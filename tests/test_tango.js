// Tango engine tests: every level, 50 seeds — unique solution (backtracking count = 1), equals stored solution,
// solvable by pure line logic (no guessing), givens consistent, signs consistent.
const T = require(require('path').join(__dirname, '..', 'assets', 'tango-core.js'));
let fail = 0;
for (const lv of Object.keys(T.LEVELS)) {
  let t0 = Date.now(), ok = 0, mx = 0, giv = [];
  for (let s = 1; s <= 50; s++) {
    const a = Date.now(); const p = T.generate(lv, lv === 'daily' ? 700000 + s : s * 7919); mx = Math.max(mx, Date.now() - a);
    if (!p) { fail++; console.log('FAIL null', lv, s); continue; }
    const n = p.n;
    const chk = T.check(n, p.solution, p.cons);
    const lg = T.logicSolve(n, p.givens, p.cons);
    const cnt = T.countSolutions(n, p.givens, p.cons, 2);
    const same = lg.complete && lg.grid.every((v, i) => v === p.solution[i]);
    const givOk = p.givens.every((v, i) => !v || v === p.solution[i]);
    if (chk.solved && lg.complete && cnt.count === 1 && same && givOk && p.cons.length === T.LEVELS[lv].cons) ok++;
    else { fail++; console.log('FAIL', lv, s, chk.solved, lg.complete, cnt.count, same, givOk); }
    giv.push(p.givens.filter(Boolean).length);
  }
  console.log(lv, 'ok', ok, '/50 max ms', mx, 'total ms', Date.now() - t0, 'givens', Math.min(...giv) + '-' + Math.max(...giv));
}
// check(): detects triples, overfull lines and broken signs
{
  const n = 6, g = new Array(36).fill(0); g[0] = g[1] = g[2] = 1;
  const r = T.check(n, g, []); if (!r.bad[0] || !r.bad[2]) { fail++; console.log('FAIL triple'); }
  const g2 = new Array(36).fill(0); g2[0] = 1; g2[1] = 2;
  const r2 = T.check(n, g2, [{ a: 0, b: 1, t: '=' }]); if (!r2.badCons[0]) { fail++; console.log('FAIL sign'); }
  const g3 = new Array(36).fill(0); g3[0] = g3[2] = g3[4] = g3[5] = 2;
  if (!T.check(n, g3, []).bad[5]) { fail++; console.log('FAIL count'); }
  // solver: empty board has many solutions; contradictory board has none
  const many = T.countSolutions(6, new Array(36).fill(0), [], 2); if (many.count !== 2) { fail++; console.log('FAIL many'); }
  const none = T.countSolutions(6, new Array(36).fill(0), [{ a: 0, b: 1, t: '=' }, { a: 1, b: 2, t: '=' }], 2); if (none.count !== 0) { fail++; console.log('FAIL none'); }
  const t = Date.now(); const e8 = T.countSolutions(8, new Array(64).fill(0), [], 2, Date.now() + 3000); console.log('8x8 empty count', e8.count, 'ms', Date.now() - t);
}
if (fail) { console.log('FAILURES', fail); process.exit(1); } else console.log('ALL PASS tango');
