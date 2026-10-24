/* Efectos de victoria: confeti y monedas en un canvas liviano. Respeta "reducir movimiento". */
(function (root) {
  'use strict';
  var CF = root.CF = root.CF || {};
  var canvas, c, parts = [], raf = 0, W = 0, H = 0, rainTimer = 0;
  var COLORS = ['#ff3d9a', '#3df5ff', '#ffc94a', '#3dffa0', '#b58cff', '#fff4dc'];
  var reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function resize() {
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    W = root.innerWidth; H = root.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function ensure() {
    if (canvas) return;
    canvas = document.createElement('canvas'); canvas.className = 'fx-canvas'; canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas); c = canvas.getContext('2d'); resize();
    root.addEventListener('resize', resize);
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function add(p) { parts.push(p); if (!raf) raf = requestAnimationFrame(tick); }

  function tick() {
    c.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.vy += p.g; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.flip += p.vf;
      if (p.y > H + 40 || p.x < -60 || p.x > W + 60) { parts.splice(i, 1); continue; }
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      var sx = Math.abs(Math.cos(p.flip));
      if (p.coin) {
        c.scale(sx < 0.12 ? 0.12 : sx, 1);
        c.beginPath(); c.arc(0, 0, p.s, 0, 6.2832); c.fillStyle = '#ffc94a'; c.fill();
        c.lineWidth = 2; c.strokeStyle = '#b8801a'; c.stroke();
        c.beginPath(); c.arc(0, 0, p.s * 0.6, 0, 6.2832); c.strokeStyle = '#fff1b8'; c.lineWidth = 1.5; c.stroke();
      } else {
        c.scale(1, sx < 0.15 ? 0.15 : sx); c.fillStyle = p.color; c.fillRect(-p.s, -p.s / 2, p.s * 2, p.s);
      }
      c.restore();
    }
    if (parts.length) raf = requestAnimationFrame(tick);
    else { raf = 0; c.clearRect(0, 0, W, H); }
  }

  function piece(x, y, vx, vy, coin) {
    add({
      x: x, y: y, vx: vx, vy: vy, g: coin ? 0.32 : 0.22, rot: rnd(0, 6), vr: rnd(-0.2, 0.2), flip: rnd(0, 6), vf: rnd(0.1, 0.3),
      s: coin ? rnd(9, 13) : rnd(4, 7), color: COLORS[(Math.random() * COLORS.length) | 0], coin: coin
    });
  }

  // Fuente de monedas desde abajo (dura lo que dura el festejo).
  var fountainTimer = 0;
  function fountain(ms) {
    if (reduce) return; ensure();
    var end = Date.now() + ms;
    clearInterval(fountainTimer);
    fountainTimer = setInterval(function () {
      for (var i = 0; i < 3; i++) piece(rnd(W * 0.15, W * 0.85), H + 10, rnd(-3, 3), rnd(-17, -11), Math.random() < 0.7);
      if (Date.now() > end) clearInterval(fountainTimer);
    }, 60);
  }

  // Niveles de festejo según cuántas veces la apuesta se cobra.
  var TIERS = [
    { min: 100, name: 'epic', title: '¡Premio épico!' },
    { min: 25, name: 'mega', title: '¡Mega premio!' },
    { min: 10, name: 'big', title: '¡Gran premio!' }
  ];
  function tierFor(mult) { for (var i = 0; i < TIERS.length; i++) if (mult >= TIERS[i].min) return TIERS[i]; return null; }

  // Pantalla de festejo con el monto que sube. Se cierra tocando "Cobrar" (o sola a los pocos segundos).
  // Devuelve una promesa que se resuelve al cerrarse.
  function celebrate(o) {
    var tier = tierFor(o.mult);
    if (!tier || typeof document === 'undefined') return Promise.resolve(false);
    var h = CF.h, sfx = CF.SFX, amount = o.amount;
    var dur = reduce ? 0 : tier.name === 'epic' ? 4200 : tier.name === 'mega' ? 3200 : 2300;
    var num = h('div', { class: 'cele-num' }, '0');
    var btn = h('button', { class: 'btn big gold cele-btn' }, 'Cobrar');
    var box = h('div', { class: 'cele cele-' + tier.name, role: 'dialog', 'aria-label': tier.title + ' ' + CF.fmt(amount) + ' fichas' },
      h('div', { class: 'cele-rays', 'aria-hidden': 'true' }),
      h('div', { class: 'cele-card' },
        h('div', { class: 'cele-title' }, tier.title),
        h('div', { class: 'cele-amount' }, h('span', { class: 'coin big' }), num),
        h('div', { class: 'cele-sub' }, (o.who ? o.who + ' cobra ' : 'Cobrás ') + 'x' + CF.fmt(Math.round(o.mult * 10) / 10) + ' la apuesta'),
        btn));
    document.body.appendChild(box);
    if (sfx) sfx.play('bigwin');
    if (CF.Music) CF.Music.duck(true);
    fountain(dur + 600);

    return new Promise(function (resolve) {
      var t0 = performance.now(), done = false, raf2 = 0, lastTick = 0, auto = 0;
      function show(v) { num.textContent = CF.fmt(Math.round(v)); }
      function step(now) {
        var k = dur ? Math.min(1, (now - t0) / dur) : 1;
        show(amount * (1 - Math.pow(1 - k, 3)));
        if (sfx && now - lastTick > 70 && k < 1) { lastTick = now; sfx.play('count'); }
        if (k < 1) raf2 = requestAnimationFrame(step);
        else { box.classList.add('landed'); if (sfx) sfx.play('win'); auto = setTimeout(close, 2600); }
      }
      function close() {
        if (done) return;
        if (!box.classList.contains('landed')) { cancelAnimationFrame(raf2); show(amount); box.classList.add('landed'); auto = setTimeout(close, 900); return; }
        done = true; clearTimeout(auto); clearInterval(fountainTimer);
        if (CF.Music) CF.Music.duck(false);
        box.classList.add('out'); setTimeout(function () { box.remove(); }, 260);
        resolve(true);
      }
      box.addEventListener('click', close);
      raf2 = requestAnimationFrame(step);
    });
  }

  // Monedas que vuelan desde el centro de la pantalla hasta el saldo (cuando cobrás).
  function coinsTo(target, n) {
    if (reduce || !target || !document.body.animate) return;
    var r = target.getBoundingClientRect(), tx = r.left + 14, ty = r.top + r.height / 2;
    var sx = root.innerWidth / 2, sy = root.innerHeight * 0.45;
    for (var i = 0; i < n; i++) (function (i) {
      var el = document.createElement('span'); el.className = 'coin fly-coin'; document.body.appendChild(el);
      var mx = sx + rnd(-120, 120), my = sy + rnd(-140, -40), d = 650 + i * 55;
      var a = el.animate([
        { transform: 'translate(' + (sx + rnd(-30, 30)) + 'px,' + (sy + rnd(-20, 20)) + 'px) scale(.4)', opacity: 0 },
        { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1.3)', opacity: 1, offset: 0.4 },
        { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(.7)', opacity: 1 }
      ], { duration: d, delay: i * 45, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'both' });
      a.onfinish = function () { el.remove(); if (CF.SFX && i % 2 === 0) CF.SFX.play('coin'); };
    })(i);
  }

  CF.FX = {
    celebrate: celebrate,
    coinsTo: coinsTo,
    tierFor: tierFor,
    // Fuente de confeti (y monedas) desde un punto. Por defecto, arriba al centro.
    burst: function (o) {
      if (reduce) return; ensure(); o = o || {};
      var x = o.x == null ? W / 2 : o.x, y = o.y == null ? H * 0.42 : o.y, n = o.count || 60;
      for (var i = 0; i < n; i++) {
        var a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(5, o.power || 13);
        piece(x, y, Math.cos(a) * v, Math.sin(a) * v, !!o.coins && i % 3 === 0);
      }
    },
    // Lluvia de monedas y confeti desde arriba (premios grandes).
    rain: function (ms) {
      if (reduce) return; ensure();
      var end = Date.now() + (ms || 2200);
      clearInterval(rainTimer);
      rainTimer = setInterval(function () {
        for (var i = 0; i < 4; i++) piece(rnd(0, W), -20, rnd(-1.5, 1.5), rnd(2, 5), Math.random() < 0.5);
        if (Date.now() > end) clearInterval(rainTimer);
      }, 55);
    }
  };
})(typeof self !== 'undefined' ? self : this);
