/* Unlimited Dailies - Mini Sudoku solver page: type the clues from your board, get the answer step by step. */
(function () {
  'use strict';
  var S = window.SudokuCore;
  var form = document.getElementById('ssolver');
  if (!S || !form) return;
  var grid = form.querySelector('.sboard'), pad = form.querySelector('.spad'), out = document.getElementById('ssolver-out');
  var sizeSel = form.querySelector('select[name=size]');
  var n = 6, cells = [], sol = null, shown = 0, sel = 0;

  function setup(size) {
    n = size; cells = new Array(n * n).fill(0); sol = null; shown = 0; sel = 0;
    var G = S.geo(n), h = '';
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n;
      var edge = (c % G.bw === G.bw - 1 && c < n - 1 ? ' br' : '') + (r % G.bh === G.bh - 1 && r < n - 1 ? ' bb' : '');
      h += '<button type="button" class="scell' + edge + '" data-i="' + i + '"></button>';
    }
    grid.innerHTML = h;
    grid.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    form.style.setProperty('--sn', n);
    var ph = '';
    for (var d = 1; d <= n; d++) ph += '<button type="button" data-d="' + d + '" aria-label="Enter ' + d + '">' + d + '</button>';
    ph += '<button type="button" data-d="0" aria-label="Erase">⌫</button>';
    pad.innerHTML = ph;
    draw();
  }

  function draw() {
    var bad = S.check(n, cells).bad;
    for (var i = 0; i < n * n; i++) {
      var el = grid.children[i], v = cells[i], rv = 0;
      if (!v && sol) { var at = sol.order.indexOf(i); if (at >= 0 && at < shown) rv = sol.grid[i]; }
      el.className = el.className.replace(/ (given|reveal|sel|bad)/g, '') + (v ? ' given' : '') + (rv ? ' reveal' : '') + (i === sel ? ' sel' : '') + (bad[i] ? ' bad' : '');
      el.textContent = v || rv || '';
      el.setAttribute('aria-label', 'Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + ': ' + (v ? v : rv ? rv + ' (answer)' : 'empty'));
    }
  }

  function reset() { sol = null; shown = 0; out.innerHTML = ''; }
  function put(d) { cells[sel] = d; reset(); if (d && sel < n * n - 1) sel++; draw(); }

  grid.addEventListener('click', function (e) { var b = e.target.closest('.scell'); if (!b) return; sel = +b.getAttribute('data-i'); draw(); });
  pad.addEventListener('click', function (e) { var b = e.target.closest('[data-d]'); if (!b) return; put(+b.getAttribute('data-d')); });
  grid.addEventListener('keydown', function (e) {
    var i = +(e.target.getAttribute('data-i')); if (isNaN(i)) return;
    sel = i; var k = e.key, j = -1;
    if (/^[1-9]$/.test(k) && +k <= n) { e.preventDefault(); put(+k); grid.children[sel].focus(); return; }
    if (k === 'Backspace' || k === 'Delete' || k === '0') { e.preventDefault(); put(0); return; }
    if (k === 'ArrowRight' && i % n < n - 1) j = i + 1;
    if (k === 'ArrowLeft' && i % n > 0) j = i - 1;
    if (k === 'ArrowDown' && i + n < n * n) j = i + n;
    if (k === 'ArrowUp' && i - n >= 0) j = i - n;
    if (j >= 0) { e.preventDefault(); sel = j; grid.children[j].focus(); draw(); }
  });
  sizeSel.addEventListener('change', function () { setup(+sizeSel.value); out.innerHTML = ''; });
  form.querySelector('[data-clear]').addEventListener('click', function () { setup(n); out.innerHTML = ''; });
  form.querySelector('[data-example]').addEventListener('click', function () {
    var p = S.generate('hard', 31415);
    sizeSel.value = '6'; setup(6);
    cells = p.givens.slice(); draw();
    out.innerHTML = '<p>Example loaded: a 6×6 board from our own generator. Press <strong>Solve</strong>.</p>';
  });

  function msg(html) { out.innerHTML = '<div class="card">' + html + '</div>'; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (Object.keys(S.check(n, cells).bad).length) { msg('<p class="warn">The same number appears twice in a row, column or box (shown in red). Please check the board against your puzzle.</p>'); return; }
    if (cells.filter(Boolean).length < (n === 6 ? 8 : 17)) { msg('<p class="warn">Please enter all the numbers your puzzle starts with – a real ' + n + '×' + n + ' puzzle has at least ' + (n === 6 ? 'eight' : '17') + ' of them.</p>'); return; }
    var lg = S.logicSolve(n, cells), steps = lg.steps.slice(), full = lg.grid, note;
    if (lg.contradiction) { msg('<p class="warn">No solution: these numbers cannot all be right. One of them was probably entered in the wrong square.</p>'); return; }
    var bt = S.countSolutions(n, cells, 2, Date.now() + 4000);
    if (bt.timedOut) { msg('<p class="warn">This board took too long to check. Please add every starting number from your puzzle.</p>'); return; }
    if (!bt.count) { msg('<p class="warn">No solution: these numbers cannot all be right. One of them was probably entered in the wrong square.</p>'); return; }
    if (!lg.complete) { full = bt.grid; for (var i = 0; i < n * n; i++) if (!lg.grid[i]) steps.push({ i: i, v: full[i], kind: 'search', unit: -1 }); }
    note = bt.count > 1 ? '<p class="warn">Note: with what you entered there is more than one answer, so this may differ from your puzzle. Check that every starting number is entered.</p>'
      : lg.complete ? '<p class="ok">Solved by pure logic – this board has exactly one solution.</p>' : '<p class="ok">Solved – this board has exactly one solution.</p>';
    sol = { grid: full, order: steps.map(function (s) { return s.i; }), steps: steps };
    shown = Math.min(1, steps.length); sel = -1; draw();
    out.innerHTML = '<div class="card">' + note + '<p data-step></p><button type="button" class="btn primary" data-more>Show next square</button> <button type="button" class="btn" data-all>Show full answer</button><ol class="steps" data-list></ol></div>';
    stepText();
    out.querySelector('[data-more]').onclick = function () { if (shown < sol.steps.length) { shown++; draw(); stepText(); } };
    out.querySelector('[data-all]').onclick = function () { shown = sol.steps.length; draw(); stepText(); };
  });

  function stepText() {
    var h = '';
    for (var s = 0; s < shown; s++) {
      var st = sol.steps[s], r = Math.floor(st.i / n) + 1, c = st.i % n + 1;
      var why = st.kind === 'hidden' ? 'the only square in ' + S.unitName(n, st.unit) + ' where ' + st.v + ' fits'
        : st.kind === 'naked' ? 'its row, column and box already hold every other number'
        : 'the only value that leads to a valid board';
      h += '<li>Row ' + r + ', column ' + c + ': <strong>' + st.v + '</strong> – ' + why + '</li>';
    }
    out.querySelector('[data-list]').innerHTML = h;
    out.querySelector('[data-step]').textContent = shown + ' of ' + sol.steps.length + ' empty squares shown on the board above.';
    if (shown >= sol.steps.length) { out.querySelector('[data-more]').disabled = true; out.querySelector('[data-all]').disabled = true; }
  }

  setup(6);
})();
