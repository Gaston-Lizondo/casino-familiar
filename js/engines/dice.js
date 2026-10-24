/* Motor de dados: 2 dados, apuestas a la suma o a dobles. Lógica pura. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CF = root.CF || {}; root.CF.Dice = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // multTenths = multiplicador en décimas (23 = x2,3). Se usan enteros para no tener errores de coma flotante.
  var BETS = {
    under: { label: 'Menos de 7', hint: '2 a 6', multTenths: 23, test: function (s) { return s < 7; } },
    seven: { label: 'Siete', hint: 'justo 7', multTenths: 57, test: function (s) { return s === 7; } },
    over: { label: 'Más de 7', hint: '8 a 12', multTenths: 23, test: function (s) { return s > 7; } },
    doubles: { label: 'Dobles', hint: 'dos iguales', multTenths: 57, test: function (s, d) { return d[0] === d[1]; } }
  };

  function roll(rng) { return [rng.int(6) + 1, rng.int(6) + 1]; }

  function resolve(type, amount, dice) {
    var b = BETS[type];
    if (!b) throw new Error('Apuesta desconocida: ' + type);
    var sum = dice[0] + dice[1];
    var win = b.test(sum, dice);
    return { type: type, amount: amount, dice: dice, sum: sum, win: win, payout: win ? Math.floor(amount * b.multTenths / 10) : 0 };
  }

  // Retorno teórico exacto de una apuesta (enumerando las 36 combinaciones).
  function theoreticalRTP(type) {
    var total = 0;
    for (var a = 1; a <= 6; a++) for (var c = 1; c <= 6; c++) total += resolve(type, 1000, [a, c]).payout / 1000;
    return total / 36;
  }

  return { BETS: BETS, roll: roll, resolve: resolve, theoreticalRTP: theoreticalRTP };
});
