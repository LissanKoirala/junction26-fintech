/* The slots for VIZ's animated model visuals (video/src/v2/ml/, VIZ's files: never edited here). Until VIZ delivers,
 * each slot draws a clearly marked placeholder; once `ml/index.ts` exists, the slot plays VIZ's component inside a
 * Sequence of the slot's length (each component scales its animation to that length). */
import React from "react";
import { Sequence } from "remotion";
import { C, useT } from "./acts";
import { f } from "./timeline";

type Ctx = { keys(): string[]; (k: string): unknown };
const ctx = require.context("./", true, /^\.\/ml\/index\.tsx?$/) as Ctx;
const ml: Record<string, unknown> = (() => { const k = ctx.keys()[0]; return k ? (ctx(k) as Record<string, unknown>) : {}; })();
export const mlReady = Object.keys(ml).length > 0;

export type MlKind = "map" | "futures" | "forecast" | "risk" | "peers" | "scorecard";
type Visual = { id: string; component: React.FC; caption: string; model: string; status: string; minSeconds: number };
const VISUALS = (ml.VISUALS ?? []) as Visual[];
export const mlVisual = (kind: MlKind) => VISUALS.find(v => v.id === kind) ?? null;
export const mlComponent = (kind: MlKind) => mlVisual(kind)?.component ?? null;
/** VIZ's visual for `kind`, full frame, its animation scaled to [from, to). VIZ draws the model name and status tag;
 *  the slot adds only the one-line caption at the foot of the frame. */
export const MlSlot: React.FC<{ kind: MlKind; from: number; to: number; caption?: boolean; skip?: number }> = ({ kind, from, to, caption = true, skip = 0 }) => {
  const v = mlVisual(kind);
  const t = useT();
  if (t < from || t >= to) return null;
  if (v) {
    const Comp = v.component, k = Math.min(1, (t - from) / 0.4, (to - t) / 0.25);
    return <>
      {/* `skip`: the visual's own timeline starts that far before the slot, so its empty fade-in is not shown */}
      <Sequence from={f(from - skip)} durationInFrames={Math.max(1, f(to - from + skip))} layout="none"><Comp /></Sequence>
      {caption ? <div style={{ position: "absolute", left: 0, right: 0, top: 902, textAlign: "center", fontSize: 34, fontWeight: 650, color: "#fff",
        opacity: Math.max(0, k), textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>{v.caption}</div> : null}
    </>;
  }
  return <div style={{ position: "absolute", left: 160, top: 120, right: 160, bottom: 200, border: `4px dashed ${C.mint}`, borderRadius: 40,
    display: "grid", placeItems: "center", color: C.mint, fontSize: 60, fontWeight: 800, textAlign: "center" }}>
    <div>ML VISUAL · {kind.toUpperCase()}<div style={{ fontSize: 34, color: "#fff", marginTop: 16 }}>placeholder until VIZ delivers (video/src/v2/ml/)</div></div>
  </div>;
};
