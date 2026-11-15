/* 6. The honest scorecard: eight models, each tested against the strongest simple baseline. Two ship (filled),
 * six are labelled experimental (outlined). Verdicts from the model cards. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, DATA, INK, INK2, Title, clamp, ease, ramp, sans, useProgress } from "./common";

const ORDER = ["forecast", "risk", "tribes", "twins", "anomalies", "habits", "home", "txgpt"] as const;
const SHORT: Record<string, string> = { forecast: "Crystal ball", risk: "Early warning" };
const X0 = 330, STEP = 180, CY = 560, RAD = 62;

export const Scorecard: React.FC = () => {
  const { p } = useProgress();
  const cards = DATA.cards as Record<string, { name: string; verdict: string }>;
  const ships = ORDER.filter(k => cards[k].verdict === "ships").length;
  const groupK = ease(ramp(p, 0.62, 0.74));
  return <AbsoluteFill style={{ fontFamily: sans }}>
    <Title k={ramp(p, 0.02, 0.12)} sub="each tested against the best simple baseline">{ORDER.length} models</Title>
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
      {ORDER.map((key, i) => {
        const k = ease(ramp(p, 0.1 + i * 0.05, 0.2 + i * 0.05));
        const fill = ease(ramp(p, 0.42, 0.56));
        const ship = cards[key].verdict === "ships";
        const cx = X0 + i * STEP + (i >= ships ? 60 : 0);
        return <g key={key} opacity={clamp(k * 1.5)} transform={`translate(${cx} ${CY}) scale(${0.6 + 0.4 * k})`}>
          <circle r={RAD} fill={ship ? `rgba(145,250,155,${fill})` : "none"} stroke={ship ? C.mint : "rgba(255,255,255,.55)"} strokeWidth={4} strokeDasharray={ship ? undefined : "10 8"} />
          {ship ? <path d="M-24 2 L-6 20 L26 -16" fill="none" stroke={C.deep} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={fill} /> : null}
        </g>;
      })}
    </svg>
    {ORDER.filter(k => SHORT[k]).map((key, i) => <div key={key} style={{ position: "absolute", left: X0 + i * STEP - 90, width: 180, textAlign: "center", top: CY + RAD + 22, fontSize: 28, fontWeight: 700, color: INK, opacity: ease(ramp(p, 0.48, 0.58)) }}>{SHORT[key]}</div>)}
    <div style={{ position: "absolute", left: X0 - RAD, top: CY - RAD - 90, fontSize: 40, fontWeight: 800, color: INK, opacity: groupK }}>{ships} ship</div>
    <div style={{ position: "absolute", left: X0 + ships * STEP + 60 - RAD, top: CY - RAD - 90, fontSize: 40, fontWeight: 800, color: INK2, opacity: groupK }}>{ORDER.length - ships} experimental</div>
  </AbsoluteFill>;
};
