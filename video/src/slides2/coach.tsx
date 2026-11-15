/* Slides 12–18: the coach underneath, the models, the fit, the criteria, the motto. */
import React from "react";
import { AINO_LABEL, DATA_LABEL, LIVE_LABEL, Seg } from "../v2/kit";
import { EarlyWarning, Forecast, MoneyMap3D, Scorecard, TwoFutures } from "../v2/ml";
import { At, Big, C, Chip, CREDITS, Disc, Frame, In, LEAD, len, Mint, Ml, Sfx, SlideDef, speedOf, Sprout, Take, useT, v1, v1ev, voice } from "./core";

/** The chat clip is re-recorded after the app's switch to Gemini; until then its slide is marked provisional. */
export const CHAT_REDONE = true;

/* 12 · The coach, built on Gemini ------------------------------------------------------------ p9 */
const V12 = voice(LEAD, { scene: "p9" });
const TODAY = v1("today.mp4"), CHAT = v1("chat.mp4");
const SWITCH = V12.cue("Ask anything", 10.8);
const TYPE = v1ev("chat.mp4", "typing-start", 1.9);
const TODAY_SEGS: Seg[] = [{ from: 0.3, to: SWITCH, a: 0, b: Math.min(TODAY.seconds, SWITCH - 0.3) }];
const CHAT_SEGS: Seg[] = [{ from: SWITCH, to: SWITCH + CHAT.seconds - (TYPE - 0.4), a: TYPE - 0.4, b: CHAT.seconds }];
const S12: React.FC = () => {
  const t = useT();
  const g = V12.cue("built on Gemini", 1.8);
  return <Frame n={12} v={V12} labels={[LIVE_LABEL, speedOf(CHAT, CHAT_SEGS)]} glow={[70, 50]} pending={[!CHAT_REDONE && "chat recorded before the Gemini switch"]}>
    {t < SWITCH ? <Take c={TODAY} segs={TODAY_SEGS} x={1440} width={410} /> : <Take c={CHAT} segs={CHAT_SEGS} x={1440} width={410} />}
    <At x={120} y={120}><In at={g}><Big size={58} weight={700} color={C.heroMeta}>{CREDITS.coach.lead || "Built on"}</Big></In></At>
    <At x={110} y={190}><In at={g + 0.15} from="scale"><Big size={210}><Mint>{CREDITS.coach.model}</Mint></Big></In></At>
    <At x={120} y={415}><In at={g + 0.4}><Big size={44} weight={700} color={C.heroMeta}>{CREDITS.coach.feature}</Big></In></At>
    <At x={120} y={560}><In at={V12.cue("never does the arithmetic", 17)}><Big size={92}>Never does the maths.</Big></In></At>
    <At x={120} y={720} style={{ display: "flex", gap: 28 }}>
      <Chip at={V12.cue("An engine does", 18.7)} icon="cpu" size={44}>Engine computes</Chip>
      <Chip at={V12.cue("guard checks", 19.8)} icon="shield" size={44}>Guard checks</Chip>
    </At>
    <Sfx name="pop" at={V12.cue("An engine does", 18.7)} volume={0.5} /><Sfx name="pop" at={V12.cue("guard checks", 19.8)} volume={0.5} />
  </Frame>;
};

/* 13 · Aino among five thousand -------------------------------------------------------------- p10 · 1–3 */
const MODEL_LABEL = "Model output for the demo customer · synthetic data";
const V13 = voice(LEAD, { scene: "p10", to: "two futures" });
const FUT13 = Math.max(LEAD + 5.5, V13.cue("look-alikes", 12.6) - 0.2);
const FUT_LEN = 6.5;
const S13: React.FC = () => <Frame n={13} v={V13} labels={["Model output · Aino is a fictional customer · synthetic data"]}>
  <Ml C2={MoneyMap3D} at={LEAD} len={FUT13 - LEAD} until={FUT13} />
  <Ml C2={TwoFutures} at={FUT13} len={FUT_LEN} />
</Frame>;

/* 14 · The two that ship: forecast and early warning ----------------------------------------- p10 · 4 */
const V14 = voice(LEAD, { scene: "p10", from: "One forecasts", to: "One forecasts" });
const W14 = Math.max(LEAD + 4.8, V14.cue("one warns", 3.0));
const S14: React.FC = () => <Frame n={14} v={V14} labels={[MODEL_LABEL]}>
  <Ml C2={Forecast} at={LEAD} len={W14 - LEAD} until={W14} />
  <Ml C2={EarlyWarning} at={W14} len={5.5} />
  <Sfx name="whoosh" at={W14} volume={0.45} />
</Frame>;

/* 15 · Eight models: two ship, six experimental ---------------------------------------------- p10 · 5–7 */
const V15 = voice(LEAD, { scene: "p10", from: "We tested" });
// the scorecard groups "2 ship / 6 experimental" at 62 % of its length: land that on "Two clearly win"
const SC15 = Math.max(4, (V15.cue("Two clearly win", 5.6) + 0.2 - LEAD) / 0.62);
const S15: React.FC = () => <Frame n={15} v={V15} labels={["Each model tested against the strongest simple baseline", DATA_LABEL]}>
  <Ml C2={Scorecard} at={LEAD} len={SC15} />
</Frame>;

/* 16 · Built for S-mobiili ------------------------------------------------------------------- p11 · 1–4 */
const V16 = voice(LEAD, { scene: "p11", to: "open banking" });
const MORE = v1("more.mp4");
const SAA = v1ev("more.mp4", "saastaja", 10.95);
const S16A = V16.cue("Säästäjä", 6.5) + 0.3;
const S16SEGS: Seg[] = [
  { from: 0.3, to: S16A, a: v1ev("more.mp4", "goal", 4.8) - 0.3, b: SAA },
  { from: S16A, to: V16.end + 0.6, a: SAA, b: MORE.seconds - 0.1, maxRate: 4 },
];
const S16: React.FC = () => <Frame n={16} v={V16} labels={[LIVE_LABEL, "Säästäjä hand-off and open banking are mocks", speedOf(MORE, S16SEGS)]} glow={[70, 50]}>
  <Take c={MORE} segs={S16SEGS} x={1440} width={410} />
  <At x={120} y={150}><In at={0.4}><Big size={120}>Built for <Mint>S-mobiili</Mint></Big></In></At>
  <At x={120} y={400}><Chip at={V16.cue("One engine", 2.8)} icon="cpu" size={50}>One engine</Chip></At>
  <At x={120} y={530}><Chip at={V16.cue("guarded chat", 3.8)} icon="shield" size={50}>One guarded endpoint</Chip></At>
  <At x={120} y={660}><Chip at={V16.cue("open banking", 7.5)} icon="bank" size={50}>Open banking (mock)</Chip></At>
  <Sfx name="pop" at={V16.cue("One engine", 2.8)} volume={0.5} /><Sfx name="pop" at={V16.cue("guarded chat", 3.8)} volume={0.5} /><Sfx name="pop" at={V16.cue("open banking", 7.5)} volume={0.5} />
</Frame>;

/* 17 · The five criteria --------------------------------------------------------------------- p11 · 5–8 */
const V17 = voice(LEAD, { scene: "p11", from: "Financial literacy" });
const TILES: { icon: string; name: string; at: number }[] = [
  { icon: "chart", name: "Financial literacy", at: V17.cue("Financial literacy", 0.6) },
  { icon: "spark", name: "Original AI", at: V17.cue("Original AI", 3.6) },
  { icon: "phone", name: "Mobile UX", at: V17.cue("Clear on mobile", 5.9) },
  { icon: "flag", name: "Feasible", at: V17.cue("Feasible", 8.0) },
];
TILES.push({ icon: "bank", name: "S-mobiili fit", at: TILES[3].at + 0.9 });
const S17: React.FC = () => <Frame n={17} v={V17}>
  <At x={120} y={110}><In at={0.4}><Big size={120}>Five criteria.</Big></In></At>
  <At x={122} y={360} style={{ display: "flex", gap: 24 }}>
    {TILES.map(k => <In key={k.name} at={k.at} from="scale" style={{ transformOrigin: "50% 50%" }}>
      <div style={{ width: 316, height: 400, borderRadius: 36, background: "rgba(145,250,155,.09)", border: "2px solid rgba(145,250,155,.4)", boxSizing: "border-box",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "44px 20px 40px" }}>
        <Disc icon={k.icon} size={120} />
        <div style={{ fontSize: 46, fontWeight: 800, textAlign: "center", lineHeight: 1.08 }}>{k.name}</div>
        <Disc icon="check" size={70} fill />
      </div>
    </In>)}
  </At>
  {TILES.map(k => <Sfx key={k.name} name="pop" at={k.at} volume={0.5} />)}
</Frame>;

/* 18 · The motto ----------------------------------------------------------------------------- p12 */
const V18 = voice(LEAD + 0.3, { scene: "p12" });
const S18: React.FC = () => <Frame n={18} v={V18}>
  <At x={0} y={150} w={1920} style={{ display: "flex", justifyContent: "center" }}><In at={0.3} from="scale" style={{ transformOrigin: "50% 50%" }}><Sprout size={170} inverse /></In></At>
  <At x={0} y={350} w={1920} style={{ textAlign: "center" }}><In at={V18.cue("Vara", 0.8)} style={{ transformOrigin: "50% 50%" }}><Big size={230}>Vara</Big></In></At>
  <At x={0} y={630} w={1920} style={{ textAlign: "center" }}><In at={V18.cue("Helping", 1.5)} style={{ transformOrigin: "50% 50%" }}>
    <Big size={80} weight={700}>Helping you save money, <Mint>a craving at a time.</Mint></Big></In></At>
  <At x={0} y={800} w={1920} style={{ textAlign: "center" }}><In at={V18.end + 0.3} style={{ transformOrigin: "50% 50%" }}>
    <div style={{ fontSize: 34, fontWeight: 600, color: C.heroMeta }}>vara-junction26.swedencentral.cloudapp.azure.com</div></In></At>
  <Sfx name="impact" at={V18.cue("Vara", 0.8)} volume={0.5} />
</Frame>;

export const COACH: SlideDef[] = [
  { id: "v12-coach", title: "The coach, built on Gemini", seconds: len(V12, CHAT_SEGS[0].to), component: S12 },
  { id: "v13-money-map", title: "Aino among five thousand", seconds: len(V13, FUT13 + FUT_LEN), component: S13 },
  { id: "v14-forecast-warning", title: "Forecast and early warning", seconds: len(V14, W14 + 5.5), component: S14 },
  { id: "v15-scorecard", title: "Two ship, six experimental", seconds: len(V15, LEAD + SC15), component: S15 },
  { id: "v16-s-mobiili", title: "Built for S-mobiili", seconds: len(V16, V16.end + 0.6), component: S16 },
  { id: "v17-criteria", title: "Five criteria", seconds: len(V17, TILES[4].at + 1), component: S17 },
  { id: "v18-motto", title: "Helping you save money, a craving at a time", seconds: len(V18, V18.end + 1.2), component: S18 },
];
export const COACH_VOICES = { V12, V13, V14, V15, V16, V17, V18 };
