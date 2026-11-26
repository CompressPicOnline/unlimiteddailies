/* Unlimited Dailies - Zip-style numbered path UI */
(function () {
  'use strict';
  var Z = window.ZipCore;
  var root = document.getElementById('zgame');
  if (!Z || !root) return;

  var boardEl = root.querySelector('.zboard');
  var msgEl = root.querySelector('.game-msg');
  var timerEl = root.querySelector('[data-timer]');
  var titleEl = root.querySelector('[data-puzzle-title]');
  var modal = document.getElementById('win-modal');
  var EPOCH = Date.UTC(2026, 10, 26); // Zip daily #1
  var VER = (document.currentScript && document.currentScript.src.split('?')[1]) || '';

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('ud_z_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ud_z_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var state = null, tick = null, worker = null, reqId = 0, drawing = false;

  function dayKey(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function dailyNumber() { var d = new Date(); return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / 86400000) + 1; }
  function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function setMsg(t, kind) { msgEl.textContent = t; msgEl.className = 'game-msg' + (kind ? ' ' + kind : ''); }

  function makePuzzle(level, seed, cb) {
    var id = ++reqId;
    if (window.Worker) {
      try {
        if (!worker) {
          worker = new Worker('/assets/zip-worker.js' + (VER ? '?' + VER : ''));
          worker.onmessage = function (e) { var d = e.data; if (d.id === reqId && d.puzzle !== undefined) pending(d.puzzle); };
          worker.onerror = function () { worker = null; pending(Z.generate(pendingArgs[0], pendingArgs[1])); };
        }
        pendingArgs = [level, seed];
        pending = cb;
        worker.postMessage({ type: 'gen', id: id, level: level, seed: seed });
        return;
      } catch (e) { worker = null; }
    }
    cb(Z.generate(level, seed));
  }
  var pending = function () {}, pendingArgs = [];

  function load(level, id) {
    var today = dailyNumber();
    if (level === 'daily' && !(id > 0 && id <= today)) id = today;
    var seed = level === 'daily' ? 800000 + id : id;
    if (level !== 'daily') store.set('last_' + level, id);
    root.setAttribute('data-level', level);
    root.querySelectorAll('[data-level-btn]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-level-btn') === level ? 'true' : 'false'); });
    titleEl.textContent = 'Building board…';
    setMsg('Building a fresh board…');
    makePuzzle(level, seed, function (p) {
      if (!p) return load(level, id + 1);
      var K = 0, end = -1;
      p.nums.forEach(function (v, i) { if (v > K) { K = v; end = i; } });
      state = { level: level, id: id, n: p.n, nums: p.nums, walls: p.walls, solution: p.solution, nb: Z.neighbours(p.n, p.walls),
        K: K, end: end, path: [], history: [], start: 0, solvedAt: 0, hints: 0 };
      root.style.setProperty('--zn', p.n);
      titleEl.textContent = level === 'daily' ? 'Daily Zip #' + id : Z.LEVELS[level].label + ' ' + p.n + '×' + p.n + ' #' + id;
      setMsg('Start on 1 and drag through every square, passing the numbers in order.');
      clearInterval(tick); timerEl.textContent = '0:00';
      boardEl.classList.remove('solved');
      if (history.replaceState) history.replaceState(null, '', location.pathname + query());
      build(); render();
    });
  }

  function query() { return state.level === 'daily' ? '?daily=' + state.id : '?level=' + state.level + '&p=' + state.id; }

  function build() {
    var n = state.n, html = '';
    for (var i = 0; i < n * n; i++) {
      var v = state.nums[i];
      html += '<button type="button" class="zcell" data-i="' + i + '" aria-label="Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + (v ? ', number ' + v : '') + '">' +
        (v ? '<span class="znum">' + v + '</span>' : '') + '</button>';
    }
    html += '<svg class="zpath" viewBox="0 0 ' + n + ' ' + n + '" aria-hidden="true"><polyline points="" /></svg>';
    html += Z.wallsHtml(n, state.walls);
    boardEl.innerHTML = html;
    boardEl.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
  }

  function render() {
    var n = state.n, on = {}, p = state.path;
    p.forEach(function (c) { on[c] = 1; });
    for (var i = 0; i < n * n; i++) {
      var el = boardEl.children[i];
      el.className = 'zcell' + (on[i] ? ' on' : '') + (p.length && p[p.length - 1] === i ? ' head' : '');
    }
    boardEl.querySelector('polyline').setAttribute('points', p.map(function (c) { return (c % n + 0.5) + ',' + (Math.floor(c / n) + 0.5); }).join(' '));
  }

  function nextNum() { var m = 0; state.path.forEach(function (c) { if (state.nums[c] > m) m = state.nums[c]; }); return m + 1; }

  // Try to move the head of the path onto cell j. Returns true if the path changed.
  function stepTo(j) {
    var p = state.path, n = state.n;
    if (state.solvedAt) return false;
    if (!p.length) {
      if (state.nums[j] === 1) { p.push(j); startClock(); return true; }
      setMsg('Start on the square with 1.', 'warn'); return false;
    }
    var head = p[p.length - 1];
    if (j === head) return false;
    if (p.length > 1 && p[p.length - 2] === j) { p.pop(); return true; }
    if (p.indexOf(j) >= 0) return false;
    if (state.nb[head].indexOf(j) < 0) { if (Z.adjacent(n, head, j)) setMsg('A wall blocks that way.', 'warn'); return false; }
    var v = state.nums[j], nx = nextNum();
    if (v && v !== nx) { setMsg('Pass ' + nx + ' before ' + v + '.', 'warn'); return false; }
    if (j === state.end && p.length !== n * n - 1) { setMsg(state.K + ' is the finish – fill every other square first.', 'warn'); return false; }
    p.push(j);
    return true;
  }

  function startClock() {
    if (state.start) return;
    state.start = Date.now();
    clearInterval(tick);
    tick = setInterval(function () { if (!state.solvedAt) timerEl.textContent = fmt(Date.now() - state.start); }, 500);
  }

  function afterChange() {
    render();
    var N = state.n * state.n, p = state.path;
    if (p.length === N && p[N - 1] === state.end) return win();
    if (p.length) setMsg((N - p.length) + ' squares left · next number: ' + Math.min(nextNum(), state.K) + '.');
  }

  function cellAt(x, y) {
    var el = document.elementFromPoint(x, y);
    el = el && el.closest ? el.closest('.zcell') : null;
    return el && boardEl.contains(el) ? +el.getAttribute('data-i') : -1;
  }

  boardEl.addEventListener('pointerdown', function (e) {
    if (!state || state.solvedAt) return;
    var i = cellAt(e.clientX, e.clientY); if (i < 0) return;
    e.preventDefault();
    var p = state.path, before = p.slice(), k = p.indexOf(i);
    if (k >= 0) state.path = p.slice(0, k + 1);           // grab the path anywhere to carry on from there
    else if (!p.length && state.nums[i] === 1) { state.path = [i]; startClock(); }
    else if (!stepTo(i)) { if (!p.length) return; }
    if (state.path.join() !== before.join()) state.history.push(before);
    drawing = true;
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
    afterChange();
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (!drawing || !state || state.solvedAt) return;
    var i = cellAt(e.clientX, e.clientY); if (i < 0) return;
    if (stepTo(i)) afterChange();
  });
  function stopDraw() { drawing = false; }
  boardEl.addEventListener('pointerup', stopDraw);
  boardEl.addEventListener('pointercancel', stopDraw);
  boardEl.addEventListener('click', function (e) { e.preventDefault(); });

  boardEl.addEventListener('keydown', function (e) {
    if (!state) return;
    var n = state.n, p = state.path, head = p.length ? p[p.length - 1] : -1, j = -1;
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); if (p.length) { state.history.push(p.slice()); p.pop(); afterChange(); } return; }
    if (head < 0) {
      if (/^Arrow|^Enter$|^ $/.test(e.key)) { e.preventDefault(); var s = state.nums.indexOf(1); state.history.push([]); stepTo(s); afterChange(); focusCell(s); }
      return;
    }
    if (e.key === 'ArrowRight' && head % n < n - 1) j = head + 1;
    if (e.key === 'ArrowLeft' && head % n > 0) j = head - 1;
    if (e.key === 'ArrowDown' && head + n < n * n) j = head + n;
    if (e.key === 'ArrowUp' && head - n >= 0) j = head - n;
    if (j < 0) return;
    e.preventDefault();
    var before = p.slice();
    if (stepTo(j)) { state.history.push(before); afterChange(); }
    focusCell(state.path.length ? state.path[state.path.length - 1] : j);
  });
  function focusCell(i) { var el = boardEl.children[i]; if (el) el.focus(); }

  function win() {
    state.solvedAt = Date.now();
    clearInterval(tick);
    var time = state.solvedAt - (state.start || state.solvedAt);
    timerEl.textContent = fmt(time);
    setMsg('Solved! 🎉', 'ok');
    boardEl.classList.add('solved');
    recordWin(time);
    setTimeout(function () { showWin(time); }, 600);
  }

  function recordWin(time) {
    var stats = store.get('stats', {}), s = stats[state.level] || { solved: 0, best: 0 };
    s.solved++; if (!s.best || time < s.best) s.best = time;
    stats[state.level] = s; store.set('stats', stats);
    if (state.level === 'daily') {
      var done = store.get('daily_done', []); if (done.indexOf(state.id) < 0) { done.push(state.id); store.set('daily_done', done.slice(-400)); }
      if (state.id === dailyNumber()) {
        var last = store.get('daily_last', ''), today = dayKey(Date.now()), yk = dayKey(Date.now() - 86400000), st = store.get('streak', 0);
        if (last !== today) st = last === yk ? st + 1 : 1;
        store.set('streak', st); store.set('daily_last', today);
      }
    }
    renderStats();
  }

  function renderStats() {
    var el = root.querySelector('[data-stats]'); if (!el) return;
    var stats = store.get('stats', {}), parts = [];
    ['easy', 'medium', 'hard', 'expert', 'daily'].forEach(function (k) { if (stats[k]) parts.push(Z.LEVELS[k].label + ': ' + stats[k].solved + ' solved, best ' + fmt(stats[k].best)); });
    var st = store.get('streak', 0); if (st) parts.push('Daily streak: ' + st);
    el.textContent = parts.length ? parts.join(' · ') : 'Solve a puzzle to start your stats.';
    var done = store.get('daily_done', []);
    document.querySelectorAll('.archive a[href*="?daily="]').forEach(function (a) {
      var m = /daily=(\d+)/.exec(a.getAttribute('href')); if (m && done.indexOf(+m[1]) >= 0 && !a.querySelector('.done')) a.insertAdjacentHTML('beforeend', ' <span class="done">✓</span>');
    });
  }

  function shareText(time) {
    var label = state.level === 'daily' ? 'Daily #' + state.id : Z.LEVELS[state.level].label + ' ' + state.n + '×' + state.n + ' #' + state.id;
    var nums = '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟'.match(/.️?⃣|🔟/gu) || [];
    var trail = nums.slice(0, Math.min(state.K, 4)).join('➡️') + (state.K > 4 ? '➡️…' : '');
    return 'Zip Unlimited ' + label + ' solved in ' + fmt(time) + (state.hints ? ' (' + state.hints + ' hint' + (state.hints > 1 ? 's' : '') + ')' : ' – no hints') +
      '\n' + trail + ' · ' + state.n * state.n + ' squares\n' + location.origin + location.pathname + query();
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
    if (!state || state.solvedAt) return;
    startClock();
    state.hints++;
    var p = state.path, sol = state.solution, k = 0;
    while (k < p.length && p[k] === sol[k]) k++;
    state.history.push(p.slice());
    if (k < p.length) {
      state.path = p.slice(0, k);
      afterChange(); if (k) flash(state.path[k - 1]);
      setMsg(k ? 'Your path went the wrong way after square ' + k + ' – it has been cut back to the last correct square.' : 'The path has been cleared – start again on 1.', 'warn');
      return;
    }
    var added = 0;
    while (state.path.length < sol.length && added < 4) {
      var c = sol[state.path.length]; state.path.push(c); added++;
      if (state.nums[c] && state.path.length > 1) break;
    }
    afterChange(); flash(state.path[state.path.length - 1]);
    if (!state.solvedAt) setMsg('Hint: the path continues ' + added + ' square' + (added > 1 ? 's' : '') + ' from here (highlighted).');
  }

  function flash(i) { var el = boardEl.children[i]; if (!el) return; el.classList.add('hl'); setTimeout(function () { el.classList.remove('hl'); }, 1500); }
  function undo() { if (!state || state.solvedAt || !state.history.length) return; state.path = state.history.pop(); afterChange(); if (!state.path.length) setMsg('Start on 1 and drag through every square, passing the numbers in order.'); }
  function restart() { if (!state) return; state.path = []; state.history = []; state.solvedAt = 0; state.start = 0; state.hints = 0; boardEl.classList.remove('solved'); clearInterval(tick); timerEl.textContent = '0:00'; render(); setMsg('Board cleared – start on 1.'); }

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
    if (!state) return;
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
    if (!Z.LEVELS[lv] || lv === 'daily') lv = root.getAttribute('data-default') || 'easy';
    if (!(pid > 0)) pid = (store.get('last_' + lv, 0) || 0) + 1;
    if (lv === 'daily') pid = 0;
  }
  load(lv, pid);
  renderStats();
  window.__zip = function () { return state; }; // used by our automated browser tests
})();

