/* Zip-style numbered path engine (our own generator + solver).
   Rules: draw one path that starts at 1, passes the numbered squares in order, visits every square exactly once,
   moves only up/down/left/right, never crosses a wall, and ends on the highest number. */
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

  // k: numbers placed before the uniqueness pass; walls: walls placed up front; maxNums: reject boards that need more
  var LEVELS = {
    easy: { n: 5, label: 'Easy', k: 7, walls: 0, maxNums: 12 },
    medium: { n: 6, label: 'Medium', k: 6, walls: 0, maxNums: 12 },
    hard: { n: 7, label: 'Hard', k: 5, walls: 3, maxNums: 13 },
    expert: { n: 8, label: 'Expert', k: 6, walls: 4, maxNums: 17 },
    daily: { n: 6, label: 'Daily', k: 5, walls: 2, maxNums: 11 }
  };

  // Wall bits per cell: 1 up, 2 right, 4 down, 8 left
  var DIRS = [[-1, 0, 1, 4], [0, 1, 2, 8], [1, 0, 4, 1], [0, -1, 8, 2]];

  function wallMask(n, walls) {
    var m = new Uint8Array(n * n);
    (walls || []).forEach(function (w) {
      var a = Math.min(w.a, w.b), b = Math.max(w.a, w.b);
      if (b - a === 1) { m[a] |= 2; m[b] |= 8; } else { m[a] |= 4; m[b] |= 1; }
    });
    return m;
  }

  // Neighbour lists that respect walls
  function neighbours(n, walls) {
    var m = wallMask(n, walls), nb = [];
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n, l = [];
      for (var d = 0; d < 4; d++) {
        var rr = r + DIRS[d][0], cc = c + DIRS[d][1];
        if (rr < 0 || cc < 0 || rr >= n || cc >= n || (m[i] & DIRS[d][2])) continue;
        l.push(rr * n + cc);
      }
      nb.push(l);
    }
    return nb;
  }

  function adjacent(n, a, b) {
    var d = Math.abs(a - b);
    return (d === n) || (d === 1 && Math.floor(a / n) === Math.floor(b / n));
  }

  // Random Hamiltonian path on an n×n grid (backbite moves from a snake)
  function hamPath(n, rand) {
    var N = n * n, path = [], pos = new Int32Array(N), nb = neighbours(n, []);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) path.push(r * n + (r % 2 ? n - 1 - c : c));
    if (rand() < 0.5) path = transpose(n, path);
    for (var i = 0; i < N; i++) pos[path[i]] = i;
    var iters = N * N * 2 + 200;
    for (var t = 0; t < iters; t++) {
      if (rand() < 0.5) { path.reverse(); for (i = 0; i < N; i++) pos[path[i]] = i; }
      var tail = path[N - 1], l = nb[tail], v = l[Math.floor(rand() * l.length)];
      var j = pos[v];
      if (j === N - 2) continue;
      // reverse path[j+1 .. N-1]
      for (var a = j + 1, b = N - 1; a < b; a++, b--) { var tmp = path[a]; path[a] = path[b]; path[b] = tmp; pos[path[a]] = a; pos[path[b]] = b; }
    }
    return path;
  }
  function transpose(n, p) { return p.map(function (i) { return (i % n) * n + Math.floor(i / n); }); }

  /* Count solutions (up to limit). nums: array n*n, 0 or checkpoint number 1..K.
     Returns {count, sol, alt, aborted, nodes}. */
  function solve(n, nums, walls, limit, opts) {
    opts = opts || {};
    var N = n * n, nb = neighbours(n, walls), K = 0, start = -1, end = -1, i;
    for (i = 0; i < N; i++) if (nums[i] > K) K = nums[i];
    for (i = 0; i < N; i++) { if (nums[i] === 1) start = i; if (nums[i] === K) end = i; }
    var res = { count: 0, sol: null, alt: null, aborted: false, nodes: 0 };
    if (start < 0 || K < 2) return res;
    var seen = {}; for (i = 0; i < N; i++) if (nums[i]) { if (seen[nums[i]]) return res; seen[nums[i]] = 1; }
    for (i = 1; i <= K; i++) if (!seen[i]) return res;
    var visited = new Uint8Array(N), path = [start], stamp = new Int32Array(N), mark = 0, queue = new Int32Array(N);
    var nodeLimit = opts.nodeLimit || 2e6, deadline = opts.deadline || 0;
    visited[start] = 1;

    function ok(head, left) {
      if (left === 0) return true;
      // every empty square needs two ways in/out (the final square needs one); the empty squares must stay connected
      var first = -1, opp = 0, hc = (Math.floor(head / n) + head % n) & 1;
      for (var u = 0; u < N; u++) {
        if (visited[u]) continue;
        if (first < 0) first = u;
        if (((Math.floor(u / n) + u % n) & 1) !== hc) opp++;
        var l = nb[u], d = 0;
        for (var k = 0; k < l.length; k++) if (!visited[l[k]] || l[k] === head) d++;
        if (d < (u === end ? 1 : 2)) return false;
      }
      // the rest of the path alternates colours like a chessboard, starting with the colour opposite the head
      if (opp !== ((left + 1) >> 1)) return false;
      mark++;
      var qh = 0, qt = 0, cnt = 0, touch = false;
      queue[qt++] = first; stamp[first] = mark;
      while (qh < qt) {
        var x = queue[qh++]; cnt++;
        var lx = nb[x];
        for (k = 0; k < lx.length; k++) {
          var y = lx[k];
          if (y === head) touch = true;
          if (!visited[y] && stamp[y] !== mark) { stamp[y] = mark; queue[qt++] = y; }
        }
      }
      return cnt === left && touch;
    }

    function dfs(head, next, left) {
      if (res.count >= limit || res.aborted) return;
      if (++res.nodes > nodeLimit || (deadline && (res.nodes & 1023) === 0 && Date.now() > deadline)) { res.aborted = true; return; }
      if (left === 0) {
        if (head === end && next === K + 1) {
          res.count++;
          if (!res.sol) res.sol = path.slice(); else if (!res.alt) res.alt = path.slice();
        }
        return;
      }
      // candidate moves; a neighbour whose only other open side is the head must be entered now (forced move)
      var l = nb[head], cand = [], forced = -1;
      for (var k = 0; k < l.length; k++) {
        var v = l[k];
        if (visited[v]) continue;
        var lv = nb[v], d = 0;
        for (var q = 0; q < lv.length; q++) if (!visited[lv[q]]) d++;
        if (v !== end && d === 1) { if (forced >= 0) return; forced = v; }
        cand.push(v, d);
      }
      var order = [];
      for (k = 0; k < cand.length; k += 2) if (forced < 0 || cand[k] === forced) order.push([cand[k], cand[k + 1]]);
      order.sort(function (x, y) { return x[1] - y[1]; }); // fewest exits first
      for (k = 0; k < order.length; k++) {
        v = order[k][0];
        var nv = nums[v], nn = next;
        if (nv) { if (nv !== next) continue; nn = next + 1; }
        if (v === end && left !== 1) continue;
        visited[v] = 1; path.push(v);
        if (ok(v, left - 1)) dfs(v, nn, left - 1);
        visited[v] = 0; path.pop();
        if (res.count >= limit || res.aborted) return;
      }
    }
    dfs(start, 2, N - 1);
    return res;
  }

  function generate(level, seed) {
    var L = LEVELS[level];
    if (!L) return null;
    var n = L.n, N = n * n;
    for (var attempt = 0; attempt < 30; attempt++) {
      var rand = rng((seed * 2654435761 + attempt * 97 + 13) >>> 0);
      var path = hamPath(n, rand), pos = new Int32Array(N);
      for (var i = 0; i < N; i++) pos[path[i]] = i;
      var cps = {}; cps[0] = 1; cps[N - 1] = 1;
      // spread the first numbers along the path
      for (var k = 1; k < L.k - 1; k++) {
        var seg = (N - 1) / (L.k - 1), at = Math.round(seg * k + (rand() - 0.5) * seg * 0.6);
        if (at > 0 && at < N - 1) cps[at] = 1;
      }
      var walls = [], used = {};
      for (i = 0; i < N - 1; i++) used[Math.min(path[i], path[i + 1]) + ',' + Math.max(path[i], path[i + 1])] = 1;
      var tries = 0;
      while (walls.length < L.walls && tries++ < 200) {
        var a = Math.floor(rand() * N), dir = rand() < 0.5 ? 1 : n, b = a + dir;
        if (b >= N || (dir === 1 && b % n === 0)) continue;
        var key = a + ',' + b;
        if (used[key]) continue;
        used[key] = 1; walls.push({ a: a, b: b });
      }
      var good = false;
      for (var round = 0; round < 40; round++) {
        var nums = numbersFrom(N, path, cps);
        if (Object.keys(cps).length > L.maxNums) break;
        var r = solve(n, nums, walls, 2, { nodeLimit: 30000 });
        if (r.count === 1 && !r.aborted) { good = true; break; }
        if (r.count === 0 && !r.aborted) break; // cannot happen, safety
        var alt = r.alt;
        if (alt && L.walls && walls.length < L.walls + 3 && rand() < 0.4) {
          // wall on a step the other answer uses but ours does not
          var cand = [];
          for (i = 0; i < N - 1; i++) {
            var x = Math.min(alt[i], alt[i + 1]), y = Math.max(alt[i], alt[i + 1]);
            if (!used[x + ',' + y]) cand.push([x, y]);
          }
          if (cand.length) { var c = cand[Math.floor(rand() * cand.length)]; used[c[0] + ',' + c[1]] = 1; walls.push({ a: c[0], b: c[1] }); continue; }
        }
        var best = -1, bd = -1;
        if (alt) {
          for (i = 1; i < N - 1; i++) {
            if (cps[i]) continue;
            var ai = alt.indexOf(path[i]), d = Math.abs(ai - i) + rand();
            if (ai !== i && d > bd) { bd = d; best = i; }
          }
        }
        if (best < 0) { // search gave up: split the longest stretch without a number
          var prev = 0, gap = 0;
          for (i = 1; i < N; i++) if (cps[i]) { if (i - prev > gap) { gap = i - prev; best = prev + Math.max(1, Math.round((i - prev) / 2 + (rand() - 0.5) * (i - prev) / 3)); } prev = i; }
          if (best <= 0 || best >= N - 1 || cps[best]) { do { best = 1 + Math.floor(rand() * (N - 2)); } while (cps[best]); }
        }
        cps[best] = 1;
      }
      if (good) {
        walls.sort(function (p, q) { return p.a - q.a || p.b - q.b; });
        return { n: n, nums: nums, walls: walls, solution: path, level: level };
      }
    }
    return null;
  }

  function numbersFrom(N, path, cps) {
    var nums = new Array(N).fill(0), k = 0;
    for (var i = 0; i < N; i++) if (cps[i]) nums[path[i]] = ++k;
    return nums;
  }

  // Thick wall bars drawn over the board (positions in % of the board)
  function wallsHtml(n, walls) {
    return (walls || []).map(function (w) {
      var a = Math.min(w.a, w.b), b = Math.max(w.a, w.b), r = Math.floor(a / n), c = a % n, vert = b - a === 1;
      var st = vert ? 'left:' + ((c + 1) / n * 100) + '%;top:' + (r / n * 100) + '%;height:' + (100 / n) + '%'
                    : 'left:' + (c / n * 100) + '%;top:' + ((r + 1) / n * 100) + '%;width:' + (100 / n) + '%';
      return '<span class="zwall ' + (vert ? 'v' : 'h') + '" style="' + st + '"></span>';
    }).join('');
  }

  var api = { wallsHtml: wallsHtml, LEVELS: LEVELS, generate: generate, solve: solve, neighbours: neighbours, adjacent: adjacent, wallMask: wallMask, hamPath: hamPath, rng: rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZipCore = api;
})(typeof self !== 'undefined' ? self : this);
