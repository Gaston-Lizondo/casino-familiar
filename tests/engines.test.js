/* Pruebas de los motores. Correr con:  node tests/engines.test.js */
const assert = require('assert');
const RNG = require('../js/core/rng.js');
const Slots = require('../js/engines/slots.js');
const Roulette = require('../js/engines/roulette.js');
const Dice = require('../js/engines/dice.js');
const Scratch = require('../js/engines/scratch.js');
const BJ = require('../js/engines/blackjack.js');
const StoreLib = require('../js/core/store.js');
const { decide: stratDecide } = require('./bj-strategy.js');

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} esperado ~${b} (±${tol}), fue ${a}`);

(async () => {
  console.log('RNG');
  await test('con semilla es reproducible y distinto entre semillas', () => {
    const a = RNG.create(42), b = RNG.create(42), c = RNG.create(43);
    const sa = [a.next(), a.next(), a.next()], sb = [b.next(), b.next(), b.next()], sc = [c.next(), c.next(), c.next()];
    assert.deepStrictEqual(sa, sb); assert.notDeepStrictEqual(sa, sc);
  });
  await test('sin semilla (crypto) devuelve valores en [0,1)', () => {
    const r = RNG.create();
    for (let i = 0; i < 1000; i++) { const x = r.next(); assert.ok(x >= 0 && x < 1); }
  });
  await test('shuffle conserva los elementos', () => {
    const r = RNG.create(1), arr = Array.from({ length: 52 }, (_, i) => i);
    assert.deepStrictEqual(r.shuffle(arr).slice().sort((x, y) => x - y), arr);
  });

  console.log('Tragamonedas');
  await test('retorno teórico entre 93% y 99%', () => {
    const rtp = Slots.theoreticalRTP(); console.log('      RTP teórico:', (rtp * 100).toFixed(2) + '%');
    assert.ok(rtp > 0.93 && rtp < 0.99, rtp);
  });
  await test('simulación (400k giros) coincide con el teórico', () => {
    const r = RNG.create(7); let bet = 0, ret = 0, wins = 0; const N = 400000;
    for (let i = 0; i < N; i++) { const s = Slots.spin(r, 10); bet += 10; ret += s.payout; if (s.win) wins++; }
    console.log('      RTP simulado:', (ret / bet * 100).toFixed(2) + '%  · giros ganadores:', (wins / N * 100).toFixed(1) + '%');
    near(ret / bet, Slots.theoreticalRTP(), 0.04, 'RTP');
  });
  await test('evalúa combinaciones conocidas', () => {
    assert.strictEqual(Slots.evaluate(['seven', 'seven', 'seven']).mult, 500);
    assert.strictEqual(Slots.evaluate(['cherry', 'lemon', 'cherry']).mult, 1);
    assert.strictEqual(Slots.evaluate(['cherry', 'cherry', 'cherry']).mult, 5);
    assert.strictEqual(Slots.evaluate(['cherry', 'lemon', 'bell']).mult, 0);
    assert.strictEqual(Slots.evaluate(['lemon', 'lemon', 'bell']).mult, 0);
  });

  console.log('Ruleta');
  await test('la rueda tiene 37 números únicos, 18 rojos y 18 negros', () => {
    assert.deepStrictEqual(Roulette.WHEEL.slice().sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i));
    const c = { red: 0, black: 0, green: 0 }; for (let n = 0; n <= 36; n++) c[Roulette.colorOf(n)]++;
    assert.deepStrictEqual(c, { red: 18, black: 18, green: 1 });
  });
  await test('todas las apuestas devuelven 36/37 (97,3%) de forma exacta', () => {
    const bets = [{ type: 'red' }, { type: 'black' }, { type: 'even' }, { type: 'odd' }, { type: 'low' }, { type: 'high' }];
    for (let n = 1; n <= 3; n++) { bets.push({ type: 'dozen', n }, { type: 'column', n }); }
    for (let n = 0; n <= 36; n++) bets.push({ type: 'straight', n });
    bets.forEach(b => {
      let total = 0;
      for (let r = 0; r <= 36; r++) total += Roulette.resolve([{ ...b, amount: 37 }], r).totalReturn;
      near(total / 37 / 37, 36 / 37, 1e-9, JSON.stringify(b));
    });
  });
  await test('el cero pierde las apuestas externas y paga el pleno', () => {
    const r = Roulette.resolve([{ type: 'red', amount: 100 }, { type: 'even', amount: 100 }, { type: 'straight', n: 0, amount: 10 }], 0);
    assert.strictEqual(r.totalBet, 210); assert.strictEqual(r.totalReturn, 360); assert.strictEqual(r.net, 150);
  });
  await test('docenas y columnas', () => {
    assert.ok(Roulette.isWin({ type: 'dozen', n: 2 }, 13) && !Roulette.isWin({ type: 'dozen', n: 2 }, 12));
    assert.ok(Roulette.isWin({ type: 'column', n: 1 }, 34) && Roulette.isWin({ type: 'column', n: 3 }, 36) && Roulette.isWin({ type: 'column', n: 2 }, 35));
  });

  console.log('Dados');
  await test('retorno exacto de cada apuesta entre 94% y 96%', () => {
    Object.keys(Dice.BETS).forEach(k => { const r = Dice.theoreticalRTP(k); console.log('      ' + k + ':', (r * 100).toFixed(2) + '%'); assert.ok(r > 0.94 && r < 0.96, k + ' ' + r); });
  });
  await test('pagos enteros sin errores de redondeo', () => {
    assert.strictEqual(Dice.resolve('over', 100, [6, 5]).payout, 230);
    assert.strictEqual(Dice.resolve('seven', 500, [3, 4]).payout, 2850);
    assert.strictEqual(Dice.resolve('doubles', 10, [4, 4]).payout, 57);
    assert.strictEqual(Dice.resolve('under', 50, [4, 4]).payout, 0);
  });

  console.log('Raspadita');
  await test('retorno teórico 65% y la simulación lo respeta', () => {
    near(Scratch.theoreticalRTP(), 0.65, 1e-9);
    const r = RNG.create(11); let bet = 0, ret = 0; const N = 300000;
    for (let i = 0; i < N; i++) { const c = Scratch.generate(r, 10); bet += 10; ret += c.payout; }
    console.log('      RTP simulado:', (ret / bet * 100).toFixed(2) + '%');
    near(ret / bet, 0.65, 0.06, 'RTP');
  });
  await test('cada cartón es consistente: nunca hay premios fantasma', () => {
    const r = RNG.create(5);
    for (let i = 0; i < 100000; i++) {
      const c = Scratch.generate(r, 10);
      assert.strictEqual(c.cells.length, 6);
      const counts = {}; c.cells.forEach(x => counts[x] = (counts[x] || 0) + 1);
      const triples = Object.keys(counts).filter(k => counts[k] >= 3);
      assert.ok(triples.length <= 1 && Math.max(...Object.values(counts)) <= 3);
      assert.strictEqual(Scratch.evaluate(c.cells).mult, c.mult);
      assert.strictEqual(c.win, triples.length === 1);
    }
  });

  console.log('Blackjack');
  const C = (r) => ({ r, s: '♠' });
  const tableWith = (ids, ...cardsInPopOrder) => {          // arma un mazo donde se reparten exactamente esas cartas, en ese orden
    const t = BJ.createTable(ids); t.shoe = Array.from({ length: 300 }, () => C('2'));
    cardsInPopOrder.slice().reverse().forEach(r => t.shoe.push(C(r))); return t;
  };
  // Juega lo que falte de una ronda: nadie toma seguro, y cada mano usa la función de decisión.
  const finish = (t, pick, rng) => {
    let guard = 0;
    while (t.phase === 'insurance') t = BJ.act(t, t.seats.find(s => s.hands.length && s.insurance === null).id, 'noinsurance', rng);
    while (t.phase === 'player') { const s = BJ.currentSeat(t); t = BJ.act(t, s.id, pick(t, s), rng); assert.ok(++guard < 200); }
    return t;
  };
  const strategy = (t, s) => stratDecide(BJ, t, s.id);

  await test('valores de mano', () => {
    const h = (...rs) => BJ.handValue(rs.map(r => ({ r, s: '♠' })));
    assert.ok(h('A', 'K').blackjack && h('A', 'K').total === 21);
    assert.strictEqual(h('A', 'A', '9').total, 21); assert.ok(!h('A', 'A', '9').blackjack);
    assert.ok(h('K', 'Q', '5').bust);
    assert.ok(h('A', '6').soft && h('A', '6').total === 17);
    assert.strictEqual(h('A', '5', 'K').total, 16);
  });
  await test('doblar: cobra el doble y paga el doble', () => {
    // jugador 5+6, crupier 10+7, el doble trae un 10
    let t = BJ.startRound(tableWith(['p'], '5', '10', '6', '7', '10'), RNG.create(1), { p: 100 });
    assert.strictEqual(t.phase, 'player');
    assert.ok(BJ.canDouble(t, 'p')); assert.strictEqual(BJ.extraBetRequired(t, 'p', 'double'), 100);
    t = BJ.act(t, 'p', 'double');
    const s = t.seats[0];
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(s.wagered, 200);
    assert.strictEqual(s.hands[0].result, 'win'); assert.strictEqual(s.payout, 400);
  });
  await test('blackjack natural paga 3:2 y empata si el crupier también lo tiene', () => {
    // jugador A,K ; crupier 9,8 -> pago 3:2
    let t = BJ.startRound(tableWith(['p'], 'A', '9', 'K', '8'), RNG.create(1), { p: 100 });
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].hands[0].result, 'blackjack'); assert.strictEqual(t.seats[0].payout, 250);
    // crupier K,A (blackjack) y jugador K,A -> empate
    t = BJ.startRound(tableWith(['p'], 'K', 'K', 'A', 'A'), RNG.create(1), { p: 100 });
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].hands[0].result, 'push'); assert.strictEqual(t.seats[0].payout, 100);
    // crupier 10,A mirando -> con blackjack, jugador K,K pierde
    t = BJ.startRound(tableWith(['p'], 'K', 'K', 'K', 'A'), RNG.create(1), { p: 100 });
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].hands[0].result, 'lose'); assert.strictEqual(t.seats[0].payout, 0);
  });
  await test('separar: cada mano paga aparte, doblar después de separar, 21 paga 1:1', () => {
    // jugador 8,8 vs crupier 10,7. Mano 1: 8+3, dobla y saca 10 (21). Mano 2: 8+9=17 y se planta.
    let t = BJ.startRound(tableWith(['p'], '8', '10', '8', '7', '3', '10', '9'), RNG.create(1), { p: 100 });
    assert.ok(BJ.canSplit(t, 'p')); assert.strictEqual(BJ.extraBetRequired(t, 'p', 'split'), 100);
    t = BJ.act(t, 'p', 'split');
    assert.strictEqual(t.seats[0].hands.length, 2);
    assert.ok(BJ.canDouble(t, 'p'));
    t = BJ.act(t, 'p', 'double');
    assert.strictEqual(t.phase, 'player');                           // falta la segunda mano
    assert.deepStrictEqual(BJ.currentHand(t).cards.map(c => c.r), ['8', '9']);
    t = BJ.act(t, 'p', 'stand');
    const s = t.seats[0];
    assert.strictEqual(t.phase, 'done');
    assert.strictEqual(s.hands[0].result, 'win'); assert.strictEqual(s.hands[0].payout, 400);   // 21 con 200 apostados: 1:1
    assert.strictEqual(s.hands[1].result, 'push'); assert.strictEqual(s.hands[1].payout, 100);  // 17 contra 17
    assert.strictEqual(s.wagered, 300); assert.strictEqual(s.payout, 500);
  });
  await test('ases separados: una carta por mano, sin volver a separar, pagan 1:1', () => {
    // A,A vs 9,7. Recibe K (21) y 5 (A+5). El crupier (16) saca un 10 y se pasa.
    let t = BJ.startRound(tableWith(['p'], 'A', '9', 'A', '7', 'K', '5', '10'), RNG.create(1), { p: 100 });
    t = BJ.act(t, 'p', 'split');
    const s = t.seats[0];
    assert.strictEqual(t.phase, 'done');
    assert.deepStrictEqual(s.hands.map(x => x.cards.length), [2, 2]);
    assert.deepStrictEqual(s.hands.map(x => x.result), ['win', 'win']);
    assert.strictEqual(s.payout, 400);
    // Si el as separado recibe otro as, tampoco se vuelve a separar: la ronda termina enseguida
    t = BJ.startRound(tableWith(['p'], 'A', '9', 'A', '7', 'A', 'A', '10'), RNG.create(1), { p: 100 });
    t = BJ.act(t, 'p', 'split');
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].hands.length, 2);
  });
  await test('máximo 4 manos al separar', () => {
    let t = BJ.createTable(['p']); t.shoe = Array.from({ length: 300 }, () => C('8'));
    ['8', '10', '8', '7'].reverse().forEach(r => t.shoe.push(C(r)));
    t = BJ.startRound(t, RNG.create(1), { p: 10 });
    let splits = 0;
    while (BJ.canSplit(t, 'p')) { t = BJ.act(t, 'p', 'split'); splits++; assert.ok(splits <= 3); }
    assert.strictEqual(splits, 3); assert.strictEqual(t.seats[0].hands.length, 4);
    assert.throws(() => BJ.act(t, 'p', 'split'));
    t = finish(t, () => 'stand');
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].wagered, 40);
  });
  await test('seguro: cuesta la mitad, paga 2:1 si el crupier tiene blackjack', () => {
    // jugador K,9 ; crupier A,K (blackjack). Con seguro: pierde la mano y cobra el seguro -> queda a mano.
    let t = BJ.startRound(tableWith(['p'], 'K', 'A', '9', 'K'), RNG.create(1), { p: 100 });
    assert.strictEqual(t.phase, 'insurance'); assert.ok(BJ.canInsure(t, 'p')); assert.strictEqual(BJ.extraBetRequired(t, 'p', 'insurance'), 50);
    t = BJ.act(t, 'p', 'insurance');
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].hands[0].result, 'lose');
    assert.strictEqual(t.seats[0].payout, 150); assert.strictEqual(t.seats[0].wagered, 150);
    // Sin seguro, pierde los 100
    t = BJ.startRound(tableWith(['p'], 'K', 'A', '9', 'K'), RNG.create(1), { p: 100 });
    t = BJ.act(t, 'p', 'noinsurance');
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].payout, 0);
    // Crupier A,6 (sin blackjack): el seguro se pierde y la mano sigue
    t = BJ.startRound(tableWith(['p'], '10', 'A', '9', '6'), RNG.create(1), { p: 100 });
    t = BJ.act(t, 'p', 'insurance');
    assert.strictEqual(t.phase, 'player'); assert.strictEqual(BJ.canInsure(t, 'p'), false);
    t = BJ.act(t, 'p', 'stand');                                    // 19 contra 17 blando
    const s = t.seats[0];
    assert.strictEqual(s.payout, 200); assert.strictEqual(s.wagered, 150); assert.strictEqual(s.insPayout, 0);
  });
  await test('blackjack del jugador con As del crupier: sin seguro cobra 3:2', () => {
    let t = BJ.startRound(tableWith(['p'], 'A', 'A', 'K', '9'), RNG.create(1), { p: 100 });
    assert.strictEqual(t.phase, 'insurance');
    t = BJ.act(t, 'p', 'noinsurance');
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].hands[0].result, 'blackjack'); assert.strictEqual(t.seats[0].payout, 250);
  });
  await test('es inmutable: act() no modifica la mesa original', () => {
    const rng = RNG.create(3); let t = BJ.createTable(['p']);
    for (let i = 0; i < 20; i++) {
      t = BJ.startRound(t, rng, { p: 10 });
      if (t.phase === 'insurance') { const snap = JSON.stringify(t); BJ.act(t, 'p', 'insurance', rng); assert.strictEqual(JSON.stringify(t), snap); t = BJ.act(t, 'p', 'noinsurance', rng); }
      if (t.phase === 'player') { const snap = JSON.stringify(t); BJ.act(t, 'p', 'hit', rng); assert.strictEqual(JSON.stringify(t), snap); }
      t = finish(t, () => 'stand', rng);
    }
  });
  await test('mesas guardadas con el formato anterior se migran', () => {
    const old = { v: 1, phase: 'player', decks: 6, shoe: [C('5')], dealer: [C('10'), C('7')], turn: 0, round: 3,
      seats: [{ id: 'p', bet: 50, cards: [C('9'), C('10')], status: 'playing', doubled: false, result: null, payout: 0 }] };
    const t = BJ.migrate(old);
    assert.strictEqual(t.v, BJ.VERSION); assert.strictEqual(t.seats[0].hands[0].bet, 50);
    const done = BJ.act(t, 'p', 'stand'); assert.strictEqual(done.phase, 'done'); assert.strictEqual(done.seats[0].hands[0].result, 'win');
    assert.strictEqual(BJ.migrate({ v: 99 }), null);
  });
  await test('multi-asiento con todas las acciones al azar: turnos y cuentas siempre cierran', () => {
    const rng = RNG.create(9); let t = BJ.createTable(['a', 'b', 'c']);
    for (let round = 0; round < 1500; round++) {
      t = BJ.startRound(t, rng, { a: 10, b: 20, c: 0 });
      assert.strictEqual(t.seats[2].hands.length, 0);
      let guard = 0;
      while (t.phase !== 'done') {
        if (t.phase === 'insurance') {
          const s = t.seats.find(x => x.hands.length && x.insurance === null);
          t = BJ.act(t, s.id, rng.int(2) ? 'insurance' : 'noinsurance', rng);
        } else {
          const s = BJ.currentSeat(t); assert.ok(s && BJ.currentHand(t).status === 'playing');
          const opts = ['hit', 'stand']; if (BJ.canDouble(t, s.id)) opts.push('double'); if (BJ.canSplit(t, s.id)) opts.push('split');
          t = BJ.act(t, s.id, rng.pick(opts), rng);
        }
        assert.ok(++guard < 300);
      }
      t.seats.forEach(s => {
        if (!s.hands.length) return;
        assert.ok(s.hands.length <= BJ.MAX_HANDS);
        let pay = 0, bets = 0;
        s.hands.forEach(hd => {
          assert.ok(['win', 'lose', 'push', 'blackjack'].includes(hd.result));
          const want = { lose: 0, push: hd.bet, win: hd.bet * 2, blackjack: hd.bet + Math.floor(hd.bet * 1.5) }[hd.result];
          assert.strictEqual(hd.payout, want); pay += hd.payout; bets += hd.bet;
        });
        assert.strictEqual(s.payout, pay + s.insPayout); assert.strictEqual(s.wagered, bets + (s.insurance || 0));
      });
      assert.strictEqual(t.shoe.length, 0);
    }
  });
  await test('simulación (80k manos): estrategia básica ≈ 99,5% (la casa siempre gana por poco); "como el crupier" ≈ 94%', () => {
    const run = (pick, N, seed) => {
      const rng = RNG.create(seed); let t = BJ.createTable(['p']), wag = 0, ret = 0;
      for (let i = 0; i < N; i++) {
        t = finish(BJ.startRound(t, rng, { p: 10 }), pick, rng);
        wag += t.seats[0].wagered - (t.seats[0].insurance || 0); ret += t.seats[0].payout;
      }
      return ret / wag;
    };
    const basic = run(strategy, 80000, 2024);
    const mimic = run((t, s) => BJ.handValue(BJ.currentHand(t).cards).total < 17 ? 'hit' : 'stand', 60000, 7);
    console.log('      RTP estrategia básica:', (basic * 100).toFixed(2) + '%  |  como el crupier:', (mimic * 100).toFixed(2) + '%');
    assert.ok(basic > 0.97 && basic < 1.015, basic);
    assert.ok(mimic > 0.90 && mimic < 0.985, mimic);
  });
  await test('la mesa guardada no tiene cartas por salir ni la carta oculta del crupier', () => {
    const rng = RNG.create(77); let t = BJ.createTable(['a', 'b']);
    const secretFree = (x) => { assert.strictEqual(x.shoe.length, 0); assert.strictEqual(x.dealer.length, 1); };
    for (let i = 0; i < 3000; i++) {
      t = BJ.startRound(t, rng, { a: 10, b: 10 });
      let guard = 0;
      while (t.phase !== 'done') {
        secretFree(t);
        if (t.phase === 'insurance') t = BJ.act(t, t.seats.find(s => s.hands.length && s.insurance === null).id, 'noinsurance', rng);
        else t = BJ.act(t, BJ.currentSeat(t).id, rng.pick(['hit', 'stand']), rng);
        assert.ok(++guard < 100);
      }
      assert.ok(t.dealer.length >= 2);
      // en una mano nunca aparece una misma carta más veces que mazos hay
      const n = {}; [t.dealer].concat(...t.seats.map(s => s.hands.map(h => h.cards))).flat().forEach(c => { n[c.r + c.s] = (n[c.r + c.s] || 0) + 1; assert.ok(n[c.r + c.s] <= t.decks); });
    }
    assert.throws(() => BJ.act(BJ.startRound(BJ.createTable(['p']), RNG.create(1), { p: 10 }), 'p', 'hit'));  // sin rng no hay cartas
  });
  await test('la carta oculta respeta lo que el crupier ya miró, y el blackjack del crupier sale ~4,7%', () => {
    const rng = RNG.create(31); let t = BJ.createTable(['p']); let rounds = 0, dealerBJ = 0, peekedTen = 0, peekedAce = 0;
    for (let i = 0; i < 200000; i++) {
      t = BJ.startRound(t, rng, { p: 10 });
      const up = t.dealer[0].r, peekedNoBJ = t.phase === 'player' && BJ.cardValue(up) >= 10 || t.phase === 'insurance';
      t = finish(t, () => 'stand', rng);
      rounds++;
      const v = BJ.handValue(t.dealer.slice(0, 2));
      if (v.blackjack) dealerBJ++;
      if (peekedNoBJ && t.peeked) {
        if (up === 'A') { peekedAce++; assert.notStrictEqual(BJ.cardValue(t.dealer[1].r), 10); }
        else { peekedTen++; assert.notStrictEqual(t.dealer[1].r, 'A'); }
      }
    }
    const p = dealerBJ / rounds;
    console.log('      blackjack del crupier:', (p * 100).toFixed(2) + '% (teórico ≈ 4,73%) · miró sin BJ:', peekedTen + peekedAce);
    near(p, 2 * (4 / 13) * (1 / 13), 0.004, 'BJ crupier');
    assert.ok(peekedTen > 1000 && peekedAce > 1000);
  });

  console.log('Store');
  await test('perfiles, fichas sin negativos y suscripción', async () => {
    const calls = [];
    const s = StoreLib.create({ storage: StoreLib.memoryStorage(), defaults: [{ id: 'a', name: 'A', emoji: '🙂', color: '#fff' }], startingChips: 1000 });
    s.subscribe(() => calls.push(1));
    assert.strictEqual((await s.listProfiles())[0].chips, 1000);
    assert.deepStrictEqual(await s.adjustChips('a', -400), { ok: true, chips: 600 });
    assert.deepStrictEqual(await s.adjustChips('a', -601), { ok: false, chips: 600 });
    assert.strictEqual(await s.setChips('a', 50), 50);
    const p = await s.createProfile({ name: 'Ñandú Ç' }); assert.ok(/^[a-z0-9-]+$/.test(p.id)); assert.strictEqual(p.chips, 1000);
    const p2 = await s.createProfile({ name: 'Ñandú Ç' }); assert.notStrictEqual(p.id, p2.id);
    await s.resetAll(); assert.ok((await s.listProfiles()).every(x => x.chips === 1000));
    await s.saveGame('x', { a: 1 }); assert.deepStrictEqual(await s.loadGame('x'), { a: 1 }); await s.clearGame('x'); assert.strictEqual(await s.loadGame('x'), null);
    assert.ok(calls.length >= 4);
  });

  console.log(`\n${passed} pruebas OK` + (process.exitCode ? ' (con fallas)' : ''));
})();
