// Snow Quest's sounds, all synthesized with Web Audio: quiet by default, with one mute switch that's remembered.
let ctx: AudioContext | undefined;
let master: GainNode;
let noiseBuf: AudioBuffer;
let wind: { src: AudioBufferSourceNode; gain: GainNode } | undefined;
const MUTE_KEY = "quest:muted";
const VOLUME = 0.22;

let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

const ok = () => ctx?.state === "running" && !muted;
const t0 = () => ctx!.currentTime;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    // fine
  }
  if (ctx) master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.05);
}

/** Call from a key press or click: browsers only allow sound after one. */
export function unlock() {
  void audio().resume().then(startWind);
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = "sine", at = 0, to?: number) {
  if (!ok()) return;
  const a = audio();
  const t = t0() + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, freq: number, type: BiquadFilterType = "bandpass", at = 0, q = 1) {
  if (!ok()) return;
  const a = audio();
  const t = t0() + at;
  const s = a.createBufferSource();
  s.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

/** A soft wind under everything. */
function startWind() {
  if (wind || !ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 380;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(f.frequency);
  const g = ctx.createGain();
  g.gain.value = 0.12;
  s.connect(f).connect(g).connect(master);
  s.start();
  lfo.start();
  wind = { src: s, gain: g };
}

const PENTA = [0, 2, 4, 7, 9, 12];

export const sfx = {
  /** A crunchy footstep in snow; `ice` is a lighter skate scrape. */
  step(ice = false) {
    if (ice) noise(0.12, 0.05, 5200, "highpass");
    else noise(0.07, 0.16, 900 + Math.random() * 500, "bandpass", 0, 1.4);
  },
  talk() {
    tone(hz(76 + PENTA[Math.floor(Math.random() * 5)]), 0.05, 0.06, "square");
  },
  open() {
    tone(hz(72), 0.08, 0.1, "triangle");
    tone(hz(79), 0.12, 0.1, "triangle", 0.06);
  },
  close() {
    tone(hz(79), 0.07, 0.08, "triangle");
    tone(hz(72), 0.1, 0.08, "triangle", 0.05);
  },
  bump() {
    tone(110, 0.08, 0.12, "triangle", 0, 70);
  },
  wrong() {
    tone(hz(52), 0.18, 0.12, "square");
    tone(hz(47), 0.3, 0.12, "square", 0.16);
  },
  right() {
    [72, 76, 79, 84].forEach((n, i) => tone(hz(n), 0.22, 0.14, "triangle", i * 0.07));
    tone(hz(96), 0.5, 0.05, "sine", 0.3);
  },
  secret() {
    [84, 88, 91, 96, 100].forEach((n, i) => tone(hz(n), 0.3, 0.07, "sine", i * 0.06));
    noise(0.6, 0.04, 8000, "highpass", 0.1);
  },
  levelup() {
    const seq = [60, 64, 67, 72, 67, 72, 76, 79];
    seq.forEach((n, i) => tone(hz(n), 0.25, 0.13, "square", i * 0.09));
    [72, 76, 79, 84].forEach((n) => tone(hz(n), 1.2, 0.08, "triangle", seq.length * 0.09));
  },
  gate() {
    tone(70, 1.1, 0.2, "sawtooth", 0, 40);
    noise(1.0, 0.08, 300, "lowpass");
    [67, 71, 74, 79].forEach((n, i) => tone(hz(n), 0.6, 0.08, "sine", 0.8 + i * 0.1));
  },
  /** Wood giving way: the fallen tree is cleared. */
  crack() {
    noise(0.09, 0.3, 1800, "bandpass", 0, 0.8);
    noise(0.18, 0.25, 600, "lowpass", 0.06);
    tone(90, 0.6, 0.18, "sawtooth", 0.08, 45);
    noise(0.9, 0.08, 4000, "highpass", 0.25);
    [72, 76, 79, 84].forEach((n, i) => tone(hz(n), 0.5, 0.07, "sine", 0.6 + i * 0.08));
  },
  /** A barrier pops away. */
  pop() {
    noise(0.25, 0.15, 2500, "bandpass", 0, 0.7);
    [79, 84, 88].forEach((n, i) => tone(hz(n), 0.35, 0.09, "triangle", 0.05 + i * 0.07));
  },
  /** A skate scrape on ice. */
  glide() {
    noise(0.22, 0.05, 6500, "highpass");
  },
  pickup() {
    tone(hz(79), 0.08, 0.1, "square");
    tone(hz(91), 0.16, 0.1, "square", 0.07);
  },
  ending() {
    const mel = [72, 74, 76, 79, 76, 79, 84, 83, 79, 84];
    mel.forEach((n, i) => tone(hz(n), 0.35, 0.12, "triangle", i * 0.18));
    [48, 55, 60, 64].forEach((n) => tone(hz(n), 2.5, 0.06, "sine", mel.length * 0.18));
  },
};
