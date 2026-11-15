import React from "react";
import { Composition } from "remotion";
import { deck } from "./deck";
import "./theme";

export const Root: React.FC = () => <>
  {deck.map(slide => <Composition key={slide.id} id={slide.id} component={slide.component} durationInFrames={slide.seconds * 30} fps={30} width={1920} height={1080} />)}
</>;
