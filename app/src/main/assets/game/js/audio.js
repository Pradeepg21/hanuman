'use strict';
/* All sound is synthesised with WebAudio: no audio files to ship. */
const SFX = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  let sfxOn = true, musicOn = true;
  let timer = null, nextT = 0, step = 0, drone = null, intensity = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function envG(t, a, d, v, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest);
    return g;
  }
  function toneAt(t, f, dur, type, vol, f2, dest) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    o.connect(envG(t, 0.005, dur, vol, dest || sfxBus));
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseAt(t, dur, vol, freq, ftype, dest, q, f2) {
    if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    src.connect(f); f.connect(envG(t, 0.005, dur, vol, dest || sfxBus));
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  const now = () => (ctx ? ctx.currentTime : 0);
  const tone = (f, dur, type, vol, f2, delay) => ctx && toneAt(now() + (delay || 0), f, dur, type, vol, f2);
  const noise = (dur, vol, freq, ftype, delay, q, f2) => ctx && noiseAt(now() + (delay || 0), dur, vol, freq, ftype, null, q, f2);

  const fx = {
    coin() { tone(1568, 0.07, 'triangle', 0.09); tone(2350, 0.12, 'triangle', 0.07, null, 0.05); },
    gem() { [1046, 1318, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.14, 'sine', 0.12, null, i * 0.05)); },
    jump() { tone(260, 0.2, 'sine', 0.2, 720); noise(0.14, 0.06, 2500, 'highpass'); },
    slide() { noise(0.35, 0.16, 900, 'bandpass', 0, 0.8, 300); },
    lane() { noise(0.1, 0.05, 3000, 'highpass', 0, 1, 6000); },
    turn() { noise(0.18, 0.08, 1500, 'bandpass', 0, 1, 4000); },
    smashSwing() { noise(0.2, 0.08, 600, 'bandpass', 0, 1, 2400); },
    smash() { tone(130, 0.4, 'sine', 0.55, 38); noise(0.3, 0.35, 1400, 'lowpass', 0, 1, 200); tone(900, 0.1, 'square', 0.04, 300); },
    power() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, null, i * 0.06)); },
    stumble() { tone(170, 0.25, 'sawtooth', 0.14, 80); noise(0.2, 0.2, 700); },
    crash() { tone(220, 0.9, 'sawtooth', 0.2, 45); noise(0.7, 0.35, 500); tone(70, 0.6, 'sine', 0.5, 30); },
    fall() { tone(700, 1.1, 'sine', 0.15, 90); },
    roar() { tone(95, 0.7, 'sawtooth', 0.12, 55); noise(0.6, 0.12, 450, 'bandpass', 0, 2); },
    boost() { tone(180, 1.0, 'sawtooth', 0.07, 900); noise(1.2, 0.2, 400, 'bandpass', 0, 1, 3000); },
    shieldPop() { noise(0.4, 0.2, 3000, 'highpass'); tone(1200, 0.3, 'sine', 0.1, 300); },
    mission() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, null, i * 0.09)); },
    click() { tone(880, 0.05, 'sine', 0.08); },
    bell() { tone(1318, 1.6, 'sine', 0.12); tone(1975, 1.2, 'sine', 0.06); tone(2637, 0.8, 'sine', 0.03); },
  };

  // ---------------------------------------------------------------- music
  // A light tabla groove (teentaal-ish 16 step cycle), tanpura-like drone and a bansuri melody.
  const BPM = 116, S16 = 60 / BPM / 4;
  const SCALE = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0];
  let melodyIdx = 3;

  function startDrone() {
    if (drone) return;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 2);
    f.connect(g); g.connect(musicBus);
    const oscs = [73.42, 110, 146.83, 110.4].map(fr => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); return o; });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15; const lg = ctx.createGain(); lg.gain.value = 300;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    drone = { oscs, lfo, g };
  }
  function stopDrone() {
    if (!drone) return;
    const d = drone; drone = null;
    d.g.gain.cancelScheduledValues(ctx.currentTime);
    d.g.gain.setValueAtTime(d.g.gain.value, ctx.currentTime);
    d.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    setTimeout(() => { d.oscs.forEach(o => o.stop()); d.lfo.stop(); }, 800);
  }
  function dha(t, v) { toneAt(t, 120, 0.35, 'sine', 0.5 * v, 52, musicBus); noiseAt(t, 0.04, 0.12 * v, 2000, 'bandpass', musicBus, 1); }
  function na(t, v) { toneAt(t, 540, 0.12, 'triangle', 0.14 * v, 500, musicBus); noiseAt(t, 0.03, 0.1 * v, 5000, 'highpass', musicBus); }
  function ti(t, v) { noiseAt(t, 0.025, 0.07 * v, 7000, 'highpass', musicBus); }
  function flute(t, f, dur) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.985, t); o.frequency.linearRampToValueAtTime(f, t + 0.06);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5; const vg = ctx.createGain(); vg.gain.value = f * 0.012;
    vib.connect(vg); vg.connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.05); g.gain.setValueAtTime(0.07, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus); o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }
  function playStep(s, t) {
    const st = s % 16;
    const v = 0.75 + intensity * 0.35;
    if (st === 0 || st === 6 || st === 8 || st === 11) dha(t, v);
    if (st === 2 || st === 4 || st === 10 || st === 12 || st === 14) na(t, v);
    if (intensity > 0.3 && (st % 2 === 1)) ti(t, v);
    if (st === 3 || st === 13) ti(t, v * 0.8);
    if (s % 4 === 0 && Math.random() < 0.5) {
      melodyIdx = Math.max(0, Math.min(SCALE.length - 1, melodyIdx + Math.floor(Math.random() * 5) - 2));
      flute(t, SCALE[melodyIdx], S16 * (Math.random() < 0.5 ? 3 : 6));
    }
  }
  function schedule() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.25) { playStep(step, nextT); nextT += S16 * (1 - intensity * 0.12); step = (step + 1) % 64; }
  }

  return {
    init,
    play(name) { if (ctx && sfxOn && fx[name]) try { fx[name](); } catch (e) { /* ignore */ } },
    startMusic() {
      init(); if (!ctx || timer) return;
      nextT = ctx.currentTime + 0.1; step = 0;
      if (musicOn) startDrone();
      timer = setInterval(schedule, 60);
    },
    stopMusic() { if (timer) { clearInterval(timer); timer = null; } if (ctx) stopDrone(); },
    setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); },
    setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 1 : 0; },
    setMusic(on) {
      musicOn = on;
      if (!musicBus) return;
      musicBus.gain.value = on ? 0.32 : 0;
      if (on && timer) startDrone(); else if (!on) stopDrone();
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };
})();
