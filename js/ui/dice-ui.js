/* Pantalla de dados. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, sleep = CF.sleep, D = CF.Dice;

  CF.Games.push({ id: 'dice', name: 'Dados', icon: '🎲', desc: 'Menos, más o justo 7. Paga hasta x5,7', color: 'gold', mount: mount });

  // Posiciones (0-8 en una grilla 3x3) que se encienden para cada cara.
  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  function dieEl() { return h('div', { class: 'die' }); }
  function setDie(el, n) {
    el.setAttribute('data-face', n);
    el.replaceChildren.apply(el, Array.from({ length: 9 }, function (_, i) { return h('i', { class: PIPS[n].indexOf(i) >= 0 ? 'on' : '' }); }));
  }

  function mount(ctx) {
    var rng = CF.RNG.create();
    var bet = ctx.config.bets[0], pick = 'over', busy = false, alive = true;

    var d1 = dieEl(), d2 = dieEl();
    setDie(d1, 3); setDie(d2, 4);
    var sumEl = h('div', { class: 'dice-sum' }, '');
    var msg = h('div', { class: 'result-msg' }, 'Elegí una apuesta y tirá');

    var optBtns = {};
    var opts = Object.keys(D.BETS).map(function (k) {
      var b = D.BETS[k];
      var el = h('button', { class: 'dice-opt' + (k === pick ? ' active' : ''), type: 'button', onClick: function () { if (busy) return; select(k); } },
        h('b', null, b.label), h('small', null, b.hint), h('em', null, 'x' + (b.multTenths / 10).toString().replace('.', ',')));
      optBtns[k] = el; return el;
    });
    function select(k) {
      pick = k; ctx.sfx.play('chip');
      Object.keys(optBtns).forEach(function (x) { optBtns[x].classList.toggle('active', x === k); });
    }

    var picker = CF.betPicker({ bets: ctx.config.bets, value: bet, onChange: function (v) { bet = v; } });
    var rollBtn = h('button', { class: 'btn big gold', onClick: roll }, 'Tirar');

    ctx.el.append(h('div', { class: 'dice-stage' }, d1, d2), sumEl, msg, h('div', { class: 'dice-opts' }, opts), picker.el, rollBtn);

    async function roll() {
      if (busy) return;
      busy = true; rollBtn.disabled = true; picker.setDisabled(true);
      if (!(await ctx.wallet.debit(bet))) { busy = false; rollBtn.disabled = false; picker.setDisabled(false); return; }

      var dice = D.roll(rng), res = D.resolve(pick, bet, dice);
      ctx.wallet.hold();
      if (res.payout > 0) await ctx.wallet.credit(res.payout);

      msg.className = 'result-msg'; msg.textContent = 'Rodando…'; sumEl.textContent = '';
      // Cada dado deja de cambiar apenas se detiene: así la cara final nunca se pisa.
      var settled = [false, false];
      d1.classList.add('rolling'); d2.classList.add('rolling');
      var timer = setInterval(function () {
        if (!settled[0]) setDie(d1, rng.int(6) + 1);
        if (!settled[1]) setDie(d2, rng.int(6) + 1);
        ctx.sfx.play('dice');
      }, 90);
      await sleep(900);
      settled[0] = true; setDie(d1, dice[0]); d1.classList.remove('rolling'); ctx.sfx.play('click');
      await sleep(400);
      settled[1] = true; setDie(d2, dice[1]); d2.classList.remove('rolling'); ctx.sfx.play('click');
      clearInterval(timer);
      if (!alive) return;

      sumEl.textContent = dice[0] + ' + ' + dice[1] + ' = ' + res.sum;
      if (res.win) {
        msg.className = 'result-msg win'; msg.textContent = '¡Ganaste! +' + fmt(res.payout - bet) + ' 🪙';
        var big = res.payout >= bet * 5;
        ctx.sfx.play(big ? 'bigwin' : 'win'); ctx.fx.burst({ count: big ? 90 : 45, coins: big, y: window.innerHeight * 0.45 });
      } else { msg.className = 'result-msg lose'; msg.textContent = 'No salió. ¡Otra vez!'; ctx.sfx.play('lose'); }
      ctx.wallet.release();
      busy = false; rollBtn.disabled = false; picker.setDisabled(false);
    }

    return function cleanup() { alive = false; ctx.wallet.release(); };
  }
})();
