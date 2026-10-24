/* Pantalla de la tragamonedas. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, sleep = CF.sleep, S = CF.Slots;

  CF.Games.push({ id: 'slots', name: 'Tragamonedas', icon: '🎰', desc: 'Tres rodillos, una línea de pago', color: 'pink', top: 'Hasta x500', mount: mount });

  function mount(ctx) {
    var rng = CF.RNG.create();
    var bet = ctx.config.bets[0], busy = false, alive = true;
    var icons = S.SYMBOLS.map(function (s) { return s.icon; });
    var byId = S.byId;
    function rand() { return icons[rng.int(icons.length)]; }

    var reelEls = [0, 1, 2].map(function () {
      return h('div', { class: 'reel' }, h('div', { class: 'cell' }), h('div', { class: 'cell mid' }), h('div', { class: 'cell' }));
    });
    function setReel(i, a, b, c) {
      var cells = reelEls[i].children; cells[0].textContent = a; cells[1].textContent = b; cells[2].textContent = c;
    }
    reelEls.forEach(function (_, i) { setReel(i, rand(), rand(), rand()); });

    var machine = h('div', { class: 'slot-machine' }, h('div', { class: 'reels' }, reelEls, h('div', { class: 'payline' })));
    var lever = h('div', { class: 'lever', 'aria-hidden': 'true' });
    var msg = h('div', { class: 'result-msg' }, 'Elegí tu apuesta y girá');
    var picker = CF.betPicker({ bets: ctx.config.bets, value: bet, onChange: function (v) { bet = v; } });
    var spinBtn = h('button', { class: 'btn big', onClick: spin }, 'Girar');

    var payRows = S.SYMBOLS.slice().reverse().map(function (s) {
      return h('div', { class: 'pay-row' }, h('span', null, s.icon + s.icon + s.icon), h('b', null, 'x' + s.pay3));
    });
    payRows.push(h('div', { class: 'pay-row' }, h('span', null, '🍒🍒 dos cerezas'), h('b', null, 'x' + S.TWO_CHERRIES)));
    var paytable = h('details', { class: 'paytable' }, h('summary', null, 'Tabla de premios'), h('div', null, payRows));

    ctx.el.append(h('div', { class: 'slot-wrap' }, machine, lever), msg, picker.el, spinBtn, paytable);

    async function spin() {
      if (busy) return;
      busy = true; spinBtn.disabled = true; picker.setDisabled(true);
      if (!(await ctx.wallet.debit(bet))) { busy = false; spinBtn.disabled = false; picker.setDisabled(false); return; }
      machine.classList.remove('win', 'bigwin'); machine.classList.add('go');
      reelEls.forEach(function (r) { r.children[1].classList.remove('hit'); });
      lever.classList.add('pull'); setTimeout(function () { lever.classList.remove('pull'); }, 350);
      msg.className = 'result-msg'; msg.textContent = 'Girando…';

      var res = S.spin(rng, bet);                       // el resultado ya está decidido…
      ctx.wallet.hold();
      if (res.payout > 0) await ctx.wallet.credit(res.payout); // …y acreditado; ahora solo se anima.

      var stopped = [false, false, false];
      reelEls.forEach(function (r) { r.classList.remove('land'); r.classList.add('spinning'); });
      var timer = setInterval(function () {
        for (var i = 0; i < 3; i++) if (!stopped[i]) setReel(i, rand(), rand(), rand());
        ctx.sfx.play('tick');
      }, 85);
      var stops = [900, 1350, 1800], t0 = Date.now();
      for (var i = 0; i < 3; i++) {
        await sleep(Math.max(0, stops[i] - (Date.now() - t0)));
        stopped[i] = true; setReel(i, rand(), byId[res.reels[i]].icon, rand());
        reelEls[i].classList.remove('spinning'); reelEls[i].classList.add('land'); ctx.sfx.play('click');
      }
      clearInterval(timer);
      machine.classList.remove('go');
      if (!alive) return;

      if (res.win && res.payout <= bet) {
        msg.className = 'result-msg'; msg.textContent = '🍒🍒 Recuperás tu apuesta'; ctx.sfx.play('click');
      } else if (res.win) {
        var big = res.mult >= 10;
        machine.classList.add(big ? 'bigwin' : 'win');
        reelEls.forEach(function (r, i) { if (res.line ? res.line[i] : true) r.children[1].classList.add('hit'); });
        msg.className = 'result-msg win';
        msg.textContent = '¡Ganaste! +' + fmt(res.payout - bet) + ' 🪙';
        if (!(await ctx.celebrate(res.payout, bet))) { ctx.sfx.play('win'); ctx.fx.burst({ count: 50, coins: true, y: window.innerHeight * 0.4 }); }
      } else {
        msg.className = 'result-msg lose'; msg.textContent = 'Sin premio esta vez'; ctx.sfx.play('lose');
      }
      ctx.wallet.release();
      busy = false; spinBtn.disabled = false; picker.setDisabled(false);
    }

    return function cleanup() { alive = false; ctx.wallet.release(); };
  }
})();
