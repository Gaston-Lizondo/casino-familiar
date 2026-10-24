/* App: pantallas de jugadores, lobby, panel admin y la "billetera" que usan los juegos. */
(function () {
  'use strict';
  var CF = window.CF, h = CF.h, fmt = CF.fmt, Cfg = CF.Config, SFX = CF.SFX;
  var appEl = document.getElementById('app');
  var topEl = document.getElementById('topbar');

  // ---------- Guardado ----------
  var storage, memoryOnly = false;
  try { localStorage.setItem('__cf', '1'); localStorage.removeItem('__cf'); storage = localStorage; }
  catch (e) { storage = CF.StoreLib.memoryStorage(); memoryOnly = true; }
  var store = CF.store = CF.StoreLib.create({
    storage: storage, prefix: Cfg.storagePrefix, defaults: Cfg.defaultProfiles, startingChips: Cfg.startingChips
  });

  // ---------- Estado ----------
  var S = { view: 'profiles', profile: null, chips: 0, shown: 0, held: false, cleanup: null, nav: 0, game: null };
  var chipsEl = null;

  // El saldo de arriba sube contando cuando cobrás; cuando apostás baja de una.
  var countRaf = 0;
  function setShown(n) {
    var prev = S.shown; S.shown = n;
    if (!chipsEl) return;
    cancelAnimationFrame(countRaf);
    var el = chipsEl;
    if (n > prev && !reduceMotion && S.view === 'game') CF.FX.coinsTo(el.parentNode, Math.min(14, 4 + Math.round(Math.log(n - prev) * 1.2)));
    if (n > prev && !reduceMotion) {
      var t0 = performance.now(), dur = Math.min(1400, 350 + (n - prev) / 4);
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        el.textContent = fmt(Math.round(prev + (n - prev) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) countRaf = requestAnimationFrame(step);
      })(t0);
    } else el.textContent = fmt(n);
    if (n !== prev) {
      el.parentNode.classList.remove('up', 'down'); void el.offsetWidth;
      el.parentNode.classList.add(n > prev ? 'up' : 'down');
    }
  }
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Premios recientes de la familia (reales, guardados en este dispositivo) ----------
  var FEED_KEY = 'feed', FEED_MIN_MULT = 5;
  async function recordWin(game, amount, mult) {
    var list = (await store.loadGame(FEED_KEY)) || [];
    list.unshift({ who: S.profile.name, emoji: S.profile.emoji, game: game, amount: amount, mult: mult, at: Date.now() });
    await store.saveGame(FEED_KEY, list.slice(0, 20));
  }

  var TR = Cfg.trucos || {};

  // Ganadores inventados (truco de casino online, se apaga con trucos.ganadoresFicticios).
  var BOT_NAMES = [['Lucía', '👩'], ['Martín', '🧑'], ['Sofi', '👧'], ['Nico', '👨'], ['Valen', '🧒'], ['Juanma', '🧔'], ['Caro', '👱‍♀️'], ['Tomi', '👦'], ['Flor', '👩‍🦰'], ['Agus', '🧑‍🦱']];
  var BOT_WINS = [['Tragamonedas', [5, 10, 25, 60, 250]], ['Ruleta', [3, 36]], ['Raspadita', [10, 50]], ['Dados', [5.7]], ['Blackjack', [2.5]]];
  function fakeWin() {
    var who = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], g = BOT_WINS[Math.floor(Math.random() * BOT_WINS.length)];
    var mult = g[1][Math.floor(Math.random() * g[1].length)], bet = Cfg.bets[Math.floor(Math.random() * Cfg.bets.length)];
    return { who: who[0], emoji: who[1], game: g[0], amount: Math.round(bet * mult), mult: mult };
  }
  var fakeToastTimer = 0;
  function scheduleFakeToast() {
    clearTimeout(fakeToastTimer);
    if (!TR.ganadoresFicticios) return;
    fakeToastTimer = setTimeout(function () {
      if (S.view === 'lobby' || S.view === 'game') {
        var w = fakeWin();
        if (w.mult >= 10) CF.toast('🎉 ' + w.who + ' cobró ' + fmt(w.amount) + ' en ' + w.game);
      }
      scheduleFakeToast();
    }, 25000 + Math.random() * 35000);
  }
  scheduleFakeToast();

  // Mesa destacada: cambia cada 10 minutos según el reloj (truco: cuenta regresiva).
  var HOT_MS = 10 * 60 * 1000, hotTimer = 0;
  function hotGame() { var list = CF.Games.filter(function (g) { return g.id !== 'slots'; }); return list[Math.floor(Date.now() / HOT_MS) % list.length]; }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  // Festejo de premios grandes (lo usan los juegos). Devuelve una promesa que termina al cerrar el festejo.
  function celebrateFor(gameName) {
    return async function (payout, bet) {
      if (!(payout > 0 && bet > 0)) return false;
      var mult = payout / bet;
      if (mult >= FEED_MIN_MULT) { try { await recordWin(gameName, payout, mult); } catch (e) { /* el registro nunca frena el juego */ } }
      return CF.FX.celebrate({ amount: payout, mult: mult });
    };
  }
  function syncDisplay() { if (!S.held) setShown(S.chips); }

  store.subscribe(async function () {
    if (!S.profile) return;
    var p = await store.getProfile(S.profile.id);
    if (!p) { go('profiles'); return; }
    S.chips = p.chips; syncDisplay();
  });

  // Billetera que reciben los juegos. El resultado se acredita al instante (como lo haría un servidor)
  // y la pantalla muestra el saldo nuevo recién cuando termina la animación (hold/release).
  var wallet = {
    chips: function () { return S.chips; },
    debit: async function (n) {
      var r = await store.adjustChips(S.profile.id, -n);
      if (!r.ok) { SFX.play('lose'); CF.toast('No te alcanzan las fichas 🪙'); return false; }
      S.chips = r.chips; syncDisplay(); return true;
    },
    credit: async function (n) {
      if (n <= 0) return;
      var r = await store.adjustChips(S.profile.id, n);
      S.chips = r.chips; syncDisplay();
    },
    hold: function () { S.held = true; },
    release: function () { S.held = false; syncDisplay(); }
  };

  // ---------- Barra superior ----------
  function backBtn(to) { return h('button', { class: 'icon-btn', 'aria-label': 'Volver', onClick: function () { SFX.play('click'); go(to); } }, '←'); }
  function muteBtn() {
    var b = h('button', { class: 'icon-btn', 'aria-label': 'Sonido' }, SFX.isMuted() ? '🔇' : '🔊');
    b.addEventListener('click', function () { b.textContent = SFX.toggle() ? '🔇' : '🔊'; });
    return b;
  }
  function musicBtn() {
    var b = h('button', { class: 'icon-btn' + (CF.Music.isOn() ? '' : ' off'), 'aria-label': 'Música', 'aria-pressed': String(CF.Music.isOn()) }, '🎵');
    b.addEventListener('click', function () { var on = CF.Music.toggle(); b.classList.toggle('off', !on); b.setAttribute('aria-pressed', String(on)); });
    return b;
  }
  function renderTop() {
    chipsEl = null;
    var left, title, right = [];
    var inPlay = S.profile && (S.view === 'lobby' || S.view === 'game');
    if (S.view === 'game') { left = backBtn('lobby'); title = (CF.Games.find(function (g) { return g.id === S.game; }) || {}).name; }
    else if (S.view === 'lobby') { left = backBtn('profiles'); title = 'Casino Familiar'; }
    else if (S.view === 'admin') { left = backBtn('profiles'); title = 'Admin'; }
    else { left = h('span', { class: 'top-spacer' }); title = ''; }
    if (inPlay) {
      chipsEl = h('b', null, fmt(S.shown));
      right.push(h('div', { class: 'chips-pill', title: 'Tus fichas' }, h('span', { class: 'coin' }), chipsEl));
    }
    right.push(musicBtn(), muteBtn());
    topEl.replaceChildren(left, h('div', { class: 'top-title neon' }, title || ''), h('div', { class: 'top-right' }, right));
  }

  // ---------- Navegación ----------
  function go(view, arg) {
    if (S.cleanup) { try { S.cleanup(); } catch (e) { console.error(e); } S.cleanup = null; }
    clearInterval(hotTimer);
    S.held = false; S.view = view; S.game = view === 'game' ? arg : null; S.nav++;
    if (view === 'profiles') S.profile = null;
    S.shown = S.chips;
    appEl.replaceChildren();
    renderTop();
    if (chipsEl) chipsEl.textContent = fmt(S.chips);
    window.scrollTo(0, 0);
    ({ profiles: renderProfiles, lobby: renderLobby, game: renderGame, admin: renderAdmin })[view](arg);
  }

  // ---------- Elegir jugador ----------
  async function renderProfiles() {
    var token = S.nav;
    var list = await store.listProfiles();
    if (token !== S.nav) return;
    // Cada jugador es una ficha de casino de su color.
    var chipsList = list.map(function (p) {
      return h('button', {
        class: 'player-chip', style: { '--c': p.color }, 'aria-label': p.name + ', ' + fmt(p.chips) + ' fichas',
        onClick: function () { SFX.play('chip'); S.profile = p; S.chips = p.chips; go('lobby'); }
      },
        h('span', { class: 'pc-face' },
          h('span', { class: 'pc-avatar' }, p.emoji),
          h('span', { class: 'pc-name' }, p.name),
          h('span', { class: 'pc-chips' }, h('span', { class: 'coin' }), fmt(p.chips))));
    });
    appEl.append(h('section', { class: 'screen center' },
      h('h1', { class: 'sign', 'aria-label': 'Casino Familiar' }, h('span', { class: 'sign-script' }, 'Casino'), h('span', { class: 'sign-sub' }, 'Familiar')),
      h('p', { class: 'sub' }, 'Elegí tu ficha para jugar'),
      h('div', { class: 'player-grid' }, chipsList),
      memoryOnly ? h('p', { class: 'warn' }, 'Tu navegador no deja guardar datos: las fichas se pierden al cerrar.') : null,
      h('p', { class: 'footer-note' }, 'Fichas de mentira, sin dinero real: solo diversión.'),
      h('button', { class: 'btn ghost small', onClick: openAdmin }, '⚙️ Admin')));
  }

  // ---------- Lobby ----------
  function renderLobby() {
    var p = S.profile, token = S.nav;
    var slots = CF.Games.find(function (g) { return g.id === 'slots'; });
    var topBet = Math.max.apply(null, Cfg.bets), topMult = CF.Slots ? CF.Slots.SYMBOLS.reduce(function (m, s) { return Math.max(m, s.pay3); }, 0) : 0;
    var topIcon = CF.Slots ? CF.Slots.SYMBOLS.reduce(function (a, s) { return s.pay3 > a.pay3 ? s : a; }).icon : '💎';

    // Portada: el premio mayor que de verdad existe (la tragamonedas paga x500 con tres 💎).
    var hero = h('button', { class: 'tile hero', 'data-game': 'slots', onClick: function () { SFX.play('click'); go('game', 'slots'); } },
      h('span', { class: 'hero-label' }, 'Premio mayor'),
      h('span', { class: 'hero-amount' }, h('span', { class: 'coin big' }), fmt(topBet * topMult)),
      h('span', { class: 'hero-how' }, topIcon + topIcon + topIcon + ' en la ' + (slots ? slots.name.toLowerCase() : 'tragamonedas') + ', apostando ' + fmt(topBet)),
      h('span', { class: 'hero-cta' }, 'Jugar ' + (slots ? slots.name : '')));

    var ticker = h('div', { class: 'ticker', 'aria-label': 'Últimos premios de la familia' }, h('div', { class: 'ticker-track' }, h('span', { class: 'tick-item muted' }, 'Cargando premios…')));
    store.loadGame(FEED_KEY).then(function (list) {
      if (token !== S.nav) return;
      var real = list || [], all = real.slice();
      if (TR.ganadoresFicticios) { for (var k = 0; k < 8; k++) all.splice(Math.floor(Math.random() * (all.length + 1)), 0, fakeWin()); }
      var items = all.map(function (w) {
        return h('span', { class: 'tick-item' }, w.emoji + ' ', h('b', null, w.who), ' cobró ', h('span', { class: 'tick-amt' }, fmt(w.amount)), ' en ' + w.game + ' (x' + fmt(Math.round(w.mult * 10) / 10) + ')');
      });
      var track = ticker.firstChild;
      if (!items.length) { track.replaceChildren(h('span', { class: 'tick-item muted' }, 'Todavía nadie cobró un premio grande. Aparecen acá desde x5.')); return; }
      // Se duplica la lista para que la marquesina gire sin cortes.
      track.replaceChildren.apply(track, items.concat(items.map(function (n) { return n.cloneNode(true); })));
      track.style.setProperty('--dur', Math.max(14, items.length * 5) + 's');
      ticker.classList.add('moving');
    });

    var hot = TR.cuentaRegresiva ? hotGame() : null, hotBar = null;
    if (hot) {
      var clock = h('b', { class: 'hot-clock' }, mmss(HOT_MS - Date.now() % HOT_MS));
      hotBar = h('button', { class: 'hot-bar', onClick: function () { SFX.play('click'); go('game', hot.id); } },
        h('span', { class: 'hot-fire' }, '🔥'), h('span', null, 'Mesa destacada: ', h('b', null, hot.name)), h('span', { class: 'hot-time' }, 'termina en ', clock));
      hotTimer = setInterval(function () {
        var left = HOT_MS - Date.now() % HOT_MS;
        clock.textContent = mmss(left);
        clock.classList.toggle('urgent', left < 60000);
        if (left < 1000) { clearInterval(hotTimer); setTimeout(function () { if (S.view === 'lobby') go('lobby'); }, 1200); }
      }, 1000);
    }
    var tiles = CF.Games.filter(function (g) { return g.id !== 'slots'; }).map(function (g, i) {
      return h('button', { class: 'tile ' + g.color + (hot && hot.id === g.id ? ' hot' : ''), 'data-game': g.id, style: { '--i': i + 1 }, onClick: function () { SFX.play('click'); go('game', g.id); } },
        h('span', { class: 'tile-art' }, h('span', { class: 'tile-icon' }, g.icon)),
        g.top ? h('span', { class: 'tile-top' }, g.top) : null,
        h('span', { class: 'tile-name' }, g.name),
        h('span', { class: 'tile-desc' }, g.desc));
    });
    appEl.append(h('section', { class: 'screen' },
      h('div', { class: 'hello' }, h('span', { class: 'avatar-mini', style: { '--c': p.color } }, p.emoji), h('div', null, h('div', { class: 'hi' }, 'Hola, ' + p.name), h('div', { class: 'sub left' }, 'Elegí una mesa'))),
      S.chips <= 0 ? h('div', { class: 'banner' }, 'Te quedaste sin fichas. Pedile a quien administra que te reponga desde ⚙️ Admin.') : null,
      hero, hotBar, ticker,
      h('div', { class: 'bento' }, tiles),
      h('p', { class: 'footer-note' }, 'Fichas de mentira, sin dinero real: solo diversión.')));
  }

  // ---------- Juego ----------
  function renderGame(id) {
    var g = CF.Games.find(function (x) { return x.id === id; });
    var wrap = h('div', { class: 'game game-' + g.id });
    appEl.append(wrap);
    var cleanup = g.mount({
      el: wrap, wallet: wallet, sfx: SFX, fx: CF.FX, config: Cfg, store: store, celebrate: celebrateFor(g.name),
      profile: { id: S.profile.id, name: S.profile.name, emoji: S.profile.emoji },
      loadGame: function (k) { return store.loadGame(k); },
      saveGame: function (k, v) { return store.saveGame(k, v); }
    });
    S.cleanup = function () { S.held = false; if (typeof cleanup === 'function') cleanup(); };
  }

  // ---------- Admin ----------
  async function openAdmin() {
    var pin = await CF.askText({ title: 'Admin', label: 'PIN', type: 'password', inputmode: 'numeric', okLabel: 'Entrar' });
    if (pin === null) return;
    if (pin === Cfg.adminPin) { SFX.play('win'); go('admin'); }
    else { SFX.play('lose'); CF.toast('PIN incorrecto'); }
  }

  var EMOJIS = ['🧔', '👩', '👦', '👧', '👴', '👵', '🧑', '👨', '🐶', '🦊', '🐼', '🦄'];
  var COLORS = ['#3df5ff', '#ff3d9a', '#3dffa0', '#ffc94a', '#b58cff', '#ff7a45'];

  async function renderAdmin() {
    var token = S.nav;
    var list = await store.listProfiles();
    if (token !== S.nav) return;
    var rows = list.map(function (p) {
      function add(n) { return h('button', { class: 'btn small cyan', onClick: async function () { await store.adjustChips(p.id, n); SFX.play('chip'); refresh(); } }, '+' + fmt(n)); }
      return h('div', { class: 'admin-row' },
        h('div', { class: 'ar-head' }, h('span', { class: 'avatar-mini', style: { '--c': p.color } }, p.emoji), h('b', null, p.name), h('span', { class: 'ar-chips' }, h('span', { class: 'coin' }), fmt(p.chips))),
        h('div', { class: 'ar-actions' },
          add(100), add(500), add(1000),
          h('button', { class: 'btn small', onClick: async function () {
            var v = await CF.askText({ title: 'Fichas de ' + p.name, label: 'Cantidad exacta', type: 'number', inputmode: 'numeric', value: String(p.chips) });
            if (v === null || v === '' || isNaN(Number(v))) return;
            await store.setChips(p.id, Number(v)); refresh();
          } }, 'Fijar…'),
          h('button', { class: 'btn small ghost', 'aria-label': 'Eliminar', onClick: async function () {
            if (await CF.confirm('¿Eliminar a ' + p.name + ' y sus fichas?', 'Eliminar')) { await store.deleteProfile(p.id); refresh(); }
          } }, '🗑')));
    });
    appEl.append(h('section', { class: 'screen' },
      h('p', { class: 'sub left' }, 'Reponé fichas o administrá jugadores de ESTE dispositivo.'),
      h('div', { class: 'admin-list' }, rows),
      h('div', { class: 'admin-foot' },
        h('button', { class: 'btn cyan', onClick: addPlayer }, '➕ Agregar jugador'),
        h('button', { class: 'btn ghost', onClick: async function () {
          if (await CF.confirm('¿Volver TODAS las fichas a ' + fmt(Cfg.startingChips) + '?', 'Reiniciar')) { await store.resetAll(); refresh(); }
        } }, '♻️ Reiniciar fichas'))));
    function refresh() { if (S.view === 'admin') go('admin'); }
  }

  function addPlayer() {
    var name = h('input', { class: 'input', placeholder: 'Nombre', maxlength: 14, autocomplete: 'off' });
    var emoji = EMOJIS[4], color = COLORS[Math.floor(Math.random() * COLORS.length)];
    var eb = EMOJIS.map(function (e) {
      var b = h('button', { type: 'button', class: 'emoji-btn' + (e === emoji ? ' active' : ''), onClick: function () { emoji = e; eb.forEach(function (x) { x.classList.toggle('active', x.textContent === e); }); } }, e);
      return b;
    });
    CF.modal({
      title: 'Nuevo jugador',
      body: h('div', null, h('label', { class: 'field' }, h('span', null, 'Nombre'), name), h('div', { class: 'emoji-grid' }, eb)),
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        { label: 'Crear', kind: 'cyan', onClick: function () {
          var n = name.value.trim(); if (!n) { CF.toast('Poné un nombre'); return false; }
          store.createProfile({ name: n, emoji: emoji, color: color }).then(function () { SFX.play('win'); go('admin'); });
        } }
      ]
    });
  }

  go('profiles');
})();
