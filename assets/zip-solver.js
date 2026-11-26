/* Unlimited Dailies - Zip solver page: the user enters numbers and walls, we find the path. */
(function () {
  'use strict';
  var Z = window.ZipCore;
  var form = document.getElementById('zsolver');
  var out = document.getElementById('zsolver-out');
  if (!Z || !form) return;
  var boardEl = form.querySelector('.zboard');
  var VER = (document.currentScript && document.currentScript.src.split('?')[1]) || '';
  var n = 6, nums = [], walls = {}, mode = 'num', sol = null, shown = 0, worker = null, reqId = 0;

  function key(a, b) { return Math.min(a, b) + ',' + Math.max(a, b); }
  function wallList() { return Object.keys(walls).map(function (k) { var p = k.split(','); return { a: +p[0], b: +p[1] }; }); }

  function reset(size) {
    n = size; nums = new Array(n * n).fill(0); walls = {}; sol = null; shown = 0; out.innerHTML = '';
    build();
  }

  function build() {
    var html = '';
    for (var i = 0; i < n * n; i++) {
      html += '<button type="button" class="zcell" data-i="' + i + '" aria-label="Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + (nums[i] ? ', number ' + nums[i] : '') + '">' + (nums[i] ? '<span class="znum">' + nums[i] + '</span>' : '') + '</button>';
    }
    html += '<svg class="zpath" viewBox="0 0 ' + n + ' ' + n + '" aria-hidden="true"><polyline points="" /></svg>';
    html += Z.wallsHtml(n, wallList());
    if (mode === 'wall') {
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        var a = r * n + c;
        if (c < n - 1) html += '<button type="button" class="zedge" data-a="' + a + '" data-b="' + (a + 1) + '" style="left:' + ((c + 1) / n * 100) + '%;top:' + ((r + 0.5) / n * 100) + '%" aria-label="Wall between row ' + (r + 1) + ' columns ' + (c + 1) + ' and ' + (c + 2) + '"></button>';
        if (r < n - 1) html += '<button type="button" class="zedge" data-a="' + a + '" data-b="' + (a + n) + '" style="left:' + ((c + 0.5) / n * 100) + '%;top:' + ((r + 1) / n * 100) + '%" aria-label="Wall between column ' + (c + 1) + ' rows ' + (r + 1) + ' and ' + (r + 2) + '"></button>';
      }
    }
    boardEl.innerHTML = html;
    boardEl.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    form.style.setProperty('--zn', n);
    drawPath();
  }

  function drawPath() {
    var p = sol ? sol.slice(0, shown) : [];
    boardEl.querySelector('polyline').setAttribute('points', p.map(function (c) { return (c % n + 0.5) + ',' + (Math.floor(c / n) + 0.5); }).join(' '));
    var on = {}; p.forEach(function (c) { on[c] = 1; });
    for (var i = 0; i < n * n; i++) boardEl.children[i].classList.toggle('on', !!on[i]);
  }

  boardEl.addEventListener('click', function (e) {
    var ed = e.target.closest('.zedge');
    if (ed) { var k = key(+ed.getAttribute('data-a'), +ed.getAttribute('data-b')); if (walls[k]) delete walls[k]; else walls[k] = 1; changed(); return; }
    var cell = e.target.closest('.zcell'); if (!cell || mode !== 'num') return;
    var i = +cell.getAttribute('data-i');
    if (nums[i]) nums[i] = 0;
    else { var used = {}; nums.forEach(function (v) { if (v) used[v] = 1; }); var v = 1; while (used[v]) v++; nums[i] = v; }
    changed();
  });
  function changed() { sol = null; shown = 0; out.innerHTML = ''; build(); }

  form.querySelectorAll('[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.getAttribute('data-mode');
      form.querySelectorAll('[data-mode]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      form.classList.toggle('walls', mode === 'wall');
      build();
    });
  });
  form.querySelector('select').addEventListener('change', function () { reset(+this.value); });
  form.querySelector('[data-clear]').addEventListener('click', function () { reset(n); });
  form.querySelector('[data-example]').addEventListener('click', function () {
    var p = Z.generate('daily', 4242);
    form.querySelector('select').value = String(p.n);
    reset(p.n); nums = p.nums.slice(); p.walls.forEach(function (w) { walls[key(w.a, w.b)] = 1; }); build();
  });

  function runSolve(cb) {
    var id = ++reqId, payload = { type: 'solve', id: id, n: n, nums: nums, walls: wallList(), ms: 10000 };
    if (window.Worker) {
      try {
        if (!worker) worker = new Worker('/assets/zip-worker.js' + (VER ? '?' + VER : ''));
        worker.onmessage = function (e) { if (e.data.id === reqId) cb(e.data.result); };
        worker.postMessage(payload);
        return;
      } catch (err) { worker = null; }
    }
    setTimeout(function () { cb(Z.solve(n, nums, payload.walls, 2, { deadline: Date.now() + 3000, nodeLimit: 5e8 })); }, 30);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var K = Math.max.apply(null, nums);
    if (K < 2) { out.innerHTML = '<p class="warn">Enter at least the numbers 1 and 2 (in an official board: every number shown).</p>'; return; }
    out.innerHTML = '<p>Solving…</p>';
    runSolve(function (r) {
      if (!r.count) {
        out.innerHTML = r.aborted ? '<p class="warn">This board is taking too long. Check that every number and wall is entered – boards with very few numbers can have a huge number of paths.</p>'
          : '<p class="warn">No path exists for this board. Check the numbers (1, 2, 3 … with none missing) and the walls.</p>';
        return;
      }
      sol = r.sol; shown = Math.min(5, sol.length);
      var note = r.count > 1 ? '<p class="warn">This board has more than one answer – a number or wall is probably missing. One possible path is shown.</p>'
        : (r.aborted ? '<p>Found a path (the check for a second answer was stopped early).</p>' : '<p class="ok">Solved – this board has exactly one answer.</p>');
      out.innerHTML = note + '<p data-count></p><button type="button" class="btn primary" data-more>Show next 5 squares</button> <button type="button" class="btn" data-all>Show full answer</button>';
      update();
      out.querySelector('[data-more]').addEventListener('click', function () { shown = Math.min(sol.length, shown + 5); update(); });
      out.querySelector('[data-all]').addEventListener('click', function () { shown = sol.length; update(); });
    });
  });
  function update() {
    drawPath();
    var c = out.querySelector('[data-count]');
    if (c) c.textContent = 'Showing ' + shown + ' of ' + sol.length + ' squares of the path.' + (shown === sol.length ? ' That is the full answer.' : '');
  }

  reset(6);
})();
