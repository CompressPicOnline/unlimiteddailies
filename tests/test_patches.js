// Patches engine tests: every level, 50 seeds — unique solution (exact-cover count = 1), equals stored solution,
// one clue per patch, solution passes check(), clue info consistent with its patch.
const P = require(require('path').join(__dirname, '..', 'assets', 'patches-core.js'));
let fail = 0;
for (const lv of Object.keys(P.LEVELS)) {
  let t0 = Date.now(), ok = 0, mx = 0, any = 0, hid = 0, cl = 0;
  for (let s = 1; s <= 50; s++) {
    const a = Date.now(); const p = P.generate(lv, lv === 'daily' ? 900000 + s : s * 7919); mx = Math.max(mx, Date.now() - a);
    if (!p) { fail++; console.log('FAIL null', lv, s); continue; }
    const n = p.n, chk = P.check(n, p.clues, p.solution), cnt = P.solve(n, p.clues, 2);
    const same = cnt.count === 1 && cnt.sol.every((q, i) => { const r = p.solution[i]; return q.r === r.r && q.c === r.c && q.h === r.h && q.w === r.w; });
    const cons = p.clues.every((k, i) => { const r = p.solution[i]; const inside = Math.floor(k.i / n) >= r.r && Math.floor(k.i / n) < r.r + r.h && k.i % n >= r.c && k.i % n < r.c + r.w; return inside && (!k.area || k.area === r.h * r.w) && P.fits(k.shape, r.h, r.w) && (k.area || k.shape !== 'any'); });
    if (chk.solved && same && cons && n === P.LEVELS[lv].n) ok++; else { fail++; console.log('FAIL', lv, s, chk.solved, cnt.count, same, cons); }
    cl += p.clues.length; any += p.clues.filter(k => k.shape === 'any').length; hid += p.clues.filter(k => !k.area).length;
  }
  console.log(lv, 'ok', ok, '/50 max ms', mx, 'total ms', Date.now() - t0, 'clues/board', (cl / 50).toFixed(1), 'any', any, 'no-number', hid);
}
{ // check(): overlap, two clues, wrong area/shape, uncovered
  const clues = [{ i: 0, area: 2, shape: 'wide' }, { i: 3, area: 2, shape: 'any' }];
  const n = 2;
  if (!P.check(n, clues, [{ r: 0, c: 0, h: 1, w: 2 }, { r: 1, c: 0, h: 1, w: 2 }]).solved) { fail++; console.log('FAIL valid 2x2'); }
  if (P.check(n, clues, [{ r: 0, c: 0, h: 2, w: 1 }, { r: 0, c: 1, h: 2, w: 1 }]).solved) { fail++; console.log('FAIL tall vs wide'); }
  if (!P.check(n, clues, [{ r: 0, c: 0, h: 2, w: 2 }]).bad[0]) { fail++; console.log('FAIL two clues'); }
  if (P.check(n, clues, [{ r: 0, c: 0, h: 1, w: 2 }]).solved) { fail++; console.log('FAIL uncovered'); }
  const none = P.solve(2, [{ i: 0, area: 3, shape: 'any' }], 2); if (none.count !== 0) { fail++; console.log('FAIL none'); }
  const many = P.solve(3, [{ i: 4, area: 0, shape: 'any' }, { i: 0, area: 0, shape: 'any' }], 2); console.log('loose 3x3 count', many.count);
  const t = Date.now(); const big = P.solve(10, Array.from({ length: 10 }, (_, k) => ({ i: k * 10 + (k % 10), area: 10, shape: 'any' })), 2, Date.now() + 4000); console.log('10x10 stress count', big.count, 'timedOut', big.timedOut, 'ms', Date.now() - t);
}
if (fail) { console.log('FAILURES', fail); process.exit(1); } else console.log('ALL PASS patches');
