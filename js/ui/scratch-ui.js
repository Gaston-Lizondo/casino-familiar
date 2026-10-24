/* Pantalla de raspadita: se raspa con el dedo (o el mouse) para descubrir los premios. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, SC = CF.Scratch;

  CF.Games.push({ id: 'scratch', name: 'Raspadita', icon: '🎟️', desc: 'Encontrá tres iguales', color: 'violet', top: 'Hasta x200', mount: mount });

  var W = 480, H = 320;

  function mount(ctx) {
    var rng = CF.RNG.create();
    var bet = ctx.config.bets[0], busy = false, card = null, revealed = true, alive = true, moves = 0, drawing = false;

    var grid = h('div', { class: 'scratch-grid' });
    var canvas = h('canvas', { class: 'scratch-canvas', width: W, height: H });
    var stage = h('div', { class: 'scratch-stage' }, grid, canvas);
    var ticket = h('div', { class: 'ticket' }, h('h2', { class: 'ticket-title' }, 'La Raspadita'), stage);
    var msg = h('div', { class: 'result-msg' }, 'Comprá una raspadita y rascá');
    var picker = CF.betPicker({ bets: ctx.config.bets, value: bet, label: 'Precio', onChange: function (v) { bet = v; } });
    var buyBtn = h('button', { class: 'btn big violet', onClick: buy }, 'Comprar');
    var allBtn = h('button', { class: 'btn gold', onClick: function () { reveal(true); } }, 'Rascar todo');
    allBtn.style.display = 'none';
    var legend = h('div', { class: 'scratch-legend' }, SC.SYMBOLS.map(function (s) { return h('span', null, s.icon + ' x' + s.mult); }));

    ctx.el.append(ticket, msg, legend, picker.el, buyBtn, allBtn);
    renderIdle();

    function renderIdle() {
      grid.replaceChildren.apply(grid, Array.from({ length: SC.CELLS }, function () { return h('div', { class: 'scell' }, '❔'); }));
      canvas.style.display = 'none';
    }

    function coverCanvas() {
      var c = canvas.getContext('2d');
      c.globalCompositeOperation = 'source-over';
      var g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#d9d2c0'); g.addColorStop(0.5, '#fbf3d8'); g.addColorStop(1, '#b9ad8c');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(120,90,30,.16)'; c.lineWidth = 2;
      for (var d = -H; d < W; d += 16) { c.beginPath(); c.moveTo(d, H); c.lineTo(d + H, 0); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.55)';
      for (var i = 0; i < 90; i++) { c.beginPath(); c.arc(rng.next() * W, rng.next() * H, 1 + rng.next() * 2.5, 0, 6.3); c.fill(); }
      c.fillStyle = 'rgba(90,60,10,.6)'; c.font = '78px Yellowtail, cursive'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('¡Rascá acá!', W / 2, H / 2);
      canvas.style.display = ''; canvas.style.opacity = '1';
    }

    async function buy() {
      if (busy || !revealed) return;
      busy = true; buyBtn.disabled = true; picker.setDisabled(true);
      if (!(await ctx.wallet.debit(bet))) { busy = false; buyBtn.disabled = false; picker.setDisabled(false); return; }
      card = SC.generate(rng, bet);
      if ((ctx.config.trucos || {}).casiGanas && !card.win && rng.next() < 0.6) card.cells = nearMiss(card.cells);
      ctx.wallet.hold();
      if (card.payout > 0) await ctx.wallet.credit(card.payout);   // ya acreditado; rascar es solo ver el resultado

      grid.replaceChildren.apply(grid, card.cells.map(function (id) {
        var s = SC.byId[id]; return h('div', { class: 'scell', 'data-id': id }, h('span', { class: 'si' }, s.icon), h('small', null, 'x' + s.mult));
      }));
      revealed = false; moves = 0; coverCanvas();
      msg.className = 'result-msg'; msg.textContent = 'Rascá con el dedo. Hay premio si hay tres iguales';
      ctx.sfx.play('card'); allBtn.style.display = '';
    }

    // "Casi ganás": en un cartón perdedor pone exactamente dos símbolos grandes (💎 o ⭐). Sigue sin premio.
    function nearMiss(cells) {
      var sym = rng.next() < 0.6 ? 'diamond' : 'star', out = cells.slice();
      var have = out.filter(function (c) { return c === sym; }).length;
      var idx = rng.shuffle(out.map(function (c, i) { return c === sym ? -1 : i; }).filter(function (i) { return i >= 0; }));
      for (var k = 0; k < 2 - have; k++) out[idx[k]] = sym;
      return SC.evaluate(out).mult === 0 ? out : cells;
    }

    function clearedFraction() {
      var d = canvas.getContext('2d').getImageData(0, 0, W, H).data, n = 0, total = 0;
      for (var i = 3; i < d.length; i += 64) { total++; if (d[i] < 20) n++; }
      return n / total;
    }

    function scratchAt(e) {
      var r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
      var c = canvas.getContext('2d'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; // opaco: borra del todo
      c.beginPath(); c.arc(x, y, 26, 0, 6.3); c.fill();
      if (++moves % 6 === 0) { ctx.sfx.play('tick'); if (clearedFraction() > 0.55) reveal(false); }
    }
    canvas.addEventListener('pointerdown', function (e) { if (revealed) return; drawing = true; canvas.setPointerCapture(e.pointerId); scratchAt(e); e.preventDefault(); });
    canvas.addEventListener('pointermove', function (e) { if (drawing && !revealed) { scratchAt(e); e.preventDefault(); } });
    canvas.addEventListener('pointerup', function () { drawing = false; });
    canvas.addEventListener('pointercancel', function () { drawing = false; });

    async function reveal() {
      if (revealed || !card) return;
      revealed = true; drawing = false; allBtn.style.display = 'none';
      canvas.style.opacity = '0';
      setTimeout(function () { canvas.style.display = 'none'; }, 450);
      if (card.win) {
        Array.prototype.forEach.call(grid.children, function (el) { if (el.getAttribute('data-id') === card.symbol) el.classList.add('hit'); });
        msg.className = 'result-msg win'; msg.textContent = '¡Tres ' + SC.byId[card.symbol].icon + '! Ganaste +' + fmt(card.payout - card.bet) + ' 🪙';
        if (!(await ctx.celebrate(card.payout, card.bet))) { ctx.sfx.play('win'); ctx.fx.burst({ count: 50, coins: true, y: window.innerHeight * 0.4 }); }
        if (!alive) return;
      } else {
        var two = ['diamond', 'star'].filter(function (id) { return card.cells.filter(function (c) { return c === id; }).length === 2; })[0];
        if (two) Array.prototype.forEach.call(grid.children, function (el) { if (el.getAttribute('data-id') === two) el.classList.add('tease'); });
        msg.className = 'result-msg lose'; msg.textContent = two ? '¡Casi! Te faltó un ' + SC.byId[two].icon + ' para x' + SC.byId[two].mult : 'Ningún premio. ¡Probá otra!'; ctx.sfx.play('lose');
      }
      ctx.wallet.release();
      busy = false; buyBtn.disabled = false; picker.setDisabled(false);
    }

    return function cleanup() { alive = false; ctx.wallet.release(); };
  }
})();
