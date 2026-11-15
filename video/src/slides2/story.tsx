/* Slides 01–06: the thrill, the evidence, the idea. */
import React from "react";
import { DATA_LABEL, LIVE_LABEL, Seg } from "../v2/kit";
import { At, Big, C, clip, CountTo, Disc, ev, f, Flash, Frame, In, LEAD, len, Mint, ramp, Sfx, SlideDef, speedOf, Take, TakeSounds, useK, useT, voice } from "./core";

const RUN = "crave-run";

/* 01 · The rush, then the parcel ------------------------------------------------------------ p1 */
const V01 = voice(LEAD, { scene: "p1" });
const S01SEGS: Seg[] = [{ from: 0.3, to: V01.cue("best part", 5.5), a: ev(RUN, "scroll-start"), b: ev(RUN, "basket"), maxRate: 4 }];
const S01: React.FC = () => {
  const t = useT();
  const gone = V01.cue("thrill is gone", 8.5);
  const c = clip(RUN);
  return <Frame n={1} v={V01} side="right" labels={[LIVE_LABEL, speedOf(c, S01SEGS)]} glow={[30, 50]}>
    <Take c={c} segs={S01SEGS} x={500} width={410} gray={ease3(ramp(t, gone, gone + 1.4))} />
    <TakeSounds c={c} segs={S01SEGS} />
    <Sfx name="whoosh" at={0.05} volume={0.6} />
    <At x={900} y={170}><In at={V01.cue("you scroll", 2.6)}><Big size={200}><Mint>The rush.</Mint></Big></In></At>
    <At x={900} y={470}><In at={V01.cue("parcel", 7.0)} style={{ display: "flex", alignItems: "center", gap: 36 }}>
      <Disc icon="box" size={130} /><Big size={100}>Then the parcel.</Big></In></At>
    <Sfx name="impact" at={V01.cue("parcel", 7.0)} volume={0.35} />
    <At x={900} y={680} style={{ display: "flex", gap: 28 }}>
      <In at={gone}><Big size={80} color={C.heroMeta} style={{ whiteSpace: "nowrap" }}>Thrill gone.</Big></In>
      <In at={V01.cue("so is the money", 9.5)}><Big size={80} color={C.heroMeta} style={{ whiteSpace: "nowrap" }}>Money gone.</Big></In>
    </At>
  </Frame>;
};
const ease3 = (x: number) => 1 - (1 - x) ** 3;

/* 02 · Seven in ten ------------------------------------------------------------------------- p2 · 1 */
const V02 = voice(LEAD, { scene: "p2", to: "seven in ten" });
const S02: React.FC = () => {
  const t = useT();
  const at = V02.cue("seven in ten", 7.0);
  const lit = 69 * ease3(ramp(t, at, at + 1.3));
  const gridK = useK(0.4, 18);
  return <Frame n={2} v={V02} labels={[DATA_LABEL]}>
    <Sfx name="whoosh" at={0.05} volume={0.5} />
    <At x={120} y={130}><In at={V02.cue("three point six", 1.3)}><Big size={50} weight={700} color={C.heroMeta}>3.6 million transactions · 5 100 customers</Big></In></At>
    <At x={110} y={250}><In at={at} from="scale"><Big size={400}><Mint><CountTo at={at} to={69} dur={1.3} suffix="%" /></Mint></Big></In></At>
    <Sfx name="tick" at={at + 1.3} volume={0.7} />
    <At x={120} y={680}><In at={V02.cue("below zero", at + 0.8)}><Big size={74}>went below zero in two years</Big></In></At>
    <At x={1210} y={220} style={{ display: "grid", gridTemplateColumns: "repeat(10, 54px)", gap: 10, opacity: Math.min(1, gridK * 2) }}>
      {Array.from({ length: 100 }, (_, i) => <div key={i} style={{ width: 54, height: 54, borderRadius: 54,
        background: i < lit ? C.mint : "transparent", border: `3px solid ${i < lit ? C.mint : "rgba(255,255,255,.28)"}`, boxSizing: "border-box" }} />)}
    </At>
  </Frame>;
};

/* 03 · Young, and just before payday ------------------------------------------------------- p2 · 2–3 */
const V03 = voice(LEAD, { scene: "p2", from: "Among", to: "Almost always" });
const S03: React.FC = () => {
  const t = useT();
  const a80 = V03.cue("eight in ten", 1.8), a96 = V03.cue("last days", 4.0);
  return <Frame n={3} v={V03} labels={[DATA_LABEL]}>
    <Sfx name="whoosh" at={0.05} volume={0.5} />
    <At x={120} y={190}><In at={a80} from="scale"><Big size={300}><Mint><CountTo at={a80} to={80} suffix="%" /></Mint></Big></In></At>
    <At x={130} y={520}><In at={a80 + 0.2}><Big size={72}>aged 18–24</Big></In></At>
    <At x={1010} y={190}><In at={a96} from="scale"><Big size={300}><Mint><CountTo at={a96} to={96} suffix="%" /></Mint></Big></In></At>
    <At x={1020} y={520}><In at={a96 + 0.2}><Big size={72}>of dips: just before payday</Big></In></At>
    <Sfx name="tick" at={a80 + 0.9} volume={0.6} /><Sfx name="tick" at={a96 + 0.9} volume={0.6} />
    <At x={1020} y={720}><In at={a96 + 0.4}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        {Array.from({ length: 30 }, (_, i) => {
          const hot = i >= 20, on = hot && t >= a96 + 0.5 + (i - 20) * 0.06;
          return <div key={i} style={{ width: 20, height: i === 0 ? 90 : 60, borderRadius: 5, background: i === 0 ? "#fff" : on ? C.mint : "rgba(255,255,255,.2)" }} />;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", width: 774, marginTop: 14, fontSize: 32, fontWeight: 600, color: C.heroMeta }}>
        <span>payday</span><span>next payday</span></div>
    </In></At>
  </Frame>;
};

/* 04 · Tiny dips ---------------------------------------------------------------------------- p2 · 4–6 */
const V04 = voice(LEAD, { scene: "p2", from: "dips are tiny" });
const Token: React.FC<{ size: number; fill?: number; label?: string }> = ({ size, fill = 1, label = "39 €" }) =>
  <div style={{ width: size, height: size, borderRadius: size, position: "relative", border: `4px solid ${C.mint}`, boxSizing: "border-box", overflow: "hidden" }}>
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: "rgba(145,250,155,.22)" }} />
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: size * 0.3, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>{label}</div>
  </div>;
const S04: React.FC = () => {
  const a39 = V04.cue("thirty-nine", 1.6), deep = V04.cue("deepest dip", 4.4);
  return <Frame n={4} v={V04} labels={[DATA_LABEL]}>
    <Sfx name="whoosh" at={0.05} volume={0.5} />
    <At x={120} y={110}><In at={0.4}><Big size={140}>Tiny dips.</Big></In></At>
    <At x={120} y={380}><In at={a39} from="scale"><Token size={270} /></In></At>
    <At x={120} y={680}><In at={a39 + 0.2}><Big size={50} weight={700} color={C.heroMeta}>a typical purchase</Big></In></At>
    <At x={560} y={420} style={{ display: "flex", gap: 18 }}>
      {Array.from({ length: 6 }, (_, i) => <In key={i} at={deep + 0.25 + i * 0.2} from="scale"><Token size={176} fill={i === 5 ? 0.9 : 1} label={i === 5 ? "0,9×" : "39 €"} /></In>)}
    </At>
    {Array.from({ length: 6 }, (_, i) => <Sfx key={i} name="tick" at={deep + 0.25 + i * 0.2} volume={0.45} />)}
    <At x={560} y={260}><In at={deep + 1.5}><Big size={120}><Mint>×5.9</Mint></Big></In></At>
    <At x={880} y={290}><In at={deep + 1.6}><Big size={60} weight={700}>= the deepest dip</Big></In></At>
  </Frame>;
};

/* 05 · Keep the money ----------------------------------------------------------------------- p3 */
const V05 = voice(LEAD, { scene: "p3" });
const Bar: React.FC<{ at: number; label: string; value: number; y: number; strong?: boolean }> = ({ at, label, value, y, strong }) => {
  const t = useT();
  const k = ease3(ramp(t, at, at + 1.1));
  return <At x={120} y={y}>
    <In at={at - 0.3}><div style={{ fontSize: 54, fontWeight: 800, color: strong ? "#fff" : C.heroMeta, marginBottom: 16 }}>{label}</div></In>
    <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
      <div style={{ width: 1060, height: 96, borderRadius: 18, background: "rgba(255,255,255,.1)", position: "relative", overflow: "hidden", opacity: t >= at - 0.3 ? 1 : 0 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${value * k}%`, background: strong ? C.mint : "rgba(145,250,155,.45)", borderRadius: 18 }} />
      </div>
      <In at={at + 0.6} from="scale"><div style={{ fontSize: 120, fontWeight: 800, color: strong ? C.mint : "#fff", letterSpacing: -4, lineHeight: 1 }}><CountTo at={at} to={value} dur={1.1} suffix="%" /></div>
        <div style={{ fontSize: 30, fontWeight: 700, color: C.heroMeta, marginTop: 6, whiteSpace: "nowrap" }}>fewer days below zero</div></In>
    </div>
  </At>;
};
const S05: React.FC = () => <Frame n={5} v={V05} labels={["A replay of two years of data, all else unchanged. Not a prediction.", DATA_LABEL]}>
  <Sfx name="whoosh" at={0.05} volume={0.5} />
  <At x={120} y={110}><In at={V05.cue("craving problem", 2.4)}><Big size={130}>A <Mint>craving</Mint> problem.</Big></In></At>
  <At x={120} y={275}><In at={V05.cue("five percent", 6.0)}><Big size={54} weight={700} color={C.heroMeta}>Trim everyday extras by 5%, and…</Big></In></At>
  <Bar at={V05.cue("seventy-two", 10.0)} label="If the saved money stays put" value={72} y={380} strong />
  <Bar at={V05.cue("fifteen", 13.5)} label="If it is spent by payday" value={15} y={650} />
  <Sfx name="tick" at={V05.cue("seventy-two", 10.0) + 1.1} volume={0.6} />
</Frame>;

/* 06 · We feed it: Crave mode --------------------------------------------------------------- p4 */
const V06 = voice(LEAD, { scene: "p4" });
const Pie: React.FC<{ cross: number }> = ({ cross }) => {
  const t = useT();
  const k = ease3(ramp(t, cross, cross + 0.35));
  return <svg width={150} height={150} viewBox="0 0 100 100">
    <circle cx={50} cy={50} r={40} fill="rgba(255,255,255,.18)" />
    <path d="M50 50 L50 10 A40 40 0 0 1 88 62 Z" fill="rgba(145,250,155,.6)" />
    <path d="M50 50 L88 62 A40 40 0 0 1 30 85 Z" fill="rgba(255,255,255,.35)" />
    <path d="M12 12 L88 88" stroke="#ff6b5a" strokeWidth={9} strokeLinecap="round" strokeDasharray={`${108 * k} 200`} />
  </svg>;
};
const S06: React.FC = () => {
  const crave = V06.cue("Crave mode", 14.0);
  return <Frame n={6} v={V06}>
    <At x={120} y={110}><In at={0.4} from="scale"><Pie cross={V06.cue("pie chart", 1.6) + 0.3} /></In></At>
    <At x={330} y={125} style={{ display: "flex", gap: 30 }}>
      <In at={V06.cue("the hunt", 5.0)} from="scale"><Disc icon="search" size={120} /></In>
      <In at={V06.cue("the scroll", 6.6)} from="scale"><Disc icon="phone" size={120} /></In>
      <In at={V06.cue("buy button", 7.6)} from="scale"><Disc icon="bag" size={120} /></In>
    </At>
    <Sfx name="pop" at={V06.cue("the hunt", 5.0)} volume={0.5} /><Sfx name="pop" at={V06.cue("the scroll", 6.6)} volume={0.5} /><Sfx name="pop" at={V06.cue("buy button", 7.6)} volume={0.5} />
    <At x={120} y={350}><In at={V06.cue("fight the craving", 11.6)}><Big size={100}>We don't fight the craving.</Big></In></At>
    <At x={120} y={480}><In at={V06.cue("feed it", 12.8)}><Big size={150}><Mint>We feed it.</Mint></Big></In></At>
    <At x={110} y={690}><In at={crave} from="slam"><Big size={240}>Crave mode</Big></In></At>
    <Flash at={crave} /><Sfx name="slam" at={crave} /><Sfx name="impact" at={crave} volume={0.6} />
  </Frame>;
};

export const STORY: SlideDef[] = [
  { id: "v01-rush", title: "The rush, then the parcel", seconds: len(V01), component: S01 },
  { id: "v02-seven-in-ten", title: "Seven in ten went below zero", seconds: len(V02, V02.cue("seven in ten", 7) + 1.5), component: S02 },
  { id: "v03-young-payday", title: "Young, and just before payday", seconds: len(V03, V03.cue("last days", 4) + 1.6), component: S03 },
  { id: "v04-tiny-dips", title: "Tiny dips", seconds: len(V04, V04.cue("deepest dip", 4.4) + 2.4), component: S04 },
  { id: "v05-keep-the-money", title: "Keep the money", seconds: len(V05), component: S05 },
  { id: "v06-crave-mode", title: "We feed it: Crave mode", seconds: len(V06, V06.cue("Crave mode", 14) + 1.2), component: S06 },
];
export const STORY_VOICES = { V01, V02, V03, V04, V05, V06 };
export { f };
