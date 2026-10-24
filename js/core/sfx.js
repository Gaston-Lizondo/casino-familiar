/* Sonidos sintetizados con WebAudio (sin archivos). */
(function (root) {
  'use strict';
  root.CF = root.CF || {};
  var ctx = null;
  var MUTE_KEY = 'cf.v1.muted';
  var muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* sin storage */ }

  function audio() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, o) {
    o = o || {};
    var a = audio(); if (!a) return;
    var t0 = a.currentTime + (o.when || 0);
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    var vol = o.vol == null ? 0.05 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  var sounds = {
    click: function () { tone(660, 0.05, { type: 'triangle' }); },
    chip: function () { tone(1200, 0.04, { type: 'triangle', vol: 0.06 }); tone(900, 0.05, { type: 'triangle', when: 0.04, vol: 0.05 }); },
    tick: function () { tone(300 + Math.random() * 200, 0.03, { type: 'square', vol: 0.025 }); },
    card: function () { tone(220, 0.07, { type: 'sawtooth', to: 120, vol: 0.04 }); },
    dice: function () { tone(180, 0.05, { type: 'square', vol: 0.04 }); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.14, { type: 'triangle', when: i * 0.09, vol: 0.07 }); }); },
    bigwin: function () {
      [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach(function (f, i) { tone(f, 0.16, { type: 'triangle', when: i * 0.09, vol: 0.08 }); });
    },
    lose: function () { tone(300, 0.25, { type: 'sawtooth', to: 110, vol: 0.05 }); }
  };

  root.CF.SFX = {
    play: function (name) {
      if (muted) return;
      try { if (sounds[name]) sounds[name](); } catch (e) { /* nunca romper el juego por el sonido */ }
    },
    isMuted: function () { return muted; },
    toggle: function () {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* sin storage */ }
      if (!muted) sounds.click();
      return muted;
    }
  };
})(typeof self !== 'undefined' ? self : this);
