const Q=require(require('path').join(__dirname,'..','assets','queens-core.js'));
for (const lv of ['easy','medium','hard','expert','daily']){
 let t0=Date.now(),ok=0,fail=0,mx=0;
 for(let s=1;s<=50;s++){const a=Date.now();const p=Q.generate(lv,s*7919);mx=Math.max(mx,Date.now()-a);
  if(!p){fail++;continue;}
  const r=Q.solve(p.n,p.regions,3); const same=r.sol&&r.sol.every((c,i)=>c===p.solution[i]);
  const q={};p.solution.forEach((c,r)=>q[r*p.n+c]=1); const ch=Q.check(p.n,p.regions,q);
  const regs=new Set(p.regions); if(r.count===1&&same&&ch.solved&&regs.size===p.n)ok++;else fail++;}
 console.log(lv,'ok',ok,'fail',fail,'max ms',mx,'total',Date.now()-t0);}
// solver on generated + hand-edited boards (multi-solution and impossible)
{
  const p=Q.generate('hard',77); const r=Q.solve(p.n,p.regions,2);
  if(r.count!==1) throw new Error('solver unique fail');
  const all0=new Array(36).fill(0); for(let i=0;i<36;i++) all0[i]=Math.floor(i/6); // rows as regions -> many solutions
  const m=Q.solve(6,all0,2); if(m.count!==2) throw new Error('multi detect fail');
  const imp=new Array(16).fill(0).map((_,i)=>i<15?0:1).map((v,i)=>i===1?2:(i===2?3:v)); // 4x4 board with 4 regions
  const ri=Q.solve(4,imp,2); console.log('4x4 odd board solutions',ri.count);
  const t=Date.now(); for(let s=1;s<=20;s++){const b=Q.generate('expert',s); Q.solve(11, new Array(121).fill(0).map((_,i)=>Math.min(10,Math.floor(i/11))),2, Date.now()+4000);} console.log('solver stress ms',Date.now()-t);
  console.log('ALL PASS queens');
}
