/* Unlimited Dailies - Tango-style sun/moon grid UI */
(function () {
  'use strict';
  var T = window.TangoCore;
  var root = document.getElementById('tgame');
  if (!T || !root) return;

  var boardEl = root.querySelector('.tboard');
  var msgEl = root.querySelector('.game-msg');
  var timerEl = root.querySelector('[data-timer]');
  var titleEl = root.querySelector('[data-puzzle-title]');
  var modal = document.getElementById('win-modal');
  var EPOCH = Date.UTC(2026, 10, 25); // Tango daily #1
  var NAMES = ['', 'sun', 'moon'];

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('ud_t_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ud_t_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var state = null, tick = null;

  function dayKey(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function dailyNumber() { var d = new Date(); return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / 86400000) + 1; }
  function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function setMsg(t, kind) { msgEl.textContent = t; msgEl.className = 'game-msg' + (kind ? ' ' + kind : ''); }
  function lineName(L, n) { return L < n ? 'row ' + (L + 1) : 'column ' + (L - n + 1); }

  function load(level, id) {
    var today = dailyNumber();
    if (level === 'daily' && !(id > 0 && id <= today)) id = today;
    var seed = level === 'daily' ? 700000 + id : id;
    var p = T.generate(level, seed);
    if (!p) return load(level, id + 1);
    state = { level: level, id: id, n: p.n, givens: p.givens, cons: p.cons, solution: p.solution, grid: p.givens.slice(),
      history: [], start: 0, solvedAt: 0, hints: 0 };
    if (level !== 'daily') store.set('last_' + level, id);
    root.setAttribute('data-level', level);
    root.style.setProperty('--tn', p.n);
    root.querySelectorAll('[data-level-btn]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-level-btn') === level ? 'true' : 'false'); });
    titleEl.textContent = level === 'daily' ? 'Daily Tango #' + id : T.LEVELS[level].label + ' ' + p.n + '×' + p.n + ' #' + id;
    setMsg('Tap a square: once for a sun, twice for a moon, three times to clear.');
    clearInterval(tick); timerEl.textContent = '0:00';
    boardEl.classList.remove('solved');
    if (history.replaceState) history.replaceState(null, '', location.pathname + query());
    build(); render();
  }

  function query() { return state.level === 'daily' ? '?daily=' + state.id : '?level=' + state.level + '&p=' + state.id; }

  function build() {
    var n = state.n, html = '';
    for (var i = 0; i < n * n; i++) {
      var given = state.givens[i] ? ' given' : '';
      html += '<button type="button" class="tcell' + given + '" data-i="' + i + '" aria-label="Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + '"></button>';
    }
    state.cons.forEach(function (k, idx) {
      var r = Math.floor(k.a / n), c = k.a % n, horiz = k.b - k.a === 1;
      var left = horiz ? (c + 1) / n * 100 : (c + 0.5) / n * 100, top = horiz ? (r + 0.5) / n * 100 : (r + 1) / n * 100;
      html += '<span class="tsign" data-k="' + idx + '" style="left:' + left + '%;top:' + top + '%" aria-hidden="true">' + (k.t === '=' ? '=' : '×') + '</span>';
    });
    boardEl.innerHTML = html;
    boardEl.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
  }

  function render() {
    var res = T.check(state.n, state.grid, state.cons), n2 = state.n * state.n;
    for (var i = 0; i < n2; i++) {
      var el = boardEl.children[i], v = state.grid[i];
      el.className = 'tcell' + (state.givens[i] ? ' given' : '') + (v ? ' s' + v : '') + (res.bad[i] ? ' bad' : '');
      el.setAttribute('aria-label', 'Row ' + (Math.floor(i / state.n) + 1) + ', column ' + (i % state.n + 1) + (v ? ': ' + NAMES[v] : ': empty') + (state.givens[i] ? ' (fixed)' : ''));
    }
    boardEl.querySelectorAll('.tsign').forEach(function (s) { s.classList.toggle('bad', !!res.badCons[+s.getAttribute('data-k')]); });
    return res;
  }

  function startClock() {
    if (state.start) return;
    state.start = Date.now();
    clearInterval(tick);
    tick = setInterval(function () { if (!state.solvedAt) timerEl.textContent = fmt(Date.now() - state.start); }, 500);
  }

  function setCell(i, v) {
    if (state.solvedAt || state.givens[i] || state.grid[i] === v) return;
    startClock();
    state.history.push(state.grid.slice());
    state.grid[i] = v;
    afterChange();
  }

  function afterChange() {
    var res = render();
    if (res.solved) return win();
    var left = state.grid.filter(function (v) { return !v; }).length;
    if (Object.keys(res.bad).length) setMsg('Something breaks a rule (red): three in a row, too many of one symbol in a line, or a sign that does not match.', 'warn');
    else setMsg(left ? left + ' squares left.' : 'Board full – check the red squares.');
  }

  function win() {
    state.solvedAt = Date.now();
    clearInterval(tick);
    var time = state.solvedAt - (state.start || state.solvedAt);
    timerEl.textContent = fmt(time);
    setMsg('Solved! 🎉', 'ok');
    boardEl.classList.add('solved');
    recordWin(time);
    setTimeout(function () { showWin(time); }, 500);
  }

  function recordWin(time) {
    var stats = store.get('stats', {}), s = stats[state.level] || { solved: 0, best: 0 };
    s.solved++; if (!s.best || time < s.best) s.best = time;
    stats[state.level] = s; store.set('stats', stats);
    if (state.level === 'daily' && state.id === dailyNumber()) {
      var last = store.get('daily_last', ''), today = dayKey(Date.now()), yk = dayKey(Date.now() - 86400000), st = store.get('streak', 0);
      if (last !== today) st = last === yk ? st + 1 : 1;
      store.set('streak', st); store.set('daily_last', today);
    }
    renderStats();
  }

  function renderStats() {
    var el = root.querySelector('[data-stats]'); if (!el) return;
    var stats = store.get('stats', {}), parts = [];
    ['easy', 'medium', 'hard', 'expert', 'daily'].forEach(function (k) { if (stats[k]) parts.push(T.LEVELS[k].label + ': ' + stats[k].solved + ' solved, best ' + fmt(stats[k].best)); });
    var st = store.get('streak', 0); if (st) parts.push('Daily streak: ' + st);
    el.textContent = parts.length ? parts.join(' · ') : 'Solve a puzzle to start your stats.';
  }

  function shareText(time) {
    var label = state.level === 'daily' ? 'Daily #' + state.id : T.LEVELS[state.level].label + ' ' + state.n + '×' + state.n + ' #' + state.id;
    return 'Tango Unlimited ' + label + ' solved in ' + fmt(time) + (state.hints ? ' (' + state.hints + ' hint' + (state.hints > 1 ? 's' : '') + ')' : ' – no hints') +
      '\n☀️🌙☀️🌙☀️🌙\n' + location.origin + location.pathname + query();
  }

  function nextUrl() {
    if (state.level === 'daily') return location.pathname + '?level=medium&p=' + ((store.get('last_medium', 0) || 0) + 1);
    return location.pathname + '?level=' + state.level + '&p=' + (state.id + 1);
  }

  function showWin(time) {
    if (!modal) return;
    modal.querySelector('[data-win-text]').textContent = 'Solved in ' + fmt(time) + (state.hints ? ' using ' + state.hints + ' hint' + (state.hints > 1 ? 's' : '') + '.' : ' without hints.');
    var nx = modal.querySelector('[data-next]'); nx.href = nextUrl();
    modal.hidden = false; nx.focus();
    var sb = modal.querySelector('[data-share]'); sb.textContent = 'Share result';
    sb.onclick = function () {
      var txt = shareText(time), btn = this;
      if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { btn.textContent = 'Copied!'; }, function () {});
    };
  }
  function hideWin() { if (modal) modal.hidden = true; }

  function hint() {
    if (state.solvedAt) return;
    startClock();
    state.hints++;
    for (var i = 0; i < state.grid.length; i++) {
      if (state.grid[i] && state.grid[i] !== state.solution[i]) {
        state.history.push(state.grid.slice()); state.grid[i] = 0; afterChange(); flash(i);
        setMsg('That ' + NAMES[state.solution[i] === 1 ? 2 : 1] + ' was wrong – it has been cleared.', 'warn');
        return;
      }
    }
    var r = T.logicSolve(state.n, state.grid, state.cons), st = r.steps[0];
    if (!st) return;
    state.history.push(state.grid.slice()); state.grid[st.i] = st.v; afterChange(); flash(st.i);
    if (!state.solvedAt) setMsg('Hint: look at ' + lineName(st.line, state.n) + '. With its signs and the no-three rule, this square can only be a ' + NAMES[st.v] + '.');
  }

  function flash(i) { var el = boardEl.children[i]; if (!el) return; el.classList.add('hl'); setTimeout(function () { el.classList.remove('hl'); }, 1500); }
  function undo() { if (state.solvedAt || !state.history.length) return; state.grid = state.history.pop(); afterChange(); }
  function restart() { state.grid = state.givens.slice(); state.history = []; state.solvedAt = 0; state.start = 0; state.hints = 0; boardEl.classList.remove('solved'); clearInterval(tick); timerEl.textContent = '0:00'; render(); setMsg('Board cleared.'); }

  boardEl.addEventListener('click', function (e) {
    var b = e.target.closest('.tcell'); if (!b) return;
    var i = +b.getAttribute('data-i');
    setCell(i, (state.grid[i] + 1) % 3);
  });
  boardEl.addEventListener('keydown', function (e) {
    var i = +(e.target.getAttribute('data-i')); if (isNaN(i)) return;
    var n = state.n, j = -1, k = e.key.toLowerCase();
    if (k === '1' || k === 's') { e.preventDefault(); setCell(i, 1); return; }
    if (k === '2' || k === 'm') { e.preventDefault(); setCell(i, 2); return; }
    if (k === 'backspace' || k === 'delete' || k === '0') { e.preventDefault(); setCell(i, 0); return; }
    if (e.key === 'ArrowRight' && i % n < n - 1) j = i + 1;
    if (e.key === 'ArrowLeft' && i % n > 0) j = i - 1;
    if (e.key === 'ArrowDown' && i + n < n * n) j = i + n;
    if (e.key === 'ArrowUp' && i - n >= 0) j = i - n;
    if (j >= 0) { e.preventDefault(); boardEl.children[j].focus(); }
  });

  root.querySelectorAll('[data-level-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      var lv = b.getAttribute('data-level-btn');
      load(lv, lv === 'daily' ? 0 : (store.get('last_' + lv, 0) || 0) + (state && state.level === lv ? 1 : 0) || 1);
    });
  });
  root.querySelector('[data-action="undo"]').addEventListener('click', undo);
  root.querySelector('[data-action="restart"]').addEventListener('click', restart);
  root.querySelector('[data-action="hint"]').addEventListener('click', hint);
  root.querySelector('[data-action="new"]').addEventListener('click', function () {
    hideWin();
    if (state.level === 'daily') load('medium', (store.get('last_medium', 0) || 0) + 1); else load(state.level, state.id + 1);
  });
  if (modal) {
    modal.querySelector('[data-close]').addEventListener('click', hideWin);
    modal.addEventListener('click', function (e) { if (e.target === modal) hideWin(); });
  }

  var q = new URLSearchParams(location.search);
  var lv = q.get('level'), pid = parseInt(q.get('p'), 10), dn = parseInt(q.get('daily'), 10);
  if (dn > 0) { lv = 'daily'; pid = dn; }
  else {
    if (!T.LEVELS[lv] || lv === 'daily') lv = root.getAttribute('data-default') || 'easy';
    if (!(pid > 0)) pid = (store.get('last_' + lv, 0) || 0) + 1;
    if (lv === 'daily') pid = 0;
  }
  load(lv, pid);
  renderStats();
  window.__tango = function () { return state; }; // used by our automated browser tests
})();
