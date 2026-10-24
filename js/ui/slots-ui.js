/* Pantalla de la tragamonedas. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, sleep = CF.sleep, S = CF.Slots;

  CF.Games.push({ id: 'slots', name: 'Tragamonedas', icon: '🎰', desc: 'Tres rodillos, una línea de pago', color: 'pink', top: 'Hasta x500', mount: mount });

  function mount(ctx) {
    var rng = CF.RNG.create(), T = ctx.config.trucos || {};
    var bet = ctx.config.bets[0], busy = false, alive = true, turbo = false, autoLeft = 0;
    var icons = S.SYMBOLS.map(function (s) { return s.icon; });
    var byId = S.byId;
    var topSym = S.SYMBOLS.reduce(function (a, s) { return s.pay3 > a.pay3 ? s : a; });
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
    var spinBtn = h('button', { class: 'btn big', onClick: function () { if (autoLeft) stopAuto(); else spin(); } }, 'Girar');

    // Giro automático y turbo
    var autoRow = null, turboBtn = null;
    if (T.giroAutomatico) {
      turboBtn = h('button', { class: 'btn small gold', 'aria-pressed': 'false', onClick: function () { turbo = !turbo; turboBtn.classList.toggle('on', turbo); turboBtn.setAttribute('aria-pressed', String(turbo)); ctx.sfx.play('chip'); } }, '⚡ Turbo');
      autoRow = h('div', { class: 'auto-row' }, [10, 25, 50].map(function (n) {
        return h('button', { class: 'btn small cyan', onClick: function () { startAuto(n); } }, 'Auto ' + n);
      }), turboBtn);
    }

    var payRows = S.SYMBOLS.slice().reverse().map(function (s) {
      return h('div', { class: 'pay-row' }, h('span', null, s.icon + s.icon + s.icon), h('b', null, 'x' + s.pay3));
    });
    payRows.push(h('div', { class: 'pay-row' }, h('span', null, '🍒🍒 dos cerezas'), h('b', null, 'x' + S.TWO_CHERRIES)));
    var paytable = h('details', { class: 'paytable' }, h('summary', null, 'Tabla de premios'), h('div', null, payRows));

    ctx.el.append(h('div', { class: 'slot-wrap' }, machine, lever), msg, picker.el, spinBtn, autoRow, paytable);

    function setControls(enabled) {
      picker.setDisabled(!enabled || autoLeft > 0);
      spinBtn.disabled = !enabled && !autoLeft;
      if (autoRow) Array.prototype.forEach.call(autoRow.children, function (b) { if (b !== turboBtn) b.disabled = !enabled || autoLeft > 0; });
      spinBtn.textContent = autoLeft ? 'Parar auto (' + autoLeft + ')' : 'Girar';
      spinBtn.classList.toggle('dark', autoLeft > 0);
    }

    async function startAuto(n) {
      if (busy || autoLeft) return;
      autoLeft = n; setControls(false);
      while (autoLeft > 0 && alive) {
        var ok = await spin(true);
        if (!ok) break;
        autoLeft = Math.max(0, autoLeft - 1); setControls(false);
        if (autoLeft) await sleep(turbo ? 150 : 450);
      }
      autoLeft = 0; if (alive) setControls(true);
    }
    function stopAuto() { autoLeft = 0; setControls(!busy); }

    // Devuelve false si no se pudo girar (sin fichas).
    async function spin(fromAuto) {
      if (busy) return false;
      busy = true; setControls(false);
      if (!(await ctx.wallet.debit(bet))) { busy = false; setControls(true); return false; }
      machine.classList.remove('win', 'bigwin'); machine.classList.add('go');
      reelEls.forEach(function (r) { Array.prototype.forEach.call(r.children, function (c) { c.classList.remove('hit', 'tease'); }); });
      lever.classList.add('pull'); setTimeout(function () { lever.classList.remove('pull'); }, 350);
      msg.className = 'result-msg'; msg.textContent = 'Girando…';

      var res = S.spin(rng, bet);                       // el resultado ya está decidido…
      ctx.wallet.hold();
      if (res.payout > 0) await ctx.wallet.credit(res.payout); // …y acreditado; ahora solo se anima.

      // "Casi ganás": solo cambia lo que se ve fuera de la línea de pago; el resultado es el mismo.
      var lose = !res.win, tease = T.casiGanas && lose && res.reels[0] === res.reels[1];
      var aboveLine = T.casiGanas && lose && !tease && rng.next() < 0.35;

      var stopped = [false, false, false];
      reelEls.forEach(function (r) { r.classList.remove('land'); r.classList.add('spinning'); });
      var timer = setInterval(function () {
        for (var i = 0; i < 3; i++) if (!stopped[i]) setReel(i, rand(), rand(), rand());
        ctx.sfx.play('tick');
      }, 85);
      var stops = turbo ? [380, 560, 740] : [900, 1350, 1800], t0 = Date.now();
      for (var i = 0; i < 3; i++) {
        if (i === 2 && tease) {                           // el tercer rodillo tarda más, con suspenso
          machine.classList.add('tease'); msg.textContent = '¡Vamos… vamos…!'; ctx.sfx.play('tease');
          stops[2] += turbo ? 700 : 1500;
        }
        await sleep(Math.max(0, stops[i] - (Date.now() - t0)));
        stopped[i] = true;
        var top = rand(), bottom = rand();
        if (aboveLine) top = topSym.icon;
        if (i === 2 && tease) { if (rng.next() < 0.5) top = byId[res.reels[0]].icon; else bottom = byId[res.reels[0]].icon; }
        setReel(i, top, byId[res.reels[i]].icon, bottom);
        reelEls[i].classList.remove('spinning'); reelEls[i].classList.add('land'); ctx.sfx.play('click');
      }
      clearInterval(timer);
      machine.classList.remove('go', 'tease');
      if (!alive) return false;

      if (res.win && res.payout <= bet) {
        if (T.festejarRecuperos) {
          machine.classList.add('win');
          reelEls.forEach(function (r) { var c = r.children[1]; if (c.textContent === byId.cherry.icon) c.classList.add('hit'); });
          msg.className = 'result-msg win'; msg.textContent = '¡Ganaste ' + fmt(res.payout) + '! 🪙';
          ctx.sfx.play('win'); ctx.fx.burst({ count: 40, coins: true, y: window.innerHeight * 0.4 });
        } else { msg.className = 'result-msg'; msg.textContent = '🍒🍒 Recuperás tu apuesta'; ctx.sfx.play('click'); }
      } else if (res.win) {
        var big = res.mult >= 10;
        machine.classList.add(big ? 'bigwin' : 'win');
        reelEls.forEach(function (r) { r.children[1].classList.add('hit'); });
        msg.className = 'result-msg win';
        msg.textContent = '¡Ganaste! +' + fmt(res.payout - bet) + ' 🪙';
        if (!(await ctx.celebrate(res.payout, bet))) { ctx.sfx.play('win'); ctx.fx.burst({ count: 50, coins: true, y: window.innerHeight * 0.4 }); }
      } else if (tease) {
        reelEls[2].children[byId[res.reels[0]].icon === reelEls[2].children[0].textContent ? 0 : 2].classList.add('tease');
        msg.className = 'result-msg lose'; msg.textContent = '¡Casi! Por un pelo 😱'; ctx.sfx.play('lose');
      } else if (aboveLine) {
        reelEls.forEach(function (r) { r.children[0].classList.add('tease'); });
        msg.className = 'result-msg lose'; msg.textContent = '¡Uy! Pasaron justo arriba de la línea'; ctx.sfx.play('lose');
      } else {
        msg.className = 'result-msg lose'; msg.textContent = 'Sin premio esta vez'; ctx.sfx.play('lose');
      }
      ctx.wallet.release();
      busy = false; if (!autoLeft) setControls(true);
      return true;
    }

    return function cleanup() { alive = false; autoLeft = 0; ctx.wallet.release(); };
  }
})();
