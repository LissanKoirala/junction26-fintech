/* Version 2: typed loaders for the three files the other builders write.
 *   audio.json    (AUDIO)  narration per scene with sentence times, the music bed, the effects
 *   footage.json  (REC)    the crave-run take and the three montage shops, with event times
 *   facts.json    (REC)    the true build times and what a generated shop contains
 * Until a file exists its stand-in is used and every frame carries a red "STAND-IN" mark (see Frame in kit.tsx),
 * so a render made from stand-ins can never be mistaken for a final one.
 * require.context picks up whichever of the three files exist at bundle time (webpack), so this module compiles
 * with or without them. */
import { SCRIPT_R2 } from "./script-r2";
import v1 from "../timeline.json";

type Ctx = { keys(): string[]; (k: string): unknown };
declare global {
  interface NodeRequire { context(dir: string, sub: boolean, re: RegExp): Ctx }
  namespace NodeJS { interface Require { context(dir: string, sub: boolean, re: RegExp): Ctx } }
}
const ctx = require.context("./", false, /^\.\/(audio|footage|facts)\.json$/);
const raw = (name: string): any => {
  const k = `./${name}.json`;
  if (!ctx.keys().includes(k)) return null;
  const m = ctx(k) as any;
  return m && m.default ? m.default : m;
};

export type Sentence = { text: string; start: number; end: number };
export type Word = { w: string; start: number; end: number };
export type Vo = { file: string | null; seconds: number; sentences: Sentence[]; words?: Word[] };
export type Section = { name: string; start: number; end: number };
export type Bed = { file: string | null; seconds: number; bpm: number; first_beat: number; sections: Section[]; bar_seconds?: number; lufs?: number };
export type Sfx = { file: string; seconds: number };
export type AudioData = { vo: Record<string, Vo>; music: { bed: Bed }; sfx: Record<string, Sfx> };
export type Ev = { t: number; label: string };
export type Shop = { name?: string; brands?: string[]; product?: string; price?: string };
export type Clip = { file: string; seconds: number; width?: number; height?: number; events?: Ev[]; craving?: string; shop?: Shop; [k: string]: unknown };
export type FootageData = { clips: Record<string, Clip> };
export type FactsData = { build_seconds: { hero: number; others: number[] }; shop_has: Record<string, boolean>; notes?: string };

/* ------------------------------------------------------------ stand-ins */
const split = (t: string) => t.match(/[^.?!]+[.?!]+/g)?.map(x => x.trim()) ?? [t];
const standInVo = (): Record<string, Vo> => {
  const out: Record<string, Vo> = {};
  for (const n of Object.entries(SCRIPT_R2).map(([id, approved]) => ({ id, approved }))) {
    let t = 0; const sentences: Sentence[] = [];
    for (const text of split(n.approved)) {
      const d = text.split(/\s+/).length / 3.0;
      sentences.push({ text, start: +t.toFixed(2), end: +(t + d).toFixed(2) });
      t += d + 0.25;
    }
    out[n.id] = { file: null, seconds: +(t - 0.25).toFixed(2), sentences };
  }
  return out;
};
const v1crave = v1.clips.find(c => c.file === "crave.mp4")!;
const v1ev = (l: string) => v1crave.events.find(e => e.label === l)!.t;
const standInFootage = (): FootageData => ({
  clips: {
    "crave-run": {
      file: "live/crave.mp4", seconds: v1crave.seconds, width: 780, height: 1688,
      events: [
        { t: 0.2, label: "typing-start" }, { t: v1ev("open-shop"), label: "submitted" }, { t: 3.6, label: "build-first-paint" },
        ...v1crave.events.filter(e => !["craving", "open-shop"].includes(e.label)),
        { t: 20.2, label: "wallet-visible" },
      ],
      shop: { name: "Hallo Stride", brands: ["SOLVIK"], product: "Court Low Leather", price: "119,95 €" },
    },
    "shop-sushi": { file: "live/crave.mp4", seconds: 6, craving: "sushi tonight", shop: { name: "stand-in" } },
    "shop-headphones": { file: "live/crave.mp4", seconds: 6, craving: "wireless headphones", shop: { name: "stand-in" } },
    "shop-coat": { file: "live/crave.mp4", seconds: 6, craving: "a winter coat", shop: { name: "stand-in" } },
  },
});
const standInFacts = (): FactsData => ({
  build_seconds: { hero: +(v1ev("shop-visible") - v1ev("open-shop")).toFixed(1), others: [9, 9, 9] },
  shop_has: { name: true, brands: true, products: true, photos: true, reviews: true },
});
// The montage stand-in plays the old take's shop page; real montage clips start at 0 in their own file.
export const MONTAGE_STANDIN_OFFSET = 4.6;

/* ------------------------------------------------------------ the loaded data */
const a = raw("audio"), f = raw("footage"), x = raw("facts");
export const real = { audio: !!a, music: !!a?.music?.bed?.file, footage: !!f, facts: !!x };
export const standIns = Object.entries(real).filter(([, v]) => !v).map(([k]) => k);

/* Pace: a pause between two sentences inside a narration file that is longer than MAX_GAP is shortened to TIGHT_GAP by
 * leaving out silence from its middle. The file is then played as pieces (Mix.tsx), and the sentence times below are
 * the re-timed ones, so every on-screen cue follows the voice as heard. */
export const MAX_GAP = 0.3, TIGHT_GAP = 0.24;
/* Deliberate music-only holds (allowed by the orchestrator for the build, the montage and the twist): seconds of
 * silence added in the narration after sentence `after` (0-based) of a scene. */
export const HOLDS: Record<string, { after: string; sec: number; word?: boolean }[]> = {
  // `after`: a few words of the sentence the hold follows (keyed on text, so it survives a re-voice);
  // with `word: true` the hold goes straight after those words, inside their sentence
  d1: [{ after: "so is the money", sec: 0.6 }],     // the money drains before the question
  d2: [{ after: "Watch this", sec: 2.0 },          // the tap and the hunting animation, so the shop opens on "A whole store"
       { after: "photos to match", sec: 1.6 }],    // the last cards stream in, the stopwatch completes, then "Almost instantly."
  d4: [{ after: "so it fits", sec: 2.2 }],         // the pay sheet and the wallet button, held to read, before "Double-click to pay."
  d5: [{ after: "Nothing ships", sec: 0.5 },       // the slam lands
       { after: "ever going to", sec: 1.8 },       // order turns into the pot, coins pour
       { after: "savings pot", sec: 0.7 }],        // the count reaches the price
  d7: [{ after: "five thousand other customers,", sec: 1.6, word: true },   // the map rises (VIZ: 5 s at least)
       { after: "forecast her balance,", sec: 0.6, word: true }],          // the forecast flash (and the scene's tail)
  p5: [{ after: "She tells Vara", sec: 2.0 }],     // the tap and the hunting animation; the shop opens on "almost instantly"
  p6: [{ after: "free until payday", sec: 2.2 }],  // the pay sheet and the wallet button, before "Double-click."
  p7: [{ after: "Nothing ships", sec: 0.5 },
       { after: "ever going to", sec: 1.8 },       // order turns into the pot, coins pour
       { after: "Crave pot", sec: 0.7 }],
  p10: [{ after: "five thousand others", sec: 0.6 },   // the map (VIZ: 5 s at least)
        { after: "two futures", sec: 2.6 },            // the look-alikes and their two futures (5.5 s)
        { after: "her balance to payday,", sec: 2.4, word: true },   // the forecast (4.5 s)
        { after: "below zero", sec: 2.6 },             // the early warning (5 s)
        { after: "Two clearly win", sec: 0.8 }],       // the scorecard settles
}
const norm0 = (s: string) => s.toLowerCase().replace(/[’']/g, "'");
const tok0 = (s: string) => s.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9äöå-]+/).filter(Boolean);
export type Piece = { from: number; to: number; at: number };   // file seconds [from, to) played at scene-voice second `at`
export const pieces: Record<string, Piece[]> = {};
const retime = (id: string, v: Vo): Vo => {
  if (!v.file) return v;
  const S = v.sentences, W = v.words ?? [];
  // breaks: [end of speech, start of the next speech, gap kept, hold added]
  const brk: { end: number; next: number; keep: number; hold: number }[] = [];
  S.forEach((k, i) => {
    const n = S[i + 1];
    const hold = (HOLDS[id] ?? []).filter(h => !h.word).find(h => norm0(k.text).includes(norm0(h.after)))?.sec ?? 0;
    if (n && (n.start - k.end > MAX_GAP || hold)) brk.push({ end: k.end, next: n.start, keep: Math.min(n.start - k.end, TIGHT_GAP), hold });
  });
  for (const h of (HOLDS[id] ?? []).filter(h => h.word)) {
    const want = tok0(h.after), have = W.map(w => tok0(w.w).join(""));
    for (let i = 0; i + want.length < have.length; i++) if (want.every((x, j) => have[i + j] === x)) {
      const e = W[i + want.length - 1].end, nx = W[i + want.length].start;
      brk.push({ end: e, next: nx, keep: nx - e, hold: h.sec }); break;
    }
  }
  brk.sort((x, y) => x.end - y.end);
  const ps: Piece[] = [];
  let shift = 0, cut = 0;
  for (const k of brk) {
    ps.push({ from: cut, to: k.end + k.keep / 2, at: cut - shift });
    shift += k.next - k.end - k.keep - k.hold;
    cut = k.next - k.keep / 2;
  }
  ps.push({ from: cut, to: v.seconds, at: cut - shift });
  pieces[id] = ps;
  const map = (t: number) => { const p = ps.find(q => t >= q.from - 1e-6 && t < q.to + 1e-6) ?? ps[ps.length - 1]; return +(p.at + (t - p.from)).toFixed(3); };
  const words = v.words?.map(w => ({ w: w.w, start: map(w.start), end: map(w.end) }));
  return { ...v, seconds: +(v.seconds - shift).toFixed(3), sentences: S.map(k => ({ text: k.text, start: map(k.start), end: map(k.end) })), words };
};
const sv = standInVo();
const toks = (s: string) => s.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9äöå]+/).filter(Boolean);
const matches = (id: string, v: Vo) => {   // the delivered narration says the revision-2 text (allowing small differences)
  const want = toks(SCRIPT_R2[id] ?? ""), have = new Set(toks(v.sentences.map(s => s.text).join(" ")));
  return want.length > 0 && want.filter(w => have.has(w)).length / want.length >= 0.97 && Math.abs(toks(v.sentences.map(s => s.text).join(" ")).length - want.length) <= 1;
};
const realVo = Object.entries((a?.vo ?? {}) as Record<string, Vo>).filter(([k, v]) => matches(k, v));
export const oldNarration = Object.keys(SCRIPT_R2).filter(id => !realVo.some(([k]) => k === id));
if (oldNarration.length) standIns.push(`narration ${oldNarration.length}/20`);
export const audio: AudioData = {
  vo: { ...sv, ...Object.fromEntries(realVo.map(([k, v]) => [k, retime(k, v)])) },
  music: { bed: a?.music?.bed ?? { file: null, seconds: 600, bpm: 120, first_beat: 0, sections: [] } },
  sfx: a?.sfx ?? {},
};
export const footage: FootageData = f ?? standInFootage();
export const facts: FactsData = x ?? standInFacts();

/** Audio files are given relative to public/ ("v2/audio/vo-d1.m4a"). */
export const voOf = (id: string): Vo => {
  const v = audio.vo[id];
  if (!v) throw new Error(`audio.json: no narration for ${id}`);
  return v;
};
export const sfxFile = (name: string): Sfx | null => {
  const s = audio.sfx[name];
  if (s) return s;
  // fall back to the closest-named effect ("whoosh" → "whoosh-1" …)
  const k = Object.keys(audio.sfx).find(n => n.startsWith(name));
  return k ? audio.sfx[k] : null;
};
export const sfxNames = (prefix: string) => Object.keys(audio.sfx).filter(n => n.startsWith(prefix)).sort();

export const clip = (id: string): Clip => {
  if (id.startsWith("v1:")) {   // a version 1 recording in public/live, times from src/timeline.json
    const v = v1clip(id.slice(3));
    return { file: `live/${v.file}`, seconds: v.seconds, width: v.width, height: v.height, events: v.events, cut: v.cut };
  }
  const c = footage.clips[id];
  if (!c) throw new Error(`footage.json: no clip ${id}`);
  return c;
};
/** Source second of an event in a clip, or undefined. */
export const evOpt = (id: string, label: string) => clip(id).events?.find(e => e.label === label)?.t;
export const ev = (id: string, label: string) => {
  const t = evOpt(id, label);
  if (t === undefined) throw new Error(`footage.json: ${id} has no event ${label}`);
  return t;
};

/* ------------------------------------------------------------ narration timing (seconds inside the scene's file) */
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'");
/** The sentence containing `sub`. */
export const sentence = (id: string, sub: string): Sentence => {
  const v = voOf(id);
  const s = v.sentences.find(k => norm(k.text).includes(norm(sub)));
  if (!s) throw new Error(`${id}: no sentence with "${sub}"`);
  return s;
};
export const hasWord = (id: string, sub: string) => voOf(id).sentences.some(k => norm(k.text).includes(norm(sub)));
const tok = (s: string) => s.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9äöå-]+/).filter(Boolean);
/** The words of `sub` in the scene's word timings (audio.json `words`), or null. */
const findWords = (id: string, sub: string) => {
  const W = voOf(id).words; if (!W?.length) return null;
  const want = tok(sub), have = W.map(w => tok(w.w).join(""));
  for (let i = 0; i + want.length <= have.length; i++)
    if (want.every((x, j) => have[i + j] === x.replace(/-/g, "") || (j === want.length - 1 && have[i + j].startsWith(x.replace(/-/g, ""))) || have[i + j] === x)) return W.slice(i, i + want.length);
  return null;
};
/** The time `sub` is spoken: from the word timings, else its share of characters through its sentence. */
export const word = (id: string, sub: string): number => {
  const fw = findWords(id, sub); if (fw) return fw[0].start;
  const s = sentence(id, sub);
  const i = norm(s.text).indexOf(norm(sub));
  return s.start + (s.end - s.start) * (i / Math.max(1, s.text.length));
};
/** Estimated end of `sub`. */
export const wordEnd = (id: string, sub: string): number => {
  const fw = findWords(id, sub); if (fw) return fw[fw.length - 1].end;
  const s = sentence(id, sub);
  const i = norm(s.text).indexOf(norm(sub)) + sub.length;
  return s.start + (s.end - s.start) * (i / Math.max(1, s.text.length));
};

/* v1 recordings (public/live, src/timeline.json) */
export const v1clip = (file: string) => {
  const c = v1.clips.find(k => k.file === file);
  if (!c) throw new Error(`timeline.json: no clip ${file}`);
  return c;
};
export const v1ev2 = (file: string, label: string) => {
  const e = v1clip(file).events.find(k => k.label === label);
  if (!e) throw new Error(`timeline.json: ${file} has no event ${label}`);
  return e.t;
};
