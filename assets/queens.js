/* Unlimited Dailies - Queens-style region puzzle UI */
(function () {
  'use strict';
  var Q = window.QueensCore;
  var root = document.getElementById('qgame');
  if (!root || !Q) return;

  var boardEl = root.querySelector('.qboard');
  var msgEl = root.querySelector('.game-msg');
  var timerEl = root.querySelector('[data-timer]');
  var titleEl = root.querySelector('[data-puzzle-title]');
  var modal = document.getElementById('win-modal');
  var COLORS = ['#f4a3a3', '#a8d5f2', '#bfe3a6', '#f7d488', '#d4b8ef', '#f5b98c', '#9fe0d6', '#e9e9e9', '#f2a8d4', '#c9c59a', '#a9b8f0', '#d8e88c'];
  var EPOCH = Date.UTC(2026, 10, 24); // Queens daily #1

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('ud_q_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ud_q_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var state = null, tick = null, drag = null;

  function dayKey(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function dailyNumber() { var d = new Date(); return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / 86400000) + 1; }
  function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function setMsg(t, kind) { msgEl.textContent = t; msgEl.className = 'game-msg' + (kind ? ' ' + kind : ''); }

  function load(level, id) {
    var today = dailyNumber();
    if (level === 'daily' && !(id > 0 && id <= today)) id = today;
    var seed = level === 'daily' ? 900000 + id : id;
    titleEl.textContent = 'Generating…';
    var p = Q.generate(level, seed);
    if (!p) { setMsg('Could not create this puzzle – trying the next one.', 'warn'); return load(level, id + 1); }
    state = { level: level, id: id, n: p.n, regions: p.regions, solution: p.solution, marks: new Array(p.n * p.n).fill(0),
      history: [], start: 0, solvedAt: 0, hints: 0 };
    if (level !== 'daily') store.set('last_' + level, id);
    root.setAttribute('data-level', level);
    root.style.setProperty('--qn', p.n);
    root.querySelectorAll('[data-level-btn]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-level-btn') === level ? 'true' : 'false'); });
    titleEl.textContent = (level === 'daily' ? 'Daily Queens #' + id : Q.LEVELS[level].label + ' ' + p.n + '×' + p.n + ' #' + id);
    setMsg('Tap once for ✕, twice for a queen. Drag to mark several ✕ at once.');
    clearInterval(tick); timerEl.textContent = '0:00';
    if (history.replaceState) history.replaceState(null, '', location.pathname + query());
    build(); render();
  }

  function query() { return state.level === 'daily' ? '?daily=' + state.id : '?level=' + state.level + '&p=' + state.id; }

  function build() {
    var n = state.n, R = state.regions, html = '';
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n, g = R[i], cls = 'qcell';
      if (r === 0 || R[i - n] !== g) cls += ' bt';
      if (r === n - 1 || R[i + n] !== g) cls += ' bb';
      if (c === 0 || R[i - 1] !== g) cls += ' bl';
      if (c === n - 1 || R[i + 1] !== g) cls += ' br';
      html += '<button type="button" class="' + cls + '" data-i="' + i + '" style="background:' + COLORS[g % COLORS.length] + '" aria-label="Row ' + (r + 1) + ', column ' + (c + 1) + '"></button>';
    }
    boardEl.innerHTML = html;
    boardEl.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
  }

  function queensMap() { var m = {}; state.marks.forEach(function (v, i) { if (v === 2) m[i] = true; }); return m; }

  function render() {
    var res = Q.check(state.n, state.regions, queensMap());
    var cells = boardEl.children;
    for (var i = 0; i < cells.length; i++) {
      var v = state.marks[i], el = cells[i];
      el.textContent = v === 2 ? '♛' : (v === 1 ? '✕' : '');
      el.classList.toggle('queen', v === 2);
      el.classList.toggle('xmark', v === 1);
      el.classList.toggle('bad', !!res.conflicts[i]);
    }
    return res;
  }

  function startClock() {
    if (state.start) return;
    state.start = Date.now();
    clearInterval(tick);
    tick = setInterval(function () { if (!state.solvedAt) timerEl.textContent = fmt(Date.now() - state.start); }, 500);
  }

  function setMark(i, v, record) {
    if (state.solvedAt || state.marks[i] === v) return false;
    if (record) state.history.push(state.marks.slice());
    state.marks[i] = v;
    return true;
  }

  // Optional helper: after placing a queen, cross out every square it rules out.
  function autoX(i) {
    var n = state.n, r = Math.floor(i / n), c = i % n, g = state.regions[i];
    for (var j = 0; j < n * n; j++) {
      if (j === i || state.marks[j]) continue;
      var rj = Math.floor(j / n), cj = j % n;
      if (rj === r || cj === c || state.regions[j] === g || (Math.abs(rj - r) <= 1 && Math.abs(cj - c) <= 1)) state.marks[j] = 1;
    }
  }
  function autoOn() { var t = root.querySelector('[data-autox]'); return !!(t && t.checked); }

  function afterChange(placed) {
    if (placed >= 0 && state.marks[placed] === 2 && autoOn()) autoX(placed);
    var res = render();
    if (res.solved) return win();
    var q = 0; state.marks.forEach(function (v) { if (v === 2) q++; });
    if (Object.keys(res.conflicts).length) setMsg('Two queens clash (red). Each row, column and colour needs exactly one, and queens cannot touch.', 'warn');
    else setMsg(q + ' of ' + state.n + ' queens placed.');
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
    ['easy', 'medium', 'hard', 'expert', 'daily'].forEach(function (k) { if (stats[k]) parts.push(Q.LEVELS[k].label + ': ' + stats[k].solved + ' solved, best ' + fmt(stats[k].best)); });
    var st = store.get('streak', 0); if (st) parts.push('Daily streak: ' + st);
    el.textContent = parts.length ? parts.join(' · ') : 'Solve a puzzle to start your stats.';
  }

  function shareText(time) {
    var label = state.level === 'daily' ? 'Daily #' + state.id : Q.LEVELS[state.level].label + ' ' + state.n + '×' + state.n + ' #' + state.id;
    var row = ''; for (var i = 0; i < state.n; i++) row += '👑';
    return 'Queens Unlimited ' + label + ' solved in ' + fmt(time) + (state.hints ? ' (' + state.hints + ' hint' + (state.hints > 1 ? 's' : '') + ')' : ' – no hints') + '\n' + row + '\n' + location.origin + location.pathname + query();
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
    var n = state.n, sol = state.solution, bad = -1, missing = -1;
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), ok = sol[r] === i % n;
      if (state.marks[i] === 2 && !ok && bad < 0) bad = i;
      if (state.marks[i] === 1 && ok && bad < 0) bad = i; // an ✕ on a queen square
    }
    startClock();
    state.hints++;
    if (bad >= 0) {
      setMark(bad, 0, true); afterChange(); flash(bad);
      setMsg('That mark was wrong – it has been cleared.', 'warn');
      return;
    }
    // reveal the queen in the smallest region that is still missing one
    var size = {}, done = {};
    state.regions.forEach(function (g, i) { size[g] = (size[g] || 0) + 1; if (state.marks[i] === 2) done[g] = true; });
    var best = -1;
    for (var rr = 0; rr < n; rr++) { var ci = rr * n + sol[rr], g = state.regions[ci]; if (!done[g] && (best < 0 || size[g] < size[state.regions[best]])) best = ci; }
    if (best < 0) return;
    setMark(best, 2, true); afterChange(); flash(best);
    if (!state.solvedAt) setMsg('Hint: a queen goes here. Its row, column, colour and the eight squares around it can be ruled out.');
  }

  function flash(i) { var el = boardEl.children[i]; if (!el) return; el.classList.add('hl'); setTimeout(function () { el.classList.remove('hl'); }, 1500); }

  function undo() { if (state.solvedAt || !state.history.length) return; state.marks = state.history.pop(); afterChange(); }
  function restart() { state.marks.fill(0); state.history = []; state.solvedAt = 0; state.start = 0; state.hints = 0; boardEl.classList.remove('solved'); clearInterval(tick); timerEl.textContent = '0:00'; render(); setMsg('Board cleared.'); }

  // Pointer: tap cycles empty → ✕ → queen → empty; dragging from a cell paints ✕ (or clears ✕) on the cells it crosses.
  function idxAt(x, y) { var el = document.elementFromPoint(x, y); return el && el.parentNode === boardEl ? +el.getAttribute('data-i') : -1; }
  boardEl.addEventListener('pointerdown', function (e) {
    var i = idxAt(e.clientX, e.clientY); if (i < 0 || state.solvedAt) return;
    e.preventDefault();
    drag = { start: i, moved: false, paint: state.marks[i] === 1 ? 0 : 1, snap: state.marks.slice() };
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var i = idxAt(e.clientX, e.clientY); if (i < 0) return;
    if (i !== drag.start || drag.moved) {
      if (!drag.moved) { drag.moved = true; state.history.push(drag.snap); startClock(); if (state.marks[drag.start] !== 2) state.marks[drag.start] = drag.paint; }
      if (state.marks[i] !== 2) state.marks[i] = drag.paint;
      render();
    }
  });
  window.addEventListener('pointerup', function () {
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.moved) { startClock(); setMark(d.start, (state.marks[d.start] + 1) % 3, true); afterChange(d.start); return; }
    afterChange();
  });
  boardEl.addEventListener('keydown', function (e) {
    var i = +(e.target.getAttribute('data-i')); if (isNaN(i)) return;
    var n = state.n, j = -1;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startClock(); setMark(i, (state.marks[i] + 1) % 3, true); afterChange(i); return; }
    if (e.key === 'q' || e.key === 'Q') { startClock(); setMark(i, state.marks[i] === 2 ? 0 : 2, true); afterChange(i); return; }
    if (e.key === 'x' || e.key === 'X') { startClock(); setMark(i, state.marks[i] === 1 ? 0 : 1, true); afterChange(); return; }
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
    hideWin(); boardEl.classList.remove('solved');
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
    if (!Q.LEVELS[lv] || lv === 'daily') lv = root.getAttribute('data-default') || 'easy';
    if (!(pid > 0)) pid = (store.get('last_' + lv, 0) || 0) + 1;
    if (lv === 'daily') pid = 0;
  }
  var ax = root.querySelector('[data-autox]');
  if (ax) { ax.checked = !!store.get('autox', false); ax.addEventListener('change', function () { store.set('autox', ax.checked); }); }
  load(lv, pid);
  renderStats();
})();
