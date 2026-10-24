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

  function setShown(n) {
    var prev = S.shown; S.shown = n;
    if (!chipsEl) return;
    chipsEl.textContent = fmt(n);
    if (n !== prev) {
      chipsEl.parentNode.classList.remove('up', 'down'); void chipsEl.offsetWidth;
      chipsEl.parentNode.classList.add(n > prev ? 'up' : 'down');
    }
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
      right.push(h('div', { class: 'chips-pill', title: 'Tus fichas' }, h('span', { class: 'coin' }, '🪙'), chipsEl));
    }
    right.push(muteBtn());
    topEl.replaceChildren(left, h('div', { class: 'top-title neon' }, title || ''), h('div', { class: 'top-right' }, right));
  }

  // ---------- Navegación ----------
  function go(view, arg) {
    if (S.cleanup) { try { S.cleanup(); } catch (e) { console.error(e); } S.cleanup = null; }
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
    var cards = list.map(function (p) {
      return h('button', {
        class: 'profile-card', style: { '--c': p.color }, onClick: function () { SFX.play('click'); S.profile = p; S.chips = p.chips; go('lobby'); }
      },
        h('div', { class: 'avatar' }, p.emoji),
        h('div', { class: 'pname' }, p.name),
        h('div', { class: 'pchips' }, '🪙 ' + fmt(p.chips)));
    });
    appEl.append(h('section', { class: 'screen center' },
      h('h1', { class: 'logo neon' }, 'CASINO', h('br'), h('span', null, 'FAMILIAR')),
      h('p', { class: 'sub' }, '¿Quién juega?'),
      h('div', { class: 'profile-grid' }, cards),
      memoryOnly ? h('p', { class: 'warn' }, '⚠️ Tu navegador no deja guardar datos: las fichas se pierden al cerrar.') : null,
      h('p', { class: 'footer-note' }, '🪙 Fichas de mentira · Solo diversión · Sin dinero real'),
      h('button', { class: 'btn ghost small', onClick: openAdmin }, '⚙️ Admin')));
  }

  // ---------- Lobby ----------
  function renderLobby() {
    var p = S.profile;
    var cards = CF.Games.map(function (g) {
      return h('button', { class: 'game-card ' + g.color, onClick: function () { SFX.play('click'); go('game', g.id); } },
        h('div', { class: 'gicon' }, g.icon),
        h('div', { class: 'gtext' }, h('div', { class: 'gname' }, g.name), h('div', { class: 'gdesc' }, g.desc)),
        h('div', { class: 'garrow' }, '›'));
    });
    appEl.append(h('section', { class: 'screen' },
      h('div', { class: 'hello' }, h('span', { class: 'avatar sm', style: { '--c': p.color } }, p.emoji), h('div', null, h('div', { class: 'hi' }, 'Hola, ' + p.name + ' 👋'), h('div', { class: 'sub left' }, 'Elegí un juego'))),
      S.chips <= 0 ? h('div', { class: 'banner' }, '😅 Te quedaste sin fichas. Pedile a quien administra que te reponga desde ⚙️ Admin.') : null,
      h('div', { class: 'game-list' }, cards),
      h('p', { class: 'footer-note' }, '🪙 Fichas de mentira · Solo diversión · Sin dinero real')));
  }

  // ---------- Juego ----------
  function renderGame(id) {
    var g = CF.Games.find(function (x) { return x.id === id; });
    var wrap = h('div', { class: 'game game-' + g.id });
    appEl.append(wrap);
    var cleanup = g.mount({
      el: wrap, wallet: wallet, sfx: SFX, config: Cfg, store: store,
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
  var COLORS = ['#00e5ff', '#ff2bd6', '#c6ff00', '#ffd400', '#8a4dff', '#ff6a2b'];

  async function renderAdmin() {
    var token = S.nav;
    var list = await store.listProfiles();
    if (token !== S.nav) return;
    var rows = list.map(function (p) {
      function add(n) { return h('button', { class: 'btn small cyan', onClick: async function () { await store.adjustChips(p.id, n); SFX.play('chip'); refresh(); } }, '+' + fmt(n)); }
      return h('div', { class: 'admin-row' },
        h('div', { class: 'ar-head' }, h('span', { class: 'avatar sm', style: { '--c': p.color } }, p.emoji), h('b', null, p.name), h('span', { class: 'ar-chips' }, '🪙 ' + fmt(p.chips))),
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
