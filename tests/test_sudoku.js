// Mini Sudoku engine tests: every level, 50 seeds — unique solution (backtracking count = 1), equals stored solution,
// solvable by singles only (no guessing), givens consistent with the solution, solution valid.
const S = require(require('path').join(__dirname, '..', 'assets', 'sudoku-core.js'));
let fail = 0;
for (const lv of Object.keys(S.LEVELS)) {
  let t0 = Date.now(), ok = 0, mx = 0, giv = [];
  for (let s = 1; s <= 50; s++) {
    const a = Date.now(); const p = S.generate(lv, lv === 'daily' ? 900000 + s : s * 7919); mx = Math.max(mx, Date.now() - a);
    if (!p) { fail++; console.log('FAIL null', lv, s); continue; }
    const n = p.n;
    const chk = S.check(n, p.solution);
    const lg = S.logicSolve(n, p.givens);
    const cnt = S.countSolutions(n, p.givens, 2);
    const same = lg.complete && lg.grid.every((v, i) => v === p.solution[i]);
    const givOk = p.givens.every((v, i) => !v || v === p.solution[i]);
    if (chk.solved && lg.complete && cnt.count === 1 && same && givOk) ok++;
    else { fail++; console.log('FAIL', lv, s, chk.solved, lg.complete, cnt.count, same, givOk); }
    giv.push(p.givens.filter(Boolean).length);
  }
  console.log(lv, 'ok', ok, '/50 max ms', mx, 'total ms', Date.now() - t0, 'givens', Math.min(...giv) + '-' + Math.max(...giv));
}
{
  const g = new Array(36).fill(0); g[0] = 3; g[5] = 3;
  if (!S.check(6, g).bad[5]) { fail++; console.log('FAIL row dup'); }
  const g2 = new Array(36).fill(0); g2[0] = 2; g2[7] = 2; // same 2x3 box (row 2, col 2)
  if (!S.check(6, g2).bad[7]) { fail++; console.log('FAIL box dup'); }
  const many = S.countSolutions(6, new Array(36).fill(0), 2); if (many.count !== 2) { fail++; console.log('FAIL many'); }
  const none = S.countSolutions(6, g, 2); if (none.count !== 0) { fail++; console.log('FAIL none'); }
  const t = Date.now(); const e9 = S.countSolutions(9, new Array(81).fill(0), 2, Date.now() + 3000); console.log('9x9 empty count', e9.count, 'ms', Date.now() - t);
  // a solved solution must be accepted by check()
  const p = S.generate('expert', 5); if (!S.check(9, p.solution).solved) { fail++; console.log('FAIL 9x9 sol'); }
}
if (fail) { console.log('FAILURES', fail); process.exit(1); } else console.log('ALL PASS sudoku');
