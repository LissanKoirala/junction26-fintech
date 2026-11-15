import React from "react";
import { Composition } from "remotion";
import { deck, extras } from "./deck";
import "./theme";
import { DemoV2, DEMO_FRAMES } from "./v2/Demo";
import { PitchV2, PITCH_FRAMES } from "./v2/Pitch";
import { demoPlan, pitchPlan, planInfo } from "./v2/timeline";

// The 14 in presentation order first (render-all.mjs numbers them from that order), then the extras.
export const Root: React.FC = () => <>
  {[...deck, ...extras].map(slide => <Composition key={slide.id} id={slide.id} component={slide.component} durationInFrames={slide.seconds * 30} fps={30} width={1920} height={1080} />)}
  {/* version 2: one continuous composition per video (src/v2, video/V2.md) */}
  <Composition id="demo-v2" component={DemoV2} defaultProps={{ plan: planInfo(demoPlan) }} durationInFrames={DEMO_FRAMES} fps={30} width={1920} height={1080} />
  <Composition id="pitch-v2" component={PitchV2} defaultProps={{ plan: planInfo(pitchPlan) }} durationInFrames={PITCH_FRAMES} fps={30} width={1920} height={1080} />
</>;
