/* Estrategia básica de blackjack (6 mazos, crupier se planta en 17, doblar después de separar).
 * Solo se usa en pruebas y simulaciones para medir el retorno con "jugada perfecta". Nunca toma seguro. */
'use strict';

function shouldSplit(r, up) {
  switch (r) {
    case 11: case 8: return true;
    case 9: return (up >= 2 && up <= 6) || up === 8 || up === 9;
    case 7: return up >= 2 && up <= 7;
    case 6: return up >= 2 && up <= 6;
    case 4: return up === 5 || up === 6;
    case 3: case 2: return up >= 2 && up <= 7;
    default: return false;
  }
}

// Devuelve 'hit' | 'stand' | 'double' | 'split' para la mano en juego del asiento.
function decide(BJ, t, seatId) {
  const hd = BJ.currentHand(t);
  const up = BJ.cardValue(t.dealer[0].r);
  const v = BJ.handValue(hd.cards);
  if (BJ.canSplit(t, seatId) && shouldSplit(BJ.cardValue(hd.cards[0].r), up)) return 'split';
  const dbl = BJ.canDouble(t, seatId);
  const T = v.total;
  if (v.soft) {
    if (T >= 19) return 'stand';
    if (T === 18) return up >= 3 && up <= 6 ? (dbl ? 'double' : 'stand') : (up === 2 || up === 7 || up === 8 ? 'stand' : 'hit');
    if (T === 17) return dbl && up >= 3 && up <= 6 ? 'double' : 'hit';
    if (T === 15 || T === 16) return dbl && up >= 4 && up <= 6 ? 'double' : 'hit';
    return dbl && (up === 5 || up === 6) ? 'double' : 'hit'; // 13 y 14
  }
  if (T >= 17) return 'stand';
  if (T >= 13) return up <= 6 ? 'stand' : 'hit';
  if (T === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (T === 11) return dbl && up <= 10 ? 'double' : 'hit';
  if (T === 10) return dbl && up <= 9 ? 'double' : 'hit';
  if (T === 9) return dbl && up >= 3 && up <= 6 ? 'double' : 'hit';
  return 'hit';
}

module.exports = { decide, shouldSplit };
