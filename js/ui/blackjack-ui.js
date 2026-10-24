/* Pantalla de blackjack. La mesa (estado) vive en el motor y se guarda para retomar la mano si se cierra la app. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, sleep = CF.sleep, BJ = CF.Blackjack;

  CF.Games.push({ id: 'blackjack', name: 'Blackjack', icon: '🃏', desc: 'Llegá a 21 sin pasarte. Blackjack paga 3:2', color: 'mint', mount: mount });

  function cardEl(c) {
    if (!c) return h('div', { class: 'pcard back' });
    var red = c.s === '♥' || c.s === '♦';
    return h('div', { class: 'pcard deal' + (red ? ' red' : '') }, h('div', { class: 'corner' }, c.r, h('small', null, c.s)), h('div', { class: 'pip' }, c.s));
  }

  function mount(ctx) {
    var rng = CF.RNG.create(), seatId = ctx.profile.id, key = 'bj.' + seatId;
    var table = BJ.createTable([seatId]);
    var bet = ctx.config.bets[0], busy = true, dealerShown = 2, msg = '', msgKind = '', alive = true;

    var dealerCards = h('div', { class: 'hand' }), playerCards = h('div', { class: 'hand' });
    var dealerTot = h('span', { class: 'tot' }), playerTot = h('span', { class: 'tot' });
    var msgEl = h('div', { class: 'result-msg' });
    var betInfo = h('div', { class: 'bj-bet' });
    var picker = CF.betPicker({ bets: ctx.config.bets, value: bet, onChange: function (v) { bet = v; persist(); } });
    var dealBtn = h('button', { class: 'btn big mint', onClick: deal }, 'Repartir');
    var hitBtn = h('button', { class: 'btn big sm cyan', onClick: function () { act('hit'); } }, 'Pedir');
    var standBtn = h('button', { class: 'btn big sm', onClick: function () { act('stand'); } }, 'Plantarse');
    var dblBtn = h('button', { class: 'btn big sm gold', onClick: function () { act('double'); } }, 'Doblar');
    var actions = h('div', { class: 'bj-actions' }, hitBtn, standBtn, dblBtn);

    ctx.el.append(
      h('div', { class: 'bj-table' },
        h('div', { class: 'bj-side' }, h('div', { class: 'bj-label' }, 'Crupier ', dealerTot), dealerCards),
        h('div', { class: 'bj-side' }, h('div', { class: 'bj-label' }, ctx.profile.emoji + ' ' + ctx.profile.name + ' ', playerTot), playerCards, betInfo)),
      msgEl, picker.el, dealBtn, actions);

    function persist() { return ctx.saveGame(key, { table: table, bet: bet }); }

    function render() {
      var seat = table.seats[0], inRound = table.phase === 'player', done = table.phase === 'done';
      var showDealer = inRound ? [table.dealer[0], null] : table.dealer.slice(0, dealerShown);
      dealerCards.replaceChildren.apply(dealerCards, (table.dealer.length ? showDealer : []).map(cardEl));
      playerCards.replaceChildren.apply(playerCards, seat.cards.map(cardEl));

      if (!table.dealer.length) dealerTot.textContent = '';
      else if (inRound) dealerTot.textContent = '· ' + BJ.cardValue(table.dealer[0].r);
      else dealerTot.textContent = '· ' + BJ.handValue(table.dealer.slice(0, dealerShown)).total;
      playerTot.textContent = seat.cards.length ? '· ' + BJ.handValue(seat.cards).total : '';
      betInfo.replaceChildren.apply(betInfo, (inRound || done) && seat.bet ? [h('span', { class: 'coin' }), 'Apuesta ' + fmt(seat.bet)] : []);

      msgEl.className = 'result-msg ' + msgKind;
      msgEl.textContent = msg || (inRound ? 'Tu turno' : 'Elegí tu apuesta y repartí');

      var betting = !inRound && !busy;
      picker.el.style.display = dealBtn.style.display = betting ? '' : 'none';
      actions.style.display = inRound && !busy ? '' : 'none';
      dealBtn.textContent = done ? 'Nueva mano' : 'Repartir';
      dblBtn.disabled = !BJ.canDouble(table, seatId);
    }

    function resultText(seat) {
      var net = seat.payout - seat.bet;
      switch (seat.result) {
        case 'blackjack': return ['¡Blackjack! +' + fmt(net) + ' 🪙', 'win'];
        case 'win': return ['¡Ganaste! +' + fmt(net) + ' 🪙', 'win'];
        case 'push': return ['Empate: recuperás tu apuesta', ''];
        default: return [seat.status === 'bust' ? 'Te pasaste de 21. Perdiste ' + fmt(seat.bet) + ' 🪙' : 'Gana la casa. Perdiste ' + fmt(seat.bet) + ' 🪙', 'lose'];
      }
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
      ctx.sfx.play(seat.result === 'blackjack' ? 'bigwin' : seat.result === 'win' ? 'win' : seat.result === 'push' ? 'click' : 'lose');
      if (seat.result === 'blackjack') ctx.fx.rain(2400); else if (seat.result === 'win') ctx.fx.burst({ count: 50, coins: true, y: window.innerHeight * 0.35 });
      ctx.wallet.release(); busy = false; render();
    }

    async function deal() {
      if (busy || table.phase === 'player') return;
      busy = true; render();
      if (!(await ctx.wallet.debit(bet))) { busy = false; render(); return; }
      var o = {}; o[seatId] = bet;
      table = BJ.startRound(table, rng, o);
      dealerShown = 2; msg = ''; msgKind = ''; ctx.sfx.play('card'); render();
      if (table.phase === 'done') await finishRound();
      else { await persist(); busy = false; render(); }
    }

    async function act(action) {
      if (busy || table.phase !== 'player') return;
      busy = true; render();
      if (action === 'double') {
        var extra = BJ.extraBetRequired(table, seatId, 'double');
        if (!extra || !(await ctx.wallet.debit(extra))) { busy = false; render(); return; }
      }
      table = BJ.act(table, seatId, action); ctx.sfx.play('card'); render();
      if (table.phase === 'done') await finishRound();
      else { await persist(); busy = false; render(); }
    }

    // Retomar una mano guardada (si la hay).
    ctx.loadGame(key).then(function (saved) {
      if (!alive) return;
      if (saved && saved.table && saved.table.v === 1) {
        table = saved.table; if (saved.bet) { bet = saved.bet; picker.set(bet); }
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
