/* Queens-style region puzzle engine (our own generator + solver).
   Rules: one queen in every row, every column and every coloured region; queens may not touch, not even diagonally. */
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

  var LEVELS = {
    easy: { n: 6, label: 'Easy' },
    medium: { n: 7, label: 'Medium' },
    hard: { n: 9, label: 'Hard' },
    expert: { n: 10, label: 'Expert' },
    daily: { n: 8, label: 'Daily' }
  };

  // Count solutions (stops at `limit`). regions: flat array length n*n with region ids 0..n-1.
  // Returns {count, sol} where sol[r] = column of the first solution found.
  function solve(n, regions, limit, deadline) {
    limit = limit || 2;
    var sol = new Array(n), first = null, count = 0, colUsed = 0, regUsed = 0, steps = 0, timedOut = false;
    // order rows: still row by row (adjacency check only needs the previous row)
    function rec(r) {
      if (count >= limit || timedOut) return;
      if (deadline && (++steps & 1023) === 0 && Date.now() > deadline) { timedOut = true; return; }
      if (r === n) { count++; if (!first) first = sol.slice(); return; }
      for (var c = 0; c < n; c++) {
        if (colUsed & (1 << c)) continue;
        var g = regions[r * n + c];
        if (regUsed & (1 << g)) continue;
        if (r > 0 && Math.abs(sol[r - 1] - c) <= 1) continue;
        // prune: every region not yet used must still have a free cell in rows > r
        sol[r] = c; colUsed |= 1 << c; regUsed |= 1 << g;
        if (feasible(r + 1)) rec(r + 1);
        colUsed &= ~(1 << c); regUsed &= ~(1 << g);
        if (count >= limit || timedOut) return;
      }
    }
    function feasible(r0) {
      var avail = 0;
      for (var r = r0; r < n; r++) for (var c = 0; c < n; c++) {
        if (colUsed & (1 << c)) continue;
        if (r === r0 && Math.abs(sol[r0 - 1] - c) <= 1) continue;
        avail |= 1 << regions[r * n + c];
      }
      var need = ((1 << n) - 1) & ~regUsed;
      return (avail & need) === need;
    }
    rec(0);
    return { count: count, sol: first, timedOut: timedOut };
  }

  // Random queen placement: a permutation where neighbouring rows differ by more than 1.
  function placeQueens(n, rand) {
    var sol = new Array(n), used = new Array(n).fill(false);
    function rec(r) {
      if (r === n) return true;
      var cols = [];
      for (var c = 0; c < n; c++) cols.push(c);
      shuffle(cols, rand);
      for (var i = 0; i < n; i++) {
        var c2 = cols[i];
        if (used[c2] || (r > 0 && Math.abs(sol[r - 1] - c2) <= 1)) continue;
        sol[r] = c2; used[c2] = true;
        if (rec(r + 1)) return true;
        used[c2] = false;
      }
      return false;
    }
    rec(0);
    return sol;
  }

  function shuffle(a, rand) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function neighbours(n, i) {
    var r = Math.floor(i / n), c = i % n, out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  }

  // Grow one region from each queen with a randomised flood fill.
  function growRegions(n, sol, rand) {
    var reg = new Array(n * n).fill(-1), frontier = [];
    for (var r = 0; r < n; r++) { var i = r * n + sol[r]; reg[i] = r; frontier.push(i); }
    var left = n * n - n;
    while (left > 0) {
      // pick a random filled cell that still has an empty neighbour
      var k = Math.floor(rand() * frontier.length), cell = frontier[k];
      var empt = neighbours(n, cell).filter(function (x) { return reg[x] < 0; });
      if (!empt.length) { frontier[k] = frontier[frontier.length - 1]; frontier.pop(); continue; }
      var nx = empt[Math.floor(rand() * empt.length)];
      reg[nx] = reg[cell]; frontier.push(nx); left--;
    }
    return reg;
  }

  function connectedWithout(n, reg, g, skip) {
    var cells = [];
    for (var i = 0; i < n * n; i++) if (reg[i] === g && i !== skip) cells.push(i);
    if (!cells.length) return false;
    var seen = {}, stack = [cells[0]], cnt = 0;
    seen[cells[0]] = 1;
    while (stack.length) {
      var x = stack.pop(); cnt++;
      neighbours(n, x).forEach(function (y) { if (!seen[y] && y !== skip && reg[y] === g) { seen[y] = 1; stack.push(y); } });
    }
    return cnt === cells.length;
  }

  // Generate a puzzle with exactly one solution. Returns {n, regions, solution}.
  function generate(level, seed) {
    var L = LEVELS[level] || LEVELS.medium, n = L.n, rand = rng((Math.imul(seed, 2654435761) + n) >>> 0);
    for (var attempt = 0; attempt < 60; attempt++) {
      var sol = placeQueens(n, rand), reg = growRegions(n, sol, rand), queenCell = {};
      for (var r = 0; r < n; r++) queenCell[r * n + sol[r]] = 1;
      for (var it = 0; it < 400; it++) {
        var res = solve(n, reg, 2);
        if (res.count === 1) return { n: n, regions: reg, solution: sol, level: level, seed: seed };
        // find a solution different from ours
        var alt = otherSolution(n, reg, sol);
        if (!alt) break;
        // move one of the alternative's queen cells (not one of ours) into a neighbouring region
        var cand = [];
        for (var rr = 0; rr < n; rr++) { var ci = rr * n + alt[rr]; if (!queenCell[ci]) cand.push(ci); }
        shuffle(cand, rand);
        var moved = false;
        for (var q = 0; q < cand.length && !moved; q++) {
          var cell = cand[q], g = reg[cell];
          var opts = shuffle(neighbours(n, cell).map(function (y) { return reg[y]; }).filter(function (h) { return h !== g; }), rand);
          if (!opts.length || !connectedWithout(n, reg, g, cell)) continue;
          reg[cell] = opts[0]; moved = true;
        }
        if (!moved) break;
      }
    }
    return null;
  }

  function otherSolution(n, reg, sol) {
    // enumerate up to a few solutions and return one that differs from sol
    var found = null, cur = new Array(n), colUsed = 0, regUsed = 0;
    (function rec(r) {
      if (found) return;
      if (r === n) { for (var i = 0; i < n; i++) if (cur[i] !== sol[i]) { found = cur.slice(); return; } return; }
      for (var c = 0; c < n && !found; c++) {
        if (colUsed & (1 << c)) continue;
        var g = reg[r * n + c];
        if (regUsed & (1 << g)) continue;
        if (r > 0 && Math.abs(cur[r - 1] - c) <= 1) continue;
        cur[r] = c; colUsed |= 1 << c; regUsed |= 1 << g;
        rec(r + 1);
        colUsed &= ~(1 << c); regUsed &= ~(1 << g);
      }
    })(0);
    return found;
  }

  // Check a set of queen cells against the rules. Returns {conflicts: {cellIndex:true}, solved: bool}
  function check(n, regions, queens) {
    var conflicts = {}, list = [];
    for (var i = 0; i < n * n; i++) if (queens[i]) list.push(i);
    for (var a = 0; a < list.length; a++) for (var b = a + 1; b < list.length; b++) {
      var p = list[a], q = list[b], pr = Math.floor(p / n), pc = p % n, qr = Math.floor(q / n), qc = q % n;
      if (pr === qr || pc === qc || regions[p] === regions[q] || (Math.abs(pr - qr) <= 1 && Math.abs(pc - qc) <= 1)) {
        conflicts[p] = true; conflicts[q] = true;
      }
    }
    var solved = list.length === n && Object.keys(conflicts).length === 0;
    return { conflicts: conflicts, solved: solved };
  }

  var api = { rng: rng, LEVELS: LEVELS, solve: solve, generate: generate, check: check };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QueensCore = api;
})(this);
