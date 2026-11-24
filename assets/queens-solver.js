/* Unlimited Dailies - Queens solver page: paint the colour regions, get the queens. */
(function () {
  'use strict';
  var Q = window.QueensCore;
  var form = document.getElementById('qsolver');
  if (!form || !Q) return;
  var COLORS = ['#f4a3a3', '#a8d5f2', '#bfe3a6', '#f7d488', '#d4b8ef', '#f5b98c', '#9fe0d6', '#e9e9e9', '#f2a8d4', '#c9c59a', '#a9b8f0', '#d8e88c'];
  var grid = form.querySelector('.qboard'), pal = form.querySelector('.qpalette'), out = document.getElementById('qsolver-out');
  var sizeSel = form.querySelector('select[name=size]');
  var n = 8, cells = [], cur = 0, painting = false, sol = null, shown = 0;

  function setup(size, keep) {
    n = size; sol = null; shown = 0;
    if (!keep) cells = new Array(n * n).fill(-1);
    var h = '';
    for (var g = 0; g < n; g++) h += '<button type="button" data-c="' + g + '" style="background:' + COLORS[g] + '" aria-label="Colour ' + (g + 1) + '">' + (g + 1) + '</button>';
    h += '<button type="button" data-c="-1" aria-label="Eraser">⌫</button>';
    pal.innerHTML = h;
    if (cur >= n) cur = 0;
    var gh = '';
    for (var i = 0; i < n * n; i++) gh += '<button type="button" class="qcell" data-i="' + i + '" aria-label="Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + '"></button>';
    grid.innerHTML = gh;
    grid.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    form.style.setProperty('--qn', n);
    draw();
  }

  function draw() {
    pal.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-c') === cur ? 'true' : 'false'); });
    for (var i = 0; i < n * n; i++) {
      var el = grid.children[i], g = cells[i], r = Math.floor(i / n), c = i % n;
      el.style.background = g >= 0 ? COLORS[g] : '';
      el.className = 'qcell' + (g < 0 ? ' blank' : '') +
        ((r === 0 || cells[i - n] !== g) ? ' bt' : '') + ((r === n - 1 || cells[i + n] !== g) ? ' bb' : '') +
        ((c === 0 || cells[i - 1] !== g) ? ' bl' : '') + ((c === n - 1 || cells[i + 1] !== g) ? ' br' : '');
      var q = sol && sol.order.indexOf(r) >= 0 && sol.order.indexOf(r) < shown && sol.cols[r] === c;
      el.textContent = q ? '♛' : '';
      el.classList.toggle('queen', !!q);
    }
  }

  function paintAt(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || el.parentNode !== grid) return;
    var i = +el.getAttribute('data-i');
    if (cells[i] !== cur) { cells[i] = cur; sol = null; shown = 0; draw(); }
  }
  grid.addEventListener('pointerdown', function (e) { e.preventDefault(); painting = true; paintAt(e.clientX, e.clientY); });
  grid.addEventListener('pointermove', function (e) { if (painting) paintAt(e.clientX, e.clientY); });
  window.addEventListener('pointerup', function () { painting = false; });
  grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var i = +e.target.getAttribute('data-i'); if (isNaN(i)) return;
    e.preventDefault(); cells[i] = cur; sol = null; shown = 0; draw();
  });
  pal.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; cur = +b.getAttribute('data-c'); draw(); });
  sizeSel.addEventListener('change', function () { setup(+sizeSel.value); out.innerHTML = ''; });

  form.querySelector('[data-example]').addEventListener('click', function () {
    var p = Q.generate('daily', 424242);
    sizeSel.value = String(p.n); setup(p.n, false);
    cells = p.regions.slice(); draw();
    out.innerHTML = '<p>Example loaded: an 8×8 board from our own generator. Press <strong>Solve</strong>.</p>';
  });
  form.querySelector('[data-clear]').addEventListener('click', function () { setup(n); out.innerHTML = ''; });

  function msg(html, cls) { out.innerHTML = '<div class="card' + (cls ? ' ' + cls : '') + '">' + html + '</div>'; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var blank = cells.filter(function (g) { return g < 0; }).length;
    if (blank) { msg('<p class="warn">' + blank + ' square' + (blank > 1 ? 's are' : ' is') + ' still uncoloured. Colour every square to match your puzzle (the board needs ' + n + ' colours).</p>'); return; }
    var used = {}, map = {}, k = 0;
    cells.forEach(function (g) { if (!(g in used)) { used[g] = true; map[g] = k++; } });
    if (k !== n) { msg('<p class="warn">A ' + n + '×' + n + ' board needs exactly ' + n + ' colour regions, but you used ' + k + '. Check the colours against your puzzle.</p>'); return; }
    var regions = cells.map(function (g) { return map[g]; });
    var res = Q.solve(n, regions, 2, Date.now() + 4000);
    if (res.timedOut) { msg('<p class="warn">This board took too long to check. Please make sure the colours match your puzzle.</p>'); return; }
    if (!res.count) { msg('<p class="warn">No solution: no way to place ' + n + ' queens with one per row, column and colour, without touching. One or more squares probably have the wrong colour.</p>'); return; }
    // reveal order: smallest region first, the way a person would usually start
    var size = {}; regions.forEach(function (g) { size[g] = (size[g] || 0) + 1; });
    var order = []; for (var r = 0; r < n; r++) order.push(r);
    order.sort(function (a, b) { return size[regions[a * n + res.sol[a]]] - size[regions[b * n + res.sol[b]]]; });
    sol = { cols: res.sol, order: order }; shown = 1; draw();
    var note = res.count > 1 ? '<p class="warn">Note: this board has more than one solution, so it may not match the official answer exactly. Double-check the colours.</p>' : '<p class="ok">Solved – this board has exactly one solution.</p>';
    out.innerHTML = '<div class="card">' + note + '<p data-step></p><button type="button" class="btn primary" data-more>Show next queen</button> <button type="button" class="btn" data-all>Show all queens</button><ol class="steps" data-list></ol></div>';
    stepText();
    out.querySelector('[data-more]').onclick = function () { if (shown < n) { shown++; draw(); stepText(); } };
    out.querySelector('[data-all]').onclick = function () { shown = n; draw(); stepText(); };
  });

  function stepText() {
    var list = out.querySelector('[data-list]'), h = '';
    for (var s = 0; s < shown; s++) { var r = sol.order[s]; h += '<li>Queen in row ' + (r + 1) + ', column ' + (sol.cols[r] + 1) + '</li>'; }
    list.innerHTML = h;
    out.querySelector('[data-step]').textContent = shown + ' of ' + n + ' queens shown on the board above.';
    if (shown >= n) { out.querySelector('[data-more]').disabled = true; out.querySelector('[data-all]').disabled = true; }
  }

  setup(8);
})();
