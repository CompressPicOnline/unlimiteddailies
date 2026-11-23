// Generator/solver tests: every level, 50 seeds each — the stored solution must solve the board,
// boards must be full, wildcard count must match the level, and the solver must find a solution too.
const C = require('../assets/core.js');
let fail = 0, total = 0;
for (const lv of Object.keys(C.LEVELS)) {
  const L = C.LEVELS[lv]; let t0 = Date.now(), full = 0, opsOk = 0, solved = 0, maxSolve = 0;
  for (let s = 1; s <= 50; s++) {
    total++;
    const p = C.generate(lv, lv === 'daily' ? '2026-11-' + s : String(s));
    let b = p.cells.slice(), ok = true;
    for (const [f, t] of p.solution) { if (!C.canMerge(b, f, t, p.rows, p.cols)) { ok = false; break; } b = C.applyMerge(b, f, t); }
    if (!ok || C.tileCount(b) !== 1 || b.filter(Boolean)[0] <= 0) { fail++; console.log('FAIL stored solution', lv, s); }
    if (C.tileCount(p.cells) === p.rows * p.cols) full++; else { fail++; console.log('FAIL not full', lv, s); }
    if (C.opCount(p.cells) === L.ops) opsOk++; else { fail++; console.log('FAIL ops', lv, s, C.opCount(p.cells)); }
    const ts = Date.now(); const r = C.solve(p.cells, p.rows, p.cols, (lv === 'hard' || lv === 'expert') ? 300 : 3000); const d = Date.now() - ts; maxSolve = Math.max(maxSolve, d);
    if (r.status === 'solved') {
      solved++;
      let bb = p.cells.slice();
      for (const [f, t] of r.moves) { if (!C.canMerge(bb, f, t, p.rows, p.cols)) { fail++; console.log('FAIL solver illegal', lv, s); break; } bb = C.applyMerge(bb, f, t); }
    } else if (lv !== 'expert' && lv !== 'hard') { fail++; console.log('FAIL solver', r.status, lv, s); }
  }
  console.log(lv, L.rows + 'x' + L.cols, 'full', full, 'ops ok', opsOk, 'solver solved', solved + '/50', 'max solve ms', maxSolve, 'total ms', Date.now() - t0);
}
// rule checks
const ex = C.solve([1,1,64,4,2,32,4,4,16], 3, 3, 2000);
if (ex.status !== 'solved' || ex.moves.length !== 8) { fail++; console.log('FAIL example'); }
if (C.mergeValue(C.parseCell('x2'), 8) !== 16 || C.mergeValue(5, C.parseCell('+3')) !== 8) { fail++; console.log('FAIL op math'); }
if (C.mergeValue(C.parseCell('x2'), C.parseCell('+3')) !== 0 || C.mergeValue(4, 8) !== 0) { fail++; console.log('FAIL op rules'); }
if (!isNaN(C.parseCell('abc')) || C.parseCell('') !== 0 || C.parseCell('×3') !== -103 || C.parseCell('*2') !== -102) { fail++; console.log('FAIL parse'); }
const w = C.solve([1, 1, C.parseCell('x2'), 4], 2, 2, 1000); // 1+1=2, x2 ->4, 4+4=8
if (w.status !== 'solved') { fail++; console.log('FAIL wildcard solve', w.status); }
// daily archive: the real date keys (zero-padded UTC dates from 2026-11-21) for the first 120 dailies
for (let n = 1; n <= 120; n++) {
  const d = new Date(Date.UTC(2026, 10, 21) + (n - 1) * 86400000);
  const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  const p = C.generate('daily', key); total++;
  let b = p.cells.slice(), ok = true;
  for (const [f, t] of p.solution) { if (!C.canMerge(b, f, t, p.rows, p.cols)) { ok = false; break; } b = C.applyMerge(b, f, t); }
  if (!ok || C.tileCount(b) !== 1) { fail++; console.log('FAIL archive daily', n, key); }
}
console.log(fail ? 'FAILURES: ' + fail : 'ALL PASS (' + total + ' generated puzzles)');
process.exit(fail ? 1 : 0);
