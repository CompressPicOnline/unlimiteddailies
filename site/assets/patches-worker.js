/* Runs the Patches solver off the main thread so the page never freezes. */
importScripts('/assets/patches-core.js' + self.location.search);
self.onmessage = function (e) {
  var d = e.data, P = self.PatchesCore;
  self.postMessage({ id: d.id, result: P.solve(d.n, d.clues, 2, Date.now() + (d.ms || 8000)) });
};
