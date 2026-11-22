/* Unlimited Dailies - merge puzzle core (generator + rules + solver). No DOM here.
   Cell values: 0 = empty, >0 = number tile, <0 = wildcard tile:
   -k = "+k" (adds k), -(100+k) = "×k" (multiplies by k). */
(function (root) {
  'use strict';

  // Seeded PRNG
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // ops = number of wildcard tiles in the puzzle
  var LEVELS = {
    easy:   { rows: 3, cols: 3, start: 7,  ops: 0, label: 'Easy' },
    medium: { rows: 4, cols: 4, start: 9,  ops: 1, label: 'Medium' },
    hard:   { rows: 5, cols: 5, start: 11, ops: 2, label: 'Hard' },
    expert: { rows: 6, cols: 6, start: 13, ops: 2, label: 'Expert' },
    daily:  { rows: 4, cols: 4, start: 10, ops: 1, label: 'Daily' }
  };

  function isOp(v) { return v < 0; }
  function opMul(v) { return v <= -100; }
  function opK(v) { return opMul(v) ? -v - 100 : -v; }
  function mkAdd(k) { return -k; }
  function mkMul(k) { return -(100 + k); }
  function opLabel(v) { return (opMul(v) ? '×' : '+') + opK(v); }
  function applyOp(op, n) { return opMul(op) ? n * opK(op) : n + opK(op); }
  // Parse user text: "8", "x2", "×2", "*2", "+3". Returns value code, 0 for blank, NaN for invalid.
  function parseCell(t) {
    t = String(t || '').trim().toLowerCase().replace(/\s+/g, '');
    if (t === '') return 0;
    var m = /^([x×*+])(\d{1,2})$/.exec(t);
    if (m) { var k = +m[2]; if (k < 1) return NaN; return m[1] === '+' ? mkAdd(k) : mkMul(k); }
    if (/^\d{1,6}$/.test(t)) return +t;
    return NaN;
  }
  function label(v) { return v < 0 ? opLabel(v) : String(v); }

  function neighbors(i, rows, cols) {
    var r = Math.floor(i / cols), c = i % cols, out = [];
    if (r > 0) out.push(i - cols);
    if (r < rows - 1) out.push(i + cols);
    if (c > 0) out.push(i - 1);
    if (c < cols - 1) out.push(i + 1);
    return out;
  }

  // Merge rules: two identical numbers, or a wildcard with a number (either direction).
  // The result always lands on the target square; the moved tile leaves an empty spot.
  function mergeValue(a, b) {
    if (!a || !b) return 0;
    if (a > 0 && b > 0) return a === b ? a + b : 0;
    if (a < 0 && b < 0) return 0;
    return a < 0 ? applyOp(a, b) : applyOp(b, a);
  }

  // Build a puzzle by reversing merges from a single tile, so every puzzle is solvable.
  function generate(levelKey, seedStr) {
    var L = LEVELS[levelKey];
    var n = L.rows * L.cols, wantOps = L.ops || 0;
    var rnd = mulberry32(hashStr(levelKey + ':' + seedStr));
    var best = null;
    for (var attempt = 0; attempt < 600; attempt++) {
      var cells = new Array(n).fill(0);
      cells[Math.floor(rnd() * n)] = Math.pow(2, L.start);
      var filled = 1, splits = [], ops = 0;
      // spread wildcard splits through the build so they are not all in one corner of the solution
      var opAt = [];
      for (var q = 0; q < wantOps; q++) opAt.push(1 + Math.floor(rnd() * (n - 2)));
      while (filled < n) {
        var wantOpNow = ops < wantOps && opAt.indexOf(filled) !== -1 || (ops < wantOps && filled >= n - (wantOps - ops) - 1);
        var opts = [];
        for (var i = 0; i < n; i++) {
          var v = cells[i];
          if (v <= 0) continue;
          var nb = neighbors(i, L.rows, L.cols);
          for (var k = 0; k < nb.length; k++) {
            if (cells[nb[k]] !== 0) continue;
            if (wantOpNow) {
              // reverse of "wildcard + a -> v": a stays (or moves), wildcard appears next to it
              // keep wildcard numbers small and friendly, like the real puzzles
              if (v % 2 === 0 && v >= 4 && v <= 128) opts.push([i, nb[k], 2, mkMul(2), v / 2]);
              var addK = 1 + Math.floor(rnd() * 3);
              if (v - addK >= 2 && v >= 4 && v <= 32) opts.push([i, nb[k], 2, mkAdd(addK), v - addK]);
            } else if (v >= 2 && v % 2 === 0) {
              opts.push([i, nb[k], 1 + Math.log2(v), 0, v / 2]);
            }
          }
        }
        if (!opts.length) break;
        var tot = 0; for (var o = 0; o < opts.length; o++) tot += opts[o][2];
        var pick = rnd() * tot, ch = opts[0];
        for (o = 0; o < opts.length; o++) { pick -= opts[o][2]; if (pick <= 0) { ch = opts[o]; break; } }
        var at = ch[0], nbI = ch[1];
        if (ch[3]) {
          // randomly decide which tile was dragged: wildcard onto number, or number onto wildcard
          if (rnd() < 0.5) { cells[at] = ch[4]; cells[nbI] = ch[3]; }
          else { cells[at] = ch[3]; cells[nbI] = ch[4]; }
          ops++;
        } else {
          cells[at] = ch[4]; cells[nbI] = ch[4];
        }
        filled++;
        splits.push([nbI, at]); // forward move: drag nbI onto at
      }
      var score = filled * 10 + (ops === wantOps ? 5 : 0);
      if (!best || score > best.score) best = { cells: cells.slice(), filled: filled, score: score, solution: splits.slice().reverse() };
      if (filled === n && ops === wantOps) break;
    }
    return { rows: L.rows, cols: L.cols, cells: best.cells, level: levelKey, solution: best.solution };
  }

  function canMerge(cells, from, to, rows, cols) {
    if (from === to) return false;
    if (!mergeValue(cells[from], cells[to])) return false;
    return neighbors(from, rows, cols).indexOf(to) !== -1;
  }

  function applyMerge(cells, from, to) {
    var next = cells.slice();
    next[to] = mergeValue(cells[from], cells[to]); next[from] = 0;
    return next;
  }

  function listMoves(cells, rows, cols) {
    var moves = [];
    for (var i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      var nb = neighbors(i, rows, cols);
      for (var k = 0; k < nb.length; k++) if (mergeValue(cells[i], cells[nb[k]])) moves.push([i, nb[k]]);
    }
    return moves;
  }

  function tileCount(cells) { var c = 0; for (var i = 0; i < cells.length; i++) if (cells[i]) c++; return c; }
  function opCount(cells) { var c = 0; for (var i = 0; i < cells.length; i++) if (cells[i] < 0) c++; return c; }

  function isPow2(x) { return x > 0 && (x & (x - 1)) === 0; }
  function connected(cells, rows, cols) {
    var start = -1; for (var i = 0; i < cells.length; i++) if (cells[i]) { start = i; break; }
    if (start < 0) return true;
    var seen = {}, stack = [start], count = 0; seen[start] = 1;
    while (stack.length) {
      var x = stack.pop(); count++;
      var nb = neighbors(x, rows, cols);
      for (var k = 0; k < nb.length; k++) if (cells[nb[k]] && !seen[nb[k]]) { seen[nb[k]] = 1; stack.push(nb[k]); }
    }
    return count === tileCount(cells);
  }

  // Without wildcards the smallest value can never be created again, so its tiles must pair up.
  function minEven(cells) {
    var min = Infinity, cnt = 0;
    for (var i = 0; i < cells.length; i++) if (cells[i] > 0) { if (cells[i] < min) { min = cells[i]; cnt = 1; } else if (cells[i] === min) cnt++; }
    return cnt % 2 === 0;
  }
  // A wildcard needs a number to merge with; more wildcards than numbers can never finish.
  function opsOk(cells) { var o = opCount(cells); return o === 0 || tileCount(cells) - o >= o; }

  // A tile that can never change again blocks the finish: a number whose occupied neighbours are all
  // bigger numbers (they only grow), or a wildcard with no number next to it (empty spots never refill).
  function stuck(cells, rows, cols) {
    for (var i = 0; i < cells.length; i++) {
      var v = cells[i]; if (!v) continue;
      var nb = neighbors(i, rows, cols), live = false;
      for (var k = 0; k < nb.length; k++) {
        var w = cells[nb[k]]; if (!w) continue;
        if (v > 0 ? (w < 0 || w <= v) : w > 0) { live = true; break; }
      }
      if (!live) return true;
    }
    return false;
  }

  // Value-only check (ignores the grid): the smallest number can never be created again, so it must
  // pair with an equal number or take a wildcard. Memoised per solve.
  function valuesOk(cells, memo) {
    var nums = [], ops = [];
    for (var i = 0; i < cells.length; i++) { if (cells[i] > 0) nums.push(cells[i]); else if (cells[i] < 0) ops.push(cells[i]); }
    nums.sort(function (a, b) { return a - b; }); ops.sort(function (a, b) { return a - b; });
    return feas(nums, ops, memo);
  }
  function feas(nums, ops, memo) {
    if (nums.length === 1 && !ops.length) return true;
    if (!nums.length) return false;
    var key = nums.join(',') + '|' + ops.join(',');
    if (memo.has(key)) return memo.get(key);
    var m = nums[0], ok = false;
    if (nums.length > 1 && nums[1] === m) ok = feas(insert(nums.slice(2), 2 * m), ops, memo);
    for (var j = 0; !ok && j < ops.length; j++) {
      if (j && ops[j] === ops[j - 1]) continue;
      ok = feas(insert(nums.slice(1), applyOp(ops[j], m)), ops.slice(0, j).concat(ops.slice(j + 1)), memo);
    }
    memo.set(key, ok);
    return ok;
  }
  function insert(arr, v) { var i = 0; while (i < arr.length && arr[i] < v) i++; arr.splice(i, 0, v); return arr; }

  // Depth-first search with memo of dead positions. Returns {status, moves}.
  function solve(cells, rows, cols, timeLimitMs) {
    var deadline = Date.now() + (timeLimitMs || 1500);
    var hasOps = opCount(cells) > 0;
    if (!hasOps) {
      var total = 0; for (var i = 0; i < cells.length; i++) total += cells[i];
      if (!isPow2(total)) return { status: 'impossible', reason: 'sum' };
    }
    if (!opsOk(cells)) return { status: 'impossible', reason: 'ops' };
    var dead = new Set(), vmemo = new Map(), path = [], timedOut = false, steps = 0;
    if (hasOps && !valuesOk(cells, vmemo)) return { status: 'impossible', reason: 'values' };
    function dfs(b) {
      if (tileCount(b) === 1) return b.filter(Boolean)[0] > 0;
      if ((++steps & 255) === 0 && Date.now() > deadline) { timedOut = true; return false; }
      var key = b.join(',');
      if (dead.has(key)) return false;
      var ops = opCount(b);
      if (!connected(b, rows, cols) || (!ops && !minEven(b)) || !opsOk(b) || stuck(b, rows, cols) || (ops && !valuesOk(b, vmemo))) { dead.add(key); return false; }
      var moves = listMoves(b, rows, cols);
      // equal merges of small numbers first (usual bottleneck), wildcard merges after
      // then prefer moving a tile with few occupied neighbours (less risk of splitting the board)
      var sc = function (mv) {
        var v = (b[mv[0]] < 0 || b[mv[1]] < 0) ? Math.max(b[mv[0]], b[mv[1]]) * 8 : b[mv[0]] * 8, nb = neighbors(mv[0], rows, cols), occ = 0;
        for (var k = 0; k < nb.length; k++) if (b[nb[k]]) occ++;
        return v + occ;
      };
      moves.sort(function (a, c) { return sc(a) - sc(c); });
      for (var m = 0; m < moves.length; m++) {
        path.push(moves[m]);
        if (dfs(applyMerge(b, moves[m][0], moves[m][1]))) return true;
        path.pop();
        if (timedOut) return false;
      }
      dead.add(key);
      return false;
    }
    var ok = dfs(cells.slice());
    if (ok) return { status: 'solved', moves: path.slice() };
    return { status: timedOut ? 'timeout' : 'impossible' };
  }

  var api = {
    LEVELS: LEVELS, generate: generate, canMerge: canMerge, applyMerge: applyMerge, mergeValue: mergeValue,
    listMoves: listMoves, tileCount: tileCount, opCount: opCount, solve: solve, neighbors: neighbors, hashStr: hashStr,
    isOp: isOp, label: label, parseCell: parseCell
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MergeCore = api;
})(this);
