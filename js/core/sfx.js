/* Sonido sintetizado con WebAudio (sin archivos): efectos (CF.SFX) y música de fondo (CF.Music). */
(function (root) {
  'use strict';
  root.CF = root.CF || {};
  var ctx = null, master = null, sfxBus = null, musicBus = null;
  var MUTE_KEY = 'cf.v1.muted', MUSIC_KEY = 'cf.v1.music';
  var muted = false, musicOn = true;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; musicOn = localStorage.getItem(MUSIC_KEY) !== '0'; } catch (e) { /* sin storage */ }

  function audio() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createDynamicsCompressor(); master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Una nota: oscilador con envolvente. o: type, when, vol, to (glissando), detune, attack, bus, filter
  function tone(freq, dur, o) {
    o = o || {};
    var a = audio(); if (!a) return;
    var t0 = (o.at != null ? o.at : a.currentTime) + (o.when || 0);
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.detune) osc.detune.setValueAtTime(o.detune, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    var vol = o.vol == null ? 0.05 : o.vol, att = o.attack || 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var out = g;
    if (o.filter) { var f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; g.connect(f); out = f; }
    osc.connect(g); out.connect(o.bus || sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  // Campanita: fundamental + armónicos inarmónicos, suena "a premio".
  function bell(freq, o) {
    o = o || {};
    var v = o.vol || 0.06;
    tone(freq, 0.9, { type: 'sine', vol: v, when: o.when, at: o.at, bus: o.bus });
    tone(freq * 2.76, 0.4, { type: 'sine', vol: v * 0.35, when: o.when, at: o.at, bus: o.bus });
    tone(freq * 5.4, 0.18, { type: 'sine', vol: v * 0.15, when: o.when, at: o.at, bus: o.bus });
  }
  var noiseBuf = null;
  function noise(dur, o) {
    o = o || {};
    var a = audio(); if (!a) return;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = (o.at != null ? o.at : a.currentTime) + (o.when || 0);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf; f.type = o.ftype || 'highpass'; f.frequency.value = o.freq || 7000;
    g.gain.setValueAtTime(o.vol || 0.03, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  var C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568;
  var sounds = {
    click: function () { tone(880, 0.05, { type: 'triangle', vol: 0.04 }); },
    chip: function () { tone(2400, 0.03, { type: 'sine', vol: 0.05 }); tone(1800, 0.05, { type: 'triangle', when: 0.03, vol: 0.04 }); noise(0.04, { vol: 0.02 }); },
    tick: function () { tone(500 + Math.random() * 300, 0.025, { type: 'square', vol: 0.018, filter: 2500 }); },
    card: function () { noise(0.09, { freq: 2500, vol: 0.05, ftype: 'bandpass' }); tone(240, 0.06, { type: 'triangle', to: 140, vol: 0.025 }); },
    dice: function () { noise(0.05, { freq: 1800, vol: 0.05, ftype: 'bandpass' }); tone(160 + Math.random() * 80, 0.04, { type: 'square', vol: 0.02, filter: 1200 }); },
    count: function () { tone(2000 + Math.random() * 600, 0.03, { type: 'sine', vol: 0.03 }); },
    coin: function () { bell(1975 + Math.random() * 300, { vol: 0.025 }); },
    win: function () {
      [C5, E5, G5, C6].forEach(function (f, i) { bell(f, { when: i * 0.08, vol: 0.05 }); });
      [C5, E5, G5].forEach(function (f) { tone(f, 0.6, { type: 'triangle', when: 0.32, vol: 0.03, attack: 0.02 }); });
    },
    bigwin: function () {
      var seq = [C5, E5, G5, C6, G5, C6, E6, G6];
      seq.forEach(function (f, i) { tone(f, 0.16, { type: 'square', vol: 0.03, when: i * 0.085, filter: 3500 }); bell(f, { when: i * 0.085, vol: 0.035 }); });
      [C5, E5, G5, C6].forEach(function (f) { tone(f, 1.4, { type: 'sawtooth', when: 0.7, vol: 0.022, attack: 0.05, filter: 2200, detune: 6 }); tone(f, 1.4, { type: 'sawtooth', when: 0.7, vol: 0.022, attack: 0.05, filter: 2200, detune: -6 }); });
      for (var i = 0; i < 10; i++) bell(2200 + Math.random() * 1600, { when: 0.7 + i * 0.07, vol: 0.02 });
    },
    lose: function () { tone(330, 0.18, { type: 'triangle', to: 220, vol: 0.04 }); tone(247, 0.3, { type: 'triangle', to: 165, vol: 0.035, when: 0.12 }); }
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
      Music.sync();
      return muted;
    }
  };

  /* ---------- Música de fondo: lounge de casino (swing suave en Do), generada en vivo ----------
     Cuatro acordes que giran (Cmaj7 · Am7 · Dm7 · G7), piano eléctrico, contrabajo caminante,
     escobillas y un vibráfono que improvisa notas del acorde. Programador con anticipación (lookahead). */
  var BPM = 96, BEAT = 60 / BPM;
  var CHORDS = [
    { root: 130.81, notes: [261.63, 329.63, 392.0, 493.88] },  // Cmaj7
    { root: 110.0, notes: [220.0, 261.63, 329.63, 392.0] },     // Am7
    { root: 146.83, notes: [293.66, 349.23, 440.0, 523.25] },  // Dm7
    { root: 98.0, notes: [246.94, 293.66, 349.23, 392.0] }      // G7
  ];
  var playing = false, timer = 0, nextBeat = 0, beatIndex = 0, ducked = false;

  function scheduleBeat(t, i) {
    var bar = Math.floor(i / 4) % CHORDS.length, beat = i % 4, ch = CHORDS[bar], bus = musicBus;
    // contrabajo caminante (negras): fundamental, quinta, sexta y una nota de aproximación al acorde que viene
    var next = CHORDS[(bar + 1) % CHORDS.length].root, f;
    if (beat === 3) { f = next * 1.0595; while (f > ch.root * 1.9) f /= 2; while (f < ch.root * 0.7) f *= 2; }
    else f = ch.root * [1, 1.5, 1.6818][beat];
    tone(f, BEAT * 0.9, { at: t, type: 'triangle', vol: 0.11, attack: 0.01, filter: 700, bus: bus });
    // escobillas: swing en los "y"
    noise(0.08, { at: t, vol: 0.012, freq: 6000, bus: bus });
    noise(0.05, { at: t + BEAT * 0.66, vol: 0.008, freq: 7000, bus: bus });
    // piano eléctrico: acorde en 2 y 4 (y anticipado a veces)
    if (beat === 1 || beat === 3) ch.notes.forEach(function (f) { tone(f, BEAT * 1.1, { at: t, type: 'sine', vol: 0.03, attack: 0.012, bus: bus }); tone(f * 2, BEAT * 0.5, { at: t, type: 'sine', vol: 0.006, bus: bus }); });
    // vibráfono: notas del acorde, una octava arriba, con silencios
    if (Math.random() < 0.55) {
      var n = ch.notes[(Math.random() * ch.notes.length) | 0] * 2;
      var off = Math.random() < 0.5 ? 0 : BEAT * 0.66;
      bell(n, { at: t + off, vol: 0.022, bus: bus });
    }
  }
  function loop() {
    var a = audio(); if (!a) return;
    while (nextBeat < a.currentTime + 0.25) { scheduleBeat(nextBeat, beatIndex++); nextBeat += BEAT; }
  }
  function fade(to, s) {
    var a = audio(); if (!a) return;
    musicBus.gain.cancelScheduledValues(a.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, a.currentTime);
    musicBus.gain.linearRampToValueAtTime(to, a.currentTime + s);
  }
  var LEVEL = 0.55;
  var Music = {
    // Arranca solo después de un toque del usuario (los navegadores no dejan sonar antes).
    start: function () {
      if (playing || !musicOn || muted) return;
      var a = audio(); if (!a) return;
      playing = true; nextBeat = a.currentTime + 0.1; beatIndex = 0;
      fade(ducked ? LEVEL * 0.25 : LEVEL, 1.5);
      timer = setInterval(loop, 100); loop();
    },
    stop: function () { if (!playing) return; playing = false; fade(0, 0.6); setTimeout(function () { if (!playing) clearInterval(timer); }, 700); },
    sync: function () { if (musicOn && !muted) Music.start(); else Music.stop(); },
    isOn: function () { return musicOn; },
    toggle: function () {
      musicOn = !musicOn;
      try { localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0'); } catch (e) { /* sin storage */ }
      Music.sync();
      return musicOn;
    },
    // Baja la música mientras suena un festejo.
    duck: function (on) { ducked = on; if (playing) fade(on ? LEVEL * 0.25 : LEVEL, on ? 0.2 : 1.2); }
  };
  root.CF.Music = Music;
  if (typeof document !== 'undefined') {
    var kick = function () { Music.sync(); document.removeEventListener('pointerdown', kick); document.removeEventListener('keydown', kick); };
    document.addEventListener('pointerdown', kick); document.addEventListener('keydown', kick);
  }
})(typeof self !== 'undefined' ? self : this);
