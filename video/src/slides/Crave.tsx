import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { Accent, Badge, clipFrame, CravePill, Eyebrow, Headline, Icon, IconDisc, In, LiveClip, Phone, s, Slide, Sound, Title, useAmbient, useIn, useProgress } from "../kit";
import { C } from "../theme";
import timeline from "../timeline.json";

/* Crave slides: 07 the idea, 08 the live run, 09 honest by design.
 * Entrance times are seconds into the slide; the narration starts at 0.8 s.
 * Phrase times below come from the pauses measured in the narration file (silencedetect), plus 0.8 s. */

const ease = (t: number) => 1 - (1 - t) ** 3;

/* ============================================================ 07 · Crave mode, the idea (19 s) */
// "But advice doesn't stop a craving.(0.8) So we tried something else.(2.6) Crave mode.(4.5)
//  Tell Vara what you want,(5.3) and it builds a shop for it on the spot.(6.9) You hunt,(9.0) you fill the basket,(9.7)
//  you check out.(10.9) Nothing ships.(12.0) The money goes to your savings instead.(13.4–15.3)"
const steps = [
  { icon: "chat", label: "Say the craving", d: 5.3 },
  { icon: "bag", label: "A shop appears", d: 7.0 },
  { icon: "basket", label: <>Hunt and fill<br />the basket</>, d: 9.0 },
  { icon: "card", label: "Check out", d: 10.9 },
];
const STEP_X = [96, 406, 716, 1026], DISC = 96, DISC_TOP = 540, TRACK_Y = DISC_TOP + DISC / 2;
const TWIST = { left: 1356, top: 452, width: 468, d: 12.0, savings: 13.4 };

export const S07CraveIdea: React.FC = () => {
  const glow = 0.5 + useAmbient(9) * 0.06;
  return <Slide n={7} dark bg={`radial-gradient(900px 640px at 82% 58%, rgba(145,250,155,${0.14 * glow}), rgba(0,70,40,0) 70%), ${C.deep}`}>
    <Sound src="n-crave-idea.m4a" at={s(0.8)} />
    {/* the set-up, in fewer words than the narrator */}
    <div style={{ position: "absolute", left: 96, top: 92, display: "flex", gap: 14, fontSize: 32, fontWeight: 500, color: C.heroMeta }}>
      <In delay={s(0.9)} from="up" dist={14}><span>Advice doesn't stop a craving.</span></In>
      <In delay={s(2.6)} from="up" dist={14}><span style={{ color: "#fff" }}>So we tried something else.</span></In>
    </div>
    <div style={{ position: "absolute", left: 96, top: 196, width: 1240 }}>
      <Eyebrow dark delay={s(4.3)}>Crave mode</Eyebrow>
      <Headline dark size={76} delay={s(4.5)} style={{ marginTop: 18 }}>Helping you save money,<br /><Accent dark>a craving at a time.</Accent></Headline>
    </div>
    <In delay={s(4.7)} from="up" dist={14} style={{ position: "absolute", right: 96, top: 186 }}><CravePill scale={1.3} style={{ border: "1.5px solid rgba(145,250,155,.45)" }} /></In>
    <Track />
    {steps.map((st, k) => <Step key={k} n={k + 1} x={STEP_X[k]} {...st} />)}
    <Twist />
    <In delay={s(14.6)} from="up" dist={14} style={{ position: "absolute", left: 96, top: 900, display: "flex", alignItems: "center", gap: 14 }}>
      <Icon name="shield" size={28} color={C.mint} />
      <span style={{ fontSize: 24, color: C.heroMeta }}>Opt-in · the shop and its brands are invented · all money movement is simulated in the prototype</span>
    </In>
  </Slide>;
};

/** The journey line between the steps: each segment draws in just before the step it leads to. */
const Track: React.FC = () => {
  const ends = [...steps.slice(1).map(st => st.d), TWIST.d];
  const segs = ends.map((d, k) => {
    const x0 = STEP_X[k] + DISC + 14, x1 = k < 3 ? STEP_X[k + 1] - 14 : TWIST.left - 14;
    return { x0, x1, d, last: k === 3 };
  });
  return <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
    {segs.map(sg => <Seg key={sg.x0} {...sg} />)}
  </svg>;
};
const Seg: React.FC<{ x0: number; x1: number; d: number; last: boolean }> = ({ x0, x1, d, last }) => {
  const p = ease(useProgress(s(d) - 12, s(d) + 2));
  if (p <= 0) return null;
  const x = x0 + (x1 - x0) * p;
  return <g>
    <path d={`M ${x0} ${TRACK_Y} L ${x} ${TRACK_Y}`} stroke={last ? C.mint : "rgba(255,255,255,.28)"} strokeWidth={last ? 4 : 3} strokeLinecap="round" strokeDasharray={last ? undefined : "2 12"} />
    {last && p > 0.96 ? <path d={`M ${x1 - 14} ${TRACK_Y - 12} L ${x1} ${TRACK_Y} L ${x1 - 14} ${TRACK_Y + 12}`} fill="none" stroke={C.mint} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : null}
  </g>;
};

const Step: React.FC<{ n: number; x: number; icon: string; label: React.ReactNode; d: number }> = ({ n, x, icon, label, d }) =>
  <In delay={s(d)} from="up" dist={24} style={{ position: "absolute", left: x, top: DISC_TOP, width: 280 }}>
    <div style={{ width: DISC, height: DISC, borderRadius: DISC, background: "rgba(145,250,155,.14)", border: "1.5px solid rgba(145,250,155,.35)", display: "grid", placeItems: "center", boxSizing: "border-box" }}>
      <Icon name={icon} size={46} color={C.mint} />
    </div>
    <div style={{ marginTop: 24, fontSize: 22, fontWeight: 700, letterSpacing: 2, color: C.mint, fontVariantNumeric: "tabular-nums" }}>{String(n).padStart(2, "0")}</div>
    <div style={{ marginTop: 6, fontSize: 32, fontWeight: 700, lineHeight: 1.2, color: "#fff" }}>{label}</div>
  </In>;

/** Step 05, the twist: a mint card instead of a disc. "Nothing ships" first, then where the money goes. */
const Twist: React.FC = () => {
  const t = useIn(s(TWIST.d));
  const halo = ease(useProgress(s(TWIST.d) + 6, s(TWIST.d) + 36));
  return <div style={{ position: "absolute", left: TWIST.left, top: TWIST.top, width: TWIST.width, opacity: Math.min(1, t * 1.4), transform: `translateY(${(1 - t) * 30}px)` }}>
    <div style={{ borderRadius: 28, background: C.mint, color: C.deep, padding: "32px 36px 34px", boxShadow: `0 0 ${80 * halo}px rgba(145,250,155,${0.35 * halo})` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, color: C.green, fontVariantNumeric: "tabular-nums" }}>05</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2.4, textTransform: "uppercase", color: C.green }}>The twist</div>
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 18 }}>
        <StruckBox at={s(TWIST.d) + 10} />
        <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1, lineHeight: 1.05 }}>Nothing ships</div>
      </div>
      <In delay={s(TWIST.savings)} from="up" dist={18} style={{ marginTop: 22, paddingTop: 22, borderTop: `2px solid rgba(0,70,40,.18)`, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 72, height: 72, borderRadius: 72, background: C.deep, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="piggy" size={40} color={C.mint} stroke={2} /></div>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2 }}>The money lands<br />in savings</div>
      </In>
    </div>
  </div>;
};
/** A parcel with a stroke drawn through it. */
const StruckBox: React.FC<{ at: number }> = ({ at }) => {
  const p = ease(useProgress(at, at + 14));
  return <div style={{ width: 72, height: 72, borderRadius: 72, background: "rgba(0,70,40,.12)", display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
    <Icon name="box" size={40} color={C.deep} stroke={2} />
    <svg width={72} height={72} style={{ position: "absolute", inset: 0 }}>
      {p > 0 ? <path d={`M 18 18 L ${18 + 36 * p} ${18 + 36 * p}`} stroke={C.deep} strokeWidth={4} strokeLinecap="round" /> : null}
    </svg>
  </div>;
};

/* ============================================================ 08 · Crave mode, live (49 s)
 * crave.mp4 plays start to finish at normal speed from 1 s. Every time comes from timeline.json.
 * Narration a "Here it is, live.(1.4) New sneakers.(2.9)" leads into the craving; narration b starts 1 s after
 * the coins land, well clear of the pay chime. */
const crave = timeline.clips.find(c => c.file === "crave.mp4")!;
const ev = (label: string) => { const e = crave.events.find(x => x.label === label); if (!e) throw new Error(`crave.mp4: no event ${label}`); return e.t; };
const LIVE_AT = s(1);
const at = (label: string) => clipFrame(LIVE_AT, ev(label));
// Each step lights at its event and gets its check when the next step lights (Pay: exactly at the tick, with the chime).
const liveSteps = [
  { label: "The craving", sub: "“new sneakers”", on: "craving", done: "shop-visible" },
  { label: "A generated shop", sub: "Hallo Stride, an invented shop", on: "shop-visible", done: "added" },
  { label: "Basket", sub: "Court Low Leather · 119,95 €", on: "added", done: "checkout" },
  { label: "Checkout", sub: "137 € is free until payday, so it fits", on: "checkout", done: "sheet-open" },
  { label: "Pay", sub: "Simulated pay sheet, with the app’s chime", on: "sheet-open", done: "tick" },
  { label: "Nothing ships: money to the Crave pot", sub: "The pot counts up to 119,95 €", on: "twist", done: "inbox" },
  { label: "Order emails, in the app", sub: "No real emails are sent", on: "inbox", done: "pot" },
];
export const S08CraveLive: React.FC = () => <Slide n={8} bg={C.screen}>
  <Sound src="n-crave-live-a.m4a" at={s(1.4)} />
  <Sound src="pop.m4a" at={at("added")} volume={0.6} />
  <Sound src="chime.m4a" at={at("tick")} />
  <Sound src="coins.m4a" at={at("coins")} volume={0.7} />
  <Sound src="n-crave-live-b.m4a" at={at("coins") + s(1)} />
  <In delay={s(0.2)} from="up" dist={30} style={{ position: "absolute", left: 200, top: 84 }}>
    <Phone width={430}><LiveClip src="crave.mp4" at={LIVE_AT} to={crave.seconds} /></Phone>
  </In>
  <div style={{ position: "absolute", left: 790, top: 92, width: 1034 }}>
    <Eyebrow delay={s(0.3)}>Crave mode, live</Eyebrow>
    <Headline size={64} delay={s(0.5)} style={{ marginTop: 16 }}>One craving, start to finish. <Accent>Nothing ships.</Accent></Headline>
  </div>
  <div style={{ position: "absolute", left: 790, top: 296, width: 1034 }}>
    {liveSteps.map((st, k) => <LiveStep key={st.label} n={k + 1} {...st} />)}
  </div>
  <In delay={s(1.2)} style={{ position: "absolute", left: 790, top: 922 }}><Badge kind="live" /></In>
</Slide>;

const LiveStep: React.FC<{ n: number; label: string; sub: string; on: string; done: string }> = ({ n, label, sub, on, done }) => {
  const frame = useCurrentFrame();
  const lit = ease(useProgress(at(on), at(on) + 10));
  const isDone = frame >= at(done);
  const pop = useIn(at(done), 200, 14);
  return <div style={{ position: "relative", height: 88, display: "flex", alignItems: "center", gap: 24 }}>
    <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 52, border: `2px solid ${C.track}`, background: "#fff" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 52, background: C.green, opacity: lit, transform: `scale(${0.7 + 0.3 * lit})`, display: "grid", placeItems: "center",
        color: "#fff", fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {isDone ? <div style={{ transform: `scale(${0.6 + 0.4 * pop})` }}><Icon name="check" size={30} color="#fff" stroke={2.8} /></div> : n}
      </div>
    </div>
    <div style={{ opacity: 0.34 + 0.66 * lit }}>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15, color: lit > 0.5 ? C.ink : C.muted }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 24, color: C.muted, opacity: lit }}>{sub}</div>
    </div>
  </div>;
};

/* ============================================================ 09 · Honest by design (26 s)
 * Phrase times from the measured pauses of the re-voiced narration (22.3 s), plus 0.8 s:
 * "Crave mode is honest by design.(0.8) You opt in,(3.3) and every screen says nothing ships.(4.5)
 *  It never sets aside more than is free until payday,(7.7) and you can release the money(11.1) and buy it for real at any time.(12.6)
 *  In this prototype the money movement is simulated,(14.7) and the wallet button at checkout comes from Stripe, in test mode.(18.2)
 *  No card is charged.(21.75)"
 * The cap is what is free until payday (137 € for the demo customer), never the "safe to spend until Sunday" figure. */
const SHEET_W = 440, SHEET_GAP = 40;
// The pay sheet inside each screenshot: its top edge (measured in the PNG) to the bottom of the image.
const sheets = [
  { src: "pay-sim.png", imgW: 780, imgH: 1688, top: 790, at: 1.0, label: <>Simulated pay sheet,<br />synthesised chime</> },
  { src: "pay-wallet.png", imgW: 390, imgH: 844, top: 453, at: 1.5, label: <>Wallet button from Stripe ·<br />test mode</> },
];
export const S09CraveHonest: React.FC = () => <Slide n={9}>
  <Sound src="n-crave-honest.m4a" at={s(0.8)} />
  <Title eyebrow="Honest by design" width={980}>It only works if you are <Accent>in on it</Accent>.</Title>
  <In delay={s(0.6)} style={{ position: "absolute", right: 96, top: 76 }}><Badge kind="still" /></In>
  <div style={{ position: "absolute", left: 96, top: 300, width: 760, display: "grid", gap: 32 }}>
    <Honest icon="check" title="Opt-in" at={3.3}>Crave mode is off until you turn it on</Honest>
    <Honest icon="box" title="Every screen says nothing ships" at={4.5}><CravePill scale={0.9} /></Honest>
    <Honest icon="shield" title="Never more than is free until payday" at={7.7}>The amount is capped: 137 € for Aino</Honest>
    <Honest icon="undo" title="Release the money any time" at={11.1}>“Release the money and buy it for real”</Honest>
    <Honest icon="card" title="Prototype: money movement is simulated" at={14.7}>
      <In delay={s(18.2)} from="up" dist={10}><span>The wallet button comes from Stripe, in test mode.</span></In>
      <In delay={s(21.7)} from="up" dist={10}><span style={{ color: C.ink, fontWeight: 700 }}>No card is charged.</span></In>
    </Honest>
  </div>
  {sheets.map((sh, k) => <PaySheet key={sh.src} left={1824 - (2 - k) * SHEET_W - (1 - k) * SHEET_GAP} {...sh} />)}
</Slide>;

const Honest: React.FC<{ icon: string; title: string; at: number; children: React.ReactNode }> = ({ icon, title, at, children }) =>
  <In delay={s(at)} from="up" dist={24} style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
    <IconDisc name={icon} size={60} />
    <div style={{ paddingTop: 2 }}>
      <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2, color: C.ink }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 24, lineHeight: 1.35, color: C.muted, display: "flex", columnGap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
  </In>;

/** The bottom of a phone screenshot (the pay sheet only), in a rounded card, so its small print can be read. */
const PaySheet: React.FC<{ left: number; src: string; imgW: number; imgH: number; top: number; at: number; label: React.ReactNode }> = ({ left, src, imgW, imgH, top, at, label }) => {
  const k = SHEET_W / imgW;
  return <In delay={s(at)} from="up" dist={30} style={{ position: "absolute", left, top: 248, width: SHEET_W }}>
    <div style={{ height: 68, fontSize: 24, fontWeight: 600, lineHeight: 1.3, color: C.inkStrong, textAlign: "center" }}>{label}</div>
    <div style={{ marginTop: 16, width: SHEET_W, height: Math.round((imgH - top) * k), borderRadius: 24, overflow: "hidden", position: "relative", background: "#f2f2f4",
      boxShadow: "0 18px 50px rgba(0,70,40,.14), 0 2px 6px rgba(0,70,40,.06), 0 0 0 1px rgba(0,70,40,.06)" }}>
      <Img src={staticFile(`shots/${src}`)} style={{ position: "absolute", left: 0, top: -top * k, width: SHEET_W, height: imgH * k, display: "block" }} />
    </div>
  </In>;
};
