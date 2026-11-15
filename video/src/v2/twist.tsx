/* Version 2, script revision 2: the thrill opener (d1, p1; p4's "the hunt, the scroll, the buy button"), the hunt and
 * the pay ritual (d4, p6), and the plot twist (d5, p7). Every moment is keyed on a few words of the narration
 * (audio.json word timings) or on an event of the take (footage.json), never on a sentence number or a fixed second. */
import React from "react";
import { AbsoluteFill } from "remotion";
import {
  At, C, Clock, Count, E, ease, Eo, Flash, L, Labels, LIVE_LABEL, Mint, PhoneTake, priceNumber, PX, RUN, Say, Seg, Sfx, SIM_LABEL,
  TakeLabels, TakeSounds, useT, Whip, Win, paySegs, paySrcStart, PayPhone, WALLET_LABEL, FitsText,
} from "./acts";
import { clamp, useSpring } from "./kit";

const priceText = () => { const p = priceNumber(); return p ? p.v.toFixed(p.dec).replace(".", ",") : null; };

/* ------------------------------------------------------------ the parcel and the pot (drawn, no stock art) */
export const Parcel: React.FC<{ size?: number; dull?: number }> = ({ size = 300, dull = 0 }) =>
  <div style={{ width: size, height: size * 0.82, position: "relative", filter: `grayscale(${dull}) brightness(${1 - 0.35 * dull})` }}>
    <div style={{ position: "absolute", inset: 0, borderRadius: size * 0.06, background: "linear-gradient(160deg,#e2b77d,#c38e52)", boxShadow: "0 30px 70px rgba(0,0,0,.35)" }} />
    <div style={{ position: "absolute", left: "44%", width: "12%", top: 0, bottom: 0, background: "rgba(120,80,40,.45)" }} />
    <div style={{ position: "absolute", left: "8%", bottom: "12%", width: "34%", height: "20%", borderRadius: 6, background: "rgba(255,255,255,.85)" }} />
  </div>;

export const Pot: React.FC<{ size?: number; glow?: number }> = ({ size = 300, glow = 0 }) =>
  <div style={{ width: size, height: size * 0.9, position: "relative" }}>
    <div style={{ position: "absolute", left: "6%", right: "6%", top: 0, height: "16%", borderRadius: size, background: C.bright, opacity: 0.9 }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: "10%", bottom: 0, borderRadius: `${size * 0.12}px ${size * 0.12}px ${size * 0.3}px ${size * 0.3}px`,
      background: `linear-gradient(180deg, ${C.mint}, ${C.bright})`, boxShadow: `0 0 ${40 + 80 * glow}px rgba(0,235,90,${0.25 + 0.4 * glow})` }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: "42%", textAlign: "center", fontSize: size * 0.16, fontWeight: 900, color: C.deep, letterSpacing: -1 }}>SAVINGS</div>
  </div>;

const Coin: React.FC<{ x: number; at: number; fall: number; to: number; size?: number }> = ({ x, at, fall, to, size = 62 }) => {
  const t = useT() - at;
  if (t < 0 || t > fall + 0.05) return null;
  const p = clamp(t / fall), y = -120 + (to + 120) * p * p;
  return <div style={{ position: "absolute", left: x - size / 2, top: y, width: size, height: size, borderRadius: size, background: C.bright,
    border: `5px solid ${C.mint}`, display: "grid", placeItems: "center", fontSize: size * 0.5, fontWeight: 900, color: C.deep, transform: `rotate(${p * 280}deg)` }}>€</div>;
};

/* ------------------------------------------------------------ the thrill: "You scroll, you compare, you hit buy." */
/** Phone cuts of the take for a run of words: each word gets its own moment of the app. */
const thrillSource: Record<string, (d: number) => Omit<Seg, "from" | "to">> = {
  grid: d => ({ a: E("shop-visible") + 0.3, b: E("shop-visible") + 0.3 + Math.max(d, 0.5) * 1.5, maxRate: 2 }),
  scroll: () => ({ a: E("scroll-start"), b: E("scroll-end"), maxRate: 4 }),
  compare: () => ({ a: E("product-open"), b: E("added") - 0.6, maxRate: 4 }),
  buy: () => ({ a: E("added") - 0.6, b: E("added") + 0.35, anchor: "end", maxRate: 1.5 }),
  checkout: d => ({ a: E("checkout") + 0.3, b: E("checkout") + 0.3 + d, anchor: "start", maxRate: 1 }),
};
export type ThrillCut = { at: number; to: number; kind: keyof typeof thrillSource; word: React.ReactNode; size?: number };
export const thrillSegs = (cuts: ThrillCut[]): Seg[] => cuts.map(k => ({ from: k.at, to: k.to, ...thrillSource[k.kind](k.to - k.at) } as Seg));
export const ThrillCuts: React.FC<{ cuts: ThrillCut[] }> = ({ cuts }) => {
  const segs = thrillSegs(cuts);
  return <>
    {cuts.map((k, i) => <Win key={i} from={k.at} to={k.to}>
      <Whip at={k.at} dir={i % 2 ? -1 : 1}>
        <PhoneTake clipId={RUN} segs={segs} x={PX} push={k.kind === "checkout" ? [{ at: k.at, dur: 0.5, scale: 1.25, origin: "50% 96%" }] : k.kind === "buy" ? [{ at: k.at, dur: 0.4, scale: 1.18, origin: "50% 90%" }] : []} />
        <At x={L.x} y={360} w={L.w}><Say at={k.at} size={k.size ?? 200} from="left">{k.word}</Say></At>
      </Whip>
    </Win>)}
    {cuts.length ? <Win from={cuts[0].at} to={cuts[cuts.length - 1].to}><TakeLabels clipId={RUN} segs={segs} /></Win> : null}
  </>;
};

/** d1 / p1: the feeling, the let-down, and (d1) the question or (p1) "that money was needed". */
export const ThrillOpen: React.FC<{ c: Clock; id: string; ending: "question" | "needed" }> = ({ c, id, ending }) => {
  const w = (s: string) => c.w(id, s) - 0.05;
  const parcelAt = w("parcel arrives") - 0.15, goneAt = w("thrill is gone"), moneyAt = w("so is the money"), endAt = ending === "question" ? w("What if") : w("for a lot of people");
  const cuts: ThrillCut[] = [
    { at: w("want something"), to: w("You scroll"), kind: "grid", word: <>You want<br /><Mint>something.</Mint></>, size: 150 },
    { at: w("You scroll"), to: w("you compare"), kind: "scroll", word: "Scroll." },
    { at: w("you compare"), to: w("you hit buy"), kind: "compare", word: "Compare." },
    { at: w("you hit buy"), to: w("That rush"), kind: "buy", word: <Mint>Buy.</Mint>, size: 260 },
    { at: w("That rush"), to: parcelAt, kind: "checkout", word: <>The <Mint>rush.</Mint></>, size: 230 },
  ];
  const t = useT();
  const drop = useSpring(parcelAt, 10, 0.55);
  const dull = ease(clamp((t - goneAt) / 0.6));
  const price = priceText();
  return <>
    <Win from={0} to={cuts[0].at}><At x={960} y={330} center w={1800}><Say at={0} size={190} from="scale">You know<br /><Mint>the feeling.</Mint></Say></At></Win>
    <ThrillCuts cuts={cuts} />
    <Flash at={w("you hit buy")} len={0.25} />
    <Flash at={w("That rush")} len={0.3} color={C.mint} />
    {/* the let-down: the parcel lands, the thrill drains out of it, the money goes */}
    <Win from={parcelAt} to={endAt}>
      <div style={{ position: "absolute", left: 1180, top: 300 - (1 - drop) * 700, transform: `rotate(${(1 - drop) * -12}deg)` }}><Parcel size={420} dull={dull} /></div>
      <At x={L.x} y={300} w={980}>
        <Say at={parcelAt} out={goneAt} size={150}>The parcel<br /><Mint>arrives.</Mint></Say>
        <Say at={goneAt} out={moneyAt} size={150} color={C.heroMeta}>The thrill:<br />gone.</Say>
        <Say at={moneyAt} size={150} color={C.heroMeta}>The money:<br />gone.</Say>
        {price ? <Say at={moneyAt + 0.15} size={110} color="#ff8f8f" style={{ marginTop: 24, opacity: 1 - 0.6 * clamp((t - moneyAt - 0.8) / 0.8) }}>−{price} €</Say> : null}
      </At>
    </Win>
    <Win from={endAt} to={c.end(id)}>
      {ending === "question"
        ? <At x={960} y={250} center w={1800}>
            <Say at={endAt} size={170} from="scale">Keep <Mint>the thrill.</Mint></Say>
            <Say at={w("keep the money")} size={170} from="scale" style={{ marginTop: 30 }}>Keep <Mint>the money?</Mint></Say>
          </At>
        : <At x={960} y={290} center w={1800}>
            <Say at={endAt} size={120} color={C.heroMeta}>For a lot of people,</Say>
            <Say at={w("that money was needed")} size={170} from="scale" style={{ marginTop: 20 }}>that money<br /><Mint>was needed.</Mint></Say>
          </At>}
    </Win>
  </>;
};
export const thrillSounds = (c: Clock, id: string, ending: "question" | "needed") => {
  const w = (s: string) => c.w(id, s) - 0.05;
  return <>
    {["want something", "You scroll", "you compare", "you hit buy", "That rush"].map(k => <Sfx key={k} name="whoosh" at={w(k) - 0.08} volume={0.4} />)}
    <Sfx name="pop" at={w("you hit buy") + 0.05} volume={0.7} />
    <Sfx name="impact" at={w("parcel arrives") + 0.25} volume={0.35} />
    <Sfx name="shimmer" at={w(ending === "question" ? "What if" : "for a lot of people") - 0.1} volume={0.4} />
  </>;
};

/* ------------------------------------------------------------ the hunt and the pay ritual (d4, p6) */
type Src = "grid" | "scroll" | "product" | "reviews" | "basket" | "checkout" | "fits";
const huntSrc = (s: Src) => ({
  grid: () => { const sv = E("shop-visible"); return sv + (E("product-open") - sv) * 0.45; },
  scroll: () => E("scroll-start"),
  product: () => E("product-open") + 0.3,
  reviews: () => Eo("product-reviews") ?? E("product-open") + 1.5,
  basket: () => E("added") + 0.5,
  checkout: () => E("basket") + 0.8,
  fits: () => E("checkout") + 0.4,
}[s]());
/** cuts: the hunt's cuts, each on a word, with the part of the take it starts from; the last is the checkout's
 *  "free until payday" (FitsText). The pay sheet follows, timed backwards from the tick (paySegs). */
export const payGeometry = (c: Clock, pay: string, next: string, cuts: { at: number; src: Src; word?: React.ReactNode }[], emailWord: string) => {
  const tick = c.tick(pay);
  const fits = cuts[cuts.length - 1].at;
  const emailAt = c.w(next, emailWord) - 0.05;
  const twistEnd = Eo("twist") ?? E("tick") + 4;
  const p = paySegs(tick, emailAt);
  const last = p[p.length - 1];
  p[p.length - 1] = { ...last, b: Math.min(last.b, twistEnd - 0.3), anchor: "start" };   // never into the app's own twist screen
  const payFrom = Math.max(p[0].from, fits + 1.5);
  p[0] = { ...p[0], from: payFrom };
  const hunt: Seg[] = cuts.map((k, i) => {
    const to = i + 1 < cuts.length ? cuts[i + 1].at : payFrom;
    const a = huntSrc(k.src), b = i + 1 < cuts.length ? huntSrc(cuts[i + 1].src) : Math.max(a + 0.1, paySrcStart() - 0.1);
    return { from: k.at, to, a, b, maxRate: 3, anchor: i + 1 === cuts.length ? "start" : undefined } as Seg;
  });
  return { tick, cuts, fits, payFrom, emailAt, hunt, pay: p, sheetAt: payFrom + 0.15, revealAt: tick + ((Eo("reveal") ?? E("tick") + 1) - E("tick")) };
};
export type PayGeo = ReturnType<typeof payGeometry>;

export const HuntAndPay: React.FC<{ c: Clock; id: string; g: PayGeo; dblWord: string; dblText: React.ReactNode }> = ({ c, id, g, dblWord, dblText }) => {
  const dbl = c.w(id, dblWord) - 0.05;
  const cutAts = g.cuts.map(k => k.at);
  return <>
    {g.cuts.slice(0, -1).map((k, i) => <Win key={i} from={k.at} to={cutAts[i + 1]}>
      <Whip at={k.at} dir={i % 2 ? -1 : 1}><PhoneTake clipId={RUN} segs={g.hunt} x={PX} /></Whip>
      <At x={L.x} y={360} w={L.w}><Say at={k.at} size={i === 0 ? 130 : 170} from="left">{k.word}</Say></At>
    </Win>)}
    <Win from={g.fits} to={g.payFrom}><Whip at={g.fits}><PhoneTake clipId={RUN} segs={g.hunt} x={PX} /></Whip></Win>
    <Win from={0} to={g.payFrom}><TakeLabels clipId={RUN} segs={g.hunt} extra={[SIM_LABEL]} /></Win>
    <Win from={g.fits} to={dbl}><FitsText at={g.fits} fitsAt={c.has(id, "so it fits") ? c.w(id, "so it fits") : undefined} /></Win>
    <Win from={dbl} to={c.voEnd(id) + 0.3}><At x={L.x} y={380} w={L.w}><Say at={dbl} size={140}>{dblText}</Say></At></Win>
    <Win from={g.payFrom} to={g.emailAt}>
      <PayPhone segs={g.pay} sheetAt={g.sheetAt} centreAt={c.voEnd(id)} unzoomAt={g.revealAt} />
      <Labels items={[WALLET_LABEL, LIVE_LABEL]} />
    </Win>
  </>;
};

/* ------------------------------------------------------------ the plot twist (d5, p7) */
export const twistTimes = (c: Clock, id: string, emailWord: string) => ({
  orderAt: c.vo(id),
  emailAt: c.w(id, emailWord) - 0.05,
  stopAt: c.we(id, "And then") + 0.06,
  twistAt: c.w(id, "plot twist") - 0.04,
  shipsAt: c.w(id, "Nothing ships") - 0.04,
  everAt: c.w(id, "Nothing was ever") - 0.04,
  potAt: c.w(id, "The money went") - 0.08,
  hitAt: c.w(id, "She got the hit") - 0.05,
  keptAt: c.w(id, "She kept the money") - 0.05,
  savingAt: c.has(id, "That's saving") ? c.w(id, "That's saving") - 0.05 : undefined,
  end: c.end(id),
});
export type TwistT = ReturnType<typeof twistTimes>;

const Slam: React.FC<{ at: number; shrinkAt: number }> = ({ at, shrinkAt }) => {
  const t = useT() - at;
  if (t < 0) return null;
  const inP = ease(clamp(t / 0.16));
  const shake = t < 0.45 ? Math.sin(t * 90) * 16 * (1 - t / 0.45) : 0;
  const sh = ease(clamp((t - (shrinkAt - at)) / 0.35));
  const scale = (2.6 - 1.6 * inP) * (1 - 0.66 * sh);
  const y = 330 - 250 * sh;
  return <div style={{ position: "absolute", left: 0, right: 0, top: y, textAlign: "center", transform: `translateX(${shake}px) scale(${scale}) rotate(${-4 * (1 - sh)}deg)`,
    opacity: clamp(t / 0.06), fontSize: 300, fontWeight: 900, letterSpacing: -6, lineHeight: 1, color: C.mint, textShadow: "0 20px 60px rgba(0,0,0,.4)" }}>PLOT TWIST</div>;
};

/** "Order confirmed. The email lands." straight; a hard stop; PLOT TWIST; "Nothing ships."; the parcel turns into the
 *  pot, coins pour in and the amount counts up; then "She got the hit." / "She kept the money." */
export const Twist: React.FC<{ c: Clock; id: string; T: TwistT; potLabel: string }> = ({ c, id, T, potLabel }) => {
  const t = useT();
  // the inbox screen itself (it slides in over ~0.5 s after the take's `inbox` event)
  const inbox: Seg[] = [{ from: T.emailAt, to: T.twistAt, a: E("inbox") + 0.6, b: E("inbox") + 0.6 + Math.max(0.1, T.stopAt - T.emailAt), anchor: "start", maxRate: 1 }];
  const potSegs = potSegsOf(T);
  const frozen = clamp((t - T.stopAt) / 0.12);
  // the parcel → pot flip
  const flipA = T.potAt + 0.05, flip = clamp((t - flipA) / 0.5);
  const parcelIn = useSpring(T.everAt - 0.2, 12, 0.6);
  const coinsFrom = flipA + 0.45, potY = 440, POTX = 400;
  const price = priceNumber();
  const glow = ease(clamp((t - coinsFrom - 1.0) / 0.6));
  return <>
    {/* played straight: the order screen (PayPhone, in the act) then the email landing in the inbox */}
    <Win from={T.orderAt} to={T.emailAt}><At x={110} y={420} w={520}><Say at={T.orderAt} size={92}>Order<br /><Mint>confirmed.</Mint></Say></At></Win>
    <Win from={T.emailAt} to={T.twistAt}>
      <div style={{ position: "absolute", inset: 0, filter: `grayscale(${frozen}) brightness(${1 - 0.3 * frozen})` }}>
        <PhoneTake clipId={RUN} segs={inbox} x={960} width={560} />
        <At x={110} y={420} w={520}><Say at={T.emailAt} size={92}>The email<br /><Mint>lands.</Mint></Say></At>
      </div>
      <TakeLabels clipId={RUN} segs={inbox} extra={[SIM_LABEL]} />
    </Win>
    {/* the flip */}
    <Win from={T.twistAt} to={T.potAt}>
      <Slam at={T.twistAt} shrinkAt={T.shipsAt} />
      <At x={960} y={360} center w={1800}>
        <Say at={T.shipsAt} size={250} from="scale">Nothing <Mint>ships.</Mint></Say>
        <Say at={T.everAt} size={64} color={C.heroMeta} style={{ marginTop: 26 }}>Nothing was ever going to.</Say>
      </At>
      <Labels items={[SIM_LABEL]} />
    </Win>
    <Flash at={T.twistAt} len={0.3} />
    <Flash at={T.shipsAt} len={0.2} color={C.mint} />
    <Win from={T.potAt} to={T.hitAt}>
      <div style={{ position: "absolute", left: 100, top: 70, width: 1180, textAlign: "center", fontSize: 70, fontWeight: 900, letterSpacing: -2, color: C.mint }}>PLOT TWIST</div>
      {/* parcel turning into the pot */}
      <div style={{ position: "absolute", left: POTX - 200, top: potY - 40, width: 400, height: 380, perspective: 900 }}>
        {flip < 0.5
          ? <div style={{ transform: `rotateY(${flip * 180}deg) scale(${0.6 + 0.4 * parcelIn})` }}><Parcel size={400} /></div>
          : <div style={{ transform: `rotateY(${(flip - 1) * 180}deg)` }}><Pot size={400} glow={glow} /></div>}
      </div>
      {Array.from({ length: 14 }, (_, i) => <Coin key={i} x={POTX + ((i * 53) % 160) - 80} at={coinsFrom + i * 0.09} fall={0.55} to={potY + 20} />)}
      <At x={700} y={420} w={720}>
        <Say at={coinsFrom - 0.1} size={150} color={C.mint}>{price ? <><Count at={coinsFrom} to={price.v} decimals={price.dec} comma dur={1.3} group=" " /> €</> : null}</Say>
        <Say at={coinsFrom} size={52} color={C.heroMeta} weight={700}>{potLabel}</Say>
      </At>
      <PhoneTake clipId={RUN} segs={potSegs} x={1620} width={380} />
      <TakeLabels clipId={RUN} segs={potSegs} extra={[SIM_LABEL]} />
    </Win>
    {/* the payoff, two lines */}
    <Win from={T.hitAt} to={T.savingAt ?? T.end}>
      <At x={960} y={280} center w={1800}>
        <Say at={T.hitAt} size={180} from="scale">She got <Mint>the hit.</Mint></Say>
        <Say at={T.keptAt} size={180} from="scale" style={{ marginTop: 40 }}>She kept <Mint>the money.</Mint></Say>
      </At>
      <Labels items={[SIM_LABEL]} />
    </Win>
    {T.savingAt !== undefined ? <Win from={T.savingAt} to={T.end}>
      <At x={960} y={330} center w={1800}>
        <Say at={T.savingAt} size={150} from="scale">That’s saving,</Say>
        <Say at={T.savingAt + 0.5} size={150} color={C.mint} from="scale" style={{ marginTop: 20 }}>a craving at a time.</Say>
      </At>
    </Win> : null}
    {void id}
  </>;
};
export const potSegsOf = (T: TwistT): Seg[] => [{ from: T.potAt, to: T.hitAt, a: E("twist") - 0.2, b: E("coins") + 1.8, maxRate: 2 }];
export const twistSounds = (T: TwistT) => <>
  <TakeSounds clipId={RUN} segs={potSegsOf(T)} only={["coins"]} />
  <Sfx name="stop" at={T.stopAt - 0.02} volume={0.9} />
  <Sfx name="slam" at={T.twistAt - 0.02} volume={0.9} />
  <Sfx name="whoosh" at={T.shipsAt - 0.1} volume={0.4} />
  <Sfx name="pour" at={T.potAt + 0.45} volume={0.8} />
  <Sfx name="whoosh" at={T.hitAt - 0.1} volume={0.4} />
</>;
void AbsoluteFill;
