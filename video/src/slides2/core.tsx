/* Slides v2: the building blocks of the presentation deck (video/SLIDES2.md).
 * Format copied from the Edge-Care deck: one composition per slide, rendered to its own numbered MP4; entrances
 * only; the narration for that slide baked in; every clip ends on a complete, still frame that can sit paused
 * while the presenter talks. The look comes from the v2 kit (src/v2/kit.tsx) so the slides match the videos.
 * All times inside a slide are slide-local SECONDS. */
import React from "react";
import { AbsoluteFill, Audio, Freeze, getInputProps, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
/** --props '{"clean":true}': no red provisional marks (the PowerPoint stills; the report lists what is provisional). */
const CLEAN = !!(getInputProps() as { clean?: boolean }).clean;
import { AppSound, BRAND_LABEL, C, Icon, PhoneBody, phoneH, resolve, sans, Seg, Sfx, Sprout, TakeVideo } from "../v2/kit";
import type { Clip } from "../v2/data";
import audioRaw from "../v2/audio.json";
import footageRaw from "../v2/footage.json";
import factsRaw from "../v2/facts.json";
import creditsRaw from "../v2/credits.json";
import v1Raw from "../timeline.json";
import { SCRIPT_R2 } from "../v2/script-r2";

export { C, sans, Icon, Sprout, Sfx, AppSound };
export const FPS = 30;
export const f = (s: number) => Math.round(s * FPS);
export const LEAD = 0.5;   // narration starts this far into a slide
export const HOLD = 2.2;   // complete, still frame at the end of every slide
export const TOTAL = 18;

/* ------------------------------------------------------------------ data (read, never typed in) */
const AUD = audioRaw as unknown as { vo: Record<string, { file: string; seconds: number; sentences: { text: string; start: number; end: number }[]; words?: { w: string; start: number; end: number }[] }> };
const FOOT = footageRaw as unknown as { clips: Record<string, Clip & { build_seconds?: number; build?: { shop_open_seconds?: number; server?: Record<string, unknown> }; shop?: Record<string, unknown> }> };
export const FACTS = factsRaw as unknown as { build_seconds: { hero: number; others: number[] } };
export const CREDITS = creditsRaw as unknown as { build: { lead: string; model: string; feature: string }; coach: { lead: string; model: string; feature: string }; photos?: string };
const V1 = v1Raw as unknown as { clips: { file: string; seconds: number; cut?: unknown[]; events: { t: number; label: string }[] }[] };

export const clip = (id: string) => {
  const c = FOOT.clips[id];
  if (!c) throw new Error(`footage.json: no clip ${id}`);
  return c;
};
export const ev = (id: string, label: string, fb?: number) => {
  const t = clip(id).events?.find(e => e.label === label)?.t;
  if (t === undefined) { if (fb !== undefined) return fb; throw new Error(`footage.json: ${id} has no event ${label}`); }
  return t;
};
export const v1 = (file: string): Clip => {
  const c = V1.clips.find(k => k.file === file);
  if (!c) throw new Error(`timeline.json: no clip ${file}`);
  return { file: `live/${c.file}`, seconds: c.seconds, events: c.events };
};
export const v1ev = (file: string, label: string, fb = 0) => V1.clips.find(k => k.file === file)?.events.find(e => e.label === label)?.t ?? fb;
/** "129,90 €" → 129.9 */
export const euros = (s: unknown, fb = 0) => {
  const m = String(s ?? "").replace(/ /g, " ").match(/(\d+(?:[ ,.]\d+)?)/);
  return m ? Number(m[1].replace(/ /g, "").replace(",", ".")) : fb;
};
/** True when the take's build was made by Gemini (the shop footage is re-recorded after the app's switch). */
export const builtByGemini = (id: string) => JSON.stringify(clip(id).build?.server ?? {}).toLowerCase().includes("gemini");

/* ------------------------------------------------------------------ narration */
type W = { w: string; start: number; end: number };
const toks = (s: string) => s.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9äöå]+/).filter(Boolean);
/** The delivered file says the approved (revision 2) text. */
const matches = (scene: string) => {
  const v = AUD.vo[scene]; if (!v) return false;
  const want = toks(SCRIPT_R2[scene] ?? ""), haveL = toks(v.sentences.map(s => s.text).join(" ")), have = new Set(haveL);
  return want.length > 0 && want.filter(w => have.has(w)).length / want.length >= 0.97 && Math.abs(haveL.length - want.length) <= 1;
};
/** Stand-in timing from the approved text (about 2.9 words a second), used silently until the voice matches. */
const standIn = (scene: string) => {
  const text = SCRIPT_R2[scene] ?? "";
  const sents = text.match(/[^.?!]+[.?!]+/g)?.map(x => x.trim()) ?? [text];
  let t = 0; const sentences: { text: string; start: number; end: number }[] = [], words: W[] = [];
  for (const s of sents) {
    const ws = s.split(/\s+/), st = t;
    for (const w of ws) { words.push({ w, start: t, end: t + 0.3 }); t += 1 / 2.9; }
    sentences.push({ text: s, start: st, end: t }); t += 0.25;
  }
  return { file: null as string | null, seconds: t, sentences, words };
};
export type Part = { scene: string; from?: string; to?: string };
type Placed = { file: string | null; a: number; b: number; at: number; words: { tok: string; t: number }[] };
export type Voice = { start: number; end: number; parts: Placed[]; real: boolean; cue: (sub: string, fb?: number) => number; missing: string[] };
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'");
/** The narration a slide plays: whole sentences (from the one containing `from` to the one containing `to`) of one or
 *  more pitch scenes, back to back from slide second `at`. `cue("words")` = slide second at which those words are said. */
export function voice(at: number, ...parts: Part[]): Voice {
  const placed: Placed[] = []; let t = at, real = true; const missing: string[] = [];
  for (const p of parts) {
    const ok = matches(p.scene);
    const v = ok ? { ...AUD.vo[p.scene], file: AUD.vo[p.scene].file as string | null } : standIn(p.scene);
    if (!ok) real = false;
    const S = v.sentences;
    const i = p.from ? S.findIndex(s => norm(s.text).includes(norm(p.from!))) : 0;
    const j = p.to ? S.findIndex(s => norm(s.text).includes(norm(p.to!))) : S.length - 1;
    if (i < 0 || j < 0) throw new Error(`${p.scene}: sentence not found (${p.from} / ${p.to})`);
    const a = Math.max(0, S[i].start - 0.04), b = Math.min(v.seconds, S[j].end + 0.08);
    const W = (v.words ?? []).filter(w => w.start >= a - 0.01 && w.start < b);
    const words = W.flatMap(w => toks(w.w).map(tok => ({ tok, t: t + (w.start - a) })));
    placed.push({ file: v.file, a, b, at: t, words });
    t += b - a + 0.3;
  }
  const all = placed.flatMap(p => p.words);
  const cue = (sub: string, fb?: number) => {
    const want = toks(sub);
    for (let k = 0; k + want.length <= all.length; k++) if (want.every((x, j) => all[k + j].tok === x)) return all[k].t;
    missing.push(sub);
    return fb ?? at;
  };
  return { start: at, end: t - 0.3, parts: placed, real, cue, missing };
}
/** Plays a slide's narration. */
export const VoTrack: React.FC<{ v: Voice }> = ({ v }) => <>
  {v.parts.filter(p => p.file).map((p, i) =>
    <Sequence key={i} from={f(p.at)} layout="none">
      <Audio src={staticFile(p.file!)} trimBefore={Math.floor(p.a * FPS)} trimAfter={Math.ceil(p.b * FPS)} />
    </Sequence>)}
</>;

/* ------------------------------------------------------------------ the frame */
export const Labels: React.FC<{ items: (string | false | null | undefined)[]; side?: "left" | "right" }> = ({ items, side = "left" }) => {
  // a speed label means nothing on a still picture: the clean (PowerPoint) stills leave it out
  const list = (items.filter(Boolean) as string[]).filter(l => !(CLEAN && /×[\d.,–-]+ speed/.test(l)));
  if (!list.length) return null;
  return <div style={{ position: "absolute", [side]: 40, bottom: 66, display: "flex", flexDirection: "column-reverse", alignItems: side === "left" ? "flex-start" : "flex-end", gap: 6, zIndex: 50 } as React.CSSProperties}>
    {list.map(l => <div key={l} style={{ padding: "5px 14px", borderRadius: 999, background: "rgba(0,0,0,.32)", border: "1px solid rgba(255,255,255,.16)",
      fontSize: 20, fontWeight: 600, color: l.startsWith("×") || l.includes("× speed") ? C.mint : "rgba(255,255,255,.88)", whiteSpace: "nowrap" }}>{l}</div>)}
  </div>;
};

/** Every slide: the deck's dark green stage (still: no drifting light), the persistent label and the slide number,
 *  context labels, and a red mark on anything provisional so a draft can never pass for the final. */
export const Frame: React.FC<{ n: number; v?: Voice; labels?: (string | false | null | undefined)[]; side?: "left" | "right"; pending?: (string | false)[]; glow?: [number, number]; children: React.ReactNode }> =
  ({ n, v, labels = [], side = "left", pending = [], glow = [50, 45], children }) => {
    const marks = [...new Set([...pending, v && !v.real && "narration pending"].filter(Boolean) as string[])];
    return <AbsoluteFill style={{ background: C.deeper, fontFamily: sans, color: "#fff", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(1200px 860px at ${glow[0]}% ${glow[1]}%, rgba(0,120,65,.55), rgba(0,50,29,0) 70%)` }} />
      {children}
      {v ? <VoTrack v={v} /> : null}
      <Labels items={labels} side={side} />
      <div style={{ position: "absolute", left: 40, bottom: 24, display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 500, color: "rgba(255,255,255,.78)", zIndex: 50 }}>
        <Sprout size={24} inverse /><span>{BRAND_LABEL}</span>
      </div>
      <div style={{ position: "absolute", right: 40, bottom: 24, fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,.6)", fontVariantNumeric: "tabular-nums", zIndex: 50 }}>
        {String(n).padStart(2, "0")} / {TOTAL}</div>
      {marks.length && !CLEAN ? <div style={{ position: "absolute", right: 40, top: 20, padding: "4px 12px", background: "#d00", color: "#fff", fontSize: 20, fontWeight: 800, zIndex: 99 }}>
        PROVISIONAL: {marks.join(" + ").toUpperCase()}</div> : null}
    </AbsoluteFill>;
  };

/* ------------------------------------------------------------------ entrances (they settle: nothing leaves) */
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const useK = (at: number, damping = 15, mass = 0.6) => {
  const fr = useCurrentFrame();
  return fr < f(at) ? 0 : spring({ frame: fr - f(at), fps: FPS, config: { damping, mass, stiffness: 170 } });
};
export const useT = () => useCurrentFrame() / FPS;
export const ramp = (t: number, a: number, b: number) => clamp((t - a) / Math.max(1e-3, b - a));
export const ease = (x: number) => 1 - (1 - x) ** 3;

type From = "up" | "down" | "left" | "right" | "scale" | "slam";
/** Arrives at `at` and stays. */
export const In: React.FC<{ at: number; from?: From; dist?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, from = "up", dist = 70, style, children }) => {
  const k = useK(at, from === "slam" ? 11 : 15);
  if (k <= 0) return null;
  const tf = from === "scale" ? `scale(${0.55 + 0.45 * k})` : from === "slam" ? `scale(${1.9 - 0.9 * k})` :
    from === "left" ? `translateX(${(1 - k) * -dist}px)` : from === "right" ? `translateX(${(1 - k) * dist}px)` :
    from === "down" ? `translateY(${(1 - k) * -dist}px)` : `translateY(${(1 - k) * dist}px)`;
  return <div style={{ opacity: clamp(k * 2), transform: tf, transformOrigin: "left center", ...style }}>{children}</div>;
};
/** Big type. */
export const Big: React.FC<{ size?: number; color?: string; weight?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ size = 120, color = "#fff", weight = 800, style, children }) =>
  <div style={{ fontFamily: sans, fontSize: size, fontWeight: weight, lineHeight: 1.02, letterSpacing: -size * 0.035, color, ...style }}>{children}</div>;
export const Mint: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: C.mint }}>{children}</span>;
export const At: React.FC<{ x: number; y: number; w?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ x, y, w, style, children }) =>
  <div style={{ position: "absolute", left: x, top: y, width: w, ...style }}>{children}</div>;

/** A number that counts up from `at` (comma decimals, Finnish thin-space grouping). */
export const CountTo: React.FC<{ at: number; to: number; dur?: number; decimals?: number; suffix?: string; prefix?: string }> = ({ at, to, dur = 0.9, decimals = 0, suffix = "", prefix = "" }) => {
  // (no tabular figures with decimals: the font spaces the comma oddly)
  const t = useT();
  const v = to * ease(ramp(t, at, at + dur));
  const [i, d] = v.toFixed(decimals).split(".");
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return <span style={{ fontVariantNumeric: decimals ? "normal" : "tabular-nums" }}>{prefix}{g}{d ? "," + d : ""}{suffix}</span>;
};

/** A pill with an icon. */
export const Chip: React.FC<{ at: number; icon: string; size?: number; children: React.ReactNode }> = ({ at, icon, size = 46, children }) => {
  const k = useK(at, 12, 0.5);
  if (k <= 0) return null;
  return <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4, padding: `${size * 0.3}px ${size * 0.7}px ${size * 0.3}px ${size * 0.35}px`, borderRadius: 999,
    background: "rgba(145,250,155,.13)", border: "2px solid rgba(145,250,155,.5)", transform: `scale(${0.5 + 0.5 * k})`, transformOrigin: "left center", opacity: clamp(k * 2) }}>
    <div style={{ width: size * 1.3, height: size * 1.3, borderRadius: size, background: C.mint, display: "grid", placeItems: "center" }}><Icon name={icon} size={size * 0.8} color={C.deep} stroke={2.2} /></div>
    <span style={{ fontSize: size, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{children}</span>
  </div>;
};
export const Disc: React.FC<{ icon: string; size?: number; fill?: boolean }> = ({ icon, size = 120, fill }) =>
  <div style={{ width: size, height: size, borderRadius: size, background: fill ? C.mint : "rgba(145,250,155,.14)", border: `3px solid ${C.mint}`, display: "grid", placeItems: "center" }}>
    <Icon name={icon} size={size * 0.52} color={fill ? C.deep : C.mint} stroke={2} /></div>;

/** A white flash for a hard hit (it is light, not an element: it decays in 0.35 s). */
export const Flash: React.FC<{ at: number; len?: number }> = ({ at, len = 0.35 }) => {
  const t = useT() - at;
  if (t < 0 || t > len) return null;
  return <AbsoluteFill style={{ background: "#fff", opacity: 0.8 * (1 - t / len), zIndex: 40 }} />;
};

/* ------------------------------------------------------------------ the phone playing a take */
/** A phone playing source seconds of a take (segments as in the v2 kit: never slower than real time). It rises in at
 *  `enter`, holds the first frame until its first segment and the last frame after its last: no drift, so the end is still. */
export const Take: React.FC<{ c: Clip; segs: Seg[]; x: number; width?: number; y?: number; enter?: number; gray?: number }> = ({ c, segs, x, width = 400, y, enter = 0, gray = 0 }) => {
  const k = useK(enter, 16);
  const r = resolve(segs, c.seconds);
  const top = y ?? (1080 - phoneH(width)) / 2 - 20;
  return <div style={{ position: "absolute", left: x - width / 2, top, opacity: clamp(k * 2), transform: `translateY(${(1 - k) * 120}px)`, filter: gray > 0 ? `grayscale(${gray}) brightness(${1 - 0.35 * gray})` : undefined }}>
    <PhoneBody width={width}><TakeVideo c={c} r={r} /></PhoneBody>
  </div>;
};
/** "×2.4 speed" if any segment plays faster than real time (shown for the whole slide, so the held end says it too). */
export const speedOf = (c: Clip, segs: Seg[]) => {
  const m = Math.max(...resolve(segs, c.seconds).map(s => s.rate));
  return m > 1.05 ? `×${m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.round(m)} speed` : null;
};
/** The app's own sounds on their events, for the part of the take the segments show. */
export const TakeSounds: React.FC<{ c: Clip; segs: Seg[]; only?: string[] }> = ({ c, segs, only }) => {
  const SOUNDS: { label: string; src: "chime" | "pop" | "coins"; volume: number }[] = [
    { label: "added", src: "pop", volume: 0.7 }, { label: "tick", src: "chime", volume: 1 }, { label: "coins", src: "coins", volume: 0.8 }];
  const out: React.ReactNode[] = [];
  for (const s of resolve(segs, c.seconds)) for (const snd of SOUNDS) {
    if (only && !only.includes(snd.label)) continue;
    const e = c.events?.find(k => k.label === snd.label); if (!e) continue;
    const end = s.a + (s.to - s.from) * s.rate;
    if (s.rate > 0 && e.t >= s.a && e.t < end) out.push(<AppSound key={snd.label + s.from} src={snd.src} at={s.from + (e.t - s.a) / s.rate} volume={snd.volume} />);
  }
  return <>{out}</>;
};

/* ------------------------------------------------------------------ the ML visuals */
/** Plays one of VIZ's visuals from `at` for `len` seconds (it scales to its Sequence), then holds its last frame. */
export const Ml: React.FC<{ C2: React.FC; at: number; len: number; until?: number }> = ({ C2, at, len, until }) => {
  const fr = useCurrentFrame();
  const s = f(at), L = f(len);
  if (fr < s || (until !== undefined && fr >= f(until))) return null;
  return <Freeze frame={Math.min(fr, s + L - 1)}><Sequence from={s} durationInFrames={L} layout="none"><AbsoluteFill><C2 /></AbsoluteFill></Sequence></Freeze>;
};

/* ------------------------------------------------------------------ a slide */
export type SlideDef = { id: string; title: string; seconds: number; component: React.FC };
/** Slide length: the later of the narration's end and the build's end, plus the still hold. */
export const len = (v: Voice | null, buildEnd = 0) => Math.ceil((Math.max(v ? v.end : 0, buildEnd) + HOLD) * FPS) / FPS;
