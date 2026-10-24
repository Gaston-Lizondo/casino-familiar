/* Motor de raspadita: 6 casilleros, ganás si hay 3 símbolos iguales. Lógica pura. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CF = root.CF || {}; root.CF.Scratch = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SYMBOLS = [
    { id: 'clover', icon: '🍀', mult: 2 },
    { id: 'cherry', icon: '🍒', mult: 5 },
    { id: 'bell', icon: '🔔', mult: 10 },
    { id: 'star', icon: '⭐', mult: 50 },
    { id: 'diamond', icon: '💎', mult: 200 }
  ];
  var byId = {};
  SYMBOLS.forEach(function (s) { byId[s.id] = s; });

  // Pesos sobre 10000. Retorno teórico = suma(peso * mult) / 10000 = 65% (como una raspadita de lotería real).
  // Gana 1 de cada 5,5 cartones aprox. (18,09%).
  var OUTCOMES = [
    { sym: 'clover', w: 1200 },
    { sym: 'cherry', w: 500 },
    { sym: 'bell', w: 100 },
    { sym: 'star', w: 8 },
    { sym: 'diamond', w: 1 },
    { sym: null, w: 8191 }
  ];
  var CELLS = 6;

  // Casilleros "de relleno": nunca más de 2 iguales, así no hay un premio accidental.
  function fillers(rng, n, exclude) {
    var pool = SYMBOLS.map(function (s) { return s.id; }).filter(function (id) { return id !== exclude; });
    var counts = {}, cells = [];
    while (cells.length < n) {
      var id = rng.pick(pool);
      if ((counts[id] || 0) >= 2) continue;
      counts[id] = (counts[id] || 0) + 1;
      cells.push(id);
    }
    return cells;
  }

  function evaluate(cells) {
    var counts = {};
    cells.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    var best = null;
    Object.keys(counts).forEach(function (id) { if (counts[id] >= 3) best = id; });
    return best ? { symbol: best, mult: byId[best].mult } : { symbol: null, mult: 0 };
  }

  function generate(rng, bet) {
    var o = OUTCOMES[rng.weighted(OUTCOMES.map(function (x) { return x.w; }))];
    var cells = o.sym
      ? rng.shuffle([o.sym, o.sym, o.sym].concat(fillers(rng, CELLS - 3, o.sym)))
      : rng.shuffle(fillers(rng, CELLS, null));
    var ev = evaluate(cells);
    return { cells: cells, symbol: ev.symbol, mult: ev.mult, bet: bet, payout: bet * ev.mult, win: ev.mult > 0 };
  }

  function theoreticalRTP() {
    var total = OUTCOMES.reduce(function (a, o) { return a + o.w; }, 0), r = 0;
    OUTCOMES.forEach(function (o) { if (o.sym) r += (o.w / total) * byId[o.sym].mult; });
    return r;
  }

  return { SYMBOLS: SYMBOLS, byId: byId, CELLS: CELLS, generate: generate, evaluate: evaluate, theoreticalRTP: theoreticalRTP };
});
