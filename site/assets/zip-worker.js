/* Builds Zip boards and runs the Zip solver off the main thread so the page never freezes. */
importScripts('/assets/zip-core.js' + self.location.search);
self.onmessage = function (e) {
  var d = e.data, Z = self.ZipCore;
  if (d.type === 'gen') self.postMessage({ id: d.id, puzzle: Z.generate(d.level, d.seed) });
  else if (d.type === 'solve') self.postMessage({ id: d.id, result: Z.solve(d.n, d.nums, d.walls, 2, { deadline: Date.now() + (d.ms || 8000), nodeLimit: 5e8 }) });
};
