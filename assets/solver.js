/* Unlimited Dailies - Sumbreak solver page */
(function () {
  'use strict';
  var C = window.MergeCore;
  var form = document.getElementById('solver');
  if (!form || !C) return;
  var gridEl = form.querySelector('.solver-grid');
  var sizeEl = form.querySelector('[name=size]');
  var out = document.getElementById('solver-out');

  function build() {
    var parts = sizeEl.value.split('x'), rows = +parts[0], cols = +parts[1];
    var old = Array.prototype.map.call(gridEl.querySelectorAll('input'), function (i) { return i.value; });
    gridEl.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    gridEl.innerHTML = '';
    for (var i = 0; i < rows * cols; i++) {
      var inp = document.createElement('input');
      inp.type = 'text'; inp.inputMode = 'numeric'; inp.maxLength = 5;
      inp.setAttribute('aria-label', 'Row ' + (Math.floor(i / cols) + 1) + ' column ' + (i % cols + 1));
      inp.placeholder = '·';
      if (old[i]) inp.value = old[i];
      gridEl.appendChild(inp);
    }
  }
  sizeEl.addEventListener('change', build);
  build();

  form.querySelector('[data-example]').addEventListener('click', function () {
    sizeEl.value = '3x3'; build();
    var ex = [1, 1, 64, 4, 2, 32, 4, 4, 16];
    gridEl.querySelectorAll('input').forEach(function (inp, i) { inp.value = ex[i]; });
  });
  form.querySelector('[data-clear]').addEventListener('click', function () {
    gridEl.querySelectorAll('input').forEach(function (inp) { inp.value = ''; });
    out.innerHTML = '';
  });

  function cellName(i, cols) { return 'row ' + (Math.floor(i / cols) + 1) + ', col ' + (i % cols + 1); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var parts = sizeEl.value.split('x'), rows = +parts[0], cols = +parts[1];
    var cells = [], bad = false;
    gridEl.querySelectorAll('input').forEach(function (inp) {
      var t = inp.value.trim();
      var v = t === '' ? 0 : parseInt(t, 10);
      if (isNaN(v) || v < 0) bad = true;
      cells.push(v || 0);
    });
    if (bad) { out.innerHTML = '<p class="warn">Please enter whole numbers only. Leave dead/empty spots blank.</p>'; return; }
    if (C.tileCount(cells) < 2) { out.innerHTML = '<p class="warn">Enter at least two numbers.</p>'; return; }
    out.innerHTML = '<p>Solving…</p>';
    setTimeout(function () {
      var res = C.solve(cells, rows, cols, 6000);
      if (res.status !== 'solved') {
        out.innerHTML = '<p class="warn">' + (res.status === 'timeout'
          ? 'This board is taking too long to solve. Double-check the numbers you typed.'
          : 'No solution found. Check that every number is typed correctly and dead spots are blank. (All numbers must add up to a power of two.)') + '</p>';
        return;
      }
      var b = cells.slice(), html = '<h3>Solution: ' + res.moves.length + ' merges</h3><ol class="steps">';
      res.moves.forEach(function (m) {
        var v = b[m[0]];
        html += '<li>Drag <strong>' + v + '</strong> (' + cellName(m[0], cols) + ') onto <strong>' + v + '</strong> (' + cellName(m[1], cols) + ') → <strong>' + (v * 2) + '</strong></li>';
        b = C.applyMerge(b, m[0], m[1]);
      });
      html += '</ol><p class="ok">Final tile: <strong>' + b.filter(Boolean)[0] + '</strong></p>';
      out.innerHTML = html;
    }, 30);
  });
})();
