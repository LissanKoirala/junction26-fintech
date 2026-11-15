/* Version 2 pitch video (p1–p12), one continuous timeline. Times come from audio.json (narration) and footage.json /
 * src/timeline.json (events); figures only from DECK.md / SOURCES.md. */
import React from "react";
import { CravePill } from "../kit";
import { chatIsGemini, Eo } from "./acts";
import { clip, sentence, word, wordEnd } from "./data";
import { HuntAndPay, Parcel, payGeometry, ThrillCut, ThrillCuts, ThrillOpen, thrillSounds, Twist, twistSounds, twistTimes } from "./twist";
import { pitchPlan } from "./timeline";
import { Mix } from "./Mix";
import { DATA_LABEL, Stage, useRamp, useSpring } from "./kit";
import {
  Act, AINO_LABEL, APP_URL, At, BuildPanel, buildSegs, C, chipSounds, Clock, Close, Count, E, FitsText, Flash, Icon, L, Labels, LIVE_LABEL, Mint,
  Montage, montageSounds, NothingShips, PayPhone, PhoneTake, PotCount, PX, RUN, Say, Seg, Sfx, SIM_LABEL, TakeLabels, TakeSounds, Three,
  WALLET_LABEL, CreditBadge, Whip, Win, whenShown, useT, ease,
} from "./acts";
import { CraveProof } from "./proofs";
import { MlSlot } from "./mlslot";

const plan = pitchPlan;
const ev1 = (file: string, label: string) => clip(`v1:${file}`).events!.find(e => e.label === label)!.t;
const len1 = (file: string) => clip(`v1:${file}`).seconds;

/* ------------------------------------------------------------ p1: the thrill, and why it matters */
const ColdOpen: React.FC = () => <Act plan={plan} from="p1" to="p1" sounds={c => thrillSounds(c, "p1", "needed")}>
  {c => <ThrillOpen c={c} id="p1" ending="needed" />}
</Act>;
const SproutBig: React.FC = () => <svg width={190} height={190} viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="24" fill={C.mint} /><path d="M24 36V22M24 24c0-6 4-9 10-9 0 6-4 9-10 9zM24 26c0-5-3-8-9-8 0 5 3 8 9 8z" fill={C.deep} />
</svg>;

/* ------------------------------------------------------------ p2: the data, one number per screen */
const Num: React.FC<{ at: number; value: React.ReactNode; label: React.ReactNode; size?: number }> = ({ at, value, label, size = 300 }) =>
  <At x={960} y={size > 250 ? 250 : 300} center w={1800}>
    <Say at={at} size={size} color={C.mint} from="scale">{value}</Say>
    <Say at={at + 0.1} size={68} style={{ marginTop: 24 }}>{label}</Say>
  </At>;
const Data: React.FC = () => <Act plan={plan} from="p2" to="p2" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.4} />
  {dataCuts(c).map((t, i) => i ? <Sfx key={i} name="tick" at={t} volume={0.55} /> : null)}
</>}>{c => {
  const t = dataCuts(c);
  const end = c.end("p2");
  const screens: React.ReactNode[] = [
    <Num at={t[0]} value={<><Count at={t[0]} to={3.6} decimals={1} dur={0.5} /> million</>} size={230} label="transactions in the challenge data" />,
    <Num at={t[1]} value={<Count at={t[1]} to={5100} dur={0.5} group=" " />} label="customers" />,
    <Num at={t[2]} value={<><Count at={t[2]} to={69} dur={0.5} />%</>} label={<>went below zero at least once</>} />,
    <Num at={t[3]} value={<><Count at={t[3]} to={80} dur={0.5} />%</>} label={<>of 18–24-year-olds</>} />,
    <Num at={t[4]} value={<><Count at={t[4]} to={96} dur={0.5} />%</>} label={<>of dips: 20+ days after payday</>} />,
    <At x={960} y={380} center w={1800}><Say at={t[5]} size={170} from="scale">The dips are <Mint>tiny.</Mint></Say></At>,
    <Num at={t[6]} value={<><Count at={t[6]} to={39} dur={0.5} /> €</>} label="a typical everyday purchase" />,
    <Tokens at={t[7]} />,
  ];
  return <>{screens.map((s, i) => <Win key={i} from={t[i]} to={t[i + 1] ?? end}><Whip at={t[i]} dir={i % 2 ? -1 : 1}>{s}</Whip></Win>)}
    <Labels items={[DATA_LABEL]} />
  </>;
}}</Act>;
const dataCuts = (c: Clock) => [0, c.w("p2", "five thousand") - 0.05, c.w("p2", "seven in ten") - 0.05, c.n("p2", 1) - 0.05, c.n("p2", 2) - 0.05, c.n("p2", 3) - 0.05, c.n("p2", 4) - 0.05, c.n("p2", 5) - 0.05];
/** 5.9 purchases of 39 €: five whole tokens and one nine-tenths full, popping in one after another. */
const Tokens: React.FC<{ at: number }> = ({ at }) => {
  const t = useT();
  return <At x={960} y={260} center w={1800}>
    <div style={{ display: "flex", justifyContent: "center", gap: 26 }}>
      {[1, 1, 1, 1, 1, 0.9].map((fill, i) => {
        const k = ease(Math.max(0, Math.min(1, (t - at - i * 0.09) / 0.25)));
        return <div key={i} style={{ width: 210, height: 210, borderRadius: 210, border: `5px solid ${C.mint}`, position: "relative", overflow: "hidden", transform: `scale(${0.3 + 0.7 * k})`, opacity: k }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${fill * 100}%`, background: "rgba(145,250,155,.28)" }} />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 64, fontWeight: 800, color: "#fff" }}>39 €</div>
        </div>;
      })}
    </div>
    <Say at={at + 0.3} size={68} style={{ marginTop: 60 }}>The deepest dip in two years: <Mint>5.9</Mint></Say>
  </At>;
};

/* ------------------------------------------------------------ p3: a craving problem; keep the money */
const Bar: React.FC<{ at: number; pct: number; label: string; y: number; strong?: boolean }> = ({ at, pct, label, y, strong }) => {
  const k = ease(useRamp(at, at + 0.7));
  const W = 1300;
  return <div style={{ position: "absolute", left: 300, top: y, width: W + 300 }}>
    <Say at={at - 0.05} size={52} weight={700} color={strong ? "#fff" : C.heroMeta}>{label}</Say>
    <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 30 }}>
      <div style={{ width: W, height: 70, borderRadius: 14, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct * k}%`, height: "100%", background: strong ? C.mint : "rgba(145,250,155,.45)" }} />
      </div>
      <span style={{ fontSize: 110, fontWeight: 800, color: strong ? C.mint : "#fff", fontVariantNumeric: "tabular-nums", opacity: k > 0 ? 1 : 0 }}><Count at={at} to={pct} dur={0.7} />%</span>
    </div>
  </div>;
};
const Problem: React.FC = () => <Act plan={plan} from="p3" to="p3" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.4} />
  <Sfx name="tick" at={c.w("p3", "seventy-two") - 0.05} volume={0.6} />
  <Sfx name="tick" at={c.w("p3", "fifteen") - 0.05} volume={0.6} />
</>}>{c => {
  const n = (i: number) => c.n("p3", i) - 0.05;
  const s72 = c.w("p3", "seventy-two") - 0.05, s15 = c.w("p3", "fifteen") - 0.05;
  return <>
    <Win from={0} to={n(2)}>
      <At x={960} y={300} center w={1800}>
        <Say at={0} size={150} color={C.heroMeta}>Not a <span style={{ textDecoration: "line-through", textDecorationThickness: 12 }}>maths</span> problem.</Say>
        <Say at={n(1)} size={170} style={{ marginTop: 30 }}>A <Mint>craving</Mint> problem.</Say>
      </At>
    </Win>
    <Win from={n(2)} to={n(4)}>
      <Whip at={n(2)}>
        <At x={960} y={330} center w={1800}><Say at={n(2)} out={s72} size={130}>Trim everyday<br />extras by <Mint>5%</Mint>.</Say></At>
        <Win from={s72} to={n(4)}><Say at={s72} size={64} style={{ position: "absolute", left: 300, top: 220 }} weight={700}>Fewer days below zero, if you…</Say></Win>
        <Win from={s72} to={n(4)}><Bar at={s72} pct={72} label="…keep the money" y={360} strong /></Win>
        <Win from={s15} to={n(4)}><Bar at={s15} pct={15} label="…spend it by payday" y={620} /></Win>
      </Whip>
      <Labels items={[DATA_LABEL, "A replay of two years of data, all else unchanged. Not a prediction."]} />
    </Win>
    <Win from={n(4)} to={c.end("p3")}>
      <Whip at={n(4)}><At x={960} y={300} center w={1800}>
        <Say at={n(4)} size={120} color={C.heroMeta}>Skipping isn’t enough.</Say>
        <Say at={n(5)} size={170} style={{ marginTop: 30 }}>The money has to <Mint>stay.</Mint></Say>
      </At></Whip>
    </Win>
  </>;
}}</Act>;

/* ------------------------------------------------------------ p4: it wants the hunt; we feed it. Crave mode. */
const Feed: React.FC = () => <Act plan={plan} from="p4" to="p4" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.4} />
  {["It wants the hunt", "The scroll", "The buy button"].map(k => <Sfx key={k} name="whoosh" at={c.w("p4", k) - 0.12} volume={0.35} />)}
  <Sfx name="pop" at={c.w("p4", "The buy button") + 0.1} volume={0.6} />
  <Sfx name="impact" at={c.w("p4", "Crave mode") - 0.04} volume={0.8} />
</>}>{c => {
  const w = (s: string) => c.w("p4", s) - 0.05;
  const parcel = w("doesn't want the parcel") - 0.3, hunt = w("It wants the hunt"), what = w("So what if"), fight = w("We don't fight"), cm = c.w("p4", "Crave mode") - 0.04;
  const cuts: ThrillCut[] = [
    { at: hunt, to: w("The scroll"), kind: "compare", word: <>The <Mint>hunt.</Mint></>, size: 190 },
    { at: w("The scroll"), to: w("The buy button"), kind: "scroll", word: <>The <Mint>scroll.</Mint></>, size: 190 },
    { at: w("The buy button"), to: what, kind: "buy", word: <>The <Mint>buy button.</Mint></>, size: 170 },
  ];
  return <>
    <Win from={0} to={parcel}><At x={960} y={260} center w={1800}>
      <PieOff at={0} />
      <Say at={0} size={110} style={{ marginTop: 30 }}>Nobody stops a craving<br />with a <Mint>pie chart.</Mint></Say>
    </At></Win>
    <Win from={parcel} to={hunt}>
      <ParcelNo at={parcel} />
      <At x={L.x} y={330} w={900}><Say at={parcel} size={130}>A craving doesn’t want<br /><Mint>the parcel.</Mint></Say></At>
    </Win>
    <ThrillCuts cuts={cuts} />
    <Flash at={w("The buy button")} len={0.25} />
    <Win from={what} to={fight}><At x={960} y={300} center w={1800}>
      <Say at={what} size={140} from="scale">All of that,</Say>
      <Say at={w("keep the money")} size={170} color={C.mint} from="scale" style={{ marginTop: 20 }}>and keep the money?</Say>
    </At></Win>
    <Win from={fight} to={cm}><At x={960} y={340} center w={1800}>
      <Say at={fight} out={w("We feed it")} size={170}>Don’t fight it.</Say>
      <Say at={w("We feed it")} size={230} color={C.mint} from="scale">Feed it.</Say>
    </At></Win>
    <Win from={cm} to={c.end("p4")}>
      <At x={960} y={250} center w={1800}>
        <Say at={cm} size={250} from="scale">Crave <Mint>mode</Mint></Say>
        <Say at={cm + 0.25} size={60} color={C.heroMeta} style={{ marginTop: 20 }}>Helping you save money, a craving at a time.</Say>
      </At>
      <Flash at={cm} />
    </Win>
  </>;
}}</Act>;
const ParcelNo: React.FC<{ at: number }> = ({ at }) => {
  const k = useSpring(at, 11, 0.55), x = ease(useRamp(at + 0.5, at + 0.8));
  return <div style={{ position: "absolute", left: 1200, top: 300, transform: `translateY(${(1 - k) * -500}px)` }}>
    <Parcel size={420} />
    <svg width={420} height={360} style={{ position: "absolute", left: 0, top: 0 }}><path d={`M 30 20 L ${30 + 360 * x} ${20 + 320 * x}`} stroke={C.mint} strokeWidth={22} strokeLinecap="round" /></svg>
  </div>;
};
const CravePillIn: React.FC<{ at: number }> = ({ at }) => { const k = useSpring(at, 12, 0.5); const t = useT(); return t < at ? null : <div style={{ display: "inline-block", transform: `scale(${0.5 + 0.5 * k})`, opacity: Math.min(1, k * 2) }}><CravePill scale={1.8} /></div>; };
const PieOff: React.FC<{ at: number }> = ({ at }) => {
  const k = useSpring(at, 12, 0.5), x = ease(useRamp(at + 0.6, at + 0.9));
  return <svg width={200} height={200} viewBox="0 0 200 200" style={{ transform: `scale(${0.5 + 0.5 * k})` }}>
    <circle cx="100" cy="100" r="80" fill="rgba(255,255,255,.12)" /><path d="M100 100 L100 20 A80 80 0 0 1 176 125 Z" fill={C.heroMeta} />
    <path d={`M 30 30 L ${30 + 140 * x} ${30 + 140 * x}`} stroke={C.mint} strokeWidth={12} strokeLinecap="round" />
  </svg>;
};

/* ------------------------------------------------------------ p5: Aino, the build in full, then three more shops */
const Build: React.FC = () => <Act plan={plan} from="p5" to="p5" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.45} />
  {chipSounds(c, "p5")}
  <Sfx name="tick" at={tvP5(c)} volume={0.6} />
  <Sfx name="impact" at={c.w("p5", "almost instantly") - 0.04} volume={0.4} />
  {montageSounds(c, "p5", "A new shop")}
</>}>{c => {
  const w = (s: string) => c.w("p5", s) - 0.05;
  const tv = tvP5(c), mon = c.w("p5", "Sushi") - 0.06;
  const sv = E("shop-visible");
  // typing on "new sneakers"; the tap at the end of "She tells Vara"; the hunting animation over the hold after it, so
  // the shop opens on "almost instantly"; the cards stream in under "Its name. Its brands. Ten products. …"
  const tPaint = w("almost instantly"), tType = w("new sneakers") - 0.2;
  const tSubmit = Math.max(c.we("p5", "She tells Vara") + 0.05, tPaint - (E("build-first-paint") - E("submitted")));
  const segs = [{ from: 0, to: tType, a: Math.max(0, E("typing-start") - 1.0), b: Math.max(0, E("typing-start") - 0.2), anchor: "end", maxRate: 1 } as Seg,
    ...buildSegs(tType, tSubmit, tPaint, tv, mon, sv + (E("product-open") - sv) * 0.45)].filter(s => s.to > s.from);
  return <>
    <Win from={0} to={mon}>
      <Whip at={0}><PhoneTake clipId={RUN} segs={segs} x={PX} glowAt={tv} /></Whip>
      <BuildPanel c={c} id="p5" segs={segs} watchAt={tSubmit} chipsTo={w("None of it")} pulseAt={w("Gemini builds")} />
      <At x={L.x} y={300} w={L.w}>
        <Say at={0} out={w("payday")} size={170} from="scale">Meet <Mint>Aino.</Mint></Say>
        <Say at={w("new sneakers")} out={w("payday")} size={90} color={C.heroMeta} style={{ marginTop: 20 }}>wants new sneakers</Say>
        <Say at={w("payday")} out={w("She tells Vara")} size={120}>Payday:<br /><Mint>two weeks</Mint> away.</Say>
      </At>
      <At x={L.x} y={565} w={L.w}>
        <Say at={w("She tells Vara")} out={tPaint} size={130}>She tells <Mint>Vara.</Mint></Say>
        <Say at={tPaint + (Eo("shop-open") ?? E("build-first-paint")) - E("build-first-paint")} out={w("Its name")} size={110}><Mint>Almost instantly,</Mint><br />a whole shop.</Say>
        <Say at={w("None of it")} size={100}>None of it<br /><Mint>existed.</Mint></Say>
        <Say at={w("none of it is")} size={56} color={C.heroMeta} style={{ marginTop: 30 }}>Invented. Not a real retailer.</Say>
      </At>
      <TakeLabels clipId={RUN} segs={segs} extra={[AINO_LABEL]} />
    </Win>
    <Montage c={c} id="p5" from={mon} to={c.end("p5")} lastWord="A new shop" />
  </>;
}}</Act>;
/** The shop finishes streaming as the list of what was generated ends ("Photos to match."). */
const tvP5 = (c: Clock) => Math.min(c.we("p5", "Photos to match") + 0.1, c.w("p5", "almost instantly") - 0.05 + E("shop-visible") - E("build-first-paint"));

/* ------------------------------------------------------------ p6–p7: the hunt, the pay ritual, the beat, the plot twist */
const EMAIL_P7 = "The confirmation lands";
const geoP = (c: Clock) => payGeometry(c, "p6", "p7", [
  { at: 0, src: "grid", word: <>Do what she<br /><Mint>came to do.</Mint></> },
  { at: c.w("p6", "Hunt") - 0.05, src: "scroll", word: "Hunt." },
  { at: c.w("p6", "Compare") - 0.05, src: "product", word: "Compare." },
  { at: c.w("p6", "Add to basket") - 0.05, src: "reviews", word: <>Add to <Mint>basket.</Mint></> },
  { at: c.w("p6", "Check out") - 0.05, src: "checkout", word: "Check out." },
  { at: c.w("p6", "already checked") - 0.3, src: "fits" },
], EMAIL_P7);
const Pay: React.FC = () => <Act plan={plan} from="p6" to="p7" sounds={c => { const g = geoP(c), T = twistTimes(c, "p7", EMAIL_P7); return <>
  <Sfx name="whoosh" at={0} volume={0.45} />
  {g.cuts.slice(1, -1).map((k, i) => <Sfx key={i} name="whoosh" at={k.at - 0.08} volume={0.3} />)}
  <TakeSounds clipId={RUN} segs={g.hunt} /><TakeSounds clipId={RUN} segs={g.pay} />
  <Sfx name="tick" at={g.fits + 0.1} volume={0.5} />
  {twistSounds(T)}
</>; }}>{c => {
  const g = geoP(c), T = twistTimes(c, "p7", EMAIL_P7);
  return <>
    <HuntAndPay c={c} id="p6" g={g} dblWord="Double-click" dblText={<>Double-<Mint>click.</Mint></>} />
    <Twist c={c} id="p7" T={T} potLabel="in her Crave pot" />
  </>;
}}</Act>;

/* ------------------------------------------------------------ p8: in on it */
const InOnIt: React.FC = () => <Act plan={plan} from="p8" to="p8" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.4} />
  {railCuts(c).map((r, i) => <Sfx key={i} name="pop" at={r.at} volume={0.45} />)}
</>}>{c => <CraveProof c={c} id="p8" head={{ a: 0, b: railCuts(c)[0].at, text: <>And it’s<br /><Mint>reversible.</Mint></> }} items={railCuts(c)} />}</Act>;
const railCuts = (c: Clock) => ([
  { at: c.w("p8", "two days"), kind: "twodays" }, { at: c.w("p8", "One tap"), kind: "release" }, { at: c.w("p8", "never sets aside"), kind: "cap" },
  { at: c.w("p8", "simulated"), kind: "sim" }, { at: c.w("p8", "wallet button"), kind: "wallet" },
] as const).map(r => ({ at: r.at - 0.05, kind: r.kind }));

/* ------------------------------------------------------------ p9: the full coach */
const Coach: React.FC = () => <Act plan={plan} from="p9" to="p9" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.4} />
  {[1, 2, 6, 7, 8].map(i => <Sfx key={i} name="whoosh" at={c.n("p9", i) - 0.12} volume={0.35} />)}
</>}>{c => {
  const n = (i: number) => c.n("p9", i) - 0.05;
  const vo = ev1("today.mp4", "vara-open");
  const today: Seg[] = [{ from: n(1), to: n(2), a: 0.4, b: vo + 4.5, maxRate: 2.5 }];
  const chat: Seg[] = [
    { from: n(2), to: n(3), a: ev1("chat.mp4", "typing-start") - 0.3, b: ev1("chat.mp4", "sent") + 0.2, maxRate: 2.5 },
    { from: n(3), to: n(4), a: ev1("chat.mp4", "sent") + 0.2, b: ev1("chat.mp4", "how-open") + 1, maxRate: 3 },
    { from: n(4), to: n(6), a: ev1("chat.mp4", "how-open") + 1, b: len1("chat.mp4"), anchor: "start", maxRate: 1.5 },
  ];
  const whatif: Seg[] = [{ from: n(6), to: n(7), a: ev1("whatif.mp4", "changed") - 1, b: ev1("whatif.mp4", "changed-2") + 1, maxRate: 3 }];
  const checkin: Seg[] = [{ from: n(7), to: n(8), a: 0.3, b: ev1("checkin.mp4", "slide-4"), maxRate: 3 }];
  const fin: Seg[] = [{ from: n(8), to: c.end("p9"), a: ev1("finnish.mp4", "switched") - 1, b: ev1("finnish.mp4", "chat-tab") + 1, maxRate: 2 }];
  const shot = (file: string, segs: Seg[], from: number, to: number, text: React.ReactNode, extra: (string | null)[] = []) =>
    <Win from={from} to={to}>
      <Whip at={from}><PhoneTake clipId={`v1:${file}`} segs={segs} x={PX} /></Whip>
      {text}
      <TakeLabels clipId={`v1:${file}`} segs={segs} extra={extra} />
    </Win>;
  return <>
    <Win from={0} to={n(1)}>
      <At x={960} y={300} center w={1800}><Say at={0} size={140} from="scale">Crave mode sits on<br />a <Mint>full coach.</Mint></Say></At>
      <CreditBadge which="coach" at={c.w("p9", "built on Gemini") - 0.05} y={660} center />
    </Win>
    {shot("today.mp4", today, n(1), n(2), <At x={L.x} y={260} w={L.w}>
      <Say at={n(1)} out={c.w("p9", "one number") - 0.05} size={110}>Inside<br /><Mint>S-mobiili.</Mint></Say>
      <Win from={c.w("p9", "one number") - 0.05} to={n(2)}>
        <Say at={c.w("p9", "one number") - 0.05} size={240} color={C.mint}><Count at={c.w("p9", "one number")} to={37} dur={0.6} /> €</Say>
        <Say at={c.w("p9", "one number") + 0.1} out={c.w("p9", "after rent") - 0.05} size={60}>safe to spend until Sunday</Say>
        <Say at={c.w("p9", "after rent") - 0.05} size={60}>after rent, bills and a cushion</Say>
      </Win>
    </At>, [AINO_LABEL])}
    {shot("chat.mp4", chat, n(2), n(6), <>
      <Win from={n(2)} to={n(4)}><Three items={[
        { at: n(2), text: "Ask anything." }, { at: n(3), text: <>Answers as <Mint>cards.</Mint></> },
        { at: c.w("p9", "every number") - 0.05, text: <>Working <Mint>shown.</Mint></> },
      ]} /></Win>
      <Win from={n(4)} to={n(6)}><Three items={[
        { at: n(4), text: <>Gemini: <Mint>no maths.</Mint></> }, { at: c.w("p9", "An engine") - 0.05, text: <>Engine <Mint>computes.</Mint></> },
        { at: c.w("p9", "a guard") - 0.05, text: <>Guard <Mint>checks.</Mint></> },
      ]} /></Win>
      {chatIsGemini() ? <CreditBadge which="coach" at={n(2)} y={720} /> : null}
    </>, ["Waiting time shortened"])}
    {shot("whatif.mp4", whatif, n(6), n(7), <At x={L.x} y={360} w={L.w}><Say at={n(6)} size={130}>What if?<br /><Mint>Try it first.</Mint></Say></At>)}
    {shot("checkin.mp4", checkin, n(7), n(8), <At x={L.x} y={360} w={L.w}><Say at={n(7)} size={120}>The story of<br /><Mint>your week.</Mint></Say></At>)}
    {shot("finnish.mp4", fin, n(8), c.end("p9"), <At x={L.x} y={360} w={L.w}><Say at={n(8)} size={130}>English.<br /><Mint>Suomi.</Mint></Say></At>)}
  </>;
}}</Act>;

/* ------------------------------------------------------------ p10: eight models, tested honestly */
const ModelScreen: React.FC<{ at: number; name: string; value: string; base: string; what: string }> = ({ at, name, value, base, what }) =>
  <At x={960} y={220} center w={1800}>
    <Say at={at} size={64} color={C.mint} weight={700}>{name}</Say>
    <Say at={at + 0.05} size={250} from="scale" style={{ marginTop: 14 }}>{value}</Say>
    <Say at={at + 0.15} size={70} color={C.heroMeta} style={{ marginTop: 10 }}>vs {base} for the baseline</Say>
    <Say at={at + 0.2} size={48} color={C.heroMeta} weight={600} style={{ marginTop: 22 }}>{what}</Say>
  </At>;
const Models: React.FC = () => <Act plan={plan} from="p10" to="p10" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.4} />
  {modelCuts(c).slice(1).map((t, i) => <Sfx key={i} name="whoosh" at={t - 0.1} volume={0.35} />)}
</>}>{c => {
  const [t0, map, look, fc, warn, tested, two, six] = modelCuts(c), end = c.end("p10");
  const models: Seg[] = [{ from: six, to: end, a: ev1("models.mp4", "card-open") - Math.max(1, end - six) + 0.5, b: ev1("models.mp4", "card-open") + 1.5, maxRate: 2 }];
  const ML = "Model results · each tested against a simple baseline";
  return <>
    <Win from={t0} to={map}><At x={960} y={200} center w={1800}>
      <Say at={t0} size={380} color={C.mint} from="scale">8</Say><Say at={t0 + 0.1} size={80}>machine-learning models</Say>
    </At><Labels items={[DATA_LABEL]} /></Win>
    <MlSlot kind="map" from={map} to={look} />
    <MlSlot kind="futures" from={look} to={fc} />
    <MlSlot kind="forecast" from={fc} to={warn} />
    <MlSlot kind="risk" from={warn} to={tested} />
    <MlSlot kind="scorecard" from={tested} to={six} caption={false} />
    <Win from={six} to={end}>
      <Whip at={six}><PhoneTake clipId="v1:models.mp4" segs={models} x={PX} /></Whip>
      <At x={L.x} y={300} w={L.w}>
        <Say at={six} size={240} color={C.mint}>6</Say>
        <Say at={six + 0.1} size={96}>experimental.</Say>
        <Say at={c.w("p10", "the app says so") - 0.05} size={64} color={C.heroMeta} style={{ marginTop: 30 }}>The app says so.</Say>
      </At>
      <TakeLabels clipId="v1:models.mp4" segs={models} extra={[ML]} />
    </Win>
  </>;
}}</Act>;
const modelCuts = (c: Clock) => [0, c.w("p10", "One maps"), c.w("p10", "One finds"), c.w("p10", "One forecasts"), c.w("p10", "one warns"),
  c.w("p10", "We tested"), c.w("p10", "Two clearly win"), c.w("p10", "Six are labelled")].map((t, i) => i === 0 ? t : i <= 5 ? t - 0.3 : t - 0.05);

/* ------------------------------------------------------------ p11: fit and the five criteria */
const Fit: React.FC = () => <Act plan={plan} from="p11" to="p11" sounds={c => <>
  <Sfx name="whoosh" at={0} volume={0.4} />
  <Sfx name="whoosh" at={c.n("p11", 3) - 0.12} volume={0.35} />
  {[4, 5, 6, 7].map(i => <Sfx key={i} name="impact" at={c.n("p11", i) - 0.05} volume={0.25} />)}
</>}>{c => {
  const n = (i: number) => c.n("p11", i) - 0.05;
  const vo = ev1("today.mp4", "vara-open");
  const today: Seg[] = [{ from: 0, to: n(3), a: 0.3, b: vo + 3, maxRate: 2 }];
  const more: Seg[] = [{ from: n(3), to: n(4), a: ev1("more.mp4", "goal") - 0.2, b: ev1("more.mp4", "connect") + 2, maxRate: 3 }];
  const crit = [
    { k: "Financial literacy", a: <>Every answer shows<br />its <Mint>working.</Mint></> },
    { k: "Original AI", a: <>A shop that<br /><Mint>sells nothing.</Mint></> },
    { k: "Mobile UX", a: <>Clear on mobile.<br /><Mint>Two languages.</Mint></> },
    { k: "Feasible", a: <>Live <Mint>right now.</Mint></> },
  ];
  return <>
    <Win from={0} to={n(3)}>
      <Whip at={0}><PhoneTake clipId="v1:today.mp4" segs={today} x={PX} /></Whip>
      <At x={L.x} y={260} w={L.w}>
        <Say at={0} size={110}>Built to slot into<br /><Mint>S-mobiili.</Mint></Say>
        <Say at={n(1)} size={80} style={{ marginTop: 50 }}>One engine.</Say>
        <Say at={n(2)} size={80} style={{ marginTop: 14 }}>One guarded<br />chat endpoint.</Say>
      </At>
      <TakeLabels clipId="v1:today.mp4" segs={today} extra={[AINO_LABEL]} />
    </Win>
    <Win from={n(3)} to={n(4)}>
      <Whip at={n(3)}><PhoneTake clipId="v1:more.mp4" segs={more} x={PX} /></Whip>
      <At x={L.x} y={300} w={L.w}>
        <Say at={n(3)} size={110}>Säästäjä.</Say>
        <Say at={c.w("p11", "other banks") - 0.05} size={110} style={{ marginTop: 10 }}>Open banking.</Say>
        <Say at={c.w("p11", "both mocked") - 0.05} size={64} color={C.warnBg} style={{ marginTop: 40 }}>Both mocked here.</Say>
      </At>
      <TakeLabels clipId="v1:more.mp4" segs={more} extra={["Säästäjä hand-off and open banking: mocks"]} />
    </Win>
    {crit.map((k, i) => <Win key={k.k} from={n(4 + i)} to={i < 3 ? n(5 + i) : c.end("p11")}>
      <Whip at={n(4 + i)} dir={i % 2 ? -1 : 1}><At x={960} y={300} center w={1800}>
        <Say at={n(4 + i)} size={56} color={C.mint} weight={700} style={{ letterSpacing: 4, textTransform: "uppercase" }}>{k.k}</Say>
        <Say at={n(4 + i) + 0.05} size={140} from="scale" style={{ marginTop: 30 }}>{k.a}</Say>
        {i === 3 ? <Say at={n(7) + 0.2} size={44} color={C.heroMeta} weight={600} style={{ marginTop: 40 }}>{APP_URL}</Say> : null}
      </At></Whip>
    </Win>)}
  </>;
}}</Act>;

/* ------------------------------------------------------------ p12: the motto */
const End: React.FC = () => <Act plan={plan} from="p12" to="p12" sounds={() => <Sfx name="whoosh" at={0} volume={0.4} />}>
  {c => <Whip at={0}><Close c={c} id="p12" addresses={[APP_URL, `${APP_URL}/insights/`]} hitAt={c.we("p12", "a time") + 0.05} /></Whip>}
</Act>;

const P = (id: string) => plan.scenes.find(k => k.id === id)!;
const p5 = P("p5");
export const PitchV2: React.FC<{ plan?: unknown }> = () => <Stage>
  <ColdOpen /><Data /><Problem /><Feed /><Build /><Pay /><InOnIt /><Coach /><Models /><Fit /><End />
  <Mix plan={plan} cue={{
    returnAt: P("p7").vo + word("p7", "plot twist") - 0.04, montage: [[p5.vo + word("p5", "Sushi") - 0.1, p5.end]],
    liftAt: p5.vo + word("p5", "almost instantly") - 0.05, lift: "lift 2", back: "peak",
    mid: { from: P("p7").vo - 0.3, to: P("p7").vo + wordEnd("p7", "And then") + 0.06, section: "groove 2" },
  }} />
</Stage>;
export const PITCH_FRAMES = pitchPlan.frames;
void whenShown; void Mint; void sentence; void SproutBig;
