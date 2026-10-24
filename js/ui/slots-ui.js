/* Pantalla de la tragamonedas. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, sleep = CF.sleep, S = CF.Slots;

  CF.Games.push({ id: 'slots', name: 'Tragamonedas', icon: '🎰', desc: '3 rodillos · pagan hasta x500', color: 'pink', mount: mount });

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

    var machine = h('div', { class: 'slot-machine' }, h('div', { class: 'reels' }, reelEls), h('div', { class: 'payline' }));
    var msg = h('div', { class: 'result-msg' }, 'Elegí tu apuesta y girá');
    var picker = CF.betPicker({ bets: ctx.config.bets, value: bet, onChange: function (v) { bet = v; } });
    var spinBtn = h('button', { class: 'btn big pink', onClick: spin }, 'GIRAR');

    var payRows = S.SYMBOLS.slice().reverse().map(function (s) {
      return h('div', { class: 'pay-row' }, h('span', null, s.icon + s.icon + s.icon), h('b', null, 'x' + s.pay3));
    });
    payRows.push(h('div', { class: 'pay-row' }, h('span', null, '🍒🍒 (2 cerezas)'), h('b', null, 'x' + S.TWO_CHERRIES)));
    var paytable = h('details', { class: 'paytable' }, h('summary', null, 'Tabla de premios'), h('div', null, payRows));

    ctx.el.append(machine, msg, picker.el, spinBtn, paytable);

    async function spin() {
      if (busy) return;
      busy = true; spinBtn.disabled = true; picker.setDisabled(true);
      if (!(await ctx.wallet.debit(bet))) { busy = false; spinBtn.disabled = false; picker.setDisabled(false); return; }
      machine.classList.remove('win', 'bigwin'); msg.className = 'result-msg'; msg.textContent = 'Girando…';

      var res = S.spin(rng, bet);                       // el resultado ya está decidido…
      ctx.wallet.hold();
      if (res.payout > 0) await ctx.wallet.credit(res.payout); // …y acreditado; ahora solo se anima.

      var stopped = [false, false, false];
      var timer = setInterval(function () {
        for (var i = 0; i < 3; i++) if (!stopped[i]) setReel(i, rand(), rand(), rand());
        ctx.sfx.play('tick');
      }, 85);
      var stops = [900, 1350, 1800], t0 = Date.now();
      for (var i = 0; i < 3; i++) {
        await sleep(Math.max(0, stops[i] - (Date.now() - t0)));
        stopped[i] = true; setReel(i, rand(), byId[res.reels[i]].icon, rand()); ctx.sfx.play('click');
      }
      clearInterval(timer);
      if (!alive) return;

      if (res.win && res.payout <= bet) {
        msg.className = 'result-msg'; msg.textContent = '🍒🍒 Recuperás tu apuesta'; ctx.sfx.play('click');
      } else if (res.win) {
        var big = res.mult >= 25;
        machine.classList.add(big ? 'bigwin' : 'win');
        msg.className = 'result-msg win';
        msg.textContent = (big ? '🎉 ¡PREMIAZO! ' : '✨ ¡Ganaste! ') + '+' + fmt(res.payout - bet) + ' 🪙';
        ctx.sfx.play(big ? 'bigwin' : 'win');
      } else {
        msg.className = 'result-msg lose'; msg.textContent = 'Casi… ¡probá de nuevo!'; ctx.sfx.play('lose');
      }
      ctx.wallet.release();
      busy = false; spinBtn.disabled = false; picker.setDisabled(false);
    }

    return function cleanup() { alive = false; ctx.wallet.release(); };
  }
})();
