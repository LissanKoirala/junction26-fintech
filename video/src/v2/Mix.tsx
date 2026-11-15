/* Version 2 mix: narration, the music bed with its volume automation, the riser into the silent beat, the impact
 * when the music comes back, and the final hit. Scene effects (whooshes, pops, ticks) and the app's own sounds are
 * placed by the scenes themselves. Levels are in dB relative to each file's own loudness (measured, see MEASURED);
 * the finished file is normalised to -16 LUFS afterwards (scripts/finish-v2.sh). */
import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { audio, pieces, sfxFile, voOf, wordEnd } from "./data";
import { f, FPS, Plan } from "./timeline";
import { STEM } from "./kit";

/** Integrated loudness of the delivered files (LUFS), measured with ffmpeg ebur128 on the VM. */
export const MEASURED = { vo: -16, bed: audio.music.bed.lufs ?? -16, riser: -19.9, impact: -12.4 };
/** Targets, in LUFS before the final normalisation. Voice -16; music 20 dB under it while a line is spoken. */
export const LEVEL = { vo: -16, musicUp: -22, musicDuck: -35, musicBetween: -30, montageDuck: -31, riser: -26, impact: -18, hit: -16 };
const gain = (target: number, measured: number) => Math.min(1, 10 ** ((target - measured) / 20));

/** returnAt: the music comes back (with the impact) on this video second, from section `back`'s downbeat.
 *  liftAt: section `lift`'s downbeat lands on this video second (the shop finishing its build); the bed starts on a bar
 *  line before it, so the music enters on a downbeat within the first two seconds. */
export type MusicCue = { returnAt: number; montage: [number, number][]; liftAt: number; lift: string; back: string;
  /** after the chime: the music plays again from `section` between `from` and `to` (a hard stop), before `returnAt` */
  mid?: { from: number; to: number; section: string } };

/** Ducking weight 0…1 at video second t: 1 while a line is spoken, easing out in the gaps. */
function duckWeight(spans: [number, number][], t: number) {
  const ATT = 0.15, REL = 0.4;
  let w = 0;
  for (const [a, b] of spans) {
    if (t >= a && t <= b) return 1;
    if (t < a && a - t < ATT) w = Math.max(w, 1 - (a - t) / ATT);
    if (t > b && t - b < REL) w = Math.max(w, 1 - (t - b) / REL);
  }
  return w;
}

export const Mix: React.FC<{ plan: Plan; cue: MusicCue }> = ({ plan, cue }) => {
  const spans: [number, number][] = [];
  for (const s of plan.scenes) for (const k of voOf(s.id).sentences) spans.push([s.vo + k.start, s.vo + k.end]);
  const beat = plan.beats[0];
  const last = plan.scenes[plan.scenes.length - 1];
  const hitAt = last.vo + wordEnd(last.id, "a time") + 0.05;
  const bed = audio.music.bed;
  const inMontage = (t: number) => cue.montage.some(([a, b]) => t >= a && t < b);
  // music level in dB at video second t
  const musicDb = (t: number) => {
    const w = duckWeight(spans, t);
    const duck = inMontage(t) ? LEVEL.montageDuck : LEVEL.musicDuck;
    const up = spans.some(([a], i) => i > 0 && t > spans[i - 1][1] && t < a && a - spans[i - 1][1] < 1) ? LEVEL.musicBetween : LEVEL.musicUp;
    return up + (duck - up) * w;
  };
  const vol = (t0: number) => (fr: number) => {
    const t = t0 + fr / FPS;
    let g = 10 ** ((musicDb(t) - MEASURED.bed) / 20);
    if (beat && t > beat.musicStop - 0.04 && t < cue.returnAt) g = 0;  // dead stop
    if (t > hitAt) g *= Math.max(0, 1 - (t - hitAt) / 0.12);     // ends on the hit
    return Math.min(1, g);
  };
  // the bed: entering on a bar line so that `lift` lands on liftAt, stopping dead at the beat, back from `back` on the impact
  const sec = (name: string) => bed.sections.find(s => s.name === name);
  const bar = bed.bar_seconds ?? 240 / (bed.bpm || 120);
  const L = sec(cue.lift)?.start ?? bed.first_beat;
  const nBars = Math.max(0, Math.min(Math.floor(cue.liftAt / bar), Math.floor((L - bed.first_beat) / bar + 1e-6)));
  const aVideo = cue.liftAt - nBars * bar, aBed = L - nBars * bar;
  const aEnd = beat ? beat.musicStop : hitAt + 0.2;
  const bFrom = sec(cue.back)?.start ?? aBed + (aEnd - aVideo);
  const riser = sfxFile("riser"), impact = sfxFile("impact") ?? sfxFile("hit");
  const want = (k: "vo" | "music" | "fx") => !STEM || STEM === k || (k === "fx" && STEM === "sfx");
  return <>
    {want("vo") && plan.scenes.map(s => {
      const v = voOf(s.id);
      return v.file ? (pieces[s.id] ?? [{ from: 0, to: v.seconds, at: 0 }]).map((p, i) =>
        <Sequence key={`${s.id}-${i}`} from={f(s.vo + p.at)} durationInFrames={Math.max(1, f(p.to - p.from))} layout="none">
          <Audio src={staticFile(v.file!)} startFrom={f(p.from)} volume={gain(LEVEL.vo, MEASURED.vo)} /></Sequence>) : null;
    })}
    {bed.file && want("music") ? <>
      <Sequence from={f(aVideo)} durationInFrames={f(aEnd - aVideo)} layout="none"><Audio src={staticFile(bed.file)} startFrom={f(aBed)} volume={vol(aVideo)} /></Sequence>
      {beat ? <Sequence from={f(cue.returnAt)} durationInFrames={f(hitAt + 0.2 - cue.returnAt)} layout="none">
        <Audio src={staticFile(bed.file)} startFrom={f(bFrom)} volume={vol(cue.returnAt)} /></Sequence> : null}
    </> : null}
    {bed.file && want("music") && cue.mid && cue.mid.to > cue.mid.from ? <Sequence from={f(cue.mid.from)} durationInFrames={f(cue.mid.to - cue.mid.from)} layout="none">
      <Audio src={staticFile(bed.file)} startFrom={f(sec(cue.mid.section)?.start ?? bFrom)} volume={(fr: number) => {
        const t = cue.mid!.from + fr / FPS, w = duckWeight(spans, t);
        const fadeIn = Math.min(1, (t - cue.mid!.from) / 0.5);
        return Math.min(1, fadeIn * 10 ** ((LEVEL.musicUp + (LEVEL.musicDuck - LEVEL.musicUp) * w - MEASURED.bed) / 20));
      }} /></Sequence> : null}
    {riser && beat && want("fx") ? <Sequence from={f(beat.musicStop - riser.seconds)} durationInFrames={f(riser.seconds)} layout="none">
      <Audio src={staticFile(riser.file)} volume={gain(LEVEL.riser, MEASURED.riser)} /></Sequence> : null}
    {impact && beat && want("fx") ? <Sequence from={f(cue.returnAt)} layout="none"><Audio src={staticFile(impact.file)} volume={gain(LEVEL.impact, MEASURED.impact)} /></Sequence> : null}
    {impact && want("fx") ? <Sequence from={f(hitAt)} layout="none"><Audio src={staticFile(impact.file)} volume={gain(LEVEL.hit, MEASURED.impact)} /></Sequence> : null}
  </>;
};
