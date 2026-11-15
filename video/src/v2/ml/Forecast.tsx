/* 3. The Crystal ball: Aino's balance running forward to payday, the range fanning out (8 in 10 simulated runs),
 * rent and payday marked, the day before payday labelled. Same days and series as the app's ForecastChart. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, DATA, GRID, INK, INK2, StatusTag, Title, clamp, ease, easeInOut, eur, ramp, sans, useProgress } from "./common";

const F = DATA.forecast;
const ND = F.p50.length - 1;          // last day shown (payday + 1, as in the app)
const X0 = 300, X1 = 1500, TOP = 300, BOT = 880;
const VMAX = 2400, VMIN = -500;
const xOf = (d: number) => X0 + (d / ND) * (X1 - X0);
const yOf = (v: number) => TOP + (VMAX - v) / (VMAX - VMIN) * (BOT - TOP);
const LAST = F.paydayDay - 1;         // the day before payday: the low point the app talks about
const DAY = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`; };
const BAND = "rgba(145,250,155,.20)";

const series = (a: number[], upto: number) => {
  const full = Math.floor(upto), out: [number, number][] = [];
  for (let d = 0; d <= Math.min(full, ND); d++) out.push([xOf(d), yOf(a[d])]);
  if (full < ND) { const f = upto - full; out.push([xOf(full + f), yOf(a[full] + (a[full + 1] - a[full]) * f)]); }
  return out;
};
const line = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

export const Forecast: React.FC = () => {
  const { p } = useProgress();
  const axK = ramp(p, 0.02, 0.12);
  const draw = easeInOut(ramp(p, 0.1, 0.72)) * ND;
  const rentK = ease(ramp(p, 0.26, 0.34));
  const payK = ease(ramp(p, 0.62, 0.7));
  const endK = ease(ramp(p, 0.72, 0.84));
  const hi = series(F.p90, draw), lo = series(F.p10, draw), mid = series(F.p50, draw);
  const band = line(hi) + lo.slice().reverse().map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join("") + "Z";
  const [hx, hy] = mid[mid.length - 1];
  const lx = xOf(LAST);
  return <AbsoluteFill style={{ fontFamily: sans }}>
    <Title k={ramp(p, 0.02, 0.1)} sub="middle line · 8 in 10 runs inside the band">Balance to payday</Title>
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
      <g opacity={axK}>
        {[1000, 2000].map(v => <line key={v} x1={X0} y1={yOf(v)} x2={X1} y2={yOf(v)} stroke={GRID} strokeWidth={1} />)}
        <line x1={X0} y1={yOf(0)} x2={X1} y2={yOf(0)} stroke="rgba(255,255,255,.4)" strokeWidth={2} strokeDasharray="6 8" />
      </g>
      <path d={band} fill={BAND} />
      <path d={line(mid)} fill="none" stroke={C.mint} strokeWidth={14} strokeOpacity={0.12} strokeLinejoin="round" />
      <path d={line(mid)} fill="none" stroke={C.mint} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />
      {draw < ND ? <circle cx={hx} cy={hy} r={9} fill={C.mint} opacity={axK} /> : null}
      {payK > 0 ? <line x1={xOf(F.paydayDay)} y1={TOP - 20} x2={xOf(F.paydayDay)} y2={BOT} stroke="rgba(255,255,255,.55)" strokeWidth={2} strokeDasharray="4 6" opacity={payK} /> : null}
      {endK > 0 ? <g opacity={endK}>
        <line x1={lx} y1={yOf(F.p10[LAST])} x2={lx} y2={yOf(F.p90[LAST])} stroke="#fff" strokeWidth={2.5} />
        <line x1={lx - 10} y1={yOf(F.p10[LAST])} x2={lx + 10} y2={yOf(F.p10[LAST])} stroke="#fff" strokeWidth={2.5} />
        <line x1={lx - 10} y1={yOf(F.p90[LAST])} x2={lx + 10} y2={yOf(F.p90[LAST])} stroke="#fff" strokeWidth={2.5} />
        <line x1={lx + 16} y1={yOf(F.p50[LAST])} x2={X1 + 26} y2={yOf(F.p50[LAST])} stroke="rgba(255,255,255,.6)" strokeWidth={2} />
        <circle cx={lx} cy={yOf(F.p50[LAST])} r={11} fill={C.mint} stroke="#fff" strokeWidth={3} />
      </g> : null}
    </svg>
    {[0, 1000, 2000].map(v => <div key={v} style={{ position: "absolute", left: X0 - 170, width: 150, textAlign: "right", top: yOf(v) - 16, fontSize: 26, fontWeight: 600, color: INK2, opacity: axK }}>{eur(v)}</div>)}
    <div style={{ position: "absolute", left: X0 - 60, width: 120, textAlign: "center", top: BOT + 26, fontSize: 28, fontWeight: 600, color: INK2, opacity: axK }}>today</div>
    <Lbl x={xOf(DATA.forecast.rent.day) + 18} y={yOf(F.p90[DATA.forecast.rent.day]) - 92} k={rentK} small="Rent" big={eur(DATA.forecast.rent.amount)} />
    <Lbl x={xOf(F.paydayDay) + 18} y={TOP - 30} k={payK} small="Payday" big={DAY(F.payday)} />
    {endK > 0 ? <div style={{ position: "absolute", left: X1 + 40, top: yOf(F.p50[LAST]) - 34, opacity: clamp(endK * 1.5), whiteSpace: "nowrap" }}>
      <div style={{ fontSize: 64, fontWeight: 800, color: INK, letterSpacing: -2, lineHeight: 1 }}>{eur(F.p50[LAST])}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: INK2, marginTop: 8 }}>8 in 10:</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: INK2 }}>{eur(F.p10[LAST])} to {eur(F.p90[LAST])}</div>
    </div> : null}
    <StatusTag status="ships" name="Crystal ball" opacity={ramp(p, 0.02, 0.1)} />
  </AbsoluteFill>;
};

const Lbl: React.FC<{ x: number; y: number; k: number; small: string; big: string }> = ({ x, y, k, small, big }) =>
  k > 0 ? <div style={{ position: "absolute", left: x, top: y, opacity: clamp(k * 1.5), transform: `translateY(${(1 - k) * 12}px)`, whiteSpace: "nowrap" }}>
    <div style={{ fontSize: 26, fontWeight: 600, color: INK2 }}>{small}</div>
    <div style={{ fontSize: 36, fontWeight: 800, color: INK }}>{big}</div>
  </div> : null;
