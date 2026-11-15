// Crave mode sounds and haptics, synthesised with the Web Audio API (no sound files). Short and soft:
// a click for presses, a pop for "added to basket", the pay chime (three variants), coins for the pot.
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem("vara.crave.muted") === "1";
} catch {
  /* ignore */
}

function ac(force = false): AudioContext | null {
  if (muted && !force) return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(a: AudioContext, freq: number, start: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(a.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

// ---------------------------------------------------------------- the pay chime
// A bright, glassy contactless-payment "ding", synthesised from scratch: a few sine partials per note, each with a
// near-instant attack and its own exponential decay (higher partials die faster, like a struck glass bell), plus a
// tiny high-passed noise transient for the "tap" of the strike. Three variants to pick by ear (?chime=a|b|c).
export type ChimeId = "a" | "b" | "c";
interface ChimeNote { freq: number; at: number; gain: number }
export interface Chime {
  name: string;
  notes: ChimeNote[]; // fundamental frequency (Hz), start offset (s), loudness
  partials: number[]; // frequency ratios to the fundamental
  partialGains: number[];
  decays: number[]; // seconds to fade, per partial
  attack: number; // seconds
  strike: number; // gain of the noise transient (0 = none)
}
export const CHIMES: Record<ChimeId, Chime> = {
  // Best guess at the familiar wallet "ding": two very close, bright notes a perfect fourth apart (A6 grace, D7),
  // a nearly harmonic glassy spectrum, ~0.5 s ring.
  a: { name: "Bright double ding", notes: [{ freq: 1760, at: 0, gain: 0.55 }, { freq: 2349.3, at: 0.075, gain: 0.85 }], partials: [1, 2, 3.01, 4.2], partialGains: [1, 0.32, 0.1, 0.05], decays: [0.5, 0.26, 0.14, 0.08], attack: 0.003, strike: 0.05 },
  // One struck glass bell: B6 with inharmonic bell partials, a little longer ring.
  b: { name: "Single glass bell", notes: [{ freq: 1975.5, at: 0, gain: 0.9 }], partials: [1, 2.76, 5.4, 8.93], partialGains: [1, 0.28, 0.12, 0.05], decays: [0.6, 0.22, 0.1, 0.06], attack: 0.002, strike: 0.07 },
  // Softer rising chime: E6 then B6 (a fifth), rounder spectrum, as in the first version.
  c: { name: "Soft rising chime", notes: [{ freq: 1318.5, at: 0, gain: 0.7 }, { freq: 1975.5, at: 0.11, gain: 0.8 }], partials: [1, 2, 3], partialGains: [1, 0.18, 0.05], decays: [0.55, 0.25, 0.12], attack: 0.006, strike: 0 },
};
export const CHIME_IDS: ChimeId[] = ["a", "b", "c"];
const CHIME_KEY = "vara.crave.chime";
const isChime = (x: unknown): x is ChimeId => x === "a" || x === "b" || x === "c";

/** Current variant: ?chime= in the URL (also inside the hash; saved), then the saved choice, then "a". */
export function chimeId(): ChimeId {
  try {
    const q = new URLSearchParams(location.search).get("chime") ?? new URLSearchParams(location.hash.split("?")[1] ?? "").get("chime");
    if (isChime(q)) {
      localStorage.setItem(CHIME_KEY, q);
      return q;
    }
    const saved = localStorage.getItem(CHIME_KEY);
    if (isChime(saved)) return saved;
  } catch {
    /* ignore */
  }
  return "a";
}
export function setChimeId(id: ChimeId) {
  try {
    localStorage.setItem(CHIME_KEY, id);
  } catch {
    /* ignore */
  }
}

function playChime(a: AudioContext, c: Chime) {
  try {
    const t0 = a.currentTime + 0.005;
    const master = a.createGain();
    master.gain.value = 0.22;
    master.connect(a.destination);
    for (const n of c.notes) {
      const start = t0 + n.at;
      c.partials.forEach((ratio, i) => {
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(n.freq * ratio, start);
        const peak = n.gain * (c.partialGains[i] ?? 0.05);
        const dec = c.decays[i] ?? 0.1;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + c.attack);
        g.gain.exponentialRampToValueAtTime(0.0001, start + c.attack + dec);
        o.connect(g).connect(master);
        o.start(start);
        o.stop(start + c.attack + dec + 0.03);
      });
      if (c.strike > 0) {
        const len = Math.floor(a.sampleRate * 0.012);
        const buf = a.createBuffer(1, len, a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
        const src = a.createBufferSource();
        src.buffer = buf;
        const f = a.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = 5000;
        const g = a.createGain();
        g.gain.value = c.strike * n.gain;
        src.connect(f).connect(g).connect(master);
        src.start(start);
      }
    }
  } catch {
    /* audio is a nicety; never break the flow */
  }
}

export function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export const sfx = {
  click() {
    const a = ac();
    if (!a) return;
    // a soft, very short filtered noise tick
    const len = Math.floor(a.sampleRate * 0.018);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2400;
    const g = a.createGain();
    g.gain.value = 0.25;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
    haptic(8);
  },
  pop() {
    const a = ac();
    haptic(12);
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.16);
  },
  /** The payment confirmation: the selected chime variant (see CHIMES). Haptic pulse on the same frame. */
  chime(variant?: ChimeId) {
    haptic(30);
    const a = ac();
    if (a) playChime(a, CHIMES[variant ?? chimeId()]);
  },
  /** Audition a variant from a button press, even when Crave sounds are muted. */
  preview(variant: ChimeId) {
    const a = ac(true);
    if (a) playChime(a, CHIMES[variant]);
  },
  /** Call from the user's tap before a delayed sound, so the AudioContext is allowed to start (autoplay rules). */
  unlock() {
    ac();
  },
  coin() {
    const a = ac();
    haptic(10);
    if (!a) return;
    const t = a.currentTime;
    tone(a, 1568, t, 0.09, 0.08, "square");
    tone(a, 2093, t + 0.07, 0.22, 0.07, "square");
  },
  setMuted(m: boolean) {
    muted = m;
    try {
      localStorage.setItem("vara.crave.muted", m ? "1" : "0");
    } catch {
      /* ignore */
    }
  },
  isMuted: () => muted,
};
