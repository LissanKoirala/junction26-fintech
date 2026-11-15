/* 1. The Money Map in 3D: every main-cohort customer placed by spending behaviour, coloured by spender tribe,
 * rising from the app's flat map into a third axis (their savings rate), then Aino found and her tribe lit. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { AinoMark, Cam, Cloud, heightOf, makeProjector, world, zOfRate } from "./Cloud";
import { DATA, INK, INK2, StatusTag, Title, TRIBE_COLORS, clamp, ease, easeInOut, num, ramp, sans, useProgress } from "./common";

/** Camera at progress p (shared with TwoFutures so a cut between them matches). */
export function mapCam(p: number): Cam {
  const lift = easeInOut(ramp(p, 0.06, 0.4));
  const zoomK = easeInOut(ramp(p, 0.5, 0.82));
  const a = world(DATA.aino.index, lift);
  return {
    az: -Math.PI / 2 - 0.55 + 1.0 * easeInOut(p),
    el: 1.1 - 0.65 * easeInOut(ramp(p, 0.04, 0.45)),
    zoom: 1.25 + 0.9 * zoomK,
    target: [a[0] * zoomK * 0.8, a[1] * zoomK * 0.8, a[2] * zoomK * 0.8],
    cy: 570 + 110 * (1 - lift),
    lift,
  };
}
export const MAP_END = mapCam(1);

export const MoneyMap3D: React.FC = () => {
  const { p, t } = useProgress();
  const cam = mapCam(p);
  const focus = ease(ramp(p, 0.56, 0.7));
  const ainoK = ease(ramp(p, 0.5, 0.58));
  const labelK = ease(ramp(p, 0.62, 0.72));
  const axisK = ease(ramp(p, 0.3, 0.42)) * (1 - ramp(p, 0.55, 0.62));
  const titleK = ramp(p, 0.02, 0.12);
  const titleOut = 1 - ramp(p, 0.52, 0.58);
  const tribe = DATA.tribes[DATA.aino.tribe];
  return <AbsoluteFill style={{ fontFamily: sans }}>
    <Cloud cam={cam} look={{ appear: ease(ramp(p, 0, 0.2)), focus }} />
    <Axis cam={cam} k={axisK} />
    <AinoMark cam={cam} k={ainoK} t={t} labelK={labelK} label={<>
      <div style={{ fontSize: 58, fontWeight: 800, color: INK, letterSpacing: -1.5 }}>Aino</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 38, fontWeight: 700, color: INK, marginTop: 4, whiteSpace: "nowrap" }}>
        <span style={{ width: 20, height: 20, borderRadius: 20, background: TRIBE_COLORS[DATA.aino.tribe], display: "inline-block" }} />
        {tribe.name}
      </div>
    </>} />
    <Title k={titleK} out={titleOut} sub="placed by spending · 5 spending tribes">{num(DATA.n)} customers</Title>
    <div style={{ position: "absolute", left: 96, top: 92, opacity: clamp(ramp(p, 0.66, 0.74) * 1.5), fontFamily: sans }}>
      <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, color: INK }}>Where Aino stands</div>
    </div>
    <StatusTag status="experimental" name="Money Map" opacity={ramp(p, 0.04, 0.14)} />
  </AbsoluteFill>;
};

/** The height axis: savings rate, with ticks at 0 % and 40 %. */
const Axis: React.FC<{ cam: Cam; k: number }> = ({ cam, k }) => {
  if (k <= 0) return null;
  const P = makeProjector(cam);
  const X = 0.45, Z = -1.1;
  const lo = P(X, heightOf(0, cam.lift), Z), hi = P(X, heightOf(1, cam.lift), Z);
  const ticks = [0, 40].map(v => ({ v, q: P(X, heightOf(zOfRate(v), cam.lift), Z) }));
  return <>
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity: k }}>
      <line x1={lo.sx} y1={lo.sy} x2={hi.sx} y2={hi.sy} stroke="rgba(255,255,255,.45)" strokeWidth={2} />
      {ticks.map(({ v, q }) => <line key={v} x1={q.sx - 8} y1={q.sy} x2={q.sx + 8} y2={q.sy} stroke="rgba(255,255,255,.55)" strokeWidth={2} />)}
    </svg>
    {ticks.map(({ v, q }) => <div key={v} style={{ position: "absolute", left: q.sx - 120, top: q.sy - 17, width: 100, textAlign: "right", fontSize: 26, fontWeight: 600, color: INK2, opacity: k }}>{v}&nbsp;%</div>)}
    <div style={{ position: "absolute", left: hi.sx - 140, top: hi.sy - 62, fontSize: 28, fontWeight: 700, color: INK, opacity: k, whiteSpace: "nowrap" }}>↑ savings rate</div>
  </>;
};
