import React from "react";
import { Composition } from "remotion";
import { deck, extras } from "./deck";
import "./theme";

// The 14 in presentation order first (render-all.mjs numbers them from that order), then the extras.
export const Root: React.FC = () => <>
  {[...deck, ...extras].map(slide => <Composition key={slide.id} id={slide.id} component={slide.component} durationInFrames={slide.seconds * 30} fps={30} width={1920} height={1080} />)}
</>;
