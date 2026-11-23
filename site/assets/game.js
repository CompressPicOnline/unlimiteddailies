/* Unlimited Dailies - merge puzzle game UI */
(function () {
  'use strict';
  var C = window.MergeCore;
  var root = document.getElementById('game');
  if (!root || !C) return;

  var boardEl = root.querySelector('.board');
  var msgEl = root.querySelector('.game-msg');
  var timerEl = root.querySelector('[data-timer]');
  var movesEl = root.querySelector('[data-moves]');
  var titleEl = root.querySelector('[data-puzzle-title]');
  var modal = document.getElementById('win-modal');

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('ud_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ud_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var state = null; // {level, id, rows, cols, cells, history, moves, start, solvedAt, solutionMap}
  var selected = -1, tick = null, hintTimer = null;

  function todayKey() {
    var d = new Date();
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function dailyNumber() { return Math.floor((Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - Date.UTC(2026, 10, 21)) / 86400000) + 1; }
  // Daily #n is generated from its own UTC date, so past dailies (archive) can be replayed.
  function dailyKey(n) {
    var d = new Date(Date.UTC(2026, 10, 21) + (n - 1) * 86400000);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function dailyDone(n) { var d = store.get('daily_done', []); return d.indexOf(n) >= 0; }

  function load(level, id) {
    var today = dailyNumber();
    if (level === 'daily' && !(id > 0 && id < today)) id = 0; // 0 = today's daily
    var archive = level === 'daily' && id > 0;
    var seed = level === 'daily' ? (archive ? dailyKey(id) : todayKey()) : String(id);
    var p = C.generate(level, seed);
    var map = {}, b = p.cells.slice();
    for (var i = 0; i < p.solution.length; i++) { map[b.join(',')] = p.solution[i]; b = C.applyMerge(b, p.solution[i][0], p.solution[i][1]); }
    state = { level: level, archive: archive, id: level === 'daily' ? (archive ? id : today) : id, rows: p.rows, cols: p.cols, cells: p.cells.slice(),
      initial: p.cells.slice(), history: [], moves: 0, start: 0, solvedAt: 0, solutionMap: map };
    selected = -1;
    if (level !== 'daily') store.set('last_' + level, id);
    root.setAttribute('data-level', level);
    root.querySelectorAll('[data-level-btn]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-level-btn') === level ? 'true' : 'false'); });
    titleEl.textContent = (level === 'daily' ? 'Daily puzzle #' + state.id + (archive ? ' (' + dailyKey(id) + ')' : '') : C.LEVELS[level].label + ' puzzle #' + id);
    setMsg(C.opCount(p.cells) ? 'Merge identical neighbours – purple wildcards (×2, +N) work on any number.' : 'Drag a number onto an identical neighbour (or tap one, then the other).');
    clearInterval(tick); timerEl.textContent = '0:00'; movesEl.textContent = '0';
    if (history.replaceState) {
      var url = location.pathname + puzzleQuery();
      history.replaceState(null, '', url);
    }
    render();
  }

  function puzzleQuery() {
    if (state.level !== 'daily') return '?level=' + state.level + '&p=' + state.id;
    return state.archive ? '?daily=' + state.id : '';
  }

  function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function startClock() {
    if (state.start) return;
    state.start = Date.now();
    tick = setInterval(function () { if (!state.solvedAt) timerEl.textContent = fmt(Date.now() - state.start); }, 500);
  }

  function colorFor(v) {
    var lvl = Math.round(Math.log2(v));
    var hues = [200, 170, 140, 95, 50, 30, 10, 340, 300, 270, 240, 220, 190];
    return 'hsl(' + hues[lvl % hues.length] + ' 70% ' + (lvl > 9 ? 42 : 52) + '%)';
  }

  function render() {
    boardEl.style.gridTemplateColumns = 'repeat(' + state.cols + ', 1fr)';
    boardEl.innerHTML = '';
    for (var i = 0; i < state.cells.length; i++) {
      var v = state.cells[i];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell' + (v ? ' tile' : ' empty') + (v < 0 ? ' op' : '') + (i === selected ? ' selected' : '');
      b.setAttribute('data-i', i);
      if (v < 0) {
        b.textContent = C.label(v);
        b.setAttribute('aria-label', 'Wildcard ' + C.label(v) + ', row ' + (Math.floor(i / state.cols) + 1) + ', column ' + (i % state.cols + 1));
      } else if (v) {
        b.textContent = v;
        b.style.background = colorFor(v);
        b.setAttribute('aria-label', 'Tile ' + v + ', row ' + (Math.floor(i / state.cols) + 1) + ', column ' + (i % state.cols + 1));
        if (v >= 1000) b.classList.add('small');
      } else {
        b.setAttribute('aria-label', 'Empty');
        b.disabled = true;
      }
      boardEl.appendChild(b);
    }
    movesEl.textContent = state.moves;
  }

  function setMsg(t, kind) { msgEl.textContent = t; msgEl.className = 'game-msg' + (kind ? ' ' + kind : ''); }

  function doMerge(from, to) {
    if (state.solvedAt) return false;
    if (!C.canMerge(state.cells, from, to, state.rows, state.cols)) {
      var a = state.cells[from], b = state.cells[to];
      if (a < 0 && b < 0) setMsg('Two wildcards cannot merge. Use a wildcard on a number.', 'warn');
      else if (a && b && C.neighbors(from, state.rows, state.cols).indexOf(to) === -1) setMsg('Tiles must be side by side (not diagonal).', 'warn');
      else if (a > 0 && b > 0 && a !== b) setMsg('Only identical numbers can merge (or a wildcard with any number).', 'warn');
      else setMsg('Tiles must be side by side (not diagonal).', 'warn');
      return false;
    }
    startClock();
    state.history.push(state.cells.slice());
    state.cells = C.applyMerge(state.cells, from, to);
    state.moves++;
    selected = -1;
    render();
    var t = boardEl.querySelector('[data-i="' + to + '"]');
    if (t) { t.classList.add('pop'); }
    checkEnd();
    return true;
  }

  function checkEnd() {
    if (C.tileCount(state.cells) === 1) {
      state.solvedAt = Date.now();
      clearInterval(tick);
      var time = state.solvedAt - (state.start || state.solvedAt);
      timerEl.textContent = fmt(time);
      setMsg('Solved! One tile left.', 'ok');
      recordWin(time);
      setTimeout(function () { showWin(time); }, 450);
      return;
    }
    if (!C.listMoves(state.cells, state.rows, state.cols).length) {
      setMsg('No merges left. Undo a move or restart.', 'warn');
    } else {
      setMsg('Keep going: ' + C.tileCount(state.cells) + ' tiles left.');
    }
  }

  function recordWin(time) {
    var stats = store.get('stats', {});
    var s = stats[state.level] || { solved: 0, best: 0 };
    s.solved++;
    if (!s.best || time < s.best) s.best = time;
    stats[state.level] = s;
    if (state.level === 'daily') {
      var done = store.get('daily_done', []);
      if (done.indexOf(state.id) < 0) { done.push(state.id); store.set('daily_done', done); }
      renderArchive();
    }
    if (state.level === 'daily' && !state.archive) {
      var last = store.get('daily_last', '');
      var y = new Date(Date.now() - 86400000);
      var yk = y.getUTCFullYear() + '-' + String(y.getUTCMonth() + 1).padStart(2, '0') + '-' + String(y.getUTCDate()).padStart(2, '0');
      var streak = store.get('streak', 0);
      if (last !== todayKey()) streak = (last === yk) ? streak + 1 : 1;
      store.set('streak', streak); store.set('daily_last', todayKey());
    }
    store.set('stats', stats);
    renderStats();
  }

  function renderStats() {
    var el = document.querySelector('[data-stats]');
    if (!el) return;
    var stats = store.get('stats', {}), parts = [];
    ['easy', 'medium', 'hard', 'expert', 'daily'].forEach(function (k) {
      if (stats[k]) parts.push(C.LEVELS[k].label + ': ' + stats[k].solved + ' solved, best ' + fmt(stats[k].best));
    });
    var st = store.get('streak', 0);
    if (st) parts.push('Daily streak: ' + st);
    el.textContent = parts.length ? parts.join(' · ') : 'Solve a puzzle to start your stats.';
  }

  function shareText(time) {
    var label = state.level === 'daily' ? 'Daily #' + state.id : C.LEVELS[state.level].label + ' #' + state.id;
    return 'Sumbreak Unlimited ' + label + ' solved in ' + fmt(time) + ' (' + state.moves + ' merges) 🧮\n' + location.origin + location.pathname + puzzleQuery();
  }

  function showWin(time) {
    if (!modal) return;
    modal.querySelector('[data-win-text]').textContent = 'Solved in ' + fmt(time) + ' with ' + state.moves + ' merges.';
    modal.hidden = false;
    var nx = modal.querySelector('[data-next]');
    nx.href = nextUrl();
    nx.focus();
    modal.querySelector('[data-share]').onclick = function () {
      var txt = shareText(time), btn = this;
      if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { btn.textContent = 'Copied!'; }, function () {});
    };
  }
  function hideWin() { if (modal) modal.hidden = true; }

  function nextTarget() {
    if (state.archive && state.id + 1 < dailyNumber()) return { daily: state.id + 1 };
    var lv = state.level === 'daily' ? 'medium' : state.level;
    var id = state.level === 'daily' ? (store.get('last_medium', 0) || 0) + 1 : state.id + 1;
    return { lv: lv, id: id };
  }
  function nextUrl() { var t = nextTarget(); return location.pathname + (t.daily ? '?daily=' + t.daily : '?level=' + t.lv + '&p=' + t.id); }

  function nextPuzzle() {
    hideWin();
    var t = nextTarget();
    if (t.daily) load('daily', t.daily); else load(t.lv, t.id);
  }

  // Archive of our own past daily puzzles (only on pages with a [data-archive] list).
  function renderArchive() {
    var el = document.querySelector('[data-archive]');
    if (!el) return;
    var today = dailyNumber(), html = '';
    for (var n = today; n >= 1; n--) {
      var href = n === today ? '/' : '/?daily=' + n;
      html += '<li><a href="' + href + '">#' + n + ' · ' + dailyKey(n) + (n === today ? ' (today)' : '') + '</a>' + (dailyDone(n) ? ' <span class="done" title="Solved">✓</span>' : '') + '</li>';
    }
    el.innerHTML = html;
  }

  function hint() {
    if (state.solvedAt) return;
    var key = state.cells.join(','), mv = state.solutionMap[key];
    if (!mv) {
      // short, time-limited search so the page never freezes
      var res = C.solve(state.cells, state.rows, state.cols, 400);
      if (res.status === 'solved') mv = res.moves[0];
      else if (!rewind(res.status === 'impossible')) return;
      else { key = state.cells.join(','); mv = state.solutionMap[key]; if (!mv) return; }
    }
    flash(mv[0], mv[1]);
    var lbl = C.label(state.cells[mv[0]]);
    setMsg((state.msgPrefix || 'Hint: ') + 'drag the highlighted ' + lbl + ' onto its glowing neighbour.');
    state.msgPrefix = '';
  }
  // "Last good move": go back to the latest position that is on a known solution path.
  function rewind(deadEnd) {
    var steps = 0;
    for (var h = state.history.length - 1; h >= 0; h--) {
      steps++;
      if (state.solutionMap[state.history[h].join(',')]) {
        state.cells = state.history[h].slice(); state.history = state.history.slice(0, h);
        state.moves = Math.max(0, state.moves - steps); selected = -1; render();
        state.msgPrefix = (deadEnd ? 'That position was a dead end, so we went back ' : 'Went back ') + steps + (steps === 1 ? ' move' : ' moves') + ' to your last good position. Next: ';
        return true;
      }
    }
    setMsg('Hard to say from here. Try Restart.', 'warn');
    return false;
  }
  function flash(a, b) {
    clearTimeout(hintTimer);
    var ea = boardEl.querySelector('[data-i="' + a + '"]'), eb = boardEl.querySelector('[data-i="' + b + '"]');
    if (ea) ea.classList.add('hint-from'); if (eb) eb.classList.add('hint-to');
    hintTimer = setTimeout(function () { if (ea) ea.classList.remove('hint-from'); if (eb) eb.classList.remove('hint-to'); }, 2600);
  }

  function undo() {
    if (!state.history.length || state.solvedAt) return;
    state.cells = state.history.pop(); state.moves = Math.max(0, state.moves - 1); selected = -1;
    render(); checkEnd();
  }
  function restart() {
    if (state.solvedAt) { load(state.level, state.level === 'daily' && !state.archive ? 0 : state.id); return; }
    state.cells = state.initial.slice(); state.history = []; state.moves = 0; selected = -1;
    render(); setMsg('Puzzle restarted.');
  }

  // Pointer handling: drag from one tile to a neighbour, or tap-tap.
  var down = -1, downX = 0, downY = 0;
  function cellFromPoint(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== boardEl && !el.hasAttribute('data-i')) el = el.parentElement;
    return el && el.hasAttribute && el.hasAttribute('data-i') ? +el.getAttribute('data-i') : -1;
  }
  boardEl.addEventListener('pointerdown', function (e) {
    var i = cellFromPoint(e.clientX, e.clientY);
    if (i < 0 || !state.cells[i]) return;
    down = i; downX = e.clientX; downY = e.clientY;
    e.preventDefault();
  });
  window.addEventListener('pointerup', function (e) {
    if (down < 0) return;
    var from = down; down = -1;
    var moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 12;
    var target = cellFromPoint(e.clientX, e.clientY);
    if (moved && target >= 0 && target !== from) { doMerge(from, target); return; }
    // tap logic
    if (selected === -1) { selected = from; render(); }
    else if (selected === from) { selected = -1; render(); }
    else if (!doMerge(selected, from)) { selected = from; render(); }
  });
  boardEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var i = +(e.target.getAttribute('data-i'));
    if (isNaN(i)) return;
    e.preventDefault();
    if (selected === -1) selected = i; else if (selected === i) selected = -1; else if (!doMerge(selected, i)) selected = i;
    render();
    var f = boardEl.querySelector('[data-i="' + i + '"]'); if (f && !f.disabled) f.focus();
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
  root.querySelector('[data-action="new"]').addEventListener('click', nextPuzzle);
  if (modal) {
    // "Next puzzle" in the win dialog is a real link (a natural break between puzzles).
    modal.querySelector('[data-close]').addEventListener('click', hideWin);
    modal.addEventListener('click', function (e) { if (e.target === modal) hideWin(); });
  }

  // Initial puzzle from URL (?level=hard&p=12) or the page default.
  var q = new URLSearchParams(location.search);
  var lv = q.get('level'), pid = parseInt(q.get('p'), 10), dn = parseInt(q.get('daily'), 10);
  if (dn > 0) { lv = 'daily'; pid = dn; }
  else {
    if (!C.LEVELS[lv] || lv === 'daily') lv = root.getAttribute('data-default') || 'easy';
    if (!(pid > 0)) pid = (store.get('last_' + lv, 0) || 0) + 1;
    if (lv === 'daily') pid = 0;
  }
  load(lv, pid);
  renderStats();
  renderArchive();
})();
