// Zip engine tests: every level, 50 seeds — stored solution is a valid path (every square once, orthogonal steps,
// no wall crossed, numbers in order, starts on 1 and ends on the highest number) and the solver finds exactly that one answer.
const Z = require(require('path').join(__dirname, '..', 'assets', 'zip-core.js'));
let fail = 0;
function valid(p) {
  const n = p.n, N = n * n, s = p.solution, nb = Z.neighbours(n, p.walls);
  if (s.length !== N || new Set(s).size !== N) return 'not every square once';
  for (let i = 1; i < N; i++) if (nb[s[i - 1]].indexOf(s[i]) < 0) return 'bad step/wall at ' + i;
  let next = 1;
  for (const c of s) if (p.nums[c]) { if (p.nums[c] !== next) return 'order'; next++; }
  if (p.nums[s[0]] !== 1 || p.nums[s[N - 1]] !== next - 1) return 'start/end';
  return '';
}
for (const lv of Object.keys(Z.LEVELS)) {
  let t0 = Date.now(), ok = 0, mx = 0, ks = [];
  for (let s = 1; s <= 50; s++) {
    const seed = lv === 'daily' ? 800000 + s : s * 7919;
    const a = Date.now(); const p = Z.generate(lv, seed); mx = Math.max(mx, Date.now() - a);
    if (!p) { fail++; console.log('FAIL null', lv, s); continue; }
    const v = valid(p);
    const r = Z.solve(p.n, p.nums, p.walls, 2, { nodeLimit: 2e7 });
    const same = r.sol && r.sol.join() === p.solution.join();
    const again = Z.generate(lv, seed); // deterministic
    if (!v && r.count === 1 && !r.aborted && same && again.nums.join() === p.nums.join()) ok++;
    else { fail++; console.log('FAIL', lv, s, v, r.count, r.aborted, same); }
    ks.push(Math.max(...p.nums));
  }
  console.log(lv, 'ok', ok, '/50 max gen ms', mx, 'total ms', Date.now() - t0, 'numbers', Math.min(...ks) + '-' + Math.max(...ks));
}
// solver edge cases
{
  const n = 3, nums = [1, 0, 0, 0, 0, 0, 0, 0, 2]; // 3x3 corner to corner: several paths
  const r = Z.solve(n, nums, [], 2); if (r.count !== 2) { fail++; console.log('FAIL many', r.count); }
  const none = Z.solve(2, [1, 0, 0, 2], [], 2); if (none.count !== 0) { fail++; console.log('FAIL none', none.count); }
  const missing = Z.solve(3, [1, 0, 3, 0, 0, 0, 0, 0, 0], [], 2); if (missing.count !== 0) { fail++; console.log('FAIL missing number'); }
  const wall = Z.solve(2, [1, 2, 0, 0], [{ a: 0, b: 2 }], 2); // the only way out of 1 is blocked by the wall → no path
  if (wall.count !== 0) { fail++; console.log('FAIL wall', wall.count); }
  const one = Z.solve(2, [1, 0, 2, 0], [], 2); // 2x2: 1 top-left, 2 bottom-left, must end on 2: 0,1,3,2 only
  if (one.count !== 1 || one.sol.join() !== '0,1,3,2') { fail++; console.log('FAIL one', one.count); }
  const t = Date.now(); const big = Z.generate('expert', 123456); const rb = Z.solve(big.n, big.nums, big.walls, 2, { deadline: Date.now() + 5000 });
  console.log('expert solve ms', Date.now() - t, rb.count, rb.aborted);
  // solver stress: 7x7 to 9x9 boards with few numbers taken from random paths (as on the solver page)
  for (const [n, k] of [[7, 6], [8, 6], [8, 8], [9, 10]]) {
    let found = 0, mx = 0;
    for (let s = 1; s <= 10; s++) {
      const p = Z.hamPath(n, Z.rng(s * 31 + n)), N = n * n, nums = new Array(N).fill(0); let c = 0;
      for (let j = 0; j < k; j++) nums[p[Math.round(j * (N - 1) / (k - 1))]] = ++c;
      const t = Date.now(); const r = Z.solve(n, nums, [], 2, { deadline: Date.now() + 8000, nodeLimit: 5e8 }); mx = Math.max(mx, Date.now() - t);
      if (r.sol) found++;
    }
    console.log('solver ' + n + 'x' + n + ' with ' + k + ' numbers: path found', found + '/10, max ms', mx);
    if (found < 10) { fail++; console.log('FAIL solver stress', n, k); }
  }
}
if (fail) { console.log('FAILURES', fail); process.exit(1); } else console.log('ALL PASS zip');
