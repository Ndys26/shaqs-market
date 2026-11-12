// All sounds are synthesised with the Web Audio API: no audio files to host.
let ctx: AudioContext | null = null;
let enabled = true;

export const setSoundEnabled = (on: boolean) => { enabled = on; };

function ac(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain = 0.2) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

function noise(c: AudioContext, start: number, dur: number, gain = 0.15) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  const hp = c.createBiquadFilter();
  const g = c.createGain();
  hp.type = 'highpass';
  hp.frequency.value = 3000;
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(hp).connect(g).connect(c.destination);
  src.start(c.currentTime + start);
}

export const audio = {
  /** Cash-register "ka-ching" when an order is placed. */
  kaching() {
    const c = ac(); if (!c) return;
    noise(c, 0, 0.08, 0.2);
    tone(c, 1568, 0.06, 0.5, 'triangle', 0.25);
    tone(c, 2093, 0.12, 0.7, 'triangle', 0.22);
    tone(c, 2637, 0.12, 0.7, 'sine', 0.1);
  },
  /** Soft rising chime when stock is replenished. */
  chime() {
    const c = ac(); if (!c) return;
    [659, 784, 988, 1319].forEach((f, i) => tone(c, f, i * 0.09, 0.9, 'sine', 0.15));
  },
  /** Short tick when kilograms are added. */
  click() {
    const c = ac(); if (!c) return;
    tone(c, 1200, 0, 0.04, 'square', 0.05);
  },
  /** Two-pulse buzzer for an urgent rush order. */
  alert() {
    const c = ac(); if (!c) return;
    tone(c, 440, 0, 0.18, 'sawtooth', 0.12);
    tone(c, 440, 0.25, 0.18, 'sawtooth', 0.12);
    tone(c, 660, 0.5, 0.3, 'sawtooth', 0.1);
  },
};
