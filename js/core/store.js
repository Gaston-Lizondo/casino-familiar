/*
 * Capa de guardado (intercambiable).
 *
 * Hoy: localStorage del navegador (cada dispositivo tiene sus propias fichas).
 * Mañana (multijugador): se escribe otro adaptador con LA MISMA interfaz que respalde
 * en Firebase y el resto del juego no cambia. La interfaz es toda async a propósito.
 *
 *   listProfiles()                      -> [{id,name,emoji,color,chips}]
 *   getProfile(id)                      -> perfil | null
 *   createProfile({name,emoji,color})   -> perfil
 *   deleteProfile(id)
 *   adjustChips(id, delta)              -> {ok, chips}   (ok=false si quedaría en negativo)
 *   setChips(id, value)                 -> chips
 *   resetAll(chips)
 *   subscribe(cb)                       -> función para desuscribirse
 *   loadGame(key) / saveGame(key, val) / clearGame(key)   (estado de partidas en curso)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CF = root.CF || {}; root.CF.StoreLib = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function memoryStorage() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  function slug(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'jugador';
  }

  function create(opts) {
    var storage = opts.storage;
    var prefix = opts.prefix || 'cf.v1.';
    var defaults = opts.defaults || [];
    var startingChips = opts.startingChips == null ? 1000 : opts.startingChips;
    var KEY = prefix + 'profiles';
    var listeners = [];

    function emit() {
      listeners.slice().forEach(function (cb) { try { cb(); } catch (e) { console.error(e); } });
    }
    function write(list, notify) {
      storage.setItem(KEY, JSON.stringify(list));
      if (notify !== false) emit();
    }
    function read() {
      var raw = storage.getItem(KEY);
      if (raw) { try { var v = JSON.parse(raw); if (Array.isArray(v)) return v; } catch (e) { /* se re-siembra */ } }
      var seeded = defaults.map(function (p) { return Object.assign({}, p, { chips: startingChips }); });
      write(seeded, false);
      return seeded;
    }

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', function (e) { if (e.key === KEY) emit(); });
    }

    return {
      kind: 'local',
      listProfiles: async function () { return read(); },
      getProfile: async function (id) { return read().find(function (p) { return p.id === id; }) || null; },
      createProfile: async function (data) {
        var list = read();
        var base = slug(data.name), id = base, n = 2;
        while (list.some(function (p) { return p.id === id; })) id = base + '-' + (n++);
        var p = { id: id, name: data.name, emoji: data.emoji || '🙂', color: data.color || '#00e5ff', chips: startingChips };
        list.push(p); write(list); return p;
      },
      deleteProfile: async function (id) {
        write(read().filter(function (p) { return p.id !== id; }));
        storage.removeItem(prefix + 'game.bj.' + id);
      },
      adjustChips: async function (id, delta) {
        var list = read();
        var p = list.find(function (x) { return x.id === id; });
        if (!p) throw new Error('Perfil inexistente: ' + id);
        var next = p.chips + delta;
        if (next < 0) return { ok: false, chips: p.chips };
        p.chips = next; write(list);
        return { ok: true, chips: next };
      },
      setChips: async function (id, value) {
        var list = read();
        var p = list.find(function (x) { return x.id === id; });
        if (!p) throw new Error('Perfil inexistente: ' + id);
        p.chips = Math.max(0, Math.floor(value)); write(list);
        return p.chips;
      },
      resetAll: async function (chips) {
        var v = chips == null ? startingChips : chips;
        write(read().map(function (p) { return Object.assign({}, p, { chips: v }); }));
      },
      subscribe: function (cb) {
        listeners.push(cb);
        return function () { listeners = listeners.filter(function (x) { return x !== cb; }); };
      },
      loadGame: async function (key) {
        var raw = storage.getItem(prefix + 'game.' + key);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
      },
      saveGame: async function (key, val) { storage.setItem(prefix + 'game.' + key, JSON.stringify(val)); },
      clearGame: async function (key) { storage.removeItem(prefix + 'game.' + key); }
    };
  }

  return { create: create, memoryStorage: memoryStorage };
});
