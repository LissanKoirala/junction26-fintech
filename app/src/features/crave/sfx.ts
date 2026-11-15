// Crave mode sounds and haptics, synthesised with the Web Audio API (no sound files). Short and soft:
// a click for presses, a pop for "added to basket", a two-note chime for a successful payment, coins for the pot.
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem("vara.crave.muted") === "1";
} catch {
  /* ignore */
}

function ac(): AudioContext | null {
  if (muted) return null;
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
  /** The payment confirmation: two bright notes, a fifth apart, with a soft shimmer. */
  chime() {
    haptic([18, 40, 28]);
    const a = ac();
    if (!a) return;
    const t = a.currentTime + 0.02;
    tone(a, 1318.5, t, 0.32, 0.16); // E6
    tone(a, 2637, t, 0.18, 0.03, "triangle");
    tone(a, 1975.5, t + 0.11, 0.55, 0.17); // B6
    tone(a, 3951, t + 0.11, 0.25, 0.025, "triangle");
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
