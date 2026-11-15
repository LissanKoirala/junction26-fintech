/* 2. Look-alikes and two futures: from the map, lines to Aino's 100 money twins (coloured by what happened to them
 * next), then a hand-over to the two diverging balance paths the Two Futures model shows her. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { AinoMark, Cam, Cloud } from "./Cloud";
import { mapCam } from "./MoneyMap3D";
import { BUILT, DATA, GRID, INK, INK2, SLIPPED, StatusTag, Title, clamp, ease, easeInOut, eur, ramp, sans, useProgress } from "./common";

// chart geometry
const OX = 330, X1 = 1450, TOP = 300, BOT = 900;
const VMAX = 4800, VMIN = -1600;
const yOf = (v: number) => TOP + (VMAX - v) / (VMAX - VMIN) * (BOT - TOP);
const xOf = (m: number) => OX + (m / 12) * (X1 - OX);
const Y0 = yOf(0);

export const TwoFutures: React.FC = () => {
  const { p, t } = useProgress();
  const base = mapCam(1);
  const hand = easeInOut(ramp(p, 0.4, 0.54));
  const cam: Cam = { ...base, cx: 960 + (OX - 960) * hand, cy: 570 + (Y0 - 570) * hand, zoom: base.zoom * (1 + 0.6 * hand) };
  const cloudOp = 1 - ramp(p, 0.42, 0.56);
  const lines = ease(ramp(p, 0.06, 0.4));
  const twinFocus = ease(ramp(p, 0.02, 0.16));
  const chartK = ramp(p, 0.5, 0.58);
  const draw = easeInOut(ramp(p, 0.54, 0.84));
  const endK = ease(ramp(p, 0.8, 0.9));
  const t1 = ramp(p, 0.04, 0.12) * (1 - ramp(p, 0.42, 0.48));
  const t2 = ramp(p, 0.52, 0.6);
  const { built, slipped } = DATA.futures;
  return <AbsoluteFill style={{ fontFamily: sans }}>
    {cloudOp > 0 ? <Cloud cam={cam} look={{ appear: 1, focus: 1, twinFocus, lines, opacity: cloudOp }} /> : null}
    {cloudOp > 0 ? <AinoMark cam={cam} k={1} t={t} /> : null}
    <Title k={t1} out={t1 > 0 ? 1 : 0} sub="a year ago, they spent like her">{DATA.nTwins} look-alikes</Title>
    <Title k={t2} sub="what happened to her look-alikes next">Two futures, a year ahead</Title>
    {chartK > 0 ? <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity: chartK }}>
      <line x1={OX} y1={Y0} x2={X1} y2={Y0} stroke="rgba(255,255,255,.35)" strokeWidth={2} strokeDasharray="6 8" />
      {[-1000, 2000, 4000].map(v => <line key={v} x1={OX} y1={yOf(v)} x2={X1} y2={yOf(v)} stroke={GRID} strokeWidth={1} />)}
      <Path pts={built.p50} k={draw} color={BUILT} />
      <Path pts={slipped.p50} k={draw} color={SLIPPED} />
      <circle cx={OX} cy={Y0} r={11} fill="#fff" stroke="#91fa9b" strokeWidth={3} />
    </svg> : null}
    {chartK > 0 ? <>
      {[-1000, 0, 2000, 4000].map(v => <div key={v} style={{ position: "absolute", left: OX - 170, width: 150, textAlign: "right", top: yOf(v) - 16, fontSize: 26, fontWeight: 600, color: INK2, opacity: chartK }}>{eur(v, true)}</div>)}
      <div style={{ position: "absolute", left: OX - 40, top: BOT + 30, fontSize: 28, fontWeight: 600, color: INK2, opacity: chartK }}>now</div>
      <div style={{ position: "absolute", left: X1 - 160, width: 200, textAlign: "right", top: BOT + 30, fontSize: 28, fontWeight: 600, color: INK2, opacity: chartK }}>12 months</div>
      <EndLabel x={xOf(12)} y={yOf(built.change)} k={endK} name={built.label} value={eur(built.change, true)} />
      <EndLabel x={xOf(12)} y={yOf(slipped.change)} k={endK} name={slipped.label} value={eur(slipped.change, true)} />
    </> : null}
    <StatusTag status="experimental" name="Two Futures" opacity={ramp(p, 0.02, 0.1)} />
  </AbsoluteFill>;
};

const Path: React.FC<{ pts: number[]; k: number; color: string }> = ({ pts, k, color }) => {
  if (k <= 0) return null;
  const n = pts.length - 1, upto = k * n, full = Math.floor(upto);
  const xy: [number, number][] = [];
  for (let m = 0; m <= Math.min(full, n); m++) xy.push([xOf(m), yOf(pts[m])]);
  if (full < n) { const f = upto - full; xy.push([xOf(full + f), yOf(pts[full] + (pts[full + 1] - pts[full]) * f)]); }
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const [hx, hy] = xy[xy.length - 1];
  return <>
    <path d={d} fill="none" stroke={color} strokeWidth={14} strokeOpacity={0.12} strokeLinejoin="round" strokeLinecap="round" />
    <path d={d} fill="none" stroke={color} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={hx} cy={hy} r={9} fill={color} />
  </>;
};

const EndLabel: React.FC<{ x: number; y: number; k: number; name: string; value: string }> = ({ x, y, k, name, value }) =>
  k > 0 ? <div style={{ position: "absolute", left: x + 34, top: y - 52, opacity: clamp(k * 1.5), transform: `translateX(${(1 - k) * -20}px)`, whiteSpace: "nowrap" }}>
    <div style={{ fontSize: 30, fontWeight: 600, color: INK2 }}>{name}</div>
    <div style={{ fontSize: 56, fontWeight: 800, color: INK, letterSpacing: -1.5, lineHeight: 1.05 }}>{value}</div>
  </div> : null;
