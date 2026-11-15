/* 4. Early warning: Aino's chance of going below zero in the next 14 days, on a dial with the average customer's
 * chance marked, then the model's top reasons pushing it up, one at a time. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { DATA, INK, INK2, StatusTag, clamp, ease, num, pct, ramp, sans, useProgress } from "./common";

const R = DATA.risk;
const CX = 560, CY = 560, RAD = 250, SW = 34;
const A0 = Math.PI * 0.75, SWEEP = Math.PI * 1.5;      // 270° dial, open at the bottom
const pt = (f: number, r = RAD) => [CX + r * Math.cos(A0 + SWEEP * f), CY + r * Math.sin(A0 + SWEEP * f)];
const arc = (f: number) => {
  const [x0, y0] = pt(0), [x1, y1] = pt(Math.max(1e-4, f));
  return `M${x0},${y0} A${RAD},${RAD} 0 ${SWEEP * f > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
};
const WARM = "#ffb35c";

export const EarlyWarning: React.FC = () => {
  const { p } = useProgress();
  const k0 = ease(ramp(p, 0, 0.1));
  const fill = ease(ramp(p, 0.06, 0.36));
  const avgK = ease(ramp(p, 0.3, 0.4));
  const v = R.probability * fill;
  const [ax, ay] = pt(R.baseRate, RAD + SW / 2 + 6), [ax2, ay2] = pt(R.baseRate, RAD - SW / 2 - 6);
  const [lx, ly] = pt(R.baseRate, RAD + 70);
  const reasons = R.drivers.map((_, i) => ease(ramp(p, 0.42 + i * 0.13, 0.52 + i * 0.13)));
  return <AbsoluteFill style={{ fontFamily: sans }}>
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity: k0 }}>
      <path d={arc(1)} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={SW} strokeLinecap="round" />
      {fill > 0 ? <path d={arc(v)} fill="none" stroke={WARM} strokeWidth={SW} strokeLinecap="round" /> : null}
      <line x1={ax} y1={ay} x2={ax2} y2={ay2} stroke="#fff" strokeWidth={4} opacity={avgK} />
    </svg>
    <div style={{ position: "absolute", left: lx - 250, width: 220, textAlign: "right", top: ly - 40, opacity: avgK, fontSize: 26, fontWeight: 600, color: INK2, lineHeight: 1.2 }}>
      average<br /><span style={{ color: INK, fontWeight: 700, fontSize: 32 }}>{pct(R.baseRate)}</span></div>
    <div style={{ position: "absolute", left: CX - 300, width: 600, top: CY - 120, textAlign: "center", opacity: k0 }}>
      <div style={{ fontSize: 170, fontWeight: 800, color: INK, letterSpacing: -6, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{num(v * 100)}<span style={{ fontSize: 90 }}>&nbsp;%</span></div>
      <div style={{ fontSize: 32, fontWeight: 600, color: INK2, marginTop: 12 }}>chance of going below zero</div>
      <div style={{ fontSize: 32, fontWeight: 600, color: INK2 }}>in the next {R.horizonDays} days</div>
    </div>
    <div style={{ position: "absolute", left: 1000, top: 300, width: 800 }}>
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: INK2, opacity: reasons[0] }}>Pushing it up</div>
      {R.drivers.map((d, i) => <div key={d.short} style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 34, opacity: clamp(reasons[i] * 1.5), transform: `translateX(${(1 - reasons[i]) * 40}px)` }}>
        <svg width={48} height={48} viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke={WARM} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div>
          <div style={{ fontSize: 30, fontWeight: 600, color: INK2 }}>{d.short}</div>
          <div style={{ fontSize: 50, fontWeight: 800, color: INK, letterSpacing: -1 }}>{d.value}</div>
        </div>
      </div>)}
    </div>
    <StatusTag status="ships" name="Early warning" opacity={k0} />
  </AbsoluteFill>;
};
