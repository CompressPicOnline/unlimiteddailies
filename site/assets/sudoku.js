/* Unlimited Dailies - Mini Sudoku UI */
(function () {
  'use strict';
  var S = window.SudokuCore;
  var root = document.getElementById('sgame');
  if (!S || !root) return;

  var boardEl = root.querySelector('.sboard');
  var padEl = root.querySelector('.spad');
  var msgEl = root.querySelector('.game-msg');
  var timerEl = root.querySelector('[data-timer]');
  var titleEl = root.querySelector('[data-puzzle-title]');
  var notesBtn = root.querySelector('[data-action="notes"]');
  var modal = document.getElementById('win-modal');
  var EPOCH = Date.UTC(2026, 10, 27); // Mini Sudoku daily #1

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('ud_s_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ud_s_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var state = null, tick = null, notesMode = false;

  function dayKey(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function dailyNumber() { var d = new Date(); return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / 86400000) + 1; }
  function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function setMsg(t, kind) { msgEl.textContent = t; msgEl.className = 'game-msg' + (kind ? ' ' + kind : ''); }
  function rc(i) { return 'row ' + (Math.floor(i / state.n) + 1) + ', column ' + (i % state.n + 1); }

  function load(level, id) {
    var today = dailyNumber();
    if (level === 'daily' && !(id > 0 && id <= today)) id = today;
    var seed = level === 'daily' ? 900000 + id : id;
    var p = S.generate(level, seed);
    if (!p) return load(level, id + 1);
    state = { level: level, id: id, n: p.n, givens: p.givens, solution: p.solution, grid: p.givens.slice(),
      notes: new Array(p.n * p.n).fill(0), history: [], start: 0, solvedAt: 0, hints: 0, sel: -1 };
    if (level !== 'daily') store.set('last_' + level, id);
    root.setAttribute('data-level', level);
    root.style.setProperty('--sn', p.n);
    root.querySelectorAll('[data-level-btn]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-level-btn') === level ? 'true' : 'false'); });
    titleEl.textContent = level === 'daily' ? 'Daily Mini Sudoku #' + id : S.LEVELS[level].label + ' ' + p.n + '×' + p.n + ' #' + id;
    setMsg('Tap a square, then a number. Each row, column and box needs 1–' + p.n + ' once.');
    clearInterval(tick); timerEl.textContent = '0:00';
    boardEl.classList.remove('solved');
    if (history.replaceState) history.replaceState(null, '', location.pathname + query());
    build(); render();
  }

  function query() { return state.level === 'daily' ? '?daily=' + state.id : '?level=' + state.level + '&p=' + state.id; }

  function build() {
    var n = state.n, G = S.geo(n), html = '';
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n;
      var edge = (c % G.bw === G.bw - 1 && c < n - 1 ? ' br' : '') + (r % G.bh === G.bh - 1 && r < n - 1 ? ' bb' : '');
      html += '<button type="button" class="scell' + edge + '" data-i="' + i + '"></button>';
    }
    boardEl.innerHTML = html;
    boardEl.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    var ph = '';
    for (var d = 1; d <= n; d++) ph += '<button type="button" data-d="' + d + '" aria-label="Enter ' + d + '">' + d + '</button>';
    ph += '<button type="button" data-d="0" aria-label="Erase">⌫</button>';
    padEl.innerHTML = ph;
  }

  function noteHtml(m, n) {
    var h = '<span class="snotes">';
    for (var d = 1; d <= n; d++) h += '<i>' + (m & (1 << d) ? d : '') + '</i>';
    return h + '</span>';
  }

  function render() {
    var n = state.n, res = S.check(n, state.grid), G = S.geo(n), sel = state.sel, selV = sel >= 0 ? state.grid[sel] : 0;
    var peers = {};
    if (sel >= 0) G.peers[sel].forEach(function (p) { peers[p] = 1; });
    for (var i = 0; i < n * n; i++) {
      var el = boardEl.children[i], v = state.grid[i], cls = el.className.replace(/ (given|bad|sel|peer|same|hasnotes)/g, '');
      cls += (state.givens[i] ? ' given' : '') + (res.bad[i] ? ' bad' : '') + (i === sel ? ' sel' : '') + (peers[i] ? ' peer' : '') + (selV && v === selV && i !== sel ? ' same' : '');
      if (v) el.textContent = v; else if (state.notes[i]) { el.innerHTML = noteHtml(state.notes[i], n); cls += ' hasnotes'; } else el.textContent = '';
      el.className = cls;
      el.setAttribute('aria-label', 'Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + (v ? ': ' + v : ': empty') + (state.givens[i] ? ' (fixed)' : ''));
    }
    // dim pad digits that are already complete
    var cnt = {};
    state.grid.forEach(function (v) { if (v) cnt[v] = (cnt[v] || 0) + 1; });
    padEl.querySelectorAll('[data-d]').forEach(function (b) { var d = +b.getAttribute('data-d'); b.classList.toggle('done', d > 0 && cnt[d] === n); });
    return res;
  }

  function startClock() {
    if (state.start) return;
    state.start = Date.now();
    clearInterval(tick);
    tick = setInterval(function () { if (!state.solvedAt) timerEl.textContent = fmt(Date.now() - state.start); }, 500);
  }

  function snapshot() { return { g: state.grid.slice(), nt: state.notes.slice() }; }

  function enter(d) {
    var i = state.sel;
    if (state.solvedAt) return;
    if (i < 0) { setMsg('Tap a square first, then a number.'); return; }
    if (state.givens[i]) { setMsg('That square is part of the puzzle and cannot be changed.'); return; }
    startClock();
    if (notesMode && d > 0) {
      if (state.grid[i]) return;
      state.history.push(snapshot());
      state.notes[i] ^= 1 << d;
      render(); return;
    }
    if (state.grid[i] === d && !state.notes[i]) return;
    state.history.push(snapshot());
    state.grid[i] = d; state.notes[i] = 0;
    if (d) S.geo(state.n).peers[i].forEach(function (p) { state.notes[p] &= ~(1 << d); }); // auto-clear notes of that digit in peers
    afterChange();
  }

  function afterChange() {
    var res = render();
    if (res.solved) return win();
    var left = state.grid.filter(function (v) { return !v; }).length;
    if (Object.keys(res.bad).length) setMsg('A number appears twice in a row, column or box (red).', 'warn');
    else setMsg(left ? left + ' squares left.' : 'Board full – check the red squares.');
  }

  function win() {
    state.solvedAt = Date.now();
    clearInterval(tick);
    var time = state.solvedAt - (state.start || state.solvedAt);
    timerEl.textContent = fmt(time);
    state.sel = -1; render();
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
    ['easy', 'medium', 'hard', 'expert', 'daily'].forEach(function (k) { if (stats[k]) parts.push(S.LEVELS[k].label + ': ' + stats[k].solved + ' solved, best ' + fmt(stats[k].best)); });
    var st = store.get('streak', 0); if (st) parts.push('Daily streak: ' + st);
    el.textContent = parts.length ? parts.join(' · ') : 'Solve a puzzle to start your stats.';
  }

  function shareText(time) {
    var label = state.level === 'daily' ? 'Daily #' + state.id : S.LEVELS[state.level].label + ' ' + state.n + '×' + state.n + ' #' + state.id;
    var blocks = state.n === 9 ? '🟦🟦🟦🟩🟩🟩🟦🟦🟦' : '🟦🟦🟦🟩🟩🟩';
    return 'Mini Sudoku Unlimited ' + label + ' solved in ' + fmt(time) + (state.hints ? ' (' + state.hints + ' hint' + (state.hints > 1 ? 's' : '') + ')' : ' – no hints') +
      '\n' + blocks + '\n' + location.origin + location.pathname + query();
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
        state.history.push(snapshot()); state.grid[i] = 0; state.sel = i; afterChange(); flash(i);
        setMsg('Your number at ' + rc(i) + ' was wrong – it has been cleared.', 'warn');
        return;
      }
    }
    var r = S.logicSolve(state.n, state.grid), st = r.steps[0];
    if (!st) return;
    state.history.push(snapshot()); state.grid[st.i] = st.v; state.notes[st.i] = 0; state.sel = st.i; afterChange(); flash(st.i);
    if (state.solvedAt) return;
    if (st.kind === 'hidden') setMsg('Hint: in ' + S.unitName(state.n, st.unit) + ', the ' + st.v + ' can only go at ' + rc(st.i) + ' – every other empty square there already sees a ' + st.v + '.');
    else setMsg('Hint: ' + rc(st.i) + ' can only be ' + st.v + ' – its row, column and box already hold every other number.');
  }

  function flash(i) { var el = boardEl.children[i]; if (!el) return; el.classList.add('hl'); setTimeout(function () { el.classList.remove('hl'); }, 1500); }
  function undo() { if (state.solvedAt || !state.history.length) return; var h = state.history.pop(); state.grid = h.g; state.notes = h.nt; afterChange(); }
  function restart() { state.grid = state.givens.slice(); state.notes = new Array(state.n * state.n).fill(0); state.history = []; state.solvedAt = 0; state.start = 0; state.hints = 0; state.sel = -1; boardEl.classList.remove('solved'); clearInterval(tick); timerEl.textContent = '0:00'; render(); setMsg('Board cleared.'); }
  function select(i) { state.sel = i; render(); }

  boardEl.addEventListener('click', function (e) {
    var b = e.target.closest('.scell'); if (!b || state.solvedAt) return;
    select(+b.getAttribute('data-i'));
  });
  padEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-d]'); if (!b) return;
    enter(+b.getAttribute('data-d'));
    if (state.sel >= 0 && boardEl.children[state.sel]) boardEl.children[state.sel].focus({ preventScroll: true });
  });
  boardEl.addEventListener('keydown', function (e) {
    var i = +(e.target.getAttribute('data-i')); if (isNaN(i)) return;
    if (state.sel !== i) select(i);
    var n = state.n, j = -1, k = e.key;
    if (/^[1-9]$/.test(k) && +k <= n) { e.preventDefault(); enter(+k); return; }
    if (k === 'Backspace' || k === 'Delete' || k === '0') { e.preventDefault(); enter(0); return; }
    if (k === 'n' || k === 'N') { e.preventDefault(); toggleNotes(); return; }
    if (k === 'ArrowRight' && i % n < n - 1) j = i + 1;
    if (k === 'ArrowLeft' && i % n > 0) j = i - 1;
    if (k === 'ArrowDown' && i + n < n * n) j = i + n;
    if (k === 'ArrowUp' && i - n >= 0) j = i - n;
    if (j >= 0) { e.preventDefault(); boardEl.children[j].focus(); select(j); }
  });
  boardEl.addEventListener('focusin', function (e) { var b = e.target.closest('.scell'); if (b && !state.solvedAt && state.sel !== +b.getAttribute('data-i')) select(+b.getAttribute('data-i')); });

  function toggleNotes() { notesMode = !notesMode; notesBtn.setAttribute('aria-pressed', notesMode ? 'true' : 'false'); notesBtn.textContent = notesMode ? '✏️ Notes: on' : '✏️ Notes: off'; }

  root.querySelectorAll('[data-level-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      var lv = b.getAttribute('data-level-btn');
      load(lv, lv === 'daily' ? 0 : (store.get('last_' + lv, 0) || 0) + (state && state.level === lv ? 1 : 0) || 1);
    });
  });
  root.querySelector('[data-action="undo"]').addEventListener('click', undo);
  root.querySelector('[data-action="restart"]').addEventListener('click', restart);
  root.querySelector('[data-action="hint"]').addEventListener('click', hint);
  notesBtn.addEventListener('click', toggleNotes);
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
    if (!S.LEVELS[lv] || lv === 'daily') lv = root.getAttribute('data-default') || 'easy';
    if (!(pid > 0)) pid = (store.get('last_' + lv, 0) || 0) + 1;
    if (lv === 'daily') pid = 0;
  }
  load(lv, pid);
  renderStats();
  window.__sudoku = function () { return state; }; // used by our automated browser tests
})();
