/* Unlimited Dailies - Patches solver page: enter your clues, get the answer patch by patch. */
(function () {
  'use strict';
  var P = window.PatchesCore;
  var form = document.getElementById('psolver');
  if (!P || !form) return;
  var grid = form.querySelector('.pboard'), out = document.getElementById('psolver-out'), ed = form.querySelector('.pedit');
  var sizeSel = form.querySelector('select[name=size]'), numIn = ed.querySelector('input[name=area]');
  var COLORS = ['#f6c6a8', '#b9dcf2', '#c9e7b5', '#f3d27e', '#d9c5f0', '#f5b8c8', '#a9e0d4', '#e8d6b8', '#c4cdf5', '#f0e09a', '#b8e3b0', '#f2c2e6', '#bfe2ee', '#e6c7a4'];
  var SHAPE_NAME = { any: 'any rectangle', square: 'square', wide: 'wide rectangle', tall: 'tall rectangle' };
  var VER = (document.querySelector('script[src*="patches-solver.js"]') || { src: '' }).src.split('?')[1] || '';
  var n = 6, clues = {}, sel = -1, sol = null, shown = 0, worker = null, job = 0;

  function setup(size) {
    n = size; clues = {}; sel = -1; reset();
    var h = '';
    for (var i = 0; i < n * n; i++) h += '<button type="button" class="pcell" data-i="' + i + '"></button>';
    grid.innerHTML = h + '<div class="players" aria-hidden="true"></div>';
    grid.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    form.style.setProperty('--pn', n);
    draw();
  }
  function list() { return Object.keys(clues).map(Number).sort(function (a, b) { return a - b; }).map(function (i) { return { i: i, area: clues[i].area, shape: clues[i].shape }; }); }

  function draw() {
    for (var i = 0; i < n * n; i++) {
      var el = grid.children[i], k = clues[i];
      el.innerHTML = k ? '<span class="pclue"><span class="pnum">' + (k.area || '?') + '</span><span class="pico ' + k.shape + '"></span></span>' : '';
      el.classList.toggle('sel', i === sel);
      el.setAttribute('aria-label', 'Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + (k ? ': clue ' + (k.area || 'no number') + ', ' + SHAPE_NAME[k.shape] : ': empty'));
    }
    var h = '';
    if (sol) for (var s = 0; s < shown; s++) {
      var st = sol.steps[s], p = st.rect;
      h += '<span class="patch" style="left:' + (p.c / n * 100) + '%;top:' + (p.r / n * 100) + '%;width:' + (p.w / n * 100) + '%;height:' + (p.h / n * 100) + '%;background:' + COLORS[s % COLORS.length] + '"></span>';
    }
    grid.querySelector('.players').innerHTML = h;
    ed.hidden = sel < 0;
    if (sel >= 0) {
      var k2 = clues[sel];
      ed.querySelector('[data-where]').textContent = 'Clue in row ' + (Math.floor(sel / n) + 1) + ', column ' + (sel % n + 1);
      numIn.value = k2 && k2.area ? k2.area : '';
      ed.querySelectorAll('[data-shape]').forEach(function (b) { b.setAttribute('aria-pressed', k2 && k2.shape === b.getAttribute('data-shape') ? 'true' : 'false'); });
    }
  }
  function reset() { sol = null; shown = 0; out.innerHTML = ''; }

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.pcell'); if (!b) return;
    var i = +b.getAttribute('data-i');
    if (!clues[i]) clues[i] = { area: 0, shape: 'any' };
    sel = i; reset(); draw(); numIn.focus();
  });
  numIn.addEventListener('input', function () {
    if (sel < 0) return;
    var v = parseInt(numIn.value, 10); clues[sel].area = v > 0 && v <= n * n ? v : 0; reset();
    var keep = numIn.value; draw(); numIn.value = keep;
  });
  ed.querySelectorAll('[data-shape]').forEach(function (b) {
    b.addEventListener('click', function () { if (sel < 0) return; clues[sel].shape = b.getAttribute('data-shape'); reset(); draw(); });
  });
  ed.querySelector('[data-remove]').addEventListener('click', function () { if (sel >= 0) delete clues[sel]; sel = -1; reset(); draw(); });
  ed.querySelector('[data-done]').addEventListener('click', function () { sel = -1; draw(); });
  sizeSel.addEventListener('change', function () { setup(+sizeSel.value); });
  form.querySelector('[data-clear]').addEventListener('click', function () { setup(n); });
  form.querySelector('[data-example]').addEventListener('click', function () {
    var p = P.generate('medium', 515151);
    sizeSel.value = String(p.n); setup(p.n);
    p.clues.forEach(function (k) { clues[k.i] = { area: k.area, shape: k.shape }; });
    draw();
    out.innerHTML = '<p>Example loaded: a 6×6 board from our own generator. Press <strong>Solve</strong>.</p>';
  });

  function msg(html) { out.innerHTML = '<div class="card">' + html + '</div>'; }

  // Order the answer the way a person would find it: always the clue with the fewest spots left next.
  function steps(cl, answer) {
    var cand = P.candidates(n, cl), done = [], res = [];
    function overlaps(a, b) { return a.r < b.r + b.h && b.r < a.r + a.h && a.c < b.c + b.w && b.c < a.c + a.w; }
    while (res.length < cl.length) {
      var best = -1, bestN = 1e9;
      for (var ci = 0; ci < cl.length; ci++) {
        if (done[ci]) continue;
        var cnt = cand[ci].filter(function (r) { return !res.some(function (s) { return overlaps(s.rect, r); }); }).length;
        if (cnt < bestN) { bestN = cnt; best = ci; }
      }
      done[best] = true;
      res.push({ clue: cl[best], rect: answer[best], options: bestN });
    }
    return res;
  }

  function finish(cl, r) {
    if (r.timedOut) { msg('<p class="warn">This board took too long to check. Please make sure every clue from your puzzle is entered, with its number and shape.</p>'); return; }
    if (!r.count) { msg('<p class="warn">No solution: these clues cannot all be satisfied. A number or shape was probably entered wrongly, or a clue is missing.</p>'); return; }
    var note = r.count > 1 ? '<p class="warn">Note: with what you entered there is more than one answer, so this may differ from the official one. Check that every clue, number and shape is entered.</p>'
      : '<p class="ok">Solved – this board has exactly one answer.</p>';
    sol = { steps: steps(cl, r.sol) }; shown = 1; draw();
    out.innerHTML = '<div class="card">' + note + '<p data-step></p><button type="button" class="btn primary" data-more>Show next patch</button> <button type="button" class="btn" data-all>Show full answer</button><ol class="steps" data-list></ol></div>';
    stepText();
    out.querySelector('[data-more]').onclick = function () { if (shown < sol.steps.length) { shown++; draw(); stepText(); } };
    out.querySelector('[data-all]').onclick = function () { shown = sol.steps.length; draw(); stepText(); };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    sel = -1; draw();
    var cl = list();
    if (!cl.length) { msg('<p class="warn">Tap the squares that hold a clue in your puzzle first.</p>'); return; }
    var total = 0, unknown = false;
    cl.forEach(function (k) { if (k.area) total += k.area; else unknown = true; });
    if (!unknown && total !== n * n) { msg('<p class="warn">The numbers add up to ' + total + ', but a ' + n + '×' + n + ' board has ' + n * n + ' squares. Please check the numbers against your puzzle.</p>'); return; }
    msg('<p>Solving…</p>');
    var id = ++job;
    if (window.Worker) {
      try {
        if (!worker) worker = new Worker('/assets/patches-worker.js' + (VER ? '?' + VER : ''));
        worker.onmessage = function (ev) { if (ev.data.id === id) finish(cl, ev.data.result); };
        worker.postMessage({ id: id, n: n, clues: cl, ms: 8000 });
        return;
      } catch (er) { worker = null; }
    }
    finish(cl, P.solve(n, cl, 2, Date.now() + 2500));
  });

  function stepText() {
    var h = '';
    for (var s = 0; s < shown; s++) {
      var st = sol.steps[s], k = st.clue, p = st.rect;
      h += '<li>Clue in row ' + (Math.floor(k.i / n) + 1) + ', column ' + (k.i % n + 1) + ': <strong>' + p.w + ' wide × ' + p.h + ' tall</strong>, from row ' + (p.r + 1) + ' column ' + (p.c + 1) +
        ' – ' + (st.options === 1 ? 'the only patch that still fits' : st.options + ' patches still fit; this is the one that leaves room for every other clue') + '</li>';
    }
    out.querySelector('[data-list]').innerHTML = h;
    out.querySelector('[data-step]').textContent = shown + ' of ' + sol.steps.length + ' patches shown on the board above.';
    if (shown >= sol.steps.length) { out.querySelector('[data-more]').disabled = true; out.querySelector('[data-all]').disabled = true; }
  }

  setup(6);
})();
