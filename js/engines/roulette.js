/* Motor de ruleta europea (0-36). Lógica pura, sin DOM. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CF = root.CF || {}; root.CF.Roulette = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Orden físico real de la rueda europea.
  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  function colorOf(n) {
    if (n === 0) return 'green';
    return REDS.indexOf(n) >= 0 ? 'red' : 'black';
  }

  /*
   * Una apuesta es { type, n? }:
   *   straight (n=0..36) | red | black | even | odd | low (1-18) | high (19-36)
   *   dozen (n=1..3)     | column (n=1..3)
   */
  function isWin(bet, r) {
    switch (bet.type) {
      case 'straight': return r === bet.n;
      case 'red': return colorOf(r) === 'red';
      case 'black': return colorOf(r) === 'black';
      case 'even': return r > 0 && r % 2 === 0;
      case 'odd': return r % 2 === 1;
      case 'low': return r >= 1 && r <= 18;
      case 'high': return r >= 19 && r <= 36;
      case 'dozen': return r >= 1 && Math.ceil(r / 12) === bet.n;
      case 'column': return r >= 1 && ((r - 1) % 3) + 1 === bet.n;
      default: throw new Error('Apuesta desconocida: ' + bet.type);
    }
  }

  // Multiplicador total que se devuelve al ganar (incluye la apuesta).
  function multiplier(bet) {
    if (bet.type === 'straight') return 36;
    if (bet.type === 'dozen' || bet.type === 'column') return 3;
    return 2;
  }

  function betKey(bet) {
    if (bet.type === 'straight') return 'n' + bet.n;
    if (bet.type === 'dozen') return 'd' + bet.n;
    if (bet.type === 'column') return 'c' + bet.n;
    return bet.type;
  }

  function spin(rng) { return WHEEL[rng.int(WHEEL.length)]; }

  // bets: [{ type, n?, amount }]
  function resolve(bets, result) {
    var totalBet = 0, totalReturn = 0;
    var details = bets.map(function (b) {
      var win = isWin(b, result);
      var ret = win ? b.amount * multiplier(b) : 0;
      totalBet += b.amount; totalReturn += ret;
      return { bet: b, win: win, ret: ret };
    });
    return { result: result, color: colorOf(result), totalBet: totalBet, totalReturn: totalReturn, net: totalReturn - totalBet, details: details };
  }

  return { WHEEL: WHEEL, colorOf: colorOf, isWin: isWin, multiplier: multiplier, betKey: betKey, spin: spin, resolve: resolve };
});
