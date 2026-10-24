/* Generador de azar. Sin semilla usa crypto (azar real); con semilla es reproducible (tests). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CF = root.CF || {}; root.CF.RNG = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cryptoNext() {
    var b = new Uint32Array(1);
    (globalThis.crypto || self.crypto).getRandomValues(b);
    return b[0] / 4294967296;
  }

  function create(seed) {
    var next = (seed === undefined || seed === null) ? cryptoNext : mulberry32(seed >>> 0);
    function int(n) { return Math.floor(next() * n); }
    return {
      next: next,
      int: int,
      pick: function (arr) { return arr[int(arr.length)]; },
      weighted: function (weights) {
        var total = 0, i;
        for (i = 0; i < weights.length; i++) total += weights[i];
        var r = next() * total;
        for (i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
        return weights.length - 1;
      },
      shuffle: function (arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = int(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      }
    };
  }

  return { create: create };
});
