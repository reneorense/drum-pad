let ctx = null;
let master = null;
let noiseBuf = null;

export function getCtx() { return ctx; }

export function ensureAudio() {
  if (!ctx) initAudio();
  if (ctx.state === 'suspended') ctx.resume();
}

function initAudio() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  // soft limiter so stacking pads doesn't clip
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;

  master = ctx.createGain();
  master.gain.value = 0.72;
  master.connect(comp);
  comp.connect(ctx.destination);

  // shared noise buffer (2s white noise, reused by percussive voices)
  const len = Math.floor(ctx.sampleRate * 2);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
}

export function setVolume(percent) {
  if (master) master.gain.value = (percent / 100) * 0.9;
}

export function playSound(name, when) {
  ensureAudio();
  const fn = KIT[name];
  if (fn) fn(when ?? ctx.currentTime, master);
}

/* ---------------- drum voices ---------------- */
function makeTom(freq) {
  return function (t, out) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.28);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.5);
  };
}

const KIT = {
  kick(t, out) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.45);

    // attack click
    const c = ctx.createOscillator(), cg = ctx.createGain();
    c.type = 'triangle';
    c.frequency.setValueAtTime(1000, t);
    c.frequency.exponentialRampToValueAtTime(120, t + 0.02);
    cg.gain.setValueAtTime(0.35, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    c.connect(cg).connect(out);
    c.start(t); c.stop(t + 0.04);
  },

  snare(t, out) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    n.connect(hp).connect(g).connect(out);
    n.start(t); n.stop(t + 0.25);

    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(130, t + 0.10);
    og.gain.setValueAtTime(0.45, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(out);
    o.start(t); o.stop(t + 0.14);
  },

  clap(t, out) {
    for (let i = 0; i < 4; i++) {
      const ti = t + i * 0.012, last = i === 3;
      const n = ctx.createBufferSource(); n.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(last ? 0.55 : 0.35, ti);
      g.gain.exponentialRampToValueAtTime(0.0001, ti + (last ? 0.18 : 0.03));
      n.connect(bp).connect(g).connect(out);
      n.start(ti); n.stop(ti + 0.25);
    }
  },

  hatClosed(t, out) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(hp).connect(g).connect(out);
    n.start(t); n.stop(t + 0.10);
  },

  hatOpen(t, out) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.42, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    n.connect(hp).connect(g).connect(out);
    n.start(t); n.stop(t + 0.50);
  },

  tomLow:  makeTom(110),
  tomMid:  makeTom(165),
  tomHigh: makeTom(240),

  rim(t, out) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 6;
    o.type = 'square'; o.frequency.setValueAtTime(1700, t);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(bp).connect(g).connect(out);
    o.start(t); o.stop(t + 0.05);

    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(hp).connect(ng).connect(out);
    n.start(t); n.stop(t + 0.05);
  },

  cowbell(t, out) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    g.connect(bp).connect(out);
    [540, 800].forEach(f => {
      const o = ctx.createOscillator();
      o.type = 'square'; o.frequency.value = f;
      o.connect(g); o.start(t); o.stop(t + 0.4);
    });
  },

  crash(t, out) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    n.connect(hp).connect(g).connect(out);
    n.start(t); n.stop(t + 1.5);
  },

  shaker(t, out) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 6500; bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
    n.connect(bp).connect(g).connect(out);
    n.start(t); n.stop(t + 0.15);
  }
};
