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

  CF.FX = {
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
