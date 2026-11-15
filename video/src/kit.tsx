import React from "react";
import { AbsoluteFill, Audio, Freeze, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, sans, TOTAL } from "./theme";

/* ------------------------------------------------------------------ motion
 * Entrance-only motion. Nothing ever leaves the frame or fades out, so every
 * slide ends on a complete, stable composition that can sit paused. */

/** seconds → frames */
export const s = (sec: number) => Math.round(sec * 30);

/** 0 → 1 spring that starts `delay` frames into the slide. */
export function useIn(delay = 0, damping = 200, durationInFrames = 26) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping }, durationInFrames });
}

/** Linear 0 → 1 progress between two frames (clamped). */
export function useProgress(from: number, to: number) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

/** Very slow, subtle ambient motion (-1 … 1). */
export function useAmbient(periodSec = 8, phase = 0) {
  const frame = useCurrentFrame();
  return Math.sin((frame / 30 / periodSec) * Math.PI * 2 + phase);
}

type From = "up" | "down" | "left" | "right" | "scale" | "none";
export const In: React.FC<{ delay?: number; from?: From; dist?: number; style?: React.CSSProperties; children: React.ReactNode; damping?: number }> = ({ delay = 0, from = "up", dist = 40, style, children, damping }) => {
  const t = useIn(delay, damping);
  const tf = from === "up" ? `translateY(${(1 - t) * dist}px)` : from === "down" ? `translateY(${-(1 - t) * dist}px)`
    : from === "left" ? `translateX(${-(1 - t) * dist}px)` : from === "right" ? `translateX(${(1 - t) * dist}px)`
    : from === "scale" ? `scale(${0.86 + 0.14 * t})` : "none";
  return <div style={{ opacity: Math.min(1, t * 1.4), transform: tf, ...style }}>{children}</div>;
};

/* ------------------------------------------------------------------ slide shell */

/** Where what is on screen comes from. Every slide that shows the product or a number carries one. */
export type Provenance = "live" | "still" | "data" | "model" | "illustration" | "concept";
const provenance: Record<Provenance, { text: string; color: string; fill: string }> = {
  live: { text: "Live app recording · synthetic data", color: C.green, fill: C.screen },
  still: { text: "Live app screenshot · synthetic data", color: C.green, fill: C.screen },
  data: { text: "Challenge dataset · synthetic", color: C.info, fill: C.infoBg },
  model: { text: "Model result · tested against a baseline", color: C.warn, fill: C.warnBg },
  illustration: { text: "Illustration", color: C.muted, fill: C.sunken },
  concept: { text: "Concept · not live", color: C.warn, fill: C.warnBg },
};

export const Badge: React.FC<{ kind: Provenance; text?: string; dark?: boolean; style?: React.CSSProperties }> = ({ kind, text, dark, style }) => {
  const p = provenance[kind];
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRadius: 999, fontFamily: sans, fontSize: 19, fontWeight: 600,
    letterSpacing: 0.2, color: dark ? C.heroMeta : p.color, background: dark ? "rgba(255,255,255,.08)" : p.fill, border: `1px solid ${dark ? "rgba(255,255,255,.2)" : p.color + "33"}`, ...style }}>
    <span style={{ width: 9, height: 9, borderRadius: 9, background: dark ? C.mint : p.color }} />{text ?? p.text}</div>;
};

/** Vara's mark, the sprout (same drawing as app/src/ui/hero.tsx). `inverse` on dark green. */
export const Sprout: React.FC<{ size?: number; inverse?: boolean; style?: React.CSSProperties }> = ({ size = 48, inverse, style }) => {
  const [bg, stem, big, small] = inverse ? [C.mint, C.deep, C.green, C.deep] : [C.green, "#fff", C.mint, "#fff"];
  return <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0, ...style }}>
    <circle cx="24" cy="24" r="24" fill={bg} />
    <path d="M24 36V22" stroke={stem} strokeWidth="3" strokeLinecap="round" />
    <path d="M24 24c0-6 4-10 10-10 0 6-4 10-10 10Z" fill={big} />
    <path d="M24 28c0-5-3-8-8-8 0 5 3 8 8 8Z" fill={small} />
  </svg>;
};

/** Full-frame slide with the fixed footer: who made this, sources, slide number.
 *  `dark` = deep green background. Content is absolutely positioned inside a 1920 × 1080 frame;
 *  keep everything inside left/right 96 px and above y = 1000 (the footer sits below). */
export const Slide: React.FC<{ n: number; dark?: boolean; sources?: string[]; children: React.ReactNode; bg?: string }> = ({ n, dark, sources = [], children, bg }) => {
  const ink = dark ? "rgba(255,255,255,.66)" : C.muted;
  return <AbsoluteFill style={{ background: bg ?? (dark ? C.deep : C.white), fontFamily: sans, color: dark ? "#fff" : C.ink }}>
    {children}
    <div style={{ position: "absolute", left: 96, right: 96, bottom: 28, display: "flex", alignItems: "flex-end", gap: 32, fontSize: 17, color: ink, lineHeight: 1.35 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <Sprout size={24} inverse={dark} />
        <span style={{ fontWeight: 700, color: dark ? "#fff" : C.green }}>Vara</span>
        <span>· Junction 2026 concept · not an official S-Pankki product</span>
      </div>
      <div style={{ flex: 1, textAlign: "right" }}>{sources.length ? <>Sources: {sources.join(" · ")}</> : null}</div>
      <div style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{String(n).padStart(2, "0")} / {TOTAL}</div>
    </div>
  </AbsoluteFill>;
};

export const Eyebrow: React.FC<{ children: React.ReactNode; dark?: boolean; delay?: number; style?: React.CSSProperties }> = ({ children, dark, delay = 0, style }) =>
  <In delay={delay} from="up" dist={14} style={style}>
    <div style={{ fontFamily: sans, fontSize: 20, fontWeight: 700, letterSpacing: 3.2, textTransform: "uppercase", color: dark ? C.mint : C.green }}>{children}</div>
  </In>;

export const Headline: React.FC<{ children: React.ReactNode; dark?: boolean; delay?: number; size?: number; style?: React.CSSProperties }> = ({ children, dark, delay = 4, size = 68, style }) =>
  <In delay={delay} from="up" dist={30} style={style}>
    <h1 style={{ margin: 0, fontFamily: sans, fontWeight: 700, fontSize: size, lineHeight: 1.08, letterSpacing: -1.6, color: dark ? "#fff" : C.ink }}>{children}</h1>
  </In>;

/** Emphasis inside a headline: green on light, mint on dark. */
export const Accent: React.FC<{ children: React.ReactNode; dark?: boolean; color?: string }> = ({ children, dark, color }) =>
  <span style={{ color: color ?? (dark ? C.mint : C.green) }}>{children}</span>;

/** Standard top-left title block. */
export const Title: React.FC<{ eyebrow: string; children: React.ReactNode; dark?: boolean; size?: number; width?: number }> = ({ eyebrow, children, dark, size, width = 1300 }) =>
  <div style={{ position: "absolute", left: 96, top: 76, width }}>
    <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
    <Headline dark={dark} size={size} style={{ marginTop: 16 }}>{children}</Headline>
  </div>;

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; dark?: boolean; tint?: boolean }> = ({ children, style, dark, tint }) =>
  <div style={{ background: dark ? "rgba(255,255,255,.07)" : tint ? C.screen : C.white, borderRadius: 24, border: `1px solid ${dark ? "rgba(255,255,255,.14)" : tint ? C.track : C.line}`,
    boxShadow: dark || tint ? "none" : "0 18px 50px rgba(0,70,40,.10), 0 2px 6px rgba(0,70,40,.05)", ...style }}>{children}</div>;

/** Animated number that counts up during its entrance. Finnish-style grouping is NOT applied: pass `locale`. */
export const CountUp: React.FC<{ to: number; delay?: number; decimals?: number; suffix?: string; prefix?: string; frames?: number }> = ({ to, delay = 0, decimals = 0, suffix = "", prefix = "", frames = 40 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = 1 - (1 - t) ** 3;
  const v = to * eased;
  return <>{prefix}{v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
};

/** A big figure with a label under it. */
export const Stat: React.FC<{ value: React.ReactNode; label: React.ReactNode; dark?: boolean; size?: number; delay?: number; style?: React.CSSProperties }> = ({ value, label, dark, size = 96, delay = 0, style }) =>
  <In delay={delay} style={style}>
    <div style={{ fontSize: size, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1, color: dark ? C.mint : C.green, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ marginTop: 12, fontSize: 24, lineHeight: 1.3, color: dark ? C.heroMeta : C.muted, maxWidth: 420 }}>{label}</div>
  </In>;

/* ------------------------------------------------------------------ devices */

/** Phone frame around a 390 × 844 screen (the recordings are 780 × 1688). `width` is the outer width. */
export const Phone: React.FC<{ width: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ width, children, style }) => {
  const b = width * 0.035, screenW = width - 2 * b, screenH = screenW * 844 / 390;
  return <div style={{ width, height: screenH + 2 * b, borderRadius: width * 0.15, background: "#16201b", padding: b, boxShadow: "0 40px 90px rgba(0,50,29,.30), inset 0 0 0 2px #2c3a33", flexShrink: 0, ...style }}>
    <div style={{ width: "100%", height: "100%", borderRadius: width * 0.118, overflow: "hidden", position: "relative", background: C.screen }}>{children}</div>
  </div>;
};
/** Outer height of a <Phone width> (for layout maths). */
export const phoneHeight = (width: number) => (width - 2 * width * 0.035) * 844 / 390 + 2 * width * 0.035;

/** Browser window frame for desktop recordings (1600 × 900 → 16:9). */
export const Browser: React.FC<{ width: number; url?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ width, url = "vara · insights for the judges", children, style }) =>
  <div style={{ width, borderRadius: 16, overflow: "hidden", background: "#fff", boxShadow: "0 40px 90px rgba(0,50,29,.22), 0 0 0 1px rgba(0,50,29,.10)", position: "relative", flexShrink: 0, ...style }}>
    <div style={{ height: 44, background: "#edf1ee", display: "flex", alignItems: "center", gap: 9, padding: "0 18px" }}>
      {["#ff5f57", "#febc2e", "#28c840"].map(c => <span key={c} style={{ width: 13, height: 13, borderRadius: 13, background: c }} />)}
      <div style={{ marginLeft: 18, flex: 1, height: 26, borderRadius: 8, background: "#fff", fontSize: 15, color: C.muted, display: "flex", alignItems: "center", paddingLeft: 14 }}>{url}</div>
    </div>
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden" }}>{children}</div>
  </div>;

/* ------------------------------------------------------------------ live recordings, stills, sound
 * Recordings are in public/live (made by scripts/record-app.mjs from the live app; times in src/timeline.json).
 * A clip shows its first frame before `at`, plays source seconds [from, to) from slide frame `at`,
 * then holds its last frame, so every slide still ends on a stable picture. Recordings have no sound:
 * narration and the app's own sounds are separate files in public/audio, played with <Sound>. */
export const LiveClip: React.FC<{ src: string; at: number; from?: number; to: number; rate?: number; style?: React.CSSProperties }> = ({ src, at, from = 0, to, rate = 1, style }) => {
  const frame = useCurrentFrame();
  const first = Math.round(from * 30), len = Math.round(to * 30) - first;
  const local = Math.max(0, Math.min(len - 1, Math.round((frame - at) * rate)));
  return <Freeze frame={first + local}>
    <OffthreadVideo src={staticFile(`live/${src}`)} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }} />
  </Freeze>;
};
/** Slide frame at which source second `t` of a LiveClip (started at slide frame `at`, from source second `from`) is on screen. */
export const clipFrame = (at: number, t: number, from = 0, rate = 1) => at + Math.round((t - from) * 30 / rate);

/** A still from public/shots. */
export const Shot: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) =>
  <Img src={staticFile(`shots/${src}`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }} />;

/** Plays public/audio/<src> from slide frame `at`. */
export const Sound: React.FC<{ src: string; at: number; volume?: number }> = ({ src, at, volume = 1 }) =>
  <Sequence from={at} layout="none"><Audio src={staticFile(`audio/${src}`)} volume={volume} /></Sequence>;

/** A caption that appears at frame `at` (entrance only) — used to label what a recording is doing. */
export const Caption: React.FC<{ at: number; children: React.ReactNode; dark?: boolean; style?: React.CSSProperties }> = ({ at, children, dark, style }) =>
  <In delay={at} from="up" dist={16} style={style}>
    <div style={{ fontSize: 28, lineHeight: 1.3, fontWeight: 500, color: dark ? "#fff" : C.ink }}>{children}</div>
  </In>;

export const Pill: React.FC<{ children: React.ReactNode; primary?: boolean; dark?: boolean; scale?: number; style?: React.CSSProperties }> = ({ children, primary, dark, scale = 1, style }) =>
  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 * scale, padding: `${10 * scale}px ${22 * scale}px`, borderRadius: 999, fontWeight: 600, fontSize: 20 * scale,
    background: primary ? (dark ? C.mint : C.green) : dark ? "rgba(255,255,255,.08)" : "#fff", color: primary ? (dark ? C.deep : "#fff") : dark ? "#fff" : C.green,
    border: primary ? "none" : `1.5px solid ${dark ? "rgba(255,255,255,.3)" : C.green}`, ...style }}>{children}</div>;

/** The pill the app shows on every Crave screen. */
export const CravePill: React.FC<{ scale?: number; style?: React.CSSProperties }> = ({ scale = 1, style }) =>
  <div style={{ display: "inline-flex", alignItems: "center", gap: 8 * scale, padding: `${7 * scale}px ${16 * scale}px`, borderRadius: 999, background: C.deep, color: C.mint, fontWeight: 700, fontSize: 19 * scale, ...style }}>
    <Icon name="box" size={22 * scale} color={C.mint} stroke={2} />Crave mode · nothing ships</div>;

/* ------------------------------------------------------------------ simple icons (stroke icons, 24 grid) */
const icons: Record<string, string> = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6L6 18",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z",
  chat: "M4 5h16v11H9l-5 4z",
  mic: "M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM6 11a6 6 0 0 0 12 0M12 17v3",
  chart: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7V5h12v2M16 13.5h.01",
  piggy: "M5 11a7 5.5 0 0 1 13-1.5l2 .5v4l-2 .5a7 5.5 0 0 1-2 2.3V19h-3v-1.5h-3V19H7v-2.4A5.6 5.6 0 0 1 5 11zM9 9.5h3M3 10c0 1 .7 1.6 2 1.6",
  basket: "M4 9h16l-1.6 10H5.6zM8 9l3-5M16 9l-3-5M9 13v3M12 13v3M15 13v3",
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  bag: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.3-5 6.5-5s5.7 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15c2 .6 3.2 2.2 3.5 5",
  phone: "M8 3h8v18H8zM11 18h2",
  bank: "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18",
  home: "M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  sliders: "M5 6h9M18 6h1M5 12h2M11 12h8M5 18h7M16 18h3M14 4v4M7 10v4M12 16v4",
  layers: "M12 4l9 5-9 5-9-5zM3 14l9 5 9-5",
  alert: "M12 4l9 16H3zM12 10v5M12 17.5h.01",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  repeat: "M4 9h13l-3-3M20 15H7l3 3",
  cpu: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
  doc: "M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4",
  arrow: "M4 12h15M13 6l6 6-6 6",
  undo: "M9 7L4 12l5 5M4 12h10a5 5 0 0 1 0 10h-2",
  sound: "M4 10h4l5-4v12l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4.5 4.5",
};
export const Icon: React.FC<{ name: keyof typeof icons | string; size?: number; color?: string; stroke?: number; style?: React.CSSProperties }> = ({ name, size = 28, color = C.green, stroke = 1.8, style }) =>
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>;

export const IconDisc: React.FC<{ name: string; size?: number; color?: string; bg?: string; dark?: boolean }> = ({ name, size = 64, color, bg, dark }) =>
  <div style={{ width: size, height: size, borderRadius: size, background: bg ?? (dark ? "rgba(145,250,155,.16)" : C.screen), display: "grid", placeItems: "center", flexShrink: 0 }}>
    <Icon name={name} size={size * 0.5} color={color ?? (dark ? C.mint : C.green)} /></div>;

/** A row with an icon disc, a bold line and a lighter line: the standard list item. */
export const Point: React.FC<{ icon: string; title: React.ReactNode; children?: React.ReactNode; dark?: boolean; delay?: number; size?: number; style?: React.CSSProperties }> = ({ icon, title, children, dark, delay = 0, size = 30, style }) =>
  <In delay={delay} from="up" dist={24} style={{ display: "flex", gap: 22, alignItems: "flex-start", ...style }}>
    <IconDisc name={icon} size={size * 2} dark={dark} />
    <div style={{ paddingTop: size * 0.12 }}>
      <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.2, color: dark ? "#fff" : C.ink }}>{title}</div>
      {children ? <div style={{ marginTop: 6, fontSize: size * 0.78, lineHeight: 1.35, color: dark ? C.heroMeta : C.muted }}>{children}</div> : null}
    </div>
  </In>;
