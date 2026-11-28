/* Patches-style rectangle puzzle engine (our own generator + exact-cover solver).
   Rules: split the whole grid into rectangles ("patches"). Every patch contains exactly one clue.
   A clue's number is the patch's area; its shape says square (equal sides), wide (wider than tall),
   tall (taller than wide) or any rectangle. A clue without a number only fixes the shape. */
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

  // maxA: biggest patch; anyP: share of clues shown as "any shape"; hideP: share of shape clues without a number
  var LEVELS = {
    easy: { n: 5, label: 'Easy', maxA: 6, anyP: 0, hideP: 0 },
    medium: { n: 6, label: 'Medium', maxA: 8, anyP: 0.45, hideP: 0 },
    hard: { n: 7, label: 'Hard', maxA: 10, anyP: 0.6, hideP: 0.2 },
    expert: { n: 8, label: 'Expert', maxA: 12, anyP: 0.65, hideP: 0.25 },
    daily: { n: 6, label: 'Daily', maxA: 8, anyP: 0.35, hideP: 0.1 }
  };
  var SHAPES = ['any', 'square', 'wide', 'tall'];

  function shapeOf(h, w) { return h === w ? 'square' : w > h ? 'wide' : 'tall'; }
  function fits(shape, h, w) { return shape === 'any' || shapeOf(h, w) === shape; }

  // clues: [{i, area (0 = not shown), shape}]. Returns per clue a list of rectangles {r, c, h, w, cells:[...]}.
  function candidates(n, clues) {
    var at = {};
    clues.forEach(function (k, idx) { at[k.i] = idx; });
    return clues.map(function (k, idx) {
      var cr = Math.floor(k.i / n), cc = k.i % n, out = [];
      for (var h = 1; h <= n; h++) for (var w = 1; w <= n; w++) {
        if (k.area && h * w !== k.area) continue;
        if (!fits(k.shape, h, w)) continue;
        for (var r = Math.max(0, cr - h + 1); r <= cr && r + h <= n; r++)
          for (var c = Math.max(0, cc - w + 1); c <= cc && c + w <= n; c++) {
            var cells = [], ok = true;
            for (var y = r; y < r + h && ok; y++) for (var x = c; x < c + w; x++) {
              var j = y * n + x;
              if (j !== k.i && at[j] !== undefined) { ok = false; break; }
              cells.push(j);
            }
            if (ok) out.push({ r: r, c: c, h: h, w: w, cells: cells });
          }
      }
      return out;
    });
  }

  // Exact-cover search. fixed: optional {clueIndex: rect} already placed. Returns {count, sol:[rect per clue], timedOut}.
  function solve(n, clues, limit, deadline, fixed) {
    limit = limit || 2;
    var cand = candidates(n, clues), m = clues.length, owner = new Int16Array(n * n).fill(-1);
    var placed = new Array(m).fill(null), count = 0, first = null, sols = [], timedOut = false, nodes = 0;
    function free(rect) { for (var q = 0; q < rect.cells.length; q++) if (owner[rect.cells[q]] >= 0) return false; return true; }
    function put(idx, rect, v) { rect.cells.forEach(function (j) { owner[j] = v; }); placed[idx] = v >= 0 ? rect : null; }
    if (fixed) for (var f in fixed) { if (!free(fixed[f])) return { count: 0, sol: null, sols: [], timedOut: false }; put(+f, fixed[f], +f); }
    function rec(left) {
      if (count >= limit || timedOut) return;
      if (deadline && (++nodes & 255) === 0 && Date.now() > deadline) { timedOut = true; return; }
      if (!left) { if (owner.indexOf(-1) < 0) { count++; sols.push(placed.slice()); if (!first) first = sols[0]; } return; }
      // every empty cell must still be reachable by some open clue
      var reach = new Uint8Array(n * n), best = -1, bestList = null;
      for (var i = 0; i < m; i++) {
        if (placed[i]) continue;
        var list = [];
        for (var p = 0; p < cand[i].length; p++) if (free(cand[i][p])) { list.push(cand[i][p]); cand[i][p].cells.forEach(function (j) { reach[j] = 1; }); }
        if (!list.length) return;
        if (!bestList || list.length < bestList.length) { best = i; bestList = list; }
      }
      for (var z = 0; z < n * n; z++) if (owner[z] < 0 && !reach[z]) return;
      for (var t = 0; t < bestList.length; t++) {
        put(best, bestList[t], best);
        rec(left - 1);
        put(best, bestList[t], -1);
        if (count >= limit || timedOut) return;
      }
    }
    var open = 0; for (var o = 0; o < m; o++) if (!placed[o]) open++;
    rec(open);
    return { count: count, sol: first, sols: sols, timedOut: timedOut };
  }

  // Check a list of user patches [{r,c,h,w}]. Returns {bad:{patchIndex:true}, covered, solved, clueOf:[clueIdx or -1]}.
  function check(n, clues, patches) {
    var at = {}, bad = {}, cov = new Uint8Array(n * n), clueOf = [];
    clues.forEach(function (k, idx) { at[k.i] = idx; });
    patches.forEach(function (p, pi) {
      var found = [];
      for (var y = p.r; y < p.r + p.h; y++) for (var x = p.c; x < p.c + p.w; x++) { var j = y * n + x; cov[j]++; if (at[j] !== undefined) found.push(at[j]); }
      clueOf.push(found.length === 1 ? found[0] : -1);
      if (found.length !== 1) { bad[pi] = true; return; }
      var k = clues[found[0]];
      if ((k.area && k.area !== p.h * p.w) || !fits(k.shape, p.h, p.w)) bad[pi] = true;
    });
    var covered = 0; for (var i = 0; i < n * n; i++) if (cov[i]) covered++;
    var overlap = false; for (var q = 0; q < n * n; q++) if (cov[q] > 1) overlap = true;
    return { bad: bad, covered: covered, solved: !overlap && covered === n * n && Object.keys(bad).length === 0, clueOf: clueOf };
  }

  // Random split of the grid into rectangles of area <= maxA (few 1×1 patches).
  function partition(n, maxA, rand) {
    var owner = new Int16Array(n * n).fill(-1), rects = [];
    for (var s = 0; s < n * n; s++) {
      if (owner[s] >= 0) continue;
      var r = Math.floor(s / n), c = s % n, maxW = 0;
      while (c + maxW < n && owner[r * n + c + maxW] < 0) maxW++;
      var opts = [];
      for (var h = 1; r + h <= n; h++) for (var w = 1; w <= maxW; w++) {
        if (h * w > maxA) continue;
        var ok = true;
        for (var x = c; x < c + w && ok; x++) if (owner[(r + h - 1) * n + x] >= 0) ok = false;
        if (!ok) break;
        var wt = h * w === 1 ? 0.15 : h * w === 2 ? 0.6 : 1;
        opts.push({ h: h, w: w, wt: wt });
      }
      var tot = 0; opts.forEach(function (o) { tot += o.wt; });
      var pick = rand() * tot, ch = opts[opts.length - 1];
      for (var k = 0; k < opts.length; k++) { pick -= opts[k].wt; if (pick <= 0) { ch = opts[k]; break; } }
      var rect = { r: r, c: c, h: ch.h, w: ch.w }, id = rects.length;
      for (var y = r; y < r + ch.h; y++) for (var x2 = c; x2 < c + ch.w; x2++) owner[y * n + x2] = id;
      rects.push(rect);
    }
    return rects;
  }

  function generate(level, seed) {
    var L = LEVELS[level] || LEVELS.medium, n = L.n, rand = rng((Math.imul(seed, 2246822519) + n * 97) >>> 0);
    for (var attempt = 0; attempt < 200; attempt++) {
      var rects = partition(n, L.maxA, rand);
      var ones = rects.filter(function (q) { return q.h * q.w === 1; }).length;
      if (ones > Math.max(1, Math.floor(n / 3)) || rects.length < n - 1) continue;
      var clues = rects.map(function (q) {
        var i = (q.r + Math.floor(rand() * q.h)) * n + q.c + Math.floor(rand() * q.w), shape = shapeOf(q.h, q.w), area = q.h * q.w;
        if (rand() < L.anyP) shape = 'any';
        else if (area > 1 && rand() < L.hideP) area = 0;
        return { i: i, area: area, shape: shape };
      });
      // add back information until the answer is unique (or give up on this layout)
      var res = solve(n, clues, 2, Date.now() + 1500);
      var guard = 0;
      while (res.count > 1 && !res.timedOut && guard++ < rects.length * 2) {
        var fixedOne = false, alt = null;
        res.sols.forEach(function (sl) { if (!alt && !sl.every(function (p, idx) { var q = rects[idx]; return p.r === q.r && p.c === q.c && p.h === q.h && p.w === q.w; })) alt = sl; });
        for (var a = 0; a < clues.length && !fixedOne; a++) {
          var q = rects[a], s2 = alt[a];
          if (s2 && (s2.r !== q.r || s2.c !== q.c || s2.h !== q.h || s2.w !== q.w)) {
            if (!clues[a].area) { clues[a].area = q.h * q.w; fixedOne = true; }
            else if (clues[a].shape === 'any') { clues[a].shape = shapeOf(q.h, q.w); fixedOne = true; }
          }
        }
        if (!fixedOne) { for (var b = 0; b < clues.length && !fixedOne; b++) if (clues[b].shape === 'any' || !clues[b].area) { clues[b].area = rects[b].h * rects[b].w; clues[b].shape = shapeOf(rects[b].h, rects[b].w); fixedOne = true; } }
        if (!fixedOne) break;
        res = solve(n, clues, 2, Date.now() + 1500);
      }
      if (res.count !== 1 || res.timedOut) continue;
      // make sure the unique answer is our layout
      var same = res.sol.every(function (p, idx) { var q = rects[idx]; return p.r === q.r && p.c === q.c && p.h === q.h && p.w === q.w; });
      if (!same) continue;
      var order = clues.map(function (k, idx) { return idx; }).sort(function (x, y) { return clues[x].i - clues[y].i; });
      return { n: n, level: level, seed: seed,
        clues: order.map(function (idx) { return clues[idx]; }),
        solution: order.map(function (idx) { var q = rects[idx]; return { r: q.r, c: q.c, h: q.h, w: q.w }; }) };
    }
    return null;
  }

  var api = { rng: rng, LEVELS: LEVELS, SHAPES: SHAPES, shapeOf: shapeOf, fits: fits, candidates: candidates, solve: solve, check: check, generate: generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PatchesCore = api;
})(this);
