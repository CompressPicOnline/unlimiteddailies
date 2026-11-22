/* Unlimited Dailies - Sumbreak solver page */
(function () {
  'use strict';
  var C = window.MergeCore;
  var form = document.getElementById('solver');
  if (!form || !C) return;
  var gridEl = form.querySelector('.solver-grid');
  var sizeEl = form.querySelector('[name=size]');
  var out = document.getElementById('solver-out');
  var lastFocus = null, worker = null, busy = false;
  var ver = (document.currentScript && document.currentScript.src.split('?')[1]) || '';

  function dims() { var p = sizeEl.value.split('x'); return { rows: +p[0], cols: +p[1] }; }
  function inputs() { return gridEl.querySelectorAll('input'); }

  function build() {
    var d = dims(), oldD = gridEl._d;
    var old = Array.prototype.map.call(inputs(), function (i) { return i.value; });
    gridEl.style.gridTemplateColumns = 'repeat(' + d.cols + ', 1fr)';
    gridEl.innerHTML = '';
    for (var i = 0; i < d.rows * d.cols; i++) {
      var inp = document.createElement('input');
      inp.type = 'text'; inp.inputMode = 'numeric'; inp.maxLength = 5; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', 'Row ' + (Math.floor(i / d.cols) + 1) + ' column ' + (i % d.cols + 1));
      inp.placeholder = '·';
      // keep values at the same row/column when the size changes
      if (oldD) { var r = Math.floor(i / d.cols), c = i % d.cols; if (r < oldD.rows && c < oldD.cols) inp.value = old[r * oldD.cols + c] || ''; }
      gridEl.appendChild(inp);
    }
    gridEl._d = d;
  }
  sizeEl.addEventListener('change', build);
  build();

  gridEl.addEventListener('focusin', function (e) { if (e.target.tagName === 'INPUT') lastFocus = e.target; });
  gridEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    var all = Array.prototype.slice.call(inputs()), i = all.indexOf(e.target);
    if (i < all.length - 1) { e.preventDefault(); all[i + 1].focus(); }
  });
  // Wildcard buttons: fill the last selected cell (handy on phone number keyboards that have no × or +).
  var bar = form.querySelector('.op-bar');
  if (bar) bar.addEventListener('click', function (e) {
    var v = e.target.getAttribute('data-op'); if (v === null) return;
    var all = Array.prototype.slice.call(inputs());
    var t = lastFocus && all.indexOf(lastFocus) !== -1 ? lastFocus : all.filter(function (x) { return !x.value; })[0];
    if (!t) return;
    t.value = v;
    var i = all.indexOf(t); if (i < all.length - 1) all[i + 1].focus(); else t.focus();
  });

  form.querySelector('[data-example]').addEventListener('click', function () {
    sizeEl.value = '3x3'; gridEl._d = null; build();
    var ex = [1, 1, 64, 4, 2, 32, 4, 4, 16];
    inputs().forEach(function (inp, i) { inp.value = ex[i]; });
  });
  form.querySelector('[data-clear]').addEventListener('click', function () {
    inputs().forEach(function (inp) { inp.value = ''; });
    out.innerHTML = '';
  });

  function cellName(i, cols) { return 'row ' + (Math.floor(i / cols) + 1) + ', col ' + (i % cols + 1); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mini(b, cols, a, t) {
    var h = '<div class="board-mini" style="grid-template-columns:repeat(' + cols + ',auto)" aria-hidden="true">';
    for (var i = 0; i < b.length; i++) h += '<span' + (i === a || i === t ? ' class="hl"' : '') + '>' + (b[i] ? esc(C.label(b[i])) : '&nbsp;') + '</span>';
    return h + '</div>';
  }

  function show(res, cells, rows, cols) {
    busy = false;
    if (res.status !== 'solved') {
      var hasOps = C.opCount(cells) > 0;
      out.innerHTML = '<p class="warn">' + (res.status === 'timeout'
        ? 'This board is taking too long to solve. Double-check the numbers you typed (a single wrong number makes most boards impossible).'
        : 'No solution found. Check that every number and wildcard is typed in the right cell and dead spots are blank.' +
          (hasOps ? '' : ' Without wildcards, all numbers must add up to a power of two (32, 64, 128, 256…).')) + '</p>';
      return;
    }
    var b = cells.slice(), html = '<h3>Solution: ' + res.moves.length + ' merges</h3>' +
      '<p><button type="button" class="btn primary" data-next-step>Show next step</button> <button type="button" class="btn" data-all-steps>Show all steps</button></p><ol class="steps">';
    res.moves.forEach(function (m, k) {
      var a = b[m[0]], t = b[m[1]], r = C.mergeValue(a, t);
      html += '<li class="' + (k ? 'hidden' : '') + '">Drag <strong>' + esc(C.label(a)) + '</strong> (' + cellName(m[0], cols) + ') onto <strong>' + esc(C.label(t)) + '</strong> (' + cellName(m[1], cols) + ') → <strong>' + r + '</strong>' + mini(b, cols, m[0], m[1]) + '</li>';
      b = C.applyMerge(b, m[0], m[1]);
    });
    html += '</ol><p class="ok" data-final hidden>Final tile: <strong>' + b.filter(Boolean)[0] + '</strong></p>';
    out.innerHTML = html;
    var shown = 1, items = out.querySelectorAll('.steps li');
    function upd() {
      for (var i = 0; i < items.length; i++) items[i].className = i < shown ? '' : 'hidden';
      var done = shown >= items.length;
      out.querySelector('[data-final]').hidden = !done;
      out.querySelector('[data-next-step]').hidden = done;
      out.querySelector('[data-all-steps]').hidden = done;
    }
    out.querySelector('[data-next-step]').onclick = function () { shown++; upd(); };
    out.querySelector('[data-all-steps]').onclick = function () { shown = items.length; upd(); };
    upd();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var d = dims(), cells = [], bad = [];
    inputs().forEach(function (inp, i) {
      var v = C.parseCell(inp.value);
      if (isNaN(v)) bad.push(cellName(i, d.cols));
      cells.push(v || 0);
    });
    if (bad.length) { out.innerHTML = '<p class="warn">Please check ' + esc(bad.join('; ')) + '. Type whole numbers (like 8), wildcards like x2 or +3, or leave dead spots blank.</p>'; return; }
    if (C.tileCount(cells) < 2) { out.innerHTML = '<p class="warn">Enter at least two tiles.</p>'; return; }
    out.innerHTML = '<p>Solving…</p>';
    busy = true;
    if (window.Worker) {
      try {
        if (!worker) worker = new Worker('/assets/solver-worker.js' + (ver ? '?' + ver : ''));
        var timer = setTimeout(function () { worker.terminate(); worker = null; show({ status: 'timeout' }, cells, d.rows, d.cols); }, 17000);
        worker.onmessage = function (ev) { clearTimeout(timer); show(ev.data, cells, d.rows, d.cols); };
        worker.onerror = function () { clearTimeout(timer); worker = null; show(C.solve(cells, d.rows, d.cols, 3000), cells, d.rows, d.cols); };
        worker.postMessage({ cells: cells, rows: d.rows, cols: d.cols, ms: 15000 });
        return;
      } catch (err) { worker = null; }
    }
    setTimeout(function () { show(C.solve(cells, d.rows, d.cols, 3000), cells, d.rows, d.cols); }, 30);
  });
})();
