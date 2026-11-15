/* Version 2: where every scene sits in its video. All times are derived from audio.json:
 * a scene starts GAP/2 before its narration and ends GAP/2 after it, so consecutive lines are GAP apart.
 * The pay scene (d4, p6) is followed by the silent beat: its narration ends, the music stops dead, the take plays
 * at real speed through the double-click and the scan, the app's chime plays on the tick, and the next line starts
 * POST_CHIME after the chime has ended. The last scene keeps a short tail for the final hit and the address. */
import { audio, voOf } from "./data";

export const FPS = 30;
export const f = (sec: number) => Math.round(sec * FPS);
export const GAP = 0.2;          // between the end of one line and the start of the next
export const PRE_CHIME = 1.6;    // silence between the end of "Double-click…" and the chime (>= 1.5 s)
export const POST_CHIME = 1.55;  // silence between the end of the chime and the next line (>= 1.5 s)
export const CHIME_LEN = 0.75;   // public/audio/chime.wav (src/timeline.json sounds)
export const END_TAIL = 2.6;     // after the motto: the hit rings out under the address
export const LEAD = 0.15;        // the first line starts this far into the video

export type SceneDef = { id: string; beat?: boolean; tail?: number };  // tail: music-only seconds after the line (montages)
export type Placed = {
  id: string;
  start: number;      // first frame of the scene, in video seconds
  end: number;        // the scene's end (= next scene's start)
  vo: number;         // video second at which this scene's narration starts
  voEnd: number;
  tick?: number;      // the pay scenes: video second of the tick and its chime
};
export type Plan = { scenes: Placed[]; seconds: number; frames: number; beats: { musicStop: number; tick: number; voBack: number }[] };

export function place(defs: SceneDef[]): Plan {
  const scenes: Placed[] = [];
  let vo = LEAD;
  defs.forEach((d, k) => {
    const v = voOf(d.id);
    // the line's last spoken word, not the file's end (files keep up to 60 ms of trailing silence)
    const voEnd = vo + (v.sentences.length ? v.sentences[v.sentences.length - 1].end : v.seconds);
    const start = k === 0 ? 0 : scenes[k - 1].end;
    let next: number, tick: number | undefined;
    if (d.beat) { tick = voEnd + PRE_CHIME; next = tick + CHIME_LEN + POST_CHIME; }
    else next = voEnd + GAP + (d.tail ?? 0);
    const last = k === defs.length - 1;
    const end = last ? voEnd + END_TAIL : next - GAP / 2;
    scenes.push({ id: d.id, start, end, vo, voEnd, tick });
    const nv = defs[k + 1] ? voOf(defs[k + 1].id) : null;
    vo = next - (nv?.sentences[0]?.start ?? 0);   // the next line's first word, not its file's start, lands GAP later
  });
  const seconds = scenes[scenes.length - 1].end;
  const beats = scenes.filter(s => s.tick !== undefined).map((s, k) => {
    const n = scenes[scenes.indexOf(s) + 1];
    return { musicStop: s.voEnd, tick: s.tick!, voBack: n.vo };
  });
  return { scenes, seconds, frames: f(seconds), beats };
}

export const DEMO: SceneDef[] = [
  { id: "d1" }, { id: "d2" }, { id: "d3", tail: 1.2 }, { id: "d4", beat: true }, { id: "d5" }, { id: "d6" }, { id: "d7", tail: 1.4 }, { id: "d8" },
];
export const PITCH: SceneDef[] = [
  { id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }, { id: "p5", tail: 1.2 }, { id: "p6", beat: true }, { id: "p7" },
  { id: "p8" }, { id: "p9" }, { id: "p10" }, { id: "p11" }, { id: "p12" },
];
export const demoPlan = place(DEMO);
export const pitchPlan = place(PITCH);

/** Music beat grid (seconds into the bed). */
export const beatLen = () => 60 / (audio.music.bed.bpm || 120);

/** The plan as plain data (passed to the compositions as props, written out by scripts/render-v2.mjs --plan for checks). */
export const planInfo = (p: Plan) => ({
  seconds: +p.seconds.toFixed(3),
  scenes: p.scenes.map(s => ({ id: s.id, start: +s.start.toFixed(3), length: +(s.end - s.start).toFixed(3), vo: +s.vo.toFixed(3), voEnd: +s.voEnd.toFixed(3), tick: s.tick })),
  sentences: p.scenes.flatMap(s => voOf(s.id).sentences.map(k => ({ id: s.id, text: k.text, start: +(s.vo + k.start).toFixed(3), end: +(s.vo + k.end).toFixed(3) }))),
  beats: p.beats,
});
