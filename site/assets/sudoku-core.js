/* Mini Sudoku engine (our own generator + human-style logic solver).
   Rules: fill the grid so every row, every column and every box holds each digit exactly once.
   6×6 boards use 2×3 boxes (digits 1–6); 9×9 boards use 3×3 boxes (digits 1–9). */
(function (root) {
  'use strict';

  function rng(seed) { // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, rand) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // keep: stop removing clues at this many givens (0 = remove as many as logic allows)
  var LEVELS = {
    easy: { n: 6, label: 'Easy', keep: 18 },
    medium: { n: 6, label: 'Medium', keep: 13 },
    hard: { n: 6, label: 'Hard', keep: 0 },
    expert: { n: 9, label: 'Expert', keep: 0 },
    daily: { n: 6, label: 'Daily', keep: 12 }
  };

  // Geometry: units = rows, columns, boxes (each a list of cell indices); peers per cell.
  var geoCache = {};
  function geo(n) {
    if (geoCache[n]) return geoCache[n];
    var bh = n === 6 ? 2 : n === 4 ? 2 : 3, bw = n / bh, units = [], unitOf = [], peers = [];
    for (var r = 0; r < n; r++) { var u = []; for (var c = 0; c < n; c++) u.push(r * n + c); units.push(u); }
    for (var c2 = 0; c2 < n; c2++) { var v = []; for (var r2 = 0; r2 < n; r2++) v.push(r2 * n + c2); units.push(v); }
    for (var br = 0; br < n / bh; br++) for (var bc = 0; bc < n / bw; bc++) {
      var b = [];
      for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) b.push((br * bh + y) * n + bc * bw + x);
      units.push(b);
    }
    for (var i = 0; i < n * n; i++) { unitOf.push([]); peers.push([]); }
    units.forEach(function (u, k) { u.forEach(function (i) { unitOf[i].push(k); }); });
    for (var j = 0; j < n * n; j++) {
      var s = {};
      unitOf[j].forEach(function (k) { units[k].forEach(function (p) { if (p !== j) s[p] = 1; }); });
      peers[j] = Object.keys(s).map(Number);
    }
    return (geoCache[n] = { n: n, bh: bh, bw: bw, units: units, unitOf: unitOf, peers: peers, full: (1 << (n + 1)) - 2 });
  }
  function unitName(n, k) {
    if (k < n) return 'row ' + (k + 1);
    if (k < 2 * n) return 'column ' + (k - n + 1);
    return 'box ' + (k - 2 * n + 1);
  }
  function bits(m) { var c = 0; while (m) { m &= m - 1; c++; } return c; }
  function lowDigit(m) { for (var d = 1; d < 16; d++) if (m & (1 << d)) return d; return 0; }

  function candidates(G, g, i) {
    var m = G.full;
    for (var p = 0; p < G.peers[i].length; p++) { var v = g[G.peers[i][p]]; if (v) m &= ~(1 << v); }
    return m;
  }

  // Logic solver using only naked singles and hidden singles, the way people solve mini sudoku.
  // Every step is forced, so a complete result proves the answer is unique and reachable without guessing.
  // Returns {grid, steps:[{i, v, kind:'naked'|'hidden', unit}], complete, contradiction}.
  function logicSolve(n, givens) {
    var G = geo(n), g = givens.slice(), steps = [], N = n * n;
    for (;;) {
      var found = null;
      // hidden singles first (they are the easiest to explain on a small board)
      for (var k = 0; k < G.units.length && !found; k++) {
        var u = G.units[k], have = 0;
        for (var a = 0; a < n; a++) if (g[u[a]]) have |= 1 << g[u[a]];
        for (var d = 1; d <= n && !found; d++) {
          if (have & (1 << d)) continue;
          var spot = -1, cnt = 0;
          for (var b = 0; b < n; b++) { var c = u[b]; if (!g[c] && (candidates(G, g, c) & (1 << d))) { cnt++; spot = c; } }
          if (cnt === 0) return { grid: g, steps: steps, complete: false, contradiction: true };
          if (cnt === 1) found = { i: spot, v: d, kind: 'hidden', unit: k };
        }
      }
      if (!found) {
        for (var i = 0; i < N && !found; i++) {
          if (g[i]) continue;
          var m = candidates(G, g, i);
          if (!m) return { grid: g, steps: steps, complete: false, contradiction: true };
          if (bits(m) === 1) found = { i: i, v: lowDigit(m), kind: 'naked', unit: -1 };
        }
      }
      if (!found) break;
      g[found.i] = found.v; steps.push(found);
    }
    return { grid: g, steps: steps, complete: g.indexOf(0) < 0, contradiction: false };
  }

  // Backtracking solution counter with candidate bitmasks (MRV). Optional deadline in ms since epoch.
  function countSolutions(n, givens, limit, deadline) {
    limit = limit || 2;
    var G = geo(n), N = n * n, g = givens.slice(), count = 0, first = null, timedOut = false, nodes = 0;
    // reject boards whose givens already clash
    for (var i0 = 0; i0 < N; i0++) if (g[i0]) for (var p0 = 0; p0 < G.peers[i0].length; p0++) if (g[G.peers[i0][p0]] === g[i0]) return { count: 0, grid: null, timedOut: false };
    function rec() {
      if (count >= limit || timedOut) return;
      if (deadline && (++nodes & 255) === 0 && Date.now() > deadline) { timedOut = true; return; }
      var best = -1, bm = 0, bc = 99;
      for (var i = 0; i < N; i++) {
        if (g[i]) continue;
        var m = candidates(G, g, i), c = bits(m);
        if (!c) return;
        if (c < bc) { bc = c; best = i; bm = m; if (c === 1) break; }
      }
      if (best < 0) { count++; if (!first) first = g.slice(); return; }
      for (var d = 1; d <= n; d++) if (bm & (1 << d)) { g[best] = d; rec(); g[best] = 0; if (count >= limit || timedOut) return; }
    }
    rec();
    return { count: count, grid: first, timedOut: timedOut };
  }

  // Check a (partial) grid: duplicates in any row, column or box are bad.
  function check(n, g) {
    var G = geo(n), bad = {}, full = g.indexOf(0) < 0;
    G.units.forEach(function (u) {
      var seen = {};
      u.forEach(function (i) { var v = g[i]; if (!v) return; if (seen[v] !== undefined) { bad[i] = true; bad[seen[v]] = true; } else seen[v] = i; });
    });
    return { bad: bad, solved: full && Object.keys(bad).length === 0 };
  }

  function randomSolution(n, rand) {
    var G = geo(n), N = n * n, g = new Array(N).fill(0);
    function rec(i) {
      if (i === N) return true;
      var m = candidates(G, g, i), ds = [];
      for (var d = 1; d <= n; d++) if (m & (1 << d)) ds.push(d);
      shuffle(ds, rand);
      for (var k = 0; k < ds.length; k++) { g[i] = ds[k]; if (rec(i + 1)) return true; }
      g[i] = 0; return false;
    }
    rec(0);
    return g;
  }

  function generate(level, seed) {
    var L = LEVELS[level] || LEVELS.medium, n = L.n, N = n * n, rand = rng((Math.imul(seed, 2246822519) + n * 97) >>> 0);
    for (var attempt = 0; attempt < 20; attempt++) {
      var sol = randomSolution(n, rand), giv = sol.slice(), order = [];
      for (var c = 0; c < N; c++) order.push(c);
      shuffle(order, rand);
      var filled = N;
      for (var o = 0; o < order.length && filled > L.keep; o++) {
        var cell = order[o], keepV = giv[cell];
        giv[cell] = 0;
        if (!logicSolve(n, giv).complete) giv[cell] = keepV; else filled--;
      }
      if (L.keep && filled > L.keep + 2) continue;
      if (!logicSolve(n, giv).complete) continue;
      return { n: n, givens: giv, solution: sol, level: level, seed: seed };
    }
    return null;
  }

  var api = { rng: rng, LEVELS: LEVELS, geo: geo, unitName: unitName, candidates: function (n, g, i) { return candidates(geo(n), g, i); },
    logicSolve: logicSolve, countSolutions: countSolutions, check: check, generate: generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SudokuCore = api;
})(this);
