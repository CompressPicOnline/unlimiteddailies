/* Unlimited Dailies - Patches-style rectangle puzzle UI */
(function () {
  'use strict';
  var P = window.PatchesCore;
  var root = document.getElementById('pgame');
  if (!P || !root) return;

  var boardEl = root.querySelector('.pboard');
  var msgEl = root.querySelector('.game-msg');
  var timerEl = root.querySelector('[data-timer]');
  var titleEl = root.querySelector('[data-puzzle-title]');
  var modal = document.getElementById('win-modal');
  var EPOCH = Date.UTC(2026, 10, 28); // Patches daily #1
  var COLORS = ['#f6c6a8', '#b9dcf2', '#c9e7b5', '#f3d27e', '#d9c5f0', '#f5b8c8', '#a9e0d4', '#e8d6b8', '#c4cdf5', '#f0e09a', '#b8e3b0', '#f2c2e6', '#bfe2ee', '#e6c7a4'];
  var SHAPE_NAME = { any: 'any rectangle', square: 'square', wide: 'wide rectangle', tall: 'tall rectangle' };

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('ud_p_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ud_p_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var state = null, tick = null, drag = null, kbAnchor = -1;

  function dayKey(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function dailyNumber() { var d = new Date(); return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / 86400000) + 1; }
  function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function setMsg(t, kind) { msgEl.textContent = t; msgEl.className = 'game-msg' + (kind ? ' ' + kind : ''); }
  function sameRect(a, b) { return a && b && a.r === b.r && a.c === b.c && a.h === b.h && a.w === b.w; }
  function rectFrom(a, b, n) { var r1 = Math.floor(a / n), c1 = a % n, r2 = Math.floor(b / n), c2 = b % n; return { r: Math.min(r1, r2), c: Math.min(c1, c2), h: Math.abs(r1 - r2) + 1, w: Math.abs(c1 - c2) + 1 }; }
  function inRect(p, i, n) { var r = Math.floor(i / n), c = i % n; return r >= p.r && r < p.r + p.h && c >= p.c && c < p.c + p.w; }
  function overlaps(a, b) { return a.r < b.r + b.h && b.r < a.r + a.h && a.c < b.c + b.w && b.c < a.c + a.w; }

  function load(level, id) {
    var today = dailyNumber();
    if (level === 'daily' && !(id > 0 && id <= today)) id = today;
    var seed = level === 'daily' ? 900000 + id : id;
    var p = P.generate(level, seed);
    if (!p) return load(level, id + 1);
    state = { level: level, id: id, n: p.n, clues: p.clues, solution: p.solution, patches: [], history: [], start: 0, solvedAt: 0, hints: 0 };
    if (level !== 'daily') store.set('last_' + level, id);
    root.setAttribute('data-level', level);
    root.style.setProperty('--pn', p.n);
    root.querySelectorAll('[data-level-btn]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-level-btn') === level ? 'true' : 'false'); });
    titleEl.textContent = level === 'daily' ? 'Daily Patches #' + id : P.LEVELS[level].label + ' ' + p.n + '×' + p.n + ' #' + id;
    setMsg('Drag across squares to draw a patch. Tap a patch to remove it.');
    clearInterval(tick); timerEl.textContent = '0:00';
    boardEl.classList.remove('solved');
    if (history.replaceState) history.replaceState(null, '', location.pathname + query());
    build();
    var sv = store.get('prog', null);
    if (sv && sv.k === level + ':' + id && sv.pt) {
      state.patches = sv.pt; state.hints = sv.h || 0;
      if (sv.t > 0) { state.start = Date.now() - sv.t; resumeClock(); }
      setMsg('Welcome back – your progress on this board was restored.');
    }
    render();
  }

  function save() { if (!state || (!state.solvedAt && !state.start && !state.patches.length)) return; store.set('prog', state.solvedAt ? null : { k: state.level + ':' + state.id, pt: state.patches, h: state.hints, t: state.start ? Date.now() - state.start : 0 }); }
  function resumeClock() {
    clearInterval(tick);
    tick = setInterval(function () { if (!state.solvedAt) timerEl.textContent = fmt(Date.now() - state.start); }, 500);
    timerEl.textContent = fmt(Date.now() - state.start);
  }

  function query() { return state.level === 'daily' ? '?daily=' + state.id : '?level=' + state.level + '&p=' + state.id; }

  function clueHtml(k) {
    return '<span class="pclue"><span class="pnum">' + (k.area || '?') + '</span><span class="pico ' + k.shape + '"></span></span>';
  }

  function build() {
    var n = state.n, at = {}, html = '';
    state.clues.forEach(function (k, idx) { at[k.i] = idx; });
    for (var i = 0; i < n * n; i++) {
      var k = at[i] !== undefined ? state.clues[at[i]] : null;
      html += '<button type="button" class="pcell" data-i="' + i + '" aria-label="Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) +
        (k ? ': clue ' + (k.area ? k.area + ', ' : 'no number, ') + SHAPE_NAME[k.shape] : '') + '">' + (k ? clueHtml(k) : '') + '</button>';
    }
    html += '<div class="players" aria-hidden="true"></div>';
    boardEl.innerHTML = html;
    boardEl.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
  }

  function rectStyle(p, n) {
    return 'left:' + (p.c / n * 100) + '%;top:' + (p.r / n * 100) + '%;width:' + (p.w / n * 100) + '%;height:' + (p.h / n * 100) + '%';
  }

  function render(preview) {
    if (!preview) save();
    var n = state.n, res = P.check(n, state.clues, state.patches), html = '';
    state.patches.forEach(function (p, pi) {
      var ci = res.clueOf[pi], bad = res.bad[pi];
      html += '<span class="patch' + (bad ? ' bad' : '') + '" style="' + rectStyle(p, n) + ';background:' + (ci >= 0 ? COLORS[ci % COLORS.length] : '#d5d8e0') + '"></span>';
    });
    if (preview) html += '<span class="patch preview" style="' + rectStyle(preview, n) + '"><b>' + (preview.w) + '×' + preview.h + ' = ' + preview.w * preview.h + '</b></span>';
    boardEl.querySelector('.players').innerHTML = html;
    return res;
  }

  function startClock() {
    if (state.start) return;
    state.start = Date.now();
    clearInterval(tick);
    tick = setInterval(function () { if (!state.solvedAt) timerEl.textContent = fmt(Date.now() - state.start); }, 500);
  }

  function addPatch(rect) {
    if (state.solvedAt) return;
    startClock();
    state.history.push(state.patches.slice());
    state.patches = state.patches.filter(function (p) { return !overlaps(p, rect); });
    state.patches.push(rect);
    afterChange();
  }
  function removeAt(i) {
    if (state.solvedAt) return false;
    var n = state.n, idx = -1;
    state.patches.forEach(function (p, pi) { if (inRect(p, i, n)) idx = pi; });
    if (idx < 0) return false;
    state.history.push(state.patches.slice());
    state.patches.splice(idx, 1);
    afterChange();
    return true;
  }

  function afterChange() {
    var res = render();
    if (res.solved) return win();
    var left = state.n * state.n - res.covered, nb = Object.keys(res.bad).length;
    if (nb) setMsg(nb === 1 ? 'The striped patch breaks a rule: it needs exactly one clue and must match its number and shape.' : nb + ' striped patches break a rule: each needs exactly one clue, the right area and the right shape.', 'warn');
    else setMsg(left ? left + ' squares still uncovered.' : 'Every square is covered.');
  }

  function win() {
    state.solvedAt = Date.now();
    clearInterval(tick);
    var time = state.solvedAt - (state.start || state.solvedAt);
    timerEl.textContent = fmt(time);
    setMsg('Solved! 🎉', 'ok');
    save();
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
    ['easy', 'medium', 'hard', 'expert', 'daily'].forEach(function (k) { if (stats[k]) parts.push(P.LEVELS[k].label + ': ' + stats[k].solved + ' solved, best ' + fmt(stats[k].best)); });
    var st = store.get('streak', 0); if (st) parts.push('Daily streak: ' + st);
    el.textContent = parts.length ? parts.join(' · ') : 'Solve a puzzle to start your stats.';
  }

  function shareText(time) {
    var label = state.level === 'daily' ? 'Daily #' + state.id : P.LEVELS[state.level].label + ' ' + state.n + '×' + state.n + ' #' + state.id;
    return 'Patches Unlimited ' + label + ' solved in ' + fmt(time) + (state.hints ? ' (' + state.hints + ' hint' + (state.hints > 1 ? 's' : '') + ')' : ' – no hints') +
      '\n🟧🟦🟩🟨 ' + state.clues.length + ' patches\n' + location.origin + location.pathname + query();
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
    var n = state.n;
    for (var pi = 0; pi < state.patches.length; pi++) {
      var p = state.patches[pi];
      if (!state.solution.some(function (s) { return sameRect(s, p); })) {
        state.history.push(state.patches.slice()); state.patches.splice(pi, 1); afterChange();
        setMsg('That ' + p.w + '×' + p.h + ' patch is not part of the answer – it has been removed.', 'warn');
        return;
      }
    }
    // place the clue with the fewest possible spots left (the one a careful player would find first)
    var fixed = {}, best = -1, bestN = 1e9;
    state.solution.forEach(function (s, ci) { if (state.patches.some(function (p) { return sameRect(p, s); })) fixed[ci] = s; });
    var cand = P.candidates(n, state.clues);
    state.clues.forEach(function (k, ci) {
      if (fixed[ci]) return;
      var cnt = cand[ci].filter(function (r) { return !state.patches.some(function (p) { return overlaps(p, r); }); }).length;
      if (cnt < bestN) { bestN = cnt; best = ci; }
    });
    if (best < 0) return;
    var s = state.solution[best], k = state.clues[best];
    addPatch({ r: s.r, c: s.c, h: s.h, w: s.w });
    if (!state.solvedAt) setMsg('Hint: the clue in row ' + (Math.floor(k.i / n) + 1) + ', column ' + (k.i % n + 1) + (bestN === 1 ? ' fits in only one place.' : ' has only ' + bestN + ' possible patches – this is the one that leaves room for every other clue.'));
    flash(s);
  }

  function flash(s) {
    var n = state.n, el = document.createElement('span');
    el.className = 'patch hl'; el.setAttribute('style', rectStyle(s, n));
    boardEl.querySelector('.players').appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1500);
  }
  function undo() { if (state.solvedAt || !state.history.length) return; state.patches = state.history.pop(); afterChange(); }
  function restart() { store.set('prog', null); state.patches = []; state.history = []; state.solvedAt = 0; state.start = 0; state.hints = 0; boardEl.classList.remove('solved'); clearInterval(tick); timerEl.textContent = '0:00'; render(); setMsg('Board cleared.'); }

  function cellAt(x, y) {
    var b = boardEl.getBoundingClientRect(), n = state.n;
    if (x < b.left || y < b.top || x >= b.right || y >= b.bottom) return -1;
    var c = Math.min(n - 1, Math.floor((x - b.left) / b.width * n)), r = Math.min(n - 1, Math.floor((y - b.top) / b.height * n));
    return r * n + c;
  }
  boardEl.addEventListener('pointerdown', function (e) {
    if (state.solvedAt) return;
    var i = cellAt(e.clientX, e.clientY); if (i < 0) return;
    e.preventDefault();
    drag = { a: i, b: i, moved: false };
    try { boardEl.setPointerCapture(e.pointerId); } catch (er) {}
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var i = cellAt(e.clientX, e.clientY); if (i < 0 || i === drag.b) return;
    drag.b = i; drag.moved = true;
    render(rectFrom(drag.a, drag.b, state.n));
  });
  function endDrag() {
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.moved && d.a === d.b && removeAt(d.a)) return;
    addPatch(rectFrom(d.a, d.b, state.n));
  }
  boardEl.addEventListener('pointerup', endDrag);
  boardEl.addEventListener('pointercancel', function () { drag = null; render(); });

  // keyboard: arrows move, Enter/Space starts a patch, arrows stretch it, Enter/Space again places it, Esc cancels, Delete removes
  boardEl.addEventListener('keydown', function (e) {
    var i = +(e.target.getAttribute('data-i')); if (isNaN(i)) return;
    var n = state.n, j = -1;
    if (e.key === 'ArrowRight' && i % n < n - 1) j = i + 1;
    if (e.key === 'ArrowLeft' && i % n > 0) j = i - 1;
    if (e.key === 'ArrowDown' && i + n < n * n) j = i + n;
    if (e.key === 'ArrowUp' && i - n >= 0) j = i - n;
    if (j >= 0) { e.preventDefault(); boardEl.children[j].focus(); if (kbAnchor >= 0) render(rectFrom(kbAnchor, j, n)); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (kbAnchor < 0) { kbAnchor = i; render(rectFrom(i, i, n)); setMsg('Move with the arrow keys, then press Enter again to place the patch.'); }
      else { var a = kbAnchor; kbAnchor = -1; addPatch(rectFrom(a, i, n)); }
    } else if (e.key === 'Escape') { kbAnchor = -1; render(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeAt(i); }
  });
  boardEl.addEventListener('click', function (e) { if (e.detail === 0) e.preventDefault(); }); // keyboard "click" handled above

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
    if (!P.LEVELS[lv] || lv === 'daily') lv = root.getAttribute('data-default') || 'easy';
    if (!(pid > 0)) pid = (store.get('last_' + lv, 0) || 0) + 1;
    if (lv === 'daily') pid = 0;
  }
  load(lv, pid);
  renderStats();
  window.__patches = function () { return state; }; // used by our automated browser tests
})();
