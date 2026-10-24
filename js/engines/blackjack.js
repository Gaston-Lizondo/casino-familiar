/*
 * Motor de blackjack: lógica pura, sin DOM, ESTADO 100% serializable (JSON).
 * Pensado para multijugador: la mesa tiene varios asientos (seats) con turnos.
 * Cada función recibe una mesa y devuelve una mesa NUEVA (no muta la original).
 *
 * Reglas (las de una mesa de casino estándar):
 *  - 6 mazos, el crupier se planta en cualquier 17 (también en 17 blando) y mira su carta oculta
 *    cuando muestra 10 o As (si tiene blackjack, la mano termina ahí).
 *  - Blackjack paga 3:2. Ganar paga 1:1. Empate devuelve la apuesta.
 *  - Doblar con las 2 primeras cartas (también después de separar).
 *  - Separar (split) pares del mismo valor, hasta 4 manos. Los ases separados reciben una sola
 *    carta cada uno y no se vuelven a separar. 21 después de separar paga 1:1, no 3:2.
 *  - Seguro (insurance) cuando el crupier muestra As: cuesta la mitad de la apuesta y paga 2:1.
 *  - Sin rendición (surrender).
 * Las cartas se sacan del FINAL del array shoe (shoe.pop()).
 *
 * Fases: betting -> insurance (solo si el crupier muestra As) -> player -> done.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CF = root.CF || {}; root.CF.Blackjack = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 2;
  var MAX_HANDS = 4;
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

  function newHand(cards, bet, fromSplit) {
    // status: playing | stand | bust | blackjack
    return { cards: cards, bet: bet, status: 'playing', doubled: false, fromSplit: !!fromSplit, splitAces: false, result: null, payout: 0 };
  }

  function newSeat(id) {
    // insurance: null = sin decidir | 0 = no tomó | monto. wagered = todo lo apostado en la ronda.
    return { id: id, hands: [], cur: 0, insurance: null, insPayout: 0, wagered: 0, payout: 0 };
  }

  function createTable(seatIds, opts) {
    opts = opts || {};
    return {
      v: VERSION,
      phase: 'betting', // betting | insurance | player | done
      decks: opts.decks || 6,
      shoe: [],
      dealer: [],
      turn: -1,
      round: 0,
      seats: seatIds.map(newSeat)
    };
  }

  // Convierte una mesa guardada con la versión anterior (una mano por asiento) al formato actual.
  function migrate(table) {
    if (!table) return null;
    if (table.v === VERSION) return table;
    if (table.v !== 1) return null;
    var t = clone(table);
    t.v = VERSION;
    t.seats = t.seats.map(function (o) {
      var s = newSeat(o.id);
      if (o.status !== 'idle') {
        var hd = newHand(o.cards, o.bet, false);
        hd.status = o.status === 'playing' ? 'playing' : o.status; hd.doubled = !!o.doubled; hd.result = o.result; hd.payout = o.payout;
        s.hands = [hd]; s.insurance = 0; s.wagered = o.bet; s.payout = o.payout;
      }
      return s;
    });
    return t;
  }

  function draw(t) { return t.shoe.pop(); }

  function recount(s) {
    s.wagered = s.hands.reduce(function (a, hd) { return a + hd.bet; }, 0) + (s.insurance || 0);
  }

  function dealerHasBlackjack(t) { return handValue(t.dealer).blackjack; }

  function dealerPlay(t) {
    var needs = t.seats.some(function (s) { return s.hands.some(function (hd) { return hd.status === 'stand'; }); });
    if (!needs) return;
    while (handValue(t.dealer).total < 17) t.dealer.push(draw(t));
  }

  function settle(t) {
    var dv = handValue(t.dealer);
    t.seats.forEach(function (s) {
      if (!s.hands.length) return;
      var pay = 0;
      s.hands.forEach(function (hd) {
        var res;
        if (hd.status === 'bust') res = 'lose';
        else if (hd.status === 'blackjack') res = dv.blackjack ? 'push' : 'blackjack';
        else if (dv.blackjack) res = 'lose';
        else if (dv.bust) res = 'win';
        else {
          var pv = handValue(hd.cards).total;
          res = pv > dv.total ? 'win' : (pv === dv.total ? 'push' : 'lose');
        }
        hd.result = res;
        hd.payout = res === 'lose' ? 0 : res === 'push' ? hd.bet : res === 'win' ? hd.bet * 2 : hd.bet + Math.floor(hd.bet * 1.5);
        pay += hd.payout;
      });
      s.insPayout = s.insurance > 0 && dv.blackjack ? s.insurance * 3 : 0;
      s.payout = pay + s.insPayout;
      recount(s);
    });
    t.phase = 'done';
    t.turn = -1;
  }

  // Prepara la mano actual del asiento (reparte la 2ª carta de una mano separada).
  // Devuelve true si el jugador tiene que decidir algo.
  function activate(t, s) {
    var hd = s.hands[s.cur];
    if (hd.cards.length === 1) hd.cards.push(draw(t));
    if (hd.status === 'playing' && (hd.splitAces || handValue(hd.cards).total === 21)) hd.status = 'stand';
    return hd.status === 'playing';
  }

  // Avanza a la próxima mano que debe jugar; si no queda ninguna, juega el crupier y se liquida.
  function advance(t) {
    var s = t.turn >= 0 ? t.seats[t.turn] : null;
    for (;;) {
      if (s) {
        if (s.hands[s.cur].status === 'playing') return;
        if (s.cur + 1 < s.hands.length) { s.cur++; if (activate(t, s)) return; continue; }
      }
      var j = t.turn + 1;
      while (j < t.seats.length && !(t.seats[j].hands.length && t.seats[j].hands[0].status === 'playing')) j++;
      if (j >= t.seats.length) break;
      t.turn = j; t.seats[j].cur = 0;
      return;
    }
    dealerPlay(t);
    settle(t);
  }

  function beginPlay(t) {
    t.phase = 'player'; t.turn = -1;
    advance(t);
  }

  // bets: { [seatId]: monto }. Reparte y deja la mesa lista (seguro, jugar, o liquidada si el crupier tiene blackjack).
  function startRound(table, rng, bets) {
    if (table.phase === 'player' || table.phase === 'insurance') throw new Error('Hay una mano en curso');
    var t = clone(table);
    var active = t.seats.filter(function (s) { return (bets[s.id] || 0) > 0; });
    if (!active.length) throw new Error('Nadie apostó');

    if (t.shoe.length < t.decks * 52 * 0.25) t.shoe = newShoe(rng, t.decks);
    t.round++;
    t.dealer = []; t.turn = -1;
    t.seats.forEach(function (s) {
      var b = bets[s.id] || 0;
      s.hands = b > 0 ? [newHand([], b, false)] : [];
      s.cur = 0; s.insurance = null; s.insPayout = 0; s.payout = 0;
      recount(s);
    });

    for (var pass = 0; pass < 2; pass++) {
      active.forEach(function (s) { s.hands[0].cards.push(draw(t)); });
      t.dealer.push(draw(t));
    }
    active.forEach(function (s) { if (handValue(s.hands[0].cards).blackjack) s.hands[0].status = 'blackjack'; });

    var up = cardValue(t.dealer[0].r);
    if (up === 11) { t.phase = 'insurance'; return t; }                 // primero se ofrece el seguro
    if (up === 10 && dealerHasBlackjack(t)) { settle(t); return t; }    // el crupier mira su carta
    beginPlay(t);
    return t;
  }

  function seatById(t, id) {
    for (var i = 0; i < t.seats.length; i++) if (t.seats[i].id === id) return t.seats[i];
    return null;
  }
  function currentSeat(t) { return t.phase === 'player' && t.turn >= 0 ? t.seats[t.turn] : null; }
  function currentHand(t) { var s = currentSeat(t); return s ? s.hands[s.cur] : null; }
  function turnSeat(t, seatId) { var s = currentSeat(t); return s && s.id === seatId ? s : null; }

  function canDouble(t, seatId) {
    var s = turnSeat(t, seatId), hd = s && s.hands[s.cur];
    return !!hd && hd.status === 'playing' && hd.cards.length === 2 && !hd.doubled;
  }

  function canSplit(t, seatId) {
    var s = turnSeat(t, seatId), hd = s && s.hands[s.cur];
    return !!hd && hd.status === 'playing' && hd.cards.length === 2 && !hd.splitAces &&
      s.hands.length < MAX_HANDS && cardValue(hd.cards[0].r) === cardValue(hd.cards[1].r);
  }

  function canInsure(t, seatId) {
    var s = t.phase === 'insurance' ? seatById(t, seatId) : null;
    return !!s && s.hands.length > 0 && s.insurance === null;
  }

  // Fichas extra que hay que cobrar antes de ejecutar la acción (doblar, separar o seguro).
  function extraBetRequired(t, seatId, action) {
    if (action === 'double') return canDouble(t, seatId) ? currentHand(t).bet : 0;
    if (action === 'split') return canSplit(t, seatId) ? currentHand(t).bet : 0;
    if (action === 'insurance') return canInsure(t, seatId) ? Math.floor(seatById(t, seatId).hands[0].bet / 2) : 0;
    return 0;
  }

  function act(table, seatId, action) {
    var t = clone(table);

    if (t.phase === 'insurance') {
      var si = seatById(t, seatId);
      if (!si || !canInsure(t, seatId)) throw new Error('No se puede decidir el seguro');
      if (action === 'insurance') si.insurance = Math.floor(si.hands[0].bet / 2);
      else if (action === 'noinsurance') si.insurance = 0;
      else throw new Error('Acción desconocida: ' + action);
      recount(si);
      var pending = t.seats.some(function (s) { return s.hands.length && s.insurance === null; });
      if (!pending) { if (dealerHasBlackjack(t)) settle(t); else beginPlay(t); }
      return t;
    }

    var s = currentSeat(t);
    if (!s || s.id !== seatId) throw new Error('No es el turno de ' + seatId);
    var hd = s.hands[s.cur];
    if (action === 'hit') {
      hd.cards.push(draw(t));
      var v = handValue(hd.cards);
      if (v.bust) hd.status = 'bust'; else if (v.total === 21) hd.status = 'stand';
    } else if (action === 'stand') {
      hd.status = 'stand';
    } else if (action === 'double') {
      if (!canDouble(t, seatId)) throw new Error('No se puede doblar');
      hd.bet *= 2; hd.doubled = true;
      hd.cards.push(draw(t));
      hd.status = handValue(hd.cards).bust ? 'bust' : 'stand';
    } else if (action === 'split') {
      if (!canSplit(t, seatId)) throw new Error('No se puede separar');
      var aces = hd.cards[0].r === 'A';
      var a = newHand([hd.cards[0]], hd.bet, true), b = newHand([hd.cards[1]], hd.bet, true);
      a.splitAces = b.splitAces = aces;
      s.hands.splice(s.cur, 1, a, b);
      activate(t, s); // la primera mano recibe su segunda carta
    } else {
      throw new Error('Acción desconocida: ' + action);
    }
    recount(s);
    advance(t);
    return t;
  }

  return {
    VERSION: VERSION, MAX_HANDS: MAX_HANDS, RANKS: RANKS, SUITS: SUITS,
    cardValue: cardValue, handValue: handValue, newShoe: newShoe, migrate: migrate,
    createTable: createTable, startRound: startRound, act: act,
    canDouble: canDouble, canSplit: canSplit, canInsure: canInsure,
    extraBetRequired: extraBetRequired, currentSeat: currentSeat, currentHand: currentHand
  };
});
