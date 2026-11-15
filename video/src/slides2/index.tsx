/* Entry point for slides v2 (video/SLIDES2.md): one composition per slide, in presentation order, plus a tiny
 * "slides2-manifest" composition whose props list every slide, its narration window and any cue words the narration
 * did not contain (scripts/render-slides2.mjs prints it). Rendered with scripts/render-slides2.mjs only. */
import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import "../theme";
import { FPS, Voice } from "./core";
import { STORY, STORY_VOICES } from "./story";
import { CRAVE, CRAVE_VOICES } from "./crave";
import { COACH, COACH_VOICES } from "./coach";

export const SLIDES2 = [...STORY, ...CRAVE, ...COACH];
const VOICES: Record<string, Voice> = { ...STORY_VOICES, ...CRAVE_VOICES, ...COACH_VOICES };

const manifest = () => ({
  slides: SLIDES2.map((s, i) => {
    const v = VOICES[`V${String(i + 1).padStart(2, "0")}`];
    return { n: i + 1, id: s.id, title: s.title, seconds: s.seconds, narration: v ? { real: v.real, start: +v.start.toFixed(2), end: +v.end.toFixed(2), missingCues: v.missing } : null };
  }),
});

type M = { manifest: ReturnType<typeof manifest> };
const Empty: React.FC<M> = () => <AbsoluteFill />;
const Root2: React.FC = () => <>
  {SLIDES2.map(s => <Composition key={s.id} id={s.id} component={s.component} durationInFrames={Math.round(s.seconds * FPS)} fps={FPS} width={1920} height={1080} />)}
  <Composition id="slides2-manifest" component={Empty} durationInFrames={1} fps={FPS} width={16} height={16} defaultProps={{ manifest: manifest() }} />
</>;
registerRoot(Root2);
