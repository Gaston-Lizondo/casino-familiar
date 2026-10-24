/* Pantalla de raspadita: se raspa con el dedo (o el mouse) para descubrir los premios. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, SC = CF.Scratch;

  CF.Games.push({ id: 'scratch', name: 'Raspadita', icon: '🎟️', desc: 'Encontrá 3 iguales · paga hasta x200', color: 'purple', mount: mount });

  var W = 480, H = 320;

  function mount(ctx) {
    var rng = CF.RNG.create();
    var bet = ctx.config.bets[0], busy = false, card = null, revealed = true, alive = true, moves = 0, drawing = false;

    var grid = h('div', { class: 'scratch-grid' });
    var canvas = h('canvas', { class: 'scratch-canvas', width: W, height: H });
    var stage = h('div', { class: 'scratch-stage' }, grid, canvas);
    var msg = h('div', { class: 'result-msg' }, 'Comprá una raspadita y rascá');
    var picker = CF.betPicker({ bets: ctx.config.bets, value: bet, label: 'Precio', onChange: function (v) { bet = v; } });
    var buyBtn = h('button', { class: 'btn big purple', onClick: buy }, 'COMPRAR');
    var allBtn = h('button', { class: 'btn', onClick: function () { reveal(true); } }, '✨ Rascar todo');
    allBtn.style.display = 'none';
    var legend = h('div', { class: 'scratch-legend' }, SC.SYMBOLS.map(function (s) { return h('span', null, s.icon + ' x' + s.mult); }));

    ctx.el.append(stage, msg, legend, picker.el, buyBtn, allBtn);
    renderIdle();

    function renderIdle() {
      grid.replaceChildren.apply(grid, Array.from({ length: SC.CELLS }, function () { return h('div', { class: 'scell' }, '❔'); }));
      canvas.style.display = 'none';
    }

    function coverCanvas() {
      var c = canvas.getContext('2d');
      c.globalCompositeOperation = 'source-over';
      var g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#c9ccd8'); g.addColorStop(0.5, '#eef0f8'); g.addColorStop(1, '#a9adbf');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(80,60,160,.18)';
      for (var i = 0; i < 160; i++) { c.beginPath(); c.arc(rng.next() * W, rng.next() * H, 1 + rng.next() * 3, 0, 6.3); c.fill(); }
      c.fillStyle = 'rgba(70,50,150,.55)'; c.font = 'bold 34px Orbitron, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('RASCÁ ACÁ', W / 2, H / 2 - 18); c.font = 'bold 22px Rubik, sans-serif'; c.fillText('✦ ✦ ✦', W / 2, H / 2 + 28);
      canvas.style.display = ''; canvas.style.opacity = '1';
    }

    async function buy() {
      if (busy || !revealed) return;
      busy = true; buyBtn.disabled = true; picker.setDisabled(true);
      if (!(await ctx.wallet.debit(bet))) { busy = false; buyBtn.disabled = false; picker.setDisabled(false); return; }
      card = SC.generate(rng, bet);
      ctx.wallet.hold();
      if (card.payout > 0) await ctx.wallet.credit(card.payout);   // ya acreditado; rascar es solo ver el resultado

      grid.replaceChildren.apply(grid, card.cells.map(function (id) {
        var s = SC.byId[id]; return h('div', { class: 'scell', 'data-id': id }, h('span', { class: 'si' }, s.icon), h('small', null, 'x' + s.mult));
      }));
      revealed = false; moves = 0; coverCanvas();
      msg.className = 'result-msg'; msg.textContent = '¡Rascá con el dedo! Hay premio si hay 3 iguales';
      ctx.sfx.play('card'); allBtn.style.display = '';
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

    function reveal() {
      if (revealed || !card) return;
      revealed = true; drawing = false; allBtn.style.display = 'none';
      canvas.style.opacity = '0';
      setTimeout(function () { canvas.style.display = 'none'; }, 450);
      if (card.win) {
        Array.prototype.forEach.call(grid.children, function (el) { if (el.getAttribute('data-id') === card.symbol) el.classList.add('hit'); });
        msg.className = 'result-msg win'; msg.textContent = '🎉 ¡3 ' + SC.byId[card.symbol].icon + '! Ganaste +' + fmt(card.payout - card.bet) + ' 🪙';
        ctx.sfx.play(card.mult >= 10 ? 'bigwin' : 'win');
      } else { msg.className = 'result-msg lose'; msg.textContent = 'Ningún premio… ¡probá otra!'; ctx.sfx.play('lose'); }
      ctx.wallet.release();
      busy = false; buyBtn.disabled = false; picker.setDisabled(false);
    }

    return function cleanup() { alive = false; ctx.wallet.release(); };
  }
})();
