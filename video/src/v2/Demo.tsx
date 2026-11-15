/* Version 2 demo video (d1–d8), one continuous timeline. Every time below comes from the narration (audio.json) or
 * the take's events (footage.json) through the act clock; nothing is a hard-coded second of footage. */
import React from "react";
import { Sequence } from "remotion";
import { clip } from "./data";
import { demoPlan, f } from "./timeline";
import { Mix } from "./Mix";
import { Stage } from "./kit";
import {
  Act, AINO_LABEL, APP_URL, At, BuildPanel, buildSegs, C, chipSounds, Clock, Close, Count, E, Eo, FitsText, Icon, L, LIVE_LABEL, Mint,
  Montage, montageSounds, NothingShips, paySegs, paySrcStart, PayPhone, PhoneTake, PotCount, PX, RUN, Say, Seg, Sfx, SIM_LABEL, TakeLabels, TakeSounds,
  Three, CreditBadge, chatIsGemini, WALLET_LABEL, Whip, Win, whenShown, Labels, speedLabel, resolve,
} from "./acts";
import { CraveProof, Proof } from "./proofs";
import { MlSlot } from "./mlslot";
import { word, wordEnd } from "./data";
import { HuntAndPay, payGeometry, ThrillOpen, thrillSounds, Twist, twistSounds, twistTimes } from "./twist";

const plan = demoPlan;

/* ------------------------------------------------------------ d1: the thrill, and the question */
const Feeling: React.FC = () => <Act plan={plan} from="d1" to="d1" sounds={c => thrillSounds(c, "d1", "question")}>
  {c => <ThrillOpen c={c} id="d1" ending="question" />}
</Act>;

/* ------------------------------------------------------------ d2: Aino, and a shop built from nothing */
const Build: React.FC = () => <Act plan={plan} from="d2" to="d2" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.4} />
  {chipSounds(c, "d2")}
  <Sfx name="tick" at={tVisible(c)} volume={0.6} />
  <Sfx name="impact" at={c.w("d2", "Almost instantly") - 0.04} volume={0.4} />
</>}>{c => {
  const w = (s: string) => c.w("d2", s) - 0.05;
  const tType = w("new sneakers") - 0.2, tSubmit = w("tells her bank") + 0.3, tPaint = w("A whole store"), tv = tVisible(c), tEnd = c.end("d2");
  const sv = E("shop-visible"), shopEnd = sv + (E("product-open") - sv) * 0.45;
  const segs = [{ from: 0, to: tType, a: Math.max(0, E("typing-start") - 1.0), b: Math.max(0, E("typing-start") - 0.2), anchor: "end", maxRate: 1 } as Seg,
    ...buildSegs(tType, tSubmit, tPaint, tv, tEnd, shopEnd)].filter(s => s.to > s.from);
  const chipsFrom = w("name");
  const inst = w("Almost instantly");
  const tLap = tPaint + (Eo("shop-open") ?? E("build-first-paint")) - E("build-first-paint");   // the "First product" lap
  return <>
    <Whip at={0}><PhoneTake clipId={RUN} segs={segs} x={PX} glowAt={tv} /></Whip>
    <At x={L.x} y={300} w={L.w}>
      <Say at={0} out={w("payday")} size={170} from="scale">Meet <Mint>Aino.</Mint></Say>
      <Say at={w("new sneakers")} out={w("payday")} size={90} color={C.heroMeta} style={{ marginTop: 20 }}>wants new sneakers</Say>
      <Say at={w("payday")} out={w("tells her bank")} size={120}>Payday:<br /><Mint>two weeks</Mint> away.</Say>
    </At>
    <BuildPanel c={c} id="d2" segs={segs} watchAt={tSubmit} chipsTo={inst} pulseAt={w("Gemini")} />
    <At x={L.x} y={565} w={L.w}>
      <Say at={w("tells her bank")} out={w("Watch this")} size={104}>Vara builds<br />her a <Mint>shop.</Mint></Say>
      <Say at={w("Watch this")} out={tPaint} size={150}>Watch <Mint>this.</Mint></Say>
      {/* the phrase lands with the "First product" lap (the shop's first paint), never beside "Shop complete" */}
      <Say at={tPaint} out={chipsFrom} size={104}>A whole store.</Say>
      <Say at={tLap} out={chipsFrom} size={104}><Mint>Almost instantly.</Mint></Say>
      <Say at={inst} size={120}>From<br /><Mint>nothing.</Mint></Say>
    </At>
    <TakeLabels clipId={RUN} segs={segs} extra={[AINO_LABEL]} />
  </>;
}}</Act>;
/** The shop finishes its build (stream ended, photos in) just before "Almost instantly." */
const tVisible = (c: Clock) => Math.min(c.w("d2", "Almost instantly") - 0.25, c.w("d2", "A whole store") - 0.05 + E("shop-visible") - E("build-first-paint"));

/* ------------------------------------------------------------ d3: three more shops */
const More: React.FC = () => <Act plan={plan} from="d3" to="d3" sounds={c => montageSounds(c, "d3", "Any craving")}>
  {c => <Montage c={c} id="d3" from={0} to={c.end("d3")} lastWord="Any craving" />}
</Act>;

/* ------------------------------------------------------------ d4–d5: the hunt, the pay ritual, the beat, the plot twist */
const EMAIL_D5 = "The email lands";
const geoD = (c: Clock) => payGeometry(c, "d4", "d5", [
  { at: 0, src: "grid", word: <>The whole<br /><Mint>thrill.</Mint></> },
  { at: c.w("d4", "The hunt") - 0.05, src: "scroll", word: "The hunt." },
  { at: c.w("d4", "The scroll") - 0.05, src: "product", word: "The scroll." },
  { at: c.w("d4", "The basket") - 0.05, src: "basket", word: "The basket." },
  { at: c.w("d4", "The checkout") - 0.05, src: "checkout", word: "The checkout." },
  { at: c.w("d4", "already checked") - 0.3, src: "fits" },
], EMAIL_D5);
const Pay: React.FC = () => <Act plan={plan} from="d4" to="d5" sounds={c => { const g = geoD(c), T = twistTimes(c, "d5", EMAIL_D5); return <>
  <Sfx name="whoosh" at={0} volume={0.5} />
  {g.cuts.slice(1, -1).map((k, i) => <Sfx key={i} name="whoosh" at={k.at - 0.08} volume={0.3} />)}
  <TakeSounds clipId={RUN} segs={g.hunt} />
  <TakeSounds clipId={RUN} segs={g.pay} />
  <Sfx name="tick" at={c.w("d4", "already checked") + 0.1} volume={0.5} />
  {twistSounds(T)}
</>; }}>{c => {
  const g = geoD(c), T = twistTimes(c, "d5", EMAIL_D5);
  return <>
    <HuntAndPay c={c} id="d4" g={g} dblWord="Double-click" dblText={<>Double-click<br /><Mint>to pay.</Mint></>} />
    <Twist c={c} id="d5" T={T} potLabel="in her savings pot" />
  </>;
}}</Act>;

/* ------------------------------------------------------------ d6: reversible */
const Knew: React.FC = () => <Act plan={plan} from="d6" to="d6" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.5} />
  <Sfx name="pop" at={c.w("d6", "One tap") - 0.05} volume={0.5} />
</>}>{c => <CraveProof c={c} id="d6" items={[
  { at: 0, kind: "twodays" }, { at: c.w("d6", "One tap") - 0.05, kind: "release" },
]} />}</Act>;

/* ------------------------------------------------------------ d7: the coach underneath */
const Coach: React.FC = () => <Act plan={plan} from="d7" to="d7" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.5} />
  <Sfx name="whoosh" at={c.w("d7", "Ask it anything") - 0.1} volume={0.4} />
  <Sfx name="pop" at={c.w("d7", "built on Gemini")} volume={0.5} />
</>}>{c => {
  const w = (s: string) => c.w("d7", s) - 0.05;
  const ask = w("Ask it anything"), never = w("Gemini never"), ml = c.w("d7", "And eight machine-learning") - 0.3, fc = c.w("d7", "forecast her balance") - 0.2;
  // from the Vara page on: the home shell before it has the old bottom navigation (re-recorded in phase 2)
  const today: Seg[] = [{ from: 0, to: ask, a: Eo1("today.mp4", "vara-open") + 0.4, b: Eo1("today.mp4", "vara-open") + 3, anchor: "hold", maxRate: 3 }];
  const chatEnd = clip("v1:chat.mp4").seconds;
  const chat: Seg[] = [
    { from: ask, to: never, a: Eo1("chat.mp4", "typing-start") - 0.3, b: Eo1("chat.mp4", "how-open") + 0.8, maxRate: 4 },
    { from: never, to: ml, a: Eo1("chat.mp4", "how-open") + 0.8, b: chatEnd, anchor: "start", maxRate: 1.5 },
  ];
  return <>
    <Win from={0} to={ask}>
      <Whip at={0}><PhoneTake clipId="v1:today.mp4" segs={today} x={PX} /></Whip>
      <At x={L.x} y={300} w={L.w}>
        <Say at={0} size={150}>Vara</Say>
        <Say at={0.25} size={64} color={C.heroMeta} style={{ marginTop: 18 }}>a money coach<br />inside S-mobiili</Say>
      </At>
      <TakeLabels clipId="v1:today.mp4" segs={today} extra={[AINO_LABEL]} />
    </Win>
    <Win from={ask} to={ml}>
      <Whip at={ask}><PhoneTake clipId="v1:chat.mp4" segs={chat} x={PX} /></Whip>
      <Win from={ask} to={never}><Three items={[
        { at: ask, text: "Ask anything." }, { at: w("cards"), text: <>Answers as <Mint>cards.</Mint></> },
      ]} /></Win>
      <Win from={never} to={ml}><Three items={[
        { at: never, text: <>Gemini: <Mint>no maths.</Mint></> }, { at: w("An engine"), text: <>Engine <Mint>computes.</Mint></> },
        { at: w("a guard"), text: <>Guard <Mint>checks.</Mint></> },
      ]} /></Win>
      <TakeLabels clipId="v1:chat.mp4" segs={chat} extra={["Waiting time shortened"]} />
    </Win>
    {/* over the chat footage only when that chat was answered by Gemini */}
    <Win from={0} to={chatIsGemini() ? ml : ask}><CreditBadge which="coach" at={w("built on Gemini")} y={720} /></Win>
    {/* the models: VIZ's map of the customers, then a flash of the forecast (each starts a little early: they fade in) */}
    <MlSlot kind="map" from={ml} to={fc} />
    <MlSlot kind="forecast" from={fc} to={c.end("d7")} skip={1.0} />
  </>;
}}</Act>;
const Eo1 = (file: string, label: string) => clip(`v1:${file}`).events!.find(e => e.label === label)!.t;

/* ------------------------------------------------------------ d8: the motto */
const End: React.FC = () => <Act plan={plan} from="d8" to="d8" sounds={() => <Sfx name="whoosh" at={0} volume={0.4} />}>
  {c => <Whip at={0}><Close c={c} id="d8" addresses={[APP_URL]} hitAt={c.we("d8", "a time") + 0.05} /></Whip>}
</Act>;

const abs = (id: string, sub: string) => plan.scenes.find(k => k.id === id)!.vo + word(id, sub);
const absEnd = (id: string, sub: string) => plan.scenes.find(k => k.id === id)!.vo + wordEnd(id, sub);
export const DemoV2: React.FC<{ plan?: unknown }> = () => <Stage>
  <Feeling /><Build /><More /><Pay /><Knew /><Coach /><End />
  <Mix plan={plan} cue={{
    returnAt: abs("d5", "plot twist") - 0.04, montage: [[plan.scenes[2].start, plan.scenes[2].end]],
    liftAt: abs("d2", "A whole store") - 0.05, lift: "lift 1", back: "peak",
    mid: { from: plan.scenes[4].vo - 0.3, to: absEnd("d5", "And then") + 0.06, section: "groove 2" },
  }} />
</Stage>;
export const DEMO_FRAMES = demoPlan.frames;
void Sequence; void f; void Icon; void Proof; void speedLabel; void resolve; void Count; void Eo; void FitsText; void LIVE_LABEL; void Montage;
