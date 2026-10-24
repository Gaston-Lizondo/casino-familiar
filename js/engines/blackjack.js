/*
 * Motor de blackjack: lógica pura, sin DOM, ESTADO 100% serializable (JSON).
 * Pensado para multijugador: la mesa tiene varios asientos (seats) con turnos.
 * Cada función recibe una mesa y devuelve una mesa NUEVA (no muta la original).
 *
 * Reglas: 6 mazos, el crupier se planta en cualquier 17, blackjack paga 3:2,
 * se puede doblar con las 2 primeras cartas. (Sin split ni seguro en esta versión.)
 * Las cartas se sacan del FINAL del array shoe (shoe.pop()).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CF = root.CF || {}; root.CF.Blackjack = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var SUITS = ['♠', '♥', '♦', '♣'];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function cardValue(rank) {
    if (rank === 'A') return 11;
    if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
    return parseInt(rank, 10);
  }

  function handValue(cards) {
    var total = 0, aces = 0;
    cards.forEach(function (c) { total += cardValue(c.r); if (c.r === 'A') aces++; });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total: total, soft: aces > 0 && total <= 21, bust: total > 21, blackjack: cards.length === 2 && total === 21 };
  }

  function newShoe(rng, decks) {
    var cards = [];
    for (var d = 0; d < decks; d++) SUITS.forEach(function (s) { RANKS.forEach(function (r) { cards.push({ r: r, s: s }); }); });
    return rng.shuffle(cards);
  }

  function createTable(seatIds, opts) {
    opts = opts || {};
    return {
      v: 1,
      phase: 'betting', // betting | player | done
      decks: opts.decks || 6,
      shoe: [],
      dealer: [],
      turn: -1,
      round: 0,
      seats: seatIds.map(function (id) {
        // status: idle | playing | stand | bust | blackjack
        return { id: id, bet: 0, cards: [], status: 'idle', doubled: false, result: null, payout: 0 };
      })
    };
  }

  function draw(t) { return t.shoe.pop(); }

  function dealerPlay(t) {
    var needs = t.seats.some(function (s) { return s.status === 'stand'; });
    if (!needs) return;
    while (handValue(t.dealer).total < 17) t.dealer.push(draw(t));
  }

  function settle(t) {
    var dv = handValue(t.dealer);
    t.seats.forEach(function (s) {
      if (s.bet <= 0) return;
      var res;
      if (s.status === 'bust') res = 'lose';
      else if (s.status === 'blackjack') res = dv.blackjack ? 'push' : 'blackjack';
      else if (dv.blackjack) res = 'lose';
      else if (dv.bust) res = 'win';
      else {
        var pv = handValue(s.cards).total;
        res = pv > dv.total ? 'win' : (pv === dv.total ? 'push' : 'lose');
      }
      s.result = res;
      s.payout = res === 'lose' ? 0 : res === 'push' ? s.bet : res === 'win' ? s.bet * 2 : s.bet + Math.floor(s.bet * 1.5);
    });
    t.phase = 'done';
    t.turn = -1;
  }

  // Avanza al próximo asiento que sigue jugando; si no queda ninguno, juega el crupier y se liquida.
  function advance(t) {
    var i = t.turn;
    if (i >= 0 && t.seats[i].status === 'playing') return;
    for (var j = i + 1; j < t.seats.length; j++) {
      if (t.seats[j].status === 'playing') { t.turn = j; t.phase = 'player'; return; }
    }
    dealerPlay(t);
    settle(t);
  }

  // bets: { [seatId]: monto }. Reparte y deja la mesa lista para jugar (o liquidada si hubo naturales).
  function startRound(table, rng, bets) {
    if (table.phase === 'player') throw new Error('Hay una mano en curso');
    var t = clone(table);
    var active = t.seats.filter(function (s) { return (bets[s.id] || 0) > 0; });
    if (!active.length) throw new Error('Nadie apostó');

    if (t.shoe.length < t.decks * 52 * 0.25) t.shoe = newShoe(rng, t.decks);
    t.round++;
    t.dealer = [];
    t.seats.forEach(function (s) {
      s.bet = bets[s.id] || 0; s.cards = []; s.doubled = false; s.result = null; s.payout = 0;
      s.status = s.bet > 0 ? 'playing' : 'idle';
    });

    for (var pass = 0; pass < 2; pass++) {
      active.forEach(function (s) { s.cards.push(draw(t)); });
      t.dealer.push(draw(t));
    }
    active.forEach(function (s) { if (handValue(s.cards).blackjack) s.status = 'blackjack'; });

    // El crupier "mira" su carta oculta si muestra 10 o As.
    var up = cardValue(t.dealer[0].r);
    if ((up === 10 || up === 11) && handValue(t.dealer).blackjack) {
      settle(t);
      return t;
    }
    t.turn = -1; t.phase = 'player';
    advance(t);
    return t;
  }

  function currentSeat(t) { return t.phase === 'player' && t.turn >= 0 ? t.seats[t.turn] : null; }

  function canDouble(t, seatId) {
    var s = currentSeat(t);
    return !!s && s.id === seatId && s.status === 'playing' && s.cards.length === 2 && !s.doubled;
  }

  // Fichas extra que hay que cobrar antes de ejecutar la acción (solo doblar).
  function extraBetRequired(t, seatId, action) {
    return action === 'double' && canDouble(t, seatId) ? currentSeat(t).bet : 0;
  }

  function act(table, seatId, action) {
    var t = clone(table);
    var s = currentSeat(t);
    if (!s || s.id !== seatId) throw new Error('No es el turno de ' + seatId);
    if (action === 'hit') {
      s.cards.push(draw(t));
      var v = handValue(s.cards);
      if (v.bust) s.status = 'bust'; else if (v.total === 21) s.status = 'stand';
    } else if (action === 'stand') {
      s.status = 'stand';
    } else if (action === 'double') {
      if (!canDouble(t, seatId)) throw new Error('No se puede doblar');
      s.bet *= 2; s.doubled = true;
      s.cards.push(draw(t));
      s.status = handValue(s.cards).bust ? 'bust' : 'stand';
    } else {
      throw new Error('Acción desconocida: ' + action);
    }
    advance(t);
    return t;
  }

  return {
    RANKS: RANKS, SUITS: SUITS, cardValue: cardValue, handValue: handValue, newShoe: newShoe,
    createTable: createTable, startRound: startRound, act: act, canDouble: canDouble,
    extraBetRequired: extraBetRequired, currentSeat: currentSeat
  };
});
