/* Version 2 building blocks: the stage, the persistent labels, the phone playing a take at a stated speed,
 * kinetic type, a big number, chips, the true-time stopwatch, whip entrances, and sound cues.
 * Inside a scene every time is in scene-local SECONDS; `f()` turns seconds into frames. */
import React from "react";
import { AbsoluteFill, Audio, Freeze, getInputProps, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
/** Render a single stem for measurement: --props '{"stem":"vo"}' or "music" (scripts/render-v2.mjs --stem). */
export const STEM = (getInputProps() as { stem?: string }).stem;
import { C, sans } from "../theme";
import { Icon, Sprout } from "../kit";
import { clip, Clip, footage, sfxFile, standIns, v1clip } from "./data";
import { f, FPS } from "./timeline";

export { C, sans, Icon, Sprout };
export const ease = (t: number) => 1 - (1 - t) ** 3;
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
/** Current scene-local second. */
export const useT = () => useCurrentFrame() / FPS;
/** 0 → 1 spring from second `at`. */
export const useSpring = (at: number, damping = 14, mass = 0.6) => {
  const fr = useCurrentFrame();
  return spring({ frame: fr - f(at), fps: FPS, config: { damping, mass, stiffness: 170 } });
};
export const useRamp = (a: number, b: number) => clamp((useT() - a) / Math.max(1e-3, b - a));

/* ------------------------------------------------------------ the stage */
export const BRAND_LABEL = "Vara · Junction 2026 concept · not an official S-Pankki product";
export const LIVE_LABEL = "Live app recording · edited for length · synthetic data";
export const AINO_LABEL = "Aino is a fictional customer";
export const SIM_LABEL = "Prototype: money movement is simulated";
export const DATA_LABEL = "Challenge dataset · synthetic · our analysis at /insights/";

/** The whole video: background with a slow drifting glow, and the persistent label on every frame. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const t = useT();
  const gx = 50 + 22 * Math.sin(t / 7), gy = 45 + 14 * Math.cos(t / 9);
  return <AbsoluteFill style={{ background: C.deeper, fontFamily: sans, color: "#fff", overflow: "hidden" }}>
    <AbsoluteFill style={{ background: `radial-gradient(1100px 800px at ${gx}% ${gy}%, rgba(0,120,65,.55), rgba(0,50,29,0) 70%)` }} />
    {children}
    <div style={{ position: "absolute", left: 40, bottom: 26, display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 500, color: "rgba(255,255,255,.78)", zIndex: 50 }}>
      <Sprout size={24} inverse />
      <span>{BRAND_LABEL}</span>
    </div>
    {standIns.length ? <div style={{ position: "absolute", left: 40, top: 30, padding: "6px 14px", background: "#d00", color: "#fff", fontSize: 26, fontWeight: 800, zIndex: 99 }}>
      STAND-IN {standIns.join(" + ").toUpperCase()}</div> : null}
  </AbsoluteFill>;
};

/** Context labels, bottom right, one per line. */
export const Labels: React.FC<{ items: (string | false | null | undefined)[] }> = ({ items }) => {
  const list = items.filter(Boolean) as string[];
  if (!list.length) return null;
  return <div style={{ position: "absolute", left: 40, bottom: 64, display: "flex", flexDirection: "column-reverse", alignItems: "flex-start", gap: 6, zIndex: 50 }}>
    {list.map(l => <div key={l} style={{ padding: "5px 14px", borderRadius: 999, background: "rgba(0,0,0,.32)", border: "1px solid rgba(255,255,255,.16)",
      fontSize: 20, fontWeight: 600, color: l.startsWith("×") ? C.mint : "rgba(255,255,255,.88)", whiteSpace: "nowrap" }}>{l}</div>)}
  </div>;
};

/** Renders its children only while from <= t < to (scene seconds). Time is NOT reset inside. */
export const Win: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const fr = useCurrentFrame();
  return fr >= f(from) && fr < f(to) ? <>{children}</> : null;
};

/** A whip entrance: arrives from the side with motion blur over 7 frames. */
export const Whip: React.FC<{ at: number; dir?: 1 | -1; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, dir = 1, children, style }) => {
  const fr = useCurrentFrame() - f(at);
  const p = ease(clamp(fr / 7));
  return <AbsoluteFill style={{ transform: `translateX(${dir * (1 - p) * 260}px)`, filter: p < 1 ? `blur(${(1 - p) * 26}px)` : undefined, opacity: clamp(fr / 3 + 0.2), ...style }}>{children}</AbsoluteFill>;
};

/** A white flash over everything at `at` (for hard hits). */
export const Flash: React.FC<{ at: number; len?: number; color?: string }> = ({ at, len = 0.35, color = "#fff" }) => {
  const t = useT() - at;
  if (t < 0 || t > len) return null;
  return <AbsoluteFill style={{ background: color, opacity: 0.85 * (1 - t / len), zIndex: 40 }} />;
};

/* ------------------------------------------------------------ sound */
/** An effect from audio.json at scene second `at` (skipped if AUDIO has not delivered it). */
export const Sfx: React.FC<{ name: string; at: number; volume?: number }> = ({ name, at, volume = 1 }) => {
  const s = sfxFile(name);
  if (!s || (STEM && STEM !== "sfx")) return null;
  return <Sequence from={Math.max(0, f(at))} layout="none"><Audio src={staticFile(s.file)} volume={volume} /></Sequence>;
};
/** One of the app's own sounds (public/audio/chime.m4a, pop.m4a, coins.m4a). */
export const AppSound: React.FC<{ src: "chime" | "pop" | "coins"; at: number; volume?: number }> = ({ src, at, volume = 1 }) => STEM && STEM !== "sfx" ? null :
  <Sequence from={Math.max(0, f(at))} layout="none"><Audio src={staticFile(`audio/${src}.m4a`)} volume={volume} /></Sequence>;

/* ------------------------------------------------------------ takes: footage at a stated speed */
export type Seg = { from: number; to: number; a: number; b: number; anchor?: "start" | "end" | "hold"; maxRate?: number };
export type RSeg = { from: number; to: number; a: number; rate: number };
/** Fits every segment, then splits any "hold" segment that is longer than its footage into a freeze on its first
 *  frame followed by real-speed play that ends exactly on b (so a sequence of segments stays continuous). */
/** Source ranges a take must never show (footage.json `avoid`: e.g. a look-alike of a real trademark). */
export const avoidOf = (c: Clip): [number, number][] => [...((c as unknown as { avoid?: [number, number][] }).avoid ?? []), ...(EDIT_AVOID(c) ?? [])];
/** EDIT's own entries, for one specific take only: the pre-Gemini headphones montage take (built in 16.3 s) shows a
 *  white earbud case resembling a real product in its second card from about 1.6 s until the grid scrolls past it. */
const EDIT_AVOID = (c: Clip): [number, number][] | null =>
  c.file === "v2/live/shop-headphones.mp4" && (c as unknown as { build_seconds?: number }).build_seconds === 16.3 ? [[1.5, 16.2]] : null;
/** Cuts every resolved segment across the avoided source ranges: the take plays up to the range, then cuts to its end
 *  at the same speed (a freeze inside a range is moved to just before it). */
const skipAvoid = (r: RSeg[], avoid: [number, number][]): RSeg[] => avoid.reduce((segs, [s, e]) => segs.flatMap(g => {
  const dur = g.to - g.from, srcEnd = g.a + dur * g.rate;
  if (g.rate === 0) return [g.a >= s - 0.04 && g.a <= e ? { ...g, a: s - 0.1 } : g];
  if (srcEnd <= s - 0.04 || g.a >= e) return [g];
  if (g.a >= s - 0.04) return [{ ...g, a: e + 0.05 }];                    // starts inside: start after the range
  const cut = g.from + (s - 0.1 - g.a) / g.rate;                          // plays up to the range, then cuts past it
  return [{ ...g, to: cut }, { from: cut, to: g.to, a: e + 0.05, rate: g.rate }];
}), r);
export const resolveAll = (segs: Seg[], len: number, avoid: [number, number][] = []): RSeg[] => skipAvoid(resolveRaw(segs, len), avoid);
const resolveRaw = (segs: Seg[], len: number): RSeg[] => segs.flatMap(s => {
  const dur = s.to - s.from;
  if (s.anchor === "hold" && s.b - s.a < dur) {
    const play = s.b - s.a, cut = s.to - play;
    return [{ from: s.from, to: cut, a: s.a, rate: 0 }, { from: cut, to: s.to, a: s.a, rate: 1 }];
  }
  return fitEach([s], len);
});
/** Fits source seconds [a, b] into scene seconds [from, to]. Never slower than real time: if the footage is shorter
 *  than the slot, the slot shows real-speed footage ending at b (or starting at a, with anchor "start").
 *  If it would need more than maxRate, the start is cut instead (the footage is "edited for length"). */
const fitEach = (segs: Seg[], len: number): RSeg[] => segs.map(s => {
  const dur = s.to - s.from;
  let a = s.a, b = s.b, rate = (b - a) / dur;
  const max = s.maxRate ?? 6;
  if (rate < 1) {
    rate = 1;
    if (s.anchor === "start") b = a + dur; else a = b - dur;
    if (a < 0) a = 0;
    if (a + dur > len) a = Math.max(0, len - dur);
  } else if (rate > max) { rate = max; a = b - dur * max; }
  return { from: s.from, to: s.to, a, rate };
});
export const resolve = resolveAll;
const segAt = (r: RSeg[], t: number) => r.find(s => t >= s.from && t < s.to) ?? (t < r[0].from ? r[0] : r[r.length - 1]);
export const srcAt = (r: RSeg[], t: number) => { const s = segAt(r, t); return s.a + (clamp(t, s.from, s.to) - s.from) * s.rate; };
/** Speed label text for the current moment, if not real speed. */
export const speedLabel = (rate: number) => rate > 1.05 ? `×${rate < 10 ? rate.toFixed(1).replace(/\.0$/, "") : Math.round(rate)} speed` : null;

/** The footage only (fills its parent). */
export const TakeVideo: React.FC<{ c: Clip; r: RSeg[]; offset?: number }> = ({ c, r, offset = 0 }) => {
  const t = useT();
  let src = srcAt(r, t) + offset;
  for (const [s, e] of avoidOf(c)) if (src >= s - 0.04 && src <= e) src = s - 0.1;   // last guard: never a frame inside an avoided range
  const fr = Math.max(0, Math.min(Math.floor(c.seconds * FPS) - 1, Math.floor(src * FPS)));
  // The source frame goes in trimBefore with the timeline frozen at 0: Remotion clamps a frozen frame to what is left
  // of the composition after the enclosing Sequence starts, which froze late source frames in late acts.
  return <Freeze frame={0}><OffthreadVideo src={staticFile(c.file)} trimBefore={fr} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></Freeze>;
};

/** Phone frame around a 390 × 844 screen (same proportions as the recordings). */
export const phoneH = (w: number) => (w - 2 * w * 0.035) * 844 / 390 + 2 * w * 0.035;
export const PhoneBody: React.FC<{ width: number; children: React.ReactNode; glow?: number }> = ({ width, children, glow = 0 }) => {
  const b = width * 0.035;
  return <div style={{ width, height: phoneH(width), boxSizing: "border-box", borderRadius: width * 0.15, background: "#0c1410", padding: b,
    boxShadow: `0 50px 120px rgba(0,0,0,.45), 0 0 ${120 * glow}px rgba(145,250,155,${0.55 * glow}), inset 0 0 0 2px #2c3a33` }}>
    <div style={{ width: "100%", height: "100%", borderRadius: width * 0.118, overflow: "hidden", position: "relative", background: C.screen }}>{children}</div>
  </div>;
};

export type Push = { at: number; dur?: number; scale: number; origin?: string; x?: number };
/** A phone playing a clip. `x` is the phone's centre; it always sits vertically centred. Pushes animate a zoom. */
export const PhoneTake: React.FC<{ clipId: string; segs: Seg[]; x?: number; width?: number; push?: Push[]; offset?: number; glowAt?: number; y?: number }> =
  ({ clipId, segs, x = 1240, width = 470, push = [], offset = 0, glowAt, y }) => {
    const c = clip(clipId);
    const r = resolve(segs, c.seconds, avoidOf(c));
    const t = useT();
    let scale = 1, origin = "50% 50%", cx = x;
    for (const p of push) {
      const k = ease(clamp((t - p.at) / (p.dur ?? 0.5)));
      if (t >= p.at) { scale = scale + (p.scale - scale) * k; origin = p.origin ?? origin; if (p.x !== undefined) cx = cx + (p.x - cx) * k; }
    }
    const drift = 1 + 0.012 * Math.sin(t * 0.9);
    const glow = glowAt !== undefined ? clamp(1 - Math.abs(t - glowAt - 0.4) / 0.9) : 0;
    const top = y ?? (1080 - phoneH(width)) / 2 - 6;
    return <div style={{ position: "absolute", left: cx - width / 2, top, transform: `scale(${scale * drift})`, transformOrigin: origin }}>
      <PhoneBody width={width} glow={glow}><TakeVideo c={c} r={r} offset={offset} /></PhoneBody>
    </div>;
  };
/** The labels a take needs at this moment: live footage, and its speed when it is not real time. */
export const TakeLabels: React.FC<{ clipId: string; segs: Seg[]; extra?: (string | false | null | undefined)[] }> = ({ clipId, segs, extra = [] }) => {
  const r = resolve(segs, clip(clipId).seconds, avoidOf(clip(clipId)));
  const t = useT();
  return <Labels items={[...extra, LIVE_LABEL, speedLabel(segAt(r, t).rate)]} />;
};
/** The app's own sounds on their events, for whatever part of the take a set of segments shows. */
const APP_SOUNDS: { label: string; src: "chime" | "pop" | "coins"; volume: number }[] = [
  { label: "added", src: "pop", volume: 0.7 }, { label: "tick", src: "chime", volume: 1 }, { label: "coins", src: "coins", volume: 0.8 },
];
export const TakeSounds: React.FC<{ clipId: string; segs: Seg[]; only?: string[] }> = ({ clipId, segs, only }) => {
  const c = clip(clipId);
  const r = resolve(segs, c.seconds, avoidOf(c));
  const out: React.ReactNode[] = [];
  for (const s of r) for (const snd of APP_SOUNDS) {
    if (only && !only.includes(snd.label)) continue;
    const e = c.events?.find(k => k.label === snd.label);
    if (!e) continue;
    const end = s.a + (s.to - s.from) * s.rate;
    if (e.t >= s.a && e.t < end) out.push(<AppSound key={`${snd.label}${s.from}`} src={snd.src} at={s.from + (e.t - s.a) / s.rate} volume={snd.volume} />);
  }
  return <>{out}</>;
};
/** Scene second at which source second `e` shows, given segments (undefined if not shown). */
export const whenShown = (clipId: string, segs: Seg[], e: number) => {
  const r = resolve(segs, clip(clipId).seconds, avoidOf(clip(clipId)));
  for (const s of r) { const end = s.a + (s.to - s.from) * s.rate; if (e >= s.a && e < end) return s.from + (e - s.a) / s.rate; }
  return undefined;
};

/* ------------------------------------------------------------ type */
/** Big words that pop in at `at` and leave at `out`. */
export const Say: React.FC<{ at: number; out?: number; size?: number; color?: string; weight?: number; style?: React.CSSProperties; children: React.ReactNode; from?: "up" | "scale" | "left" }> =
  ({ at, out, size = 120, color = "#fff", weight = 800, style, children, from = "up" }) => {
    const t = useT();
    const k = useSpring(at, 13, 0.55);
    if (t < at) return null;
    const o = out !== undefined ? clamp((out - t) / 0.12) : 1;
    if (o <= 0) return null;
    // after it lands, the type keeps creeping forward (about 1 % a second, at most 5 %): no screen sits still
    const creep = 1 + Math.min(0.05, 0.01 * Math.max(0, t - at - 0.4));
    const tf = (from === "scale" ? `scale(${0.6 + 0.4 * k})` : from === "left" ? `translateX(${(1 - k) * -80}px)` : `translateY(${(1 - k) * 70}px)`) + ` scale(${creep})`;
    return <div style={{ fontFamily: sans, fontSize: size, fontWeight: weight, lineHeight: 1.02, letterSpacing: -size * 0.035, color, opacity: clamp(k * 2) * o, transform: tf, transformOrigin: "35% 50%", ...style }}>{children}</div>;
  };
export const Mint: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: C.mint }}>{children}</span>;

/** Absolutely placed block. */
export const At: React.FC<{ x: number; y: number; w?: number; center?: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, w, center, children, style }) =>
  <div style={{ position: "absolute", left: center ? x - (w ?? 1600) / 2 : x, top: y, width: w ?? (center ? 1600 : undefined), textAlign: center ? "center" : undefined, ...style }}>{children}</div>;

/** A count-up number (Finnish grouping and comma decimals optional). */
export const Count: React.FC<{ at: number; to: number; dur?: number; decimals?: number; comma?: boolean; group?: string }> = ({ at, to, dur = 0.8, decimals = 0, comma, group = "," }) => {
  const k = ease(useRamp(at, at + dur));
  const v = to * k;
  let s = v.toFixed(decimals);
  const [i, d] = s.split(".");
  // digits keep a fixed width while counting; separators keep their own (narrow) width
  const parts: React.ReactNode[] = [];
  const intDigits = i.replace(/\B(?=(\d{3})+(?!\d))/g, "|").split("|");
  intDigits.forEach((g, k) => { if (k) parts.push(<span key={`g${k}`} style={{ fontVariantNumeric: "normal" }}>{group === " " ? "\u2009" : group}</span>); parts.push(<span key={`i${k}`}>{g}</span>); });
  if (d) { parts.push(<span key="sep" style={{ fontVariantNumeric: "normal" }}>{comma ? "," : "."}</span>); parts.push(<span key="d">{d}</span>); }
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{parts}</span>;
};

/** A chip that pops on a word. */
export const Chip: React.FC<{ at: number; icon: string; children: React.ReactNode; size?: number; out?: number }> = ({ at, icon, children, size = 46, out }) => {
  const t = useT();
  const k = useSpring(at, 11, 0.5);
  if (t < at) return null;
  const o = out !== undefined ? clamp((out - t) / 0.15) : 1;
  return <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4, padding: `${size * 0.3}px ${size * 0.6}px ${size * 0.3}px ${size * 0.35}px`, borderRadius: 999,
    background: "rgba(145,250,155,.13)", border: "2px solid rgba(145,250,155,.5)", transform: `scale(${0.5 + 0.5 * k})`, transformOrigin: "left center", opacity: clamp(k * 2) * o }}>
    <div style={{ width: size * 1.3, height: size * 1.3, borderRadius: size, background: C.mint, display: "grid", placeItems: "center" }}><Icon name={icon} size={size * 0.8} color={C.deep} stroke={2.2} /></div>
    <span style={{ fontSize: size, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{children}</span>
  </div>;
};

/** The true-time stopwatch: real elapsed seconds of the build, whatever speed the footage plays at, with laps that
 *  mark true moments (the shop opening, the shop complete) as they are reached. */
export type Lap = { label: string; value: number };
export const Stopwatch: React.FC<{ seconds: number; final: number; at: number; laps: Lap[]; size?: number }> = ({ seconds, final, at, laps, size = 140 }) => {
  const k = useSpring(at, 14, 0.6);
  const t = useT();
  if (t < at) return null;
  const v = Math.min(seconds, final);
  const done = v >= final - 1e-6;
  const ring = clamp(v / Math.max(final, 1));
  const R = size * 0.42, L = 2 * Math.PI * R;
  return <div style={{ opacity: clamp(k * 2), transform: `translateY(${(1 - k) * 40}px)` }}>
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.2 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={size * 0.07} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={done ? C.mint : C.bright} strokeWidth={size * 0.07} strokeLinecap="round"
          strokeDasharray={`${L * ring} ${L}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: C.heroMeta }}>Real time</div>
        <div style={{ fontSize: size * 0.78, fontWeight: 800, lineHeight: 1, letterSpacing: -3, fontVariantNumeric: "tabular-nums", color: done ? C.mint : "#fff" }}>{v.toFixed(1)} s</div>
      </div>
    </div>
    <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
      {laps.filter(l => v >= l.value - 1e-6).map(l => <LapRow key={l.label} lap={l} />)}
    </div>
  </div>;
};
const LapRow: React.FC<{ lap: Lap }> = ({ lap }) =>
  <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 46, fontWeight: 700 }}>
    <Icon name="check" size={46} color={C.mint} stroke={3} />
    <span>{lap.label}</span><span style={{ color: C.mint, fontVariantNumeric: "tabular-nums" }}>· {lap.value.toFixed(1)} s</span>
  </div>;

/** A screenshot from public/shots. */
export const Shot: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) =>
  <Img src={staticFile(`shots/${src}`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }} />;

/** The v1 recordings (public/live) in a phone, played from `at` (scene seconds) at `rate` from source `from`. */
export const V1Phone: React.FC<{ file: string; at: number; from?: number; rate?: number; x?: number; width?: number; push?: Push[] }> = ({ file, at, from = 0, rate = 1, x, width, push }) => {
  const seg: Seg = { from: at, to: at + 1000, a: from, b: from + 1000 * rate, maxRate: 99 };
  return <PhoneTakeRaw c={{ file: `live/${file}`, seconds: v1clip(file).seconds }} segs={[seg]} x={x} width={width} push={push} />;
};
const PhoneTakeRaw: React.FC<{ c: Clip; segs: Seg[]; x?: number; width?: number; push?: Push[] }> = ({ c, segs, x = 1240, width = 470, push = [] }) => {
  const r = resolve(segs, c.seconds, avoidOf(c));
  const t = useT();
  let scale = 1, origin = "50% 50%";
  for (const p of push) { const k = ease(clamp((t - p.at) / (p.dur ?? 0.5))); if (t >= p.at) { scale = scale + (p.scale - scale) * k; origin = p.origin ?? origin; } }
  const drift = 1 + 0.012 * Math.sin(t * 0.9);
  return <div style={{ position: "absolute", left: x - width / 2, top: (1080 - phoneH(width)) / 2 - 6, transform: `scale(${scale * drift})`, transformOrigin: origin }}>
    <PhoneBody width={width}><TakeVideo c={c} r={r} /></PhoneBody>
  </div>;
};

export const allClips = () => footage.clips;
export { interpolate };
