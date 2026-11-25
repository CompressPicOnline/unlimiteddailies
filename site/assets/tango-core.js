/* Tango-style sun/moon binary grid engine (our own generator + logic solver).
   Rules: fill every cell with a sun (1) or a moon (2). Each row and column holds the same number of suns and moons,
   no more than two of the same symbol may sit next to each other in a row or column,
   "=" between two cells means they are the same, "x" means they are opposite. */
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

  // keep: givens left after removal stops; cons: number of =/x signs
  var LEVELS = {
    easy: { n: 6, label: 'Easy', keep: 14, cons: 6 },
    medium: { n: 6, label: 'Medium', keep: 9, cons: 6 },
    hard: { n: 6, label: 'Hard', keep: 0, cons: 5 },
    expert: { n: 8, label: 'Expert', keep: 0, cons: 9 },
    daily: { n: 6, label: 'Daily', keep: 6, cons: 6 }
  };

  // All valid lines of length n (n/2 of each symbol, never three in a row). Cached per n.
  var lineCache = {};
  function lines(n) {
    if (lineCache[n]) return lineCache[n];
    var out = [];
    for (var m = 0; m < (1 << n); m++) {
      var ones = 0, ok = true, a = [];
      for (var i = 0; i < n; i++) { var v = (m >> i) & 1 ? 1 : 2; a.push(v); if (v === 1) ones++; }
      if (ones !== n / 2) continue;
      for (var j = 2; j < n && ok; j++) if (a[j] === a[j - 1] && a[j] === a[j - 2]) ok = false;
      if (ok) out.push(a);
    }
    return (lineCache[n] = out);
  }

  // Constraints: list of {a, b, t} with a<b adjacent cells, t = '=' or 'x'.
  // Line index L: 0..n-1 rows, n..2n-1 columns. Returns cell indices of the line.
  function lineCells(n, L) {
    var c = [];
    for (var k = 0; k < n; k++) c.push(L < n ? L * n + k : k * n + (L - n));
    return c;
  }

  function consByLine(n, cons) {
    var by = [];
    for (var L = 0; L < 2 * n; L++) by.push([]);
    cons.forEach(function (k) {
      if (k.b - k.a === 1) { var r = Math.floor(k.a / n); by[r].push({ p: k.a % n, t: k.t }); }
      else { var c = k.a % n; by[n + c].push({ p: Math.floor(k.a / n), t: k.t }); }
    });
    return by;
  }

  // Logic solver: repeatedly intersect all valid patterns of each line. Every deduction is forced, so a full
  // grid means the puzzle has exactly one solution and can be solved without guessing.
  // Returns {grid, steps:[{i, v, line}], complete, contradiction}.
  function logicSolve(n, givens, cons) {
    var g = givens.slice(), steps = [], by = consByLine(n, cons), all = lines(n), changed = true;
    while (changed) {
      changed = false;
      for (var L = 0; L < 2 * n; L++) {
        var cells = lineCells(n, L), cur = cells.map(function (i) { return g[i]; });
        if (cur.indexOf(0) < 0) continue;
        var cs = by[L], fit = null, cnt = 0;
        for (var p = 0; p < all.length; p++) {
          var pat = all[p], ok = true;
          for (var k = 0; k < n && ok; k++) if (cur[k] && cur[k] !== pat[k]) ok = false;
          for (var q = 0; q < cs.length && ok; q++) {
            var same = pat[cs[q].p] === pat[cs[q].p + 1];
            if ((cs[q].t === '=') !== same) ok = false;
          }
          if (!ok) continue;
          cnt++;
          if (!fit) fit = pat.slice(); else for (var z = 0; z < n; z++) if (fit[z] !== pat[z]) fit[z] = 0;
        }
        if (!cnt) return { grid: g, steps: steps, complete: false, contradiction: true };
        for (var y = 0; y < n; y++) if (!cur[y] && fit[y]) {
          g[cells[y]] = fit[y]; steps.push({ i: cells[y], v: fit[y], line: L }); changed = true;
        }
      }
    }
    return { grid: g, steps: steps, complete: g.indexOf(0) < 0, contradiction: false };
  }

  // Backtracking solution counter (used by the solver page when logic alone does not finish, and by tests).
  function countSolutions(n, givens, cons, limit, deadline) {
    limit = limit || 2;
    var count = 0, first = null, timedOut = false, steps = 0;
    function rec(g) {
      if (count >= limit || timedOut) return;
      if (deadline && (++steps & 63) === 0 && Date.now() > deadline) { timedOut = true; return; }
      var r = logicSolve(n, g, cons);
      if (r.contradiction) return;
      if (r.complete) { if (valid(n, r.grid, cons)) { count++; if (!first) first = r.grid; } return; }
      var i = r.grid.indexOf(0);
      for (var v = 1; v <= 2; v++) { var h = r.grid.slice(); h[i] = v; rec(h); }
    }
    rec(givens.slice());
    return { count: count, grid: first, timedOut: timedOut };
  }

  function valid(n, g, cons) { return check(n, g, cons).solved; }

  // Check a (partial) grid. Returns {bad: {cell:true}, badCons: {consIndex:true}, solved}.
  function check(n, g, cons) {
    var bad = {}, badCons = {}, full = g.indexOf(0) < 0;
    for (var L = 0; L < 2 * n; L++) {
      var cells = lineCells(n, L), c1 = 0, c2 = 0;
      for (var k = 0; k < n; k++) { if (g[cells[k]] === 1) c1++; if (g[cells[k]] === 2) c2++; }
      if (c1 > n / 2) cells.forEach(function (i) { if (g[i] === 1) bad[i] = true; });
      if (c2 > n / 2) cells.forEach(function (i) { if (g[i] === 2) bad[i] = true; });
      for (var j = 2; j < n; j++) {
        var a = g[cells[j - 2]], b = g[cells[j - 1]], c = g[cells[j]];
        if (a && a === b && b === c) { bad[cells[j - 2]] = bad[cells[j - 1]] = bad[cells[j]] = true; }
      }
    }
    cons.forEach(function (k, idx) {
      var a = g[k.a], b = g[k.b];
      if (a && b && ((k.t === '=') !== (a === b))) { badCons[idx] = true; bad[k.a] = bad[k.b] = true; }
    });
    return { bad: bad, badCons: badCons, solved: full && Object.keys(bad).length === 0 };
  }

  function randomSolution(n, rand) {
    var all = lines(n), rows = [];
    function colsOk(depth) {
      for (var c = 0; c < n; c++) {
        var c1 = 0, c2 = 0;
        for (var r = 0; r < depth; r++) { if (rows[r][c] === 1) c1++; else c2++; if (r >= 2 && rows[r][c] === rows[r - 1][c] && rows[r][c] === rows[r - 2][c]) return false; }
        if (c1 > n / 2 || c2 > n / 2) return false;
      }
      return true;
    }
    function rec(r) {
      if (r === n) return true;
      var order = shuffle(all.slice(), rand);
      for (var i = 0; i < order.length; i++) {
        rows[r] = order[i];
        if (colsOk(r + 1) && rec(r + 1)) return true;
      }
      return false;
    }
    rec(0);
    var g = [];
    rows.forEach(function (row) { g = g.concat(row); });
    return g;
  }

  function generate(level, seed) {
    var L = LEVELS[level] || LEVELS.medium, n = L.n, rand = rng((Math.imul(seed, 2654435761) + n * 31) >>> 0);
    for (var attempt = 0; attempt < 30; attempt++) {
      var sol = randomSolution(n, rand), edges = [];
      for (var i = 0; i < n * n; i++) {
        if (i % n < n - 1) edges.push([i, i + 1]);
        if (i + n < n * n) edges.push([i, i + n]);
      }
      shuffle(edges, rand);
      var cons = edges.slice(0, L.cons).map(function (e) { return { a: e[0], b: e[1], t: sol[e[0]] === sol[e[1]] ? '=' : 'x' }; });
      var giv = sol.slice(), order = [];
      for (var c = 0; c < n * n; c++) order.push(c);
      shuffle(order, rand);
      var filled = n * n;
      for (var o = 0; o < order.length && filled > L.keep; o++) {
        var cell = order[o], keepV = giv[cell];
        giv[cell] = 0;
        if (!logicSolve(n, giv, cons).complete) giv[cell] = keepV; else filled--;
      }
      if (L.keep && filled > L.keep + 4) continue; // too many givens left – try another layout
      if (!logicSolve(n, giv, cons).complete) continue;
      cons.sort(function (a, b) { return a.a - b.a || a.b - b.b; });
      return { n: n, givens: giv, cons: cons, solution: sol, level: level, seed: seed };
    }
    return null;
  }

  var api = { rng: rng, LEVELS: LEVELS, lines: lines, logicSolve: logicSolve, countSolutions: countSolutions, check: check, generate: generate, lineCells: lineCells };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TangoCore = api;
})(this);
