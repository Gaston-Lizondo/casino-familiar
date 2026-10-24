/* Pantalla de la ruleta. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, sleep = CF.sleep, R = CF.Roulette;

  CF.Games.push({ id: 'roulette', name: 'Ruleta', icon: '🎡', desc: 'Número, color o docena', color: 'cyan', top: 'Hasta x36', mount: mount });

  var FILL = { red: '#c4143f', black: '#1b0f2a', green: '#0e9b5e' };
  var SIZE = 252;

  function drawWheel(canvas) {
    var dpr = 2, c = canvas.getContext('2d'), half = SIZE / 2, seg = Math.PI * 2 / 37;
    canvas.width = canvas.height = SIZE * dpr; c.scale(dpr, dpr);
    canvas.style.width = canvas.style.height = SIZE + 'px';
    // aro dorado exterior
    var rim = c.createLinearGradient(0, 0, SIZE, SIZE);
    rim.addColorStop(0, '#ffe58f'); rim.addColorStop(0.5, '#b8801a'); rim.addColorStop(1, '#ffe58f');
    c.beginPath(); c.arc(half, half, half - 1, 0, Math.PI * 2); c.fillStyle = rim; c.fill();
    for (var i = 0; i < 37; i++) {
      var n = R.WHEEL[i], a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
      c.beginPath(); c.moveTo(half, half); c.arc(half, half, half - 11, a0, a1); c.closePath();
      c.fillStyle = FILL[R.colorOf(n)]; c.fill();
      c.strokeStyle = 'rgba(255, 229, 143, .55)'; c.lineWidth = 1; c.stroke();
      c.save(); c.translate(half, half); c.rotate(a0 + seg / 2); c.translate(half - 31, 0); c.rotate(Math.PI / 2);
      c.fillStyle = '#fff4dc'; c.font = '800 11px Figtree, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(n), 0, 0); c.restore();
    }
    // centro: platillo oscuro y torreta dorada
    c.beginPath(); c.arc(half, half, half * 0.5, 0, Math.PI * 2); c.fillStyle = '#12041c'; c.fill();
    c.lineWidth = 3; c.strokeStyle = '#ffc94a'; c.stroke();
    c.strokeStyle = 'rgba(255, 201, 74, .5)'; c.lineWidth = 3;
    for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.moveTo(half + Math.cos(a) * 14, half + Math.sin(a) * 14); c.lineTo(half + Math.cos(a) * half * 0.44, half + Math.sin(a) * half * 0.44); c.stroke(); }
    var g = c.createRadialGradient(half - 4, half - 4, 2, half, half, 16);
    g.addColorStop(0, '#fff1b8'); g.addColorStop(1, '#b8801a');
    c.beginPath(); c.arc(half, half, 16, 0, Math.PI * 2); c.fillStyle = g; c.fill();
  }

  function mount(ctx) {
    var rng = CF.RNG.create();
    var chip = ctx.config.bets[0], placed = [], lastBets = [], busy = false, rot = 0, ballRot = 0, history = [], alive = true;
    var badges = {};

    // --- Rueda
    var canvas = h('canvas', { class: 'wheel' });
    drawWheel(canvas);
    var ball = h('div', { class: 'ball-orbit' }, h('div', { class: 'ball' }));
    var wheelWrap = h('div', { class: 'wheel-wrap' }, canvas, ball, h('div', { class: 'wheel-pointer' }));
    var resultEl = h('div', { class: 'result-msg' }, 'Poné tus fichas en la mesa');
    var histEl = h('div', { class: 'history' });

    // --- Mesa
    function cell(def, label, cls) {
      var key = R.betKey(def), badge = h('span', { class: 'badge' });
      badges[key] = badge;
      return h('button', { class: 'rcell ' + cls, type: 'button', onClick: function () { place(def); } }, label, badge);
    }
    var board = [cell({ type: 'straight', n: 0 }, '0', 'green zero')];
    var nums = h('div', { class: 'nums' });
    for (var r = 0; r < 12; r++) for (var k = 1; k <= 3; k++) {
      var n = r * 3 + k;
      nums.appendChild(cell({ type: 'straight', n: n }, String(n), R.colorOf(n)));
    }
    var cols = h('div', { class: 'row3' }, [1, 2, 3].map(function (k) { return cell({ type: 'column', n: k }, 'Columna ' + k + ' (x3)', 'out'); }));
    var dozens = h('div', { class: 'row3' }, [1, 2, 3].map(function (k) { return cell({ type: 'dozen', n: k }, ['1 a 12', '13 a 24', '25 a 36'][k - 1] + ' (x3)', 'out'); }));
    var outs = h('div', { class: 'row3' },
      cell({ type: 'low' }, '1 a 18', 'out'), cell({ type: 'even' }, 'Par', 'out'), cell({ type: 'red' }, '🔴 Rojo', 'out redbtn'),
      cell({ type: 'black' }, '⚫ Negro', 'out blackbtn'), cell({ type: 'odd' }, 'Impar', 'out'), cell({ type: 'high' }, '19 a 36', 'out'));
    var boardEl = h('div', { class: 'board' }, board, nums, cols, dozens, outs);

    // --- Controles
    var picker = CF.betPicker({ bets: ctx.config.bets, value: chip, label: 'Ficha', onChange: function (v) { chip = v; } });
    var totalEl = h('b', null, '0');
    var undoBtn = h('button', { class: 'btn small gold', onClick: undo }, '↩ Deshacer');
    var clearBtn = h('button', { class: 'btn small gold', onClick: clear }, 'Borrar');
    var repeatBtn = h('button', { class: 'btn small gold', onClick: repeat }, '🔁 Repetir');
    var spinBtn = h('button', { class: 'btn big cyan', onClick: spin }, 'Girar');
    var tools = h('div', { class: 'tools' }, undoBtn, clearBtn, repeatBtn);
    // Barra fija abajo: siempre se ve el total y el botón, aunque estés bajando por la mesa.
    var spinBar = h('div', { class: 'spin-bar' }, h('div', { class: 'total-line' }, 'En la mesa', h('br'), totalEl), spinBtn);

    ctx.el.append(wheelWrap, resultEl, histEl, picker.el, tools, boardEl, spinBar);
    renderBets();

    function total() { return placed.reduce(function (a, b) { return a + b.amount; }, 0); }

    function renderBets() {
      var byKey = {};
      placed.forEach(function (p) { var k = R.betKey(p.def); byKey[k] = (byKey[k] || 0) + p.amount; });
      Object.keys(badges).forEach(function (k) {
        var v = byKey[k] || 0;
        badges[k].textContent = v ? fmt(v) : ''; badges[k].classList.toggle('on', !!v);
      });
      totalEl.textContent = fmt(total());
      spinBtn.disabled = busy || !placed.length;
      undoBtn.disabled = clearBtn.disabled = busy || !placed.length;
      repeatBtn.disabled = busy || !lastBets.length || placed.length > 0;
      picker.setDisabled(busy);
    }
    function place(def) { if (busy) return; placed.push({ def: def, amount: chip }); ctx.sfx.play('chip'); renderBets(); }
    function undo() { if (busy) return; placed.pop(); renderBets(); }
    function clear() { if (busy) return; placed = []; renderBets(); }
    function repeat() { if (busy || !lastBets.length) return; placed = lastBets.map(function (b) { return { def: b.def, amount: b.amount }; }); ctx.sfx.play('chip'); renderBets(); }

    function rotateTo(num) {
      var idx = R.WHEEL.indexOf(num), seg = 360 / 37;
      var center = (idx + 0.5) * seg + (rng.next() - 0.5) * seg * 0.7;
      var desired = (((360 - center) % 360) + 360) % 360;
      var cur = ((rot % 360) + 360) % 360;
      rot += ((desired - cur + 360) % 360) + 360 * (5 + rng.int(3));
      canvas.style.transform = 'rotate(' + rot + 'deg)';
      // La bolita gira al revés y termina arriba, justo bajo la flecha, sobre el número que salió.
      ballRot -= 360 * (7 + rng.int(3));
      ball.style.transform = 'rotate(' + ballRot + 'deg)';
    }

    async function spin() {
      if (busy || !placed.length) return;
      var stake = total();
      busy = true; renderBets();
      if (!(await ctx.wallet.debit(stake))) { busy = false; renderBets(); return; }
      var bets = placed.map(function (p) { return { type: p.def.type, n: p.def.n, amount: p.amount }; });
      lastBets = placed.map(function (p) { return { def: p.def, amount: p.amount }; });

      var number = R.spin(rng), res = R.resolve(bets, number);   // resultado decidido y acreditado ya
      ctx.wallet.hold();
      if (res.totalReturn > 0) await ctx.wallet.credit(res.totalReturn);

      resultEl.className = 'result-msg'; resultEl.textContent = 'La bolita está girando…';
      renderBets();
      window.scrollTo({ top: 0, behavior: 'smooth' });   // subir para ver la rueda
      var tick = setInterval(function () { ctx.sfx.play('tick'); }, 160);
      rotateTo(number);
      await sleep(4000);
      clearInterval(tick);
      if (!alive) return;

      var col = R.colorOf(number);
      history.unshift({ n: number, c: col }); history = history.slice(0, 12);
      histEl.replaceChildren.apply(histEl, history.map(function (x) { return h('span', { class: 'dot ' + x.c }, String(x.n)); }));
      var label = (col === 'red' ? '🔴 ' : col === 'black' ? '⚫ ' : '🟢 ') + number;
      if (res.net > 0) {
        resultEl.className = 'result-msg win'; resultEl.textContent = 'Salió ' + label + '. ¡Ganaste +' + fmt(res.net) + ' 🪙!';
        if (!(await ctx.celebrate(res.net + stake, stake))) { ctx.sfx.play('win'); ctx.fx.burst({ count: 55, coins: true, y: window.innerHeight * 0.3 }); }
        if (!alive) return;
      } else if (res.totalReturn > 0 && (ctx.config.trucos || {}).festejarRecuperos) {
        // Cobró algo pero no más de lo que apostó: se festeja igual (truco de casino online).
        resultEl.className = 'result-msg win'; resultEl.textContent = 'Salió ' + label + '. ¡Cobraste ' + fmt(res.totalReturn) + '! 🪙';
        ctx.sfx.play('win'); ctx.fx.burst({ count: 40, coins: true, y: window.innerHeight * 0.3 });
      } else if (res.net === 0) { resultEl.className = 'result-msg'; resultEl.textContent = 'Salió ' + label + '. Quedaste a mano'; ctx.sfx.play('click'); }
      else { resultEl.className = 'result-msg lose'; resultEl.textContent = 'Salió ' + label + '. Perdiste ' + fmt(-res.net) + ' 🪙'; ctx.sfx.play('lose'); }

      placed = []; busy = false; ctx.wallet.release(); renderBets();
    }

    return function cleanup() { alive = false; ctx.wallet.release(); };
  }
})();
