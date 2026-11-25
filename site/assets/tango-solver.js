/* Unlimited Dailies - Tango solver page: enter suns, moons and =/× signs, get the answer step by step. */
(function () {
  'use strict';
  var T = window.TangoCore;
  var form = document.getElementById('tsolver');
  if (!T || !form) return;
  var grid = form.querySelector('.tboard'), out = document.getElementById('tsolver-out');
  var sizeSel = form.querySelector('select[name=size]');
  var NAMES = ['', 'sun', 'moon'];
  var n = 6, cells = [], signs = {}, sol = null, shown = 0;

  function key(a, b) { return a + '-' + b; }

  function setup(size) {
    n = size; cells = new Array(n * n).fill(0); signs = {}; sol = null; shown = 0;
    var h = '';
    for (var i = 0; i < n * n; i++) h += '<button type="button" class="tcell" data-i="' + i + '"></button>';
    for (var j = 0; j < n * n; j++) {
      var r = Math.floor(j / n), c = j % n;
      if (c < n - 1) h += '<button type="button" class="tedge" data-a="' + j + '" data-b="' + (j + 1) + '" style="left:' + ((c + 1) / n * 100) + '%;top:' + ((r + 0.5) / n * 100) + '%" aria-label="Sign between row ' + (r + 1) + ' column ' + (c + 1) + ' and column ' + (c + 2) + '"></button>';
      if (r < n - 1) h += '<button type="button" class="tedge" data-a="' + j + '" data-b="' + (j + n) + '" style="left:' + ((c + 0.5) / n * 100) + '%;top:' + ((r + 1) / n * 100) + '%" aria-label="Sign between column ' + (c + 1) + ' row ' + (r + 1) + ' and row ' + (r + 2) + '"></button>';
    }
    grid.innerHTML = h;
    grid.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    form.style.setProperty('--tn', n);
    draw();
  }

  function draw() {
    for (var i = 0; i < n * n; i++) {
      var el = grid.children[i], v = cells[i], rv = 0;
      if (!v && sol) { var at = sol.order.indexOf(i); if (at >= 0 && at < shown) rv = sol.grid[i]; }
      el.className = 'tcell' + (v ? ' given s' + v : '') + (rv ? ' s' + rv + ' reveal' : '');
      el.setAttribute('aria-label', 'Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + ': ' + (v ? NAMES[v] : rv ? NAMES[rv] + ' (answer)' : 'empty'));
    }
    grid.querySelectorAll('.tedge').forEach(function (b) {
      var t = signs[key(b.getAttribute('data-a'), b.getAttribute('data-b'))] || '';
      b.textContent = t === '=' ? '=' : t === 'x' ? '×' : '';
      b.classList.toggle('on', !!t);
    });
  }

  function reset() { sol = null; shown = 0; out.innerHTML = ''; }

  grid.addEventListener('click', function (e) {
    var ed = e.target.closest('.tedge');
    if (ed) {
      var k = key(ed.getAttribute('data-a'), ed.getAttribute('data-b')), t = signs[k] || '';
      signs[k] = t === '' ? '=' : t === '=' ? 'x' : '';
      if (!signs[k]) delete signs[k];
      reset(); draw(); return;
    }
    var b = e.target.closest('.tcell'); if (!b) return;
    var i = +b.getAttribute('data-i'); cells[i] = (cells[i] + 1) % 3; reset(); draw();
  });
  sizeSel.addEventListener('change', function () { setup(+sizeSel.value); out.innerHTML = ''; });
  form.querySelector('[data-clear]').addEventListener('click', function () { setup(n); out.innerHTML = ''; });
  form.querySelector('[data-example]').addEventListener('click', function () {
    var p = T.generate('medium', 424242);
    sizeSel.value = '6'; setup(6);
    cells = p.givens.slice(); p.cons.forEach(function (k) { signs[key(k.a, k.b)] = k.t; });
    draw();
    out.innerHTML = '<p>Example loaded: a 6×6 board from our own generator. Press <strong>Solve</strong>.</p>';
  });

  function msg(html) { out.innerHTML = '<div class="card">' + html + '</div>'; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var cons = Object.keys(signs).map(function (k) { var p = k.split('-'); return { a: +p[0], b: +p[1], t: signs[k] }; });
    var pre = T.check(n, cells, cons);
    if (Object.keys(pre.bad).length) { msg('<p class="warn">The board you entered already breaks a rule (three of a kind in a line, too many of one symbol, or a sign that does not match). Please check it against your puzzle.</p>'); return; }
    var lg = T.logicSolve(n, cells, cons), steps = lg.steps.slice(), full = lg.grid, note;
    if (lg.contradiction) { msg('<p class="warn">No solution: these suns, moons and signs cannot all be true. One square or sign was probably entered wrongly.</p>'); return; }
    if (lg.complete) note = '<p class="ok">Solved by pure logic – this board has exactly one solution.</p>';
    else {
      var bt = T.countSolutions(n, cells, cons, 2, Date.now() + 4000);
      if (bt.timedOut) { msg('<p class="warn">This board took too long to check. Please add the suns, moons and signs from your puzzle.</p>'); return; }
      if (!bt.count) { msg('<p class="warn">No solution: these suns, moons and signs cannot all be true. One square or sign was probably entered wrongly.</p>'); return; }
      full = bt.grid;
      for (var i = 0; i < n * n; i++) if (!lg.grid[i]) steps.push({ i: i, v: full[i], line: -1 });
      note = bt.count > 1 ? '<p class="warn">Note: with what you entered there is more than one answer, so this may differ from the official one. Check that every sign and symbol is entered.</p>'
        : '<p class="ok">Solved – this board has exactly one solution.</p>';
    }
    sol = { grid: full, order: steps.map(function (s) { return s.i; }), steps: steps };
    shown = Math.min(1, steps.length); draw();
    out.innerHTML = '<div class="card">' + note + '<p data-step></p><button type="button" class="btn primary" data-more>Show next square</button> <button type="button" class="btn" data-all>Show full answer</button><ol class="steps" data-list></ol></div>';
    stepText();
    out.querySelector('[data-more]').onclick = function () { if (shown < sol.steps.length) { shown++; draw(); stepText(); } };
    out.querySelector('[data-all]').onclick = function () { shown = sol.steps.length; draw(); stepText(); };
  });

  function stepText() {
    var h = '';
    for (var s = 0; s < shown; s++) {
      var st = sol.steps[s], r = Math.floor(st.i / n) + 1, c = st.i % n + 1;
      var why = st.line < 0 ? 'only value left that leads to a valid board' : 'forced by ' + (st.line < n ? 'row ' + (st.line + 1) : 'column ' + (st.line - n + 1)) + ' (counts, signs and no three in a row)';
      h += '<li>Row ' + r + ', column ' + c + ': <strong>' + NAMES[st.v] + '</strong> – ' + why + '</li>';
    }
    out.querySelector('[data-list]').innerHTML = h;
    out.querySelector('[data-step]').textContent = shown + ' of ' + sol.steps.length + ' empty squares shown on the board above.';
    if (shown >= sol.steps.length) { out.querySelector('[data-more]').disabled = true; out.querySelector('[data-all]').disabled = true; }
  }

  setup(6);
})();
