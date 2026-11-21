/* Unlimited Dailies - merge puzzle core (generator + rules + solver). No DOM here. */
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

  var LEVELS = {
    easy:   { rows: 3, cols: 3, start: 7,  label: 'Easy' },
    medium: { rows: 4, cols: 4, start: 9,  label: 'Medium' },
    hard:   { rows: 5, cols: 5, start: 11, label: 'Hard' },
    daily:  { rows: 4, cols: 4, start: 10, label: 'Daily' }
  };

  function neighbors(i, rows, cols) {
    var r = Math.floor(i / cols), c = i % cols, out = [];
    if (r > 0) out.push(i - cols);
    if (r < rows - 1) out.push(i + cols);
    if (c > 0) out.push(i - 1);
    if (c < cols - 1) out.push(i + 1);
    return out;
  }

  // Build a puzzle by reversing merges from a single tile, so every puzzle is solvable.
  function generate(levelKey, seedStr) {
    var L = LEVELS[levelKey];
    var n = L.rows * L.cols;
    var rnd = mulberry32(hashStr(levelKey + ':' + seedStr));
    var best = null;
    for (var attempt = 0; attempt < 400; attempt++) {
      var cells = new Array(n).fill(0);
      cells[Math.floor(rnd() * n)] = Math.pow(2, L.start);
      var filled = 1, splits = [];
      while (filled < n) {
        var opts = [];
        for (var i = 0; i < n; i++) {
          if (cells[i] >= 2) {
            var nb = neighbors(i, L.rows, L.cols);
            for (var k = 0; k < nb.length; k++) if (cells[nb[k]] === 0) {
              // weight bigger tiles a bit more so values stay varied
              var w = 1 + Math.log2(cells[i]);
              opts.push([i, nb[k], w]);
            }
          }
        }
        if (!opts.length) break;
        var tot = 0; for (var o = 0; o < opts.length; o++) tot += opts[o][2];
        var pick = rnd() * tot, ch = opts[0];
        for (o = 0; o < opts.length; o++) { pick -= opts[o][2]; if (pick <= 0) { ch = opts[o]; break; } }
        var half = cells[ch[0]] / 2;
        cells[ch[0]] = half; cells[ch[1]] = half; filled++;
        splits.push([ch[1], ch[0]]); // forward move: drag ch[1] onto ch[0]
      }
      if (!best || filled > best.filled) best = { cells: cells.slice(), filled: filled, solution: splits.slice().reverse() };
      if (filled === n) break;
    }
    return { rows: L.rows, cols: L.cols, cells: best.cells, level: levelKey, solution: best.solution };
  }

  function canMerge(cells, from, to, rows, cols) {
    if (from === to) return false;
    if (!cells[from] || !cells[to] || cells[from] !== cells[to]) return false;
    return neighbors(from, rows, cols).indexOf(to) !== -1;
  }

  function applyMerge(cells, from, to) {
    var next = cells.slice();
    next[to] = cells[to] * 2; next[from] = 0;
    return next;
  }

  function listMoves(cells, rows, cols) {
    var moves = [];
    for (var i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      var nb = neighbors(i, rows, cols);
      for (var k = 0; k < nb.length; k++) if (cells[nb[k]] === cells[i]) moves.push([i, nb[k]]);
    }
    return moves;
  }

  function tileCount(cells) { var c = 0; for (var i = 0; i < cells.length; i++) if (cells[i]) c++; return c; }

  // Quick impossibility checks: total must be a power of two, and tiles must be connected.
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

  // The smallest value can never be created again, so its tiles must pair up.
  function minEven(cells) {
    var min = Infinity, cnt = 0;
    for (var i = 0; i < cells.length; i++) if (cells[i]) { if (cells[i] < min) { min = cells[i]; cnt = 1; } else if (cells[i] === min) cnt++; }
    return cnt % 2 === 0;
  }

  // Depth-first search with memo of dead positions. Returns list of [from,to] or null.
  function solve(cells, rows, cols, timeLimitMs) {
    var deadline = Date.now() + (timeLimitMs || 1500);
    var total = 0; for (var i = 0; i < cells.length; i++) total += cells[i];
    if (!isPow2(total)) return { status: 'impossible', reason: 'sum' };
    var dead = new Set(), path = [], timedOut = false;
    function dfs(b) {
      if (tileCount(b) === 1) return true;
      if (Date.now() > deadline) { timedOut = true; return false; }
      var key = b.join(',');
      if (dead.has(key)) return false;
      if (!connected(b, rows, cols) || !minEven(b)) { dead.add(key); return false; }
      var moves = listMoves(b, rows, cols);
      // try merging small numbers first; they are the usual bottleneck
      moves.sort(function (a, c) { return b[a[0]] - b[c[0]]; });
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
    LEVELS: LEVELS, generate: generate, canMerge: canMerge, applyMerge: applyMerge,
    listMoves: listMoves, tileCount: tileCount, solve: solve, neighbors: neighbors, hashStr: hashStr
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MergeCore = api;
})(this);
