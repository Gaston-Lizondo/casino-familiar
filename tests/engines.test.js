/* Pruebas de los motores. Correr con:  node tests/engines.test.js */
const assert = require('assert');
const RNG = require('../js/core/rng.js');
const Slots = require('../js/engines/slots.js');
const Roulette = require('../js/engines/roulette.js');
const Dice = require('../js/engines/dice.js');
const Scratch = require('../js/engines/scratch.js');
const BJ = require('../js/engines/blackjack.js');
const StoreLib = require('../js/core/store.js');

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
  await test('retorno teórico 94% y la simulación lo respeta', () => {
    near(Scratch.theoreticalRTP(), 0.94, 1e-9);
    const r = RNG.create(11); let bet = 0, ret = 0; const N = 300000;
    for (let i = 0; i < N; i++) { const c = Scratch.generate(r, 10); bet += 10; ret += c.payout; }
    console.log('      RTP simulado:', (ret / bet * 100).toFixed(2) + '%');
    near(ret / bet, 0.94, 0.06, 'RTP');
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
  await test('valores de mano', () => {
    const h = (...rs) => BJ.handValue(rs.map(r => ({ r, s: '♠' })));
    assert.ok(h('A', 'K').blackjack && h('A', 'K').total === 21);
    assert.strictEqual(h('A', 'A', '9').total, 21); assert.ok(!h('A', 'A', '9').blackjack);
    assert.ok(h('K', 'Q', '5').bust);
    assert.ok(h('A', '6').soft && h('A', '6').total === 17);
    assert.strictEqual(h('A', '5', 'K').total, 16);
  });
  await test('doblar: cobra el doble y paga el doble', () => {
    const rng = RNG.create(1);
    let t = BJ.createTable(['p']);
    const C = (r) => ({ r, s: '♠' });
    t.shoe = Array.from({ length: 300 }, () => C('2'));
    // pop() saca del final: jugador 5, crupier 10, jugador 6, crupier 7, luego un 10 para el doble
    t.shoe.push(C('10'), C('7'), C('6'), C('10'), C('5'));
    t = BJ.startRound(t, rng, { p: 100 });
    assert.strictEqual(t.phase, 'player');
    assert.ok(BJ.canDouble(t, 'p')); assert.strictEqual(BJ.extraBetRequired(t, 'p', 'double'), 100);
    t = BJ.act(t, 'p', 'double');
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].bet, 200);
    assert.strictEqual(t.seats[0].result, 'win'); assert.strictEqual(t.seats[0].payout, 400);
  });
  await test('blackjack natural paga 3:2 y empata si el crupier también lo tiene', () => {
    const C = (r) => ({ r, s: '♠' });
    const base = () => { const t = BJ.createTable(['p']); t.shoe = Array.from({ length: 300 }, () => C('2')); return t; };
    // jugador A,K ; crupier 9,8 -> pago 3:2
    let t = base(); t.shoe.push(C('8'), C('K'), C('9'), C('A'));
    t = BJ.startRound(t, RNG.create(1), { p: 100 });
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].result, 'blackjack'); assert.strictEqual(t.seats[0].payout, 250);
    // ambos blackjack -> empate
    t = base(); t.shoe.push(C('K'), C('K'), C('A'), C('A'));
    t = BJ.startRound(t, RNG.create(1), { p: 100 });
    assert.strictEqual(t.seats[0].result, 'push'); assert.strictEqual(t.seats[0].payout, 100);
    // crupier blackjack, jugador 20 -> pierde
    t = base(); t.shoe.push(C('K'), C('K'), C('A'), C('K'));
    t = BJ.startRound(t, RNG.create(1), { p: 100 });
    assert.strictEqual(t.phase, 'done'); assert.strictEqual(t.seats[0].result, 'lose'); assert.strictEqual(t.seats[0].payout, 0);
  });
  await test('es inmutable: act() no modifica la mesa original', () => {
    const rng = RNG.create(3); let t = BJ.createTable(['p']);
    t = BJ.startRound(t, rng, { p: 10 });
    if (t.phase === 'player') { const snap = JSON.stringify(t); BJ.act(t, 'p', 'hit'); assert.strictEqual(JSON.stringify(t), snap); }
  });
  await test('multi-asiento: turnos en orden y liquidación correcta', () => {
    const rng = RNG.create(9); let t = BJ.createTable(['a', 'b', 'c']);
    for (let round = 0; round < 500; round++) {
      t = BJ.startRound(t, rng, { a: 10, b: 20, c: 0 });
      assert.strictEqual(t.seats[2].status, 'idle');
      let guard = 0;
      while (t.phase === 'player') {
        const seat = BJ.currentSeat(t); assert.ok(seat && seat.status === 'playing');
        t = BJ.act(t, seat.id, BJ.handValue(seat.cards).total < 17 ? 'hit' : 'stand');
        assert.ok(++guard < 50);
      }
      assert.strictEqual(t.phase, 'done');
      t.seats.forEach(s => { if (s.bet > 0) assert.ok(['win', 'lose', 'push', 'blackjack'].includes(s.result)); });
    }
  });
  await test('simulación (60k manos): estrategia "imitar al crupier" ≈ 94% y las cuentas cierran', () => {
    const rng = RNG.create(2024); let t = BJ.createTable(['p']); let bet = 0, ret = 0; const N = 60000;
    for (let i = 0; i < N; i++) {
      t = BJ.startRound(t, rng, { p: 10 });
      while (t.phase === 'player') { const s = BJ.currentSeat(t); t = BJ.act(t, 'p', BJ.handValue(s.cards).total < 17 ? 'hit' : 'stand'); }
      bet += t.seats[0].bet; ret += t.seats[0].payout;
      assert.ok(t.shoe.length >= 0);
    }
    console.log('      RTP simulado:', (ret / bet * 100).toFixed(2) + '%');
    assert.ok(ret / bet > 0.90 && ret / bet < 0.99, ret / bet);
  });
  await test('el mazo se rebaraja y nunca se queda sin cartas', () => {
    const rng = RNG.create(77); let t = BJ.createTable(['p']); let reshuffles = 0, prev = 0;
    for (let i = 0; i < 400; i++) {
      t = BJ.startRound(t, rng, { p: 10 });
      while (t.phase === 'player') t = BJ.act(t, 'p', 'hit');
      if (t.shoe.length > prev + 100) reshuffles++;
      prev = t.shoe.length;
    }
    assert.ok(reshuffles >= 2, 'reshuffles=' + reshuffles);
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
