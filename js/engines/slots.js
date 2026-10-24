/* Motor de tragamonedas: lógica pura, sin DOM. Recibe un rng y devuelve el resultado. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CF = root.CF || {}; root.CF.Slots = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // stops = peso de cada símbolo en el rodillo (sobre 24). pay3 = multiplicador por 3 iguales.
  var SYMBOLS = [
    { id: 'cherry', icon: '🍒', name: 'Cereza', stops: 8, pay3: 5 },
    { id: 'lemon', icon: '🍋', name: 'Limón', stops: 6, pay3: 10 },
    { id: 'bell', icon: '🔔', name: 'Campana', stops: 5, pay3: 25 },
    { id: 'star', icon: '⭐', name: 'Estrella', stops: 3, pay3: 60 },
    { id: 'diamond', icon: '💎', name: 'Diamante', stops: 1, pay3: 250 },
    { id: 'seven', icon: '7️⃣', name: 'Siete', stops: 1, pay3: 500 }
  ];
  var TWO_CHERRIES = 1; // exactamente 2 cerezas: devuelve la apuesta

  var byId = {};
  SYMBOLS.forEach(function (s) { byId[s.id] = s; });
  var weights = SYMBOLS.map(function (s) { return s.stops; });
  var TOTAL = weights.reduce(function (a, b) { return a + b; }, 0);

  function spinReel(rng) { return SYMBOLS[rng.weighted(weights)].id; }

  function evaluate(reels) {
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      return { kind: 'three', symbol: reels[0], mult: byId[reels[0]].pay3 };
    }
    var cherries = reels.filter(function (r) { return r === 'cherry'; }).length;
    if (cherries === 2) return { kind: 'cherries', symbol: 'cherry', mult: TWO_CHERRIES };
    return { kind: 'none', symbol: null, mult: 0 };
  }

  function spin(rng, bet) {
    var reels = [spinReel(rng), spinReel(rng), spinReel(rng)];
    var ev = evaluate(reels);
    return { reels: reels, kind: ev.kind, symbol: ev.symbol, mult: ev.mult, bet: bet, payout: bet * ev.mult, win: ev.mult > 0 };
  }

  // Retorno teórico exacto (enumerando las 216 combinaciones).
  function theoreticalRTP() {
    var rtp = 0;
    SYMBOLS.forEach(function (a) { SYMBOLS.forEach(function (b) { SYMBOLS.forEach(function (c) {
      var p = (a.stops / TOTAL) * (b.stops / TOTAL) * (c.stops / TOTAL);
      rtp += p * evaluate([a.id, b.id, c.id]).mult;
    }); }); });
    return rtp;
  }

  return { SYMBOLS: SYMBOLS, TWO_CHERRIES: TWO_CHERRIES, byId: byId, spin: spin, evaluate: evaluate, theoreticalRTP: theoreticalRTP };
});
