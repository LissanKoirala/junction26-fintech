/* Slides 07–11: what we built. The shop built live, any craving, the checkout, the plot twist, the money kept.
 * Shop names, products, prices and every time come from src/v2/footage.json (REC): nothing is typed in. */
import React from "react";
import { AINO_LABEL, LIVE_LABEL, Seg, SIM_LABEL, Stopwatch } from "../v2/kit";
import { At, Big, builtByGemini, C, FACTS, Chip, clip, CountTo, CREDITS, euros, ev, Flash, Frame, Icon, In, LEAD, len, Mint, Sfx, SlideDef, speedOf, Take, TakeSounds, useT, voice } from "./core";
import { resolve, srcAt } from "../v2/kit";

const RUN = "crave-run";
const run = clip(RUN);
const notGemini = (id: string) => !builtByGemini(id) && "footage built before the Gemini switch";

/* 07 · Gemini builds the shop, live ---------------------------------------------------------- p5 · to "real retailer" */
const V07 = voice(LEAD, { scene: "p5", to: "real retailer" });
const SUBMIT = ev(RUN, "submitted"), VISIBLE = ev(RUN, "shop-visible");
const OFF7 = V07.cue("She tells Vara", 4.5) - SUBMIT;               // slide second = source second + OFF7 (real time)
const FROM7 = Math.max(0.3, OFF7);
const S07SEGS: Seg[] = [{ from: FROM7, to: VISIBLE + OFF7 + 0.6, a: FROM7 - OFF7, b: VISIBLE + 0.6 }];
// the two true moments of the build, in real seconds after the tap, from the take's own events (as the v2 videos do)
const BUILD = VISIBLE - SUBMIT, OPEN = ev(RUN, "shop-open") - SUBMIT;
const S07: React.FC = () => {
  const t = useT();
  const r = resolve(S07SEGS, run.seconds);
  const elapsed = Math.max(0, srcAt(r, t) - SUBMIT);
  const g = V07.cue("Gemini builds", 6.5);
  return <Frame n={7} v={V07} side="right" labels={[LIVE_LABEL, AINO_LABEL, CREDITS.photos ?? "Photos · image model", speedOf(run, S07SEGS)]} pending={[notGemini(RUN)]} glow={[30, 50]}>
    <Take c={run} segs={S07SEGS} x={480} width={410} />
    <Sfx name="shimmer" at={ev(RUN, "shop-open") + OFF7} volume={0.6} />
    <At x={900} y={100}><In at={g}><Big size={56} weight={700} color={C.heroMeta}>{CREDITS.build.lead}</Big></In></At>
    <At x={890} y={165}><In at={g + 0.15} from="scale"><Big size={210}><Mint>{CREDITS.build.model}</Mint></Big></In></At>
    <At x={900} y={390}><In at={g + 0.4}><Big size={44} weight={700} color={C.heroMeta}>{CREDITS.build.feature}</Big></In></At>
    <Sfx name="impact" at={g + 0.15} volume={0.35} />
    <At x={900} y={540}><Stopwatch seconds={elapsed} final={BUILD} at={V07.cue("She tells Vara", 4.5)} size={130}
      laps={[{ label: "First product", value: OPEN }, { label: "Shop complete", value: BUILD }]} /></At>
  </Frame>;
};

/* 08 · Any craving, a new shop --------------------------------------------------------------- p5 · from "Sushi" */
const V08 = voice(LEAD, { scene: "p5", from: "Sushi" });
const MONTAGE = [["shop-sushi", "Sushi"], ["shop-headphones", "Headphones"], ["shop-coat", "winter coat"]] as const;
const PLAY = 4.2;
const M = MONTAGE.map(([id, word], i) => {
  const c = clip(id), st = V08.cue(word, LEAD + i * 0.7);
  const segs: Seg[] = [{ from: st, to: st + PLAY, a: ev(id, "build-first-paint"), b: ev(id, "shop-visible") + 0.4, maxRate: 8 }];
  // true build time: the clip's measured build_seconds (REC), else facts.json for that craving
  const build = (c as { build_seconds?: number }).build_seconds ?? FACTS.build_seconds.others[i];
  return { id, c, st, segs, build, rate: resolve(segs, c.seconds)[0].rate };
});
const rates = M.map(m => m.rate);
const SPEED8 = `×${Math.min(...rates).toFixed(1)}–${Math.max(...rates).toFixed(1)} speed`;
const S08: React.FC = () => <Frame n={8} v={V08} side="right" labels={[LIVE_LABEL, CREDITS.photos ?? "Photos · image model", SPEED8]} pending={M.map(m => notGemini(m.id))}>
  <At x={120} y={50}><In at={V08.cue("new shop", 2.6)}><Big size={88}>A new shop, <Mint>every time.</Mint></Big></In></At>
  {M.map((m, i) => {
    const x = 420 + i * 540;
    return <React.Fragment key={m.id}>
      <Take c={m.c} segs={m.segs} x={x} width={300} y={262} enter={m.st - 0.15} />
      <Sfx name="whoosh" at={m.st - 0.15} volume={0.5} />
      <At x={x - 260} y={180} w={520} style={{ textAlign: "center" }}><In at={m.st - 0.1}>
        <div style={{ fontSize: 46, fontWeight: 800, whiteSpace: "nowrap" }}>“{String(m.c.craving ?? "")}”</div></In></At>
      <At x={x - 260} y={904} w={520} style={{ textAlign: "center" }}><In at={m.st + PLAY}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 36, fontWeight: 700, color: C.mint }}>
          <Icon name="clock" size={36} color={C.mint} stroke={2.4} />{m.build.toFixed(1)} s</div></In></At>
    </React.Fragment>;
  })}
</Frame>;

/* 09 · The hunt, the basket, the checkout ---------------------------------------------------- p6 */
const V09 = voice(LEAD, { scene: "p6" });
const S9A = V09.cue("Add to basket", 3.7) + 0.4, S9B = V09.cue("Check out", 5.0) + 0.5, S9C = V09.cue("Double-click", 9.0) + 0.3;
const S09SEGS: Seg[] = [
  { from: 0.3, to: S9A, a: ev(RUN, "product-open") - 0.2, b: ev(RUN, "added") + 0.3 },
  { from: S9A, to: S9B, a: ev(RUN, "added") + 0.3, b: ev(RUN, "checkout") + 0.6 },
  { from: S9B, to: S9C, a: ev(RUN, "checkout") + 0.6, b: ev(RUN, "wallet-visible") + 0.6 },
];
const FREE = (() => { const m = String(run.shop?.payday_check ?? "").replace(/ /g, " ").match(/(\d+(?:,\d+)?) ?€ is free until payday/); return m ? m[1] : null; })();
const S09: React.FC = () => <Frame n={9} v={V09} side="right" labels={[LIVE_LABEL, SIM_LABEL, speedOf(run, S09SEGS)]} pending={[notGemini(RUN)]} glow={[30, 50]}>
  <Take c={run} segs={S09SEGS} x={480} width={410} />
  <TakeSounds c={run} segs={S09SEGS} />
  <At x={900} y={140}><In at={V09.cue("Hunt", 2.0)}><Big size={120}>The hunt.</Big></In></At>
  <At x={900} y={290}><In at={V09.cue("Add to basket", 3.7)}><Big size={120}>The basket.</Big></In></At>
  <At x={900} y={440}><In at={V09.cue("Check out", 5.0)}><Big size={120}><Mint>The checkout.</Mint></Big></In></At>
  {FREE ? <At x={900} y={660}><Chip at={V09.cue("already checked", 6.0)} icon="check" size={46}>{FREE} € free until payday</Chip></At> : null}
  <Sfx name="pop" at={V09.cue("already checked", 6.0)} volume={0.5} />
</Frame>;

/* 10 · Plot twist: nothing ships ------------------------------------------------------------- the chime alone, then p7 to "Crave pot" */
const TICK = ev(RUN, "tick"), A0 = ev(RUN, "pay-tap-1") - 1.4;
const TICK_AT = 0.4 + (TICK - A0);
const V10 = voice(TICK_AT + 0.75 + 1.5, { scene: "p7", to: "Crave pot" });
const TWIST_AT = V10.cue("twist", V10.start + 4.5), POT_AT = V10.cue("Crave pot", V10.start + 9.0);
const S10SEGS: Seg[] = [
  { from: 0.4, to: TICK_AT + 1.0, a: A0, b: TICK + 1.0 },
  { from: TICK_AT + 1.0, to: TWIST_AT, a: TICK + 1.0, b: ev(RUN, "twist"), anchor: "hold" },
  { from: TWIST_AT, to: POT_AT + 1.2, a: ev(RUN, "twist"), b: ev(RUN, "pot") + 1.0, maxRate: 4 },
];
const PRICE = euros(run.shop?.price);
const S10: React.FC = () => <Frame n={10} v={V10} side="right" labels={[LIVE_LABEL, SIM_LABEL, speedOf(run, S10SEGS)]} pending={[notGemini(RUN)]} glow={[30, 50]}>
  <Take c={run} segs={S10SEGS} x={480} width={410} />
  <TakeSounds c={run} segs={S10SEGS} />
  <Sfx name="stop" at={TWIST_AT - 0.45} volume={0.7} />
  <At x={900} y={130}><In at={TWIST_AT} from="slam" style={{ transformOrigin: "30% 50%" }}>
    <Big size={160} style={{ transform: "rotate(-3deg)" }}>PLOT TWIST</Big></In></At>
  <Flash at={TWIST_AT} /><Sfx name="slam" at={TWIST_AT} /><Sfx name="impact" at={TWIST_AT} volume={0.5} />
  <At x={900} y={360}><In at={V10.cue("Nothing ships", TWIST_AT + 0.6)}><Big size={140}><Mint>Nothing ships.</Mint></Big></In></At>
  <At x={900} y={590}><In at={POT_AT} from="scale"><Big size={130}>+<CountTo at={POT_AT} to={PRICE} dur={1.2} decimals={2} suffix=" €" /></Big></In></At>
  <At x={905} y={740}><In at={POT_AT + 0.3}><Big size={54} weight={700} color={C.heroMeta}>to her savings pot</Big></In></At>
  <Sfx name="pour" at={POT_AT} volume={0.6} />
</Frame>;

/* 11 · She got the hit. She kept the money. ------------------------------------------------- p7 from "She got the hit", p8 */
const V11 = voice(LEAD, { scene: "p7", from: "She got the hit" }, { scene: "p8" });
const S11SEGS: Seg[] = [{ from: 0.3, to: 0.3 + (run.seconds - 0.1 - (ev(RUN, "pot") - 0.3)), a: ev(RUN, "pot") - 0.3, b: run.seconds - 0.1, anchor: "start" }];
const S11: React.FC = () => <Frame n={11} v={V11} labels={[LIVE_LABEL, SIM_LABEL, "Wallet button: Stripe, test mode"]} glow={[70, 50]} pending={[notGemini(RUN)]}>
  <Take c={run} segs={S11SEGS} x={1560} width={390} />
  <At x={120} y={210}><In at={V11.cue("got the hit", 0.7)}><Big size={116}>She got the hit.</Big></In></At>
  <At x={120} y={360}><In at={V11.cue("kept the money", 1.6)}><Big size={116}><Mint>She kept the money.</Mint></Big></In></At>
  <Sfx name="impact" at={V11.cue("kept the money", 1.6)} volume={0.35} />
  <At x={120} y={640}><Chip at={V11.cue("reversible", 5.5)} icon="undo" size={48}>Reversible, any time</Chip></At>
</Frame>;

export const CRAVE: SlideDef[] = [
  { id: "v07-built-live", title: "Gemini builds the shop, live", seconds: len(V07, VISIBLE + OFF7 + 0.6), component: S07 },
  { id: "v08-any-craving", title: "Any craving, a new shop", seconds: len(V08, Math.max(...M.map(m => m.st)) + PLAY + 0.6), component: S08 },
  { id: "v09-checkout", title: "The hunt, the basket, the checkout", seconds: len(V09, S9C), component: S09 },
  { id: "v10-plot-twist", title: "Plot twist: nothing ships", seconds: len(V10, POT_AT + 1.4), component: S10 },
  { id: "v11-kept-the-money", title: "She got the hit. She kept the money.", seconds: len(V11, 0.3 + (run.seconds - ev(RUN, "pot"))), component: S11 },
];
export const CRAVE_VOICES = { V07, V08, V09, V10, V11 };
