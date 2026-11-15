/* Preview entry for checking the ML visuals on their own (not used by the videos): each visual over the deck's background. */
import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { C } from "../../theme";
import { VISUALS } from "./index";

const Bg: React.FC<{ C2: React.FC }> = ({ C2 }) => <AbsoluteFill style={{ background: C.deeper }}>
  <AbsoluteFill style={{ background: "radial-gradient(1100px 800px at 50% 45%, rgba(0,120,65,.55), rgba(0,50,29,0) 70%)" }} />
  <C2 />
</AbsoluteFill>;

const Previews: React.FC = () => <>
  {VISUALS.map(v => <Composition key={v.id} id={`ml-${v.id}`} component={() => <Bg C2={v.component} />} durationInFrames={Math.round(v.seconds * 30)} fps={30} width={1920} height={1080} />)}
  {VISUALS.map(v => <Composition key={v.id + "-short"} id={`ml-${v.id}-short`} component={() => <Bg C2={v.component} />} durationInFrames={Math.round(v.minSeconds * 30)} fps={30} width={1920} height={1080} />)}
</>;
registerRoot(Previews);
