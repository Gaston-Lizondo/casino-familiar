/* Pantalla de blackjack. La mesa (estado) vive en el motor y se guarda para retomar la mano si se cierra la app. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, sleep = CF.sleep, BJ = CF.Blackjack;

  CF.Games.push({ id: 'blackjack', name: 'Blackjack', icon: '🃏', desc: 'Llegá a 21 sin pasarte. Blackjack paga 3:2', color: 'mint', mount: mount });

  var seen = {}; // cartas que ya se animaron: así solo entra con animación la carta nueva

  function cardEl(c, key) {
    if (!c) return h('div', { class: 'pcard back' });
    var red = c.s === '♥' || c.s === '♦', fresh = !seen[key]; seen[key] = true;
    return h('div', { class: 'pcard' + (fresh ? ' deal' : '') + (red ? ' red' : '') }, h('div', { class: 'corner' }, c.r, h('small', null, c.s)), h('div', { class: 'pip' }, c.s));
  }

  var TAGS = { blackjack: ['Blackjack', 'win'], win: ['Gana', 'win'], push: ['Empate', ''], lose: ['Pierde', 'lose'] };

  function mount(ctx) {
    var rng = CF.RNG.create(), seatId = ctx.profile.id, key = 'bj.' + seatId;
    var table = BJ.createTable([seatId]);
    var bet = ctx.config.bets[0], busy = true, dealerShown = 2, msg = '', msgKind = '', alive = true;

    var dealerCards = h('div', { class: 'hand' }), handsEl = h('div', { class: 'bj-hands' });
    var dealerTot = h('span', { class: 'tot' });
    var msgEl = h('div', { class: 'result-msg' });
    var betInfo = h('div', { class: 'bj-bet' });
    var picker = CF.betPicker({ bets: ctx.config.bets, value: bet, onChange: function (v) { bet = v; persist(); } });
    var dealBtn = h('button', { class: 'btn big mint', onClick: deal }, 'Repartir');
    var hitBtn = h('button', { class: 'btn big sm cyan', onClick: function () { act('hit'); } }, 'Pedir');
    var standBtn = h('button', { class: 'btn big sm', onClick: function () { act('stand'); } }, 'Plantarse');
    var dblBtn = h('button', { class: 'btn big sm gold', onClick: function () { act('double'); } }, 'Doblar');
    var splitBtn = h('button', { class: 'btn big sm pink', onClick: function () { act('split'); } }, 'Separar');
    var actions = h('div', { class: 'bj-actions' }, hitBtn, standBtn, dblBtn, splitBtn);
    var insureBtn = h('button', { class: 'btn big sm gold', onClick: function () { act('insurance'); } }, 'Seguro');
    var noInsBtn = h('button', { class: 'btn big sm', onClick: function () { act('noinsurance'); } }, 'No, gracias');
    var insureBar = h('div', { class: 'bj-actions two' }, insureBtn, noInsBtn);

    ctx.el.append(
      h('div', { class: 'bj-table' },
        h('div', { class: 'bj-side' }, h('div', { class: 'bj-label' }, 'Crupier ', dealerTot), dealerCards),
        h('div', { class: 'bj-side' }, h('div', { class: 'bj-label' }, ctx.profile.emoji + ' ' + ctx.profile.name), handsEl, betInfo)),
      msgEl, picker.el, dealBtn, actions, insureBar);

    function persist() { return ctx.saveGame(key, { table: table, bet: bet }); }

    function handEl(hd, hi, multi, seat, inPlay, done) {
      var v = BJ.handValue(hd.cards);
      var active = inPlay && table.phase === 'player' && seat.cur === hi;
      var tag = done && hd.result ? TAGS[hd.result] : null;
      return h('div', { class: 'bj-hand' + (multi ? ' multi' : '') + (active && multi ? ' active' : '') },
        h('div', { class: 'bj-hand-head' },
          h('span', { class: 'tot' }, v.total + (v.soft && !v.bust ? ' blando' : '')),
          h('span', { class: 'bj-hbet' }, h('span', { class: 'coin' }), fmt(hd.bet)),
          tag ? h('span', { class: 'bj-tag ' + tag[1] }, tag[0]) : null),
        h('div', { class: 'hand' }, hd.cards.map(function (c, ci) { return cardEl(c, table.round + ':' + hi + ':' + ci + c.r + c.s); })));
    }

    function render() {
      var seat = table.seats[0], phase = table.phase;
      var inRound = phase === 'player' || phase === 'insurance', done = phase === 'done';
      var showDealer = inRound ? [table.dealer[0], null] : table.dealer.slice(0, dealerShown);
      dealerCards.replaceChildren.apply(dealerCards, (table.dealer.length ? showDealer : []).map(function (c, i) { return cardEl(c, table.round + ':d' + i + (c ? c.r + c.s : '')); }));
      var multi = seat.hands.length > 1;
      handsEl.replaceChildren.apply(handsEl, seat.hands.map(function (hd, hi) { return handEl(hd, hi, multi, seat, inRound, done && dealerShown >= table.dealer.length); }));

      if (!table.dealer.length) dealerTot.textContent = '';
      else if (inRound) dealerTot.textContent = '· ' + BJ.cardValue(table.dealer[0].r);
      else dealerTot.textContent = '· ' + BJ.handValue(table.dealer.slice(0, dealerShown)).total;
      betInfo.replaceChildren.apply(betInfo, seat.insurance > 0 ? [h('span', { class: 'coin' }), 'Seguro ' + fmt(seat.insurance)] : []);

      msgEl.className = 'result-msg ' + msgKind;
      msgEl.textContent = msg || (phase === 'insurance' ? 'El crupier muestra un As: ¿querés seguro?'
        : phase === 'player' ? (multi ? 'Mano ' + (seat.cur + 1) + ' de ' + seat.hands.length : 'Tu turno') : 'Elegí tu apuesta y repartí');

      var betting = !inRound && !busy;
      picker.el.style.display = dealBtn.style.display = betting ? '' : 'none';
      actions.style.display = phase === 'player' && !busy ? '' : 'none';
      insureBar.style.display = phase === 'insurance' && !busy ? '' : 'none';
      dealBtn.textContent = done ? 'Nueva mano' : 'Repartir';
      dblBtn.style.display = BJ.canDouble(table, seatId) ? '' : 'none';
      splitBtn.style.display = BJ.canSplit(table, seatId) ? '' : 'none';
      dblBtn.textContent = 'Doblar'; splitBtn.textContent = 'Separar';
      insureBtn.textContent = 'Seguro (' + fmt(BJ.extraBetRequired(table, seatId, 'insurance')) + ')';
    }

    function resultText(seat) {
      var net = seat.payout - seat.wagered, hd = seat.hands[0];
      if (seat.hands.length === 1 && !seat.insurance) {
        switch (hd.result) {
          case 'blackjack': return ['¡Blackjack! +' + fmt(net) + ' 🪙', 'win'];
          case 'win': return ['¡Ganaste! +' + fmt(net) + ' 🪙', 'win'];
          case 'push': return ['Empate: recuperás tu apuesta', ''];
          default: return [hd.status === 'bust' ? 'Te pasaste de 21. Perdiste ' + fmt(hd.bet) + ' 🪙' : 'Gana la casa. Perdiste ' + fmt(hd.bet) + ' 🪙', 'lose'];
        }
      }
      var extra = seat.insPayout > 0 ? ' (el seguro pagó)' : '';
      if (net > 0) return ['¡Ganaste! +' + fmt(net) + ' 🪙' + extra, 'win'];
      if (net === 0) return ['Quedaste a mano' + extra, ''];
      return ['Gana la casa. Perdiste ' + fmt(-net) + ' 🪙' + extra, 'lose'];
    }

    function resultSound(seat) {
      var net = seat.payout - seat.wagered;
      if (seat.hands.some(function (x) { return x.result === 'blackjack'; }) && net > 0) return 'bigwin';
      return net > 0 ? 'win' : net === 0 ? 'click' : 'lose';
    }

    async function finishRound() {
      var seat = table.seats[0];
      busy = true; ctx.wallet.hold(); msg = ''; msgKind = ''; render();
      if (seat.payout > 0) await ctx.wallet.credit(seat.payout);
      await persist();
      dealerShown = 2; ctx.sfx.play('card'); render();            // se da vuelta la carta oculta
      for (var i = 3; i <= table.dealer.length; i++) {
        await sleep(700); if (!alive) return;
        dealerShown = i; ctx.sfx.play('card'); render();
      }
      await sleep(500); if (!alive) return;
      var r = resultText(seat); msg = r[0]; msgKind = r[1];
      var snd = resultSound(seat);
      ctx.sfx.play(snd);
      if (snd === 'bigwin') ctx.fx.rain(2400); else if (snd === 'win') ctx.fx.burst({ count: 50, coins: true, y: window.innerHeight * 0.35 });
      ctx.wallet.release(); busy = false; render();
    }

    async function deal() {
      if (busy || table.phase === 'player' || table.phase === 'insurance') return;
      busy = true; render();
      if (!(await ctx.wallet.debit(bet))) { busy = false; render(); return; }
      var o = {}; o[seatId] = bet;
      seen = {};
      table = BJ.startRound(table, rng, o);
      dealerShown = 2; msg = ''; msgKind = ''; ctx.sfx.play('card'); render();
      if (table.phase === 'done') await finishRound();
      else { await persist(); busy = false; render(); }
    }

    async function act(action) {
      if (busy || (table.phase !== 'player' && table.phase !== 'insurance')) return;
      busy = true; render();
      if (action === 'double' || action === 'split' || action === 'insurance') {
        var extra = BJ.extraBetRequired(table, seatId, action);
        if (!extra || !(await ctx.wallet.debit(extra))) { busy = false; render(); return; }
      }
      table = BJ.act(table, seatId, action); ctx.sfx.play('card'); render();
      if (table.phase === 'done') await finishRound();
      else { await persist(); busy = false; render(); }
    }

    // Retomar una mano guardada (si la hay; también las del formato anterior).
    ctx.loadGame(key).then(function (saved) {
      if (!alive) return;
      var saved_t = saved && BJ.migrate(saved.table);
      if (saved_t) {
        table = saved_t; if (saved.bet) { bet = saved.bet; picker.set(bet); }
        if (table.phase === 'done') {
          dealerShown = table.dealer.length;
          var r = resultText(table.seats[0]); msg = r[0]; msgKind = r[1];
        }
      }
      busy = false; render();
    });
    render();

    return function cleanup() { alive = false; ctx.wallet.release(); };
  }
})();
