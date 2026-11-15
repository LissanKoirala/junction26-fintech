/* 5. Aino against her peers: three of the app's peer benchmarks, her value against the median of customers aged 18-24. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, DATA, INK, INK2, Title, clamp, ease, easeInOut, num, ramp, sans, useProgress } from "./common";

const ROWS = ["housing_share", "savings_rate", "small_n_m"].map(k => DATA.peers.find(r => r.key === k)!);
const NAMES: Record<string, string> = { housing_share: "Rent share of income", savings_rate: "Savings rate", small_n_m: "Buys under 10 € a month" };
const fmt = (r: typeof ROWS[number], v: number) => r.unit === "%" ? `${num(v)} %` : num(v, 1);
const T0 = 820, T1 = 1640;

export const Peers: React.FC = () => {
  const { p } = useProgress();
  const n = ROWS[0].n;
  return <AbsoluteFill style={{ fontFamily: sans }}>
    <Title k={ramp(p, 0.02, 0.12)} sub={`typical = median of ${n} customers aged ${DATA.aino.ageBand.replace("-", "–")}`}>Aino vs. people her age</Title>
    {ROWS.map((r, i) => {
      const k = ease(ramp(p, 0.1 + i * 0.14, 0.24 + i * 0.14));
      const slide = easeInOut(ramp(p, 0.2 + i * 0.14, 0.42 + i * 0.14));
      const max = Math.max(r.you, r.peers) * 1.25;
      const x = (v: number) => T0 + (Math.max(0, v) / max) * (T1 - T0);
      const y = 400 + i * 190;
      const cur = r.peers + (r.you - r.peers) * slide;
      return <div key={r.key} style={{ position: "absolute", left: 0, top: 0, opacity: clamp(k * 1.5) }}>
        <div style={{ position: "absolute", left: 140, top: y - 24, width: 620, fontSize: 40, fontWeight: 700, color: INK }}>{NAMES[r.key]}</div>
        <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
          <line x1={T0} y1={y} x2={T1} y2={y} stroke="rgba(255,255,255,.18)" strokeWidth={3} strokeLinecap="round" />
          <line x1={x(r.peers)} y1={y - 22} x2={x(r.peers)} y2={y + 22} stroke="rgba(255,255,255,.7)" strokeWidth={4} strokeLinecap="round" />
          <line x1={x(Math.min(r.peers, cur))} y1={y} x2={x(Math.max(r.peers, cur))} y2={y} stroke={C.mint} strokeWidth={5} strokeOpacity={0.6} />
          <circle cx={x(cur)} cy={y} r={16} fill={C.mint} stroke="#fff" strokeWidth={3} />
        </svg>
        <div style={{ position: "absolute", left: x(r.peers) - 100, width: 200, textAlign: "center", top: y + 30, fontSize: 26, fontWeight: 600, color: INK2 }}>typical {fmt(r, r.peers)}</div>
        <div style={{ position: "absolute", left: x(cur) - 120, width: 240, textAlign: "center", top: y - 78, fontSize: 38, fontWeight: 800, color: INK, opacity: slide }}>Aino {fmt(r, r.you)}</div>
      </div>;
    })}
  </AbsoluteFill>;
};
