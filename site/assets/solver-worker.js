/* Runs the solver off the main thread so the page never freezes. */
importScripts('/assets/core.js' + self.location.search);
self.onmessage = function (e) {
  var d = e.data;
  self.postMessage(self.MergeCore.solve(d.cells, d.rows, d.cols, d.ms));
};
