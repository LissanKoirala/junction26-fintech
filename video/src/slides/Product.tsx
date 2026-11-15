import React from "react";
import { Accent, Badge, Browser, clipFrame, Eyebrow, Headline, IconDisc, In, LiveClip, Phone, phoneHeight, Point, s, Slide, Sound, Sprout, Title, useIn, useProgress } from "../kit";
import { C } from "../theme";
import timeline from "../timeline.json";

/* Product slides: 04 meet, 05 chat, 06 coach, 11 insights, 12 fit.
 * Entrance times are seconds into the slide; the narration starts at 0.8 s.
 * Phrase times come from the pauses measured in each narration file (silencedetect), plus 0.8 s.
 * Everything that happens on a phone is placed from src/timeline.json through clipFrame. */

const ease = (t: number) => 1 - (1 - t) ** 3;
const clip = (file: string) => {
  const c = timeline.clips.find(k => k.file === file);
  if (!c) throw new Error(`no clip ${file} in timeline.json`);
  return c;
};
/** Source second of a timeline event. */
const ev = (file: string, label: string) => {
  const e = clip(file).events.find(k => k.label === label);
  if (!e) throw new Error(`no event ${label} in ${file}`);
  return e.t;
};
/** A recording plays to its end: `to` is its full length. */
const len = (file: string) => clip(file).seconds;
/** The live badge, saying so when waiting time was cut from the recording. */
const liveText = (file: string) => clip(file).cut.length ? "Live app recording · synthetic data · waiting time shortened" : undefined;

/* ============================================================ 04 · Meet Vara (16 s) */
// "So we built Vara,(0.8) a personal economic trainer(2.0) inside S-mobiili.(3.2)
//  It starts with one number:(5.0) what's safe to spend,(6.4) after rent, bills and a cushion.(8.9–10.3)"
// today.mp4 from 1.0 s: the S-mobiili home shell, Vara opens (vara-open), the Today cards scroll, back to the top (ends 13.6 s).
// The demo video opens on this slide with its own line (`audio="n-meet-demo.m4a"`, narration `meet-demo`:
// "This is Vara, …"; "after rent, bills and a cushion" starts at 8.8 s there, so the same entrance times hold).
const T_AT = s(1.0);
export const S04Meet: React.FC<{ audio?: string }> = ({ audio = "n-meet.m4a" }) => {
  const open = clipFrame(T_AT, ev("today.mp4", "vara-open"));
  const W = 420, top = (1000 - phoneHeight(W)) / 2 + 10;
  return <Slide n={4}>
    <Sound src={audio} at={s(0.8)} />
    <div style={{ position: "absolute", left: 96, top: 150, width: 1040 }}>
      <In delay={s(0.3)} from="scale" style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Sprout size={64} />
        <Eyebrow delay={s(0.3)}>Meet Vara</Eyebrow>
      </In>
      <Headline size={76} delay={s(0.6)} style={{ marginTop: 28 }}>One number first:<br />what is <Accent>safe to spend</Accent>.</Headline>
      <div style={{ marginTop: 64, display: "grid", gap: 34 }}>
        {/* arrives as Vara opens inside the S-mobiili shell on the phone */}
        <Point icon="phone" title="Inside S-mobiili" delay={open}>A personal economic trainer in the bank's app</Point>
        <Point icon="shield" title="After rent, bills and a cushion" delay={s(8.9)} />
        <Point icon="calendar" title="Until payday, week by week" delay={s(10.4)} />
      </div>
    </div>
    <In delay={s(0.2)} from="up" dist={50} style={{ position: "absolute", left: 1200, top }}>
      <Phone width={W}><LiveClip src="today.mp4" at={T_AT} to={len("today.mp4")} /></Phone>
    </In>
    <In delay={s(1.2)} style={{ position: "absolute", left: 96, top: 916 }}><Badge kind="live" /></In>
  </Slide>;
};
/** Slide 04 for the demo video: identical, with the demo's opening line. Not one of the fourteen. */
export const S04MeetDemo: React.FC = () => <S04Meet audio="n-meet-demo.m4a" />;

/* ============================================================ 05 · Chat with your money (23 s) */
// "Ask it anything,(0.8) in plain words.(1.9) Answers arrive as cards,(3.0) built from your own transactions,(4.9)
//  and every number shows how it was worked out.(6.9) The language model never does the arithmetic.(9.4)
//  An engine does,(12.2) and a guard checks every figure(13.6) before it reaches you.(14.7–16.7)"
// chat.mp4 from source 1.0 s, at 1.0 s: typing (typing-start), sent, answer cards (answer-first-card), scroll,
// "How I got this" opens (how-open); ends 20.3 s, holds to 23 s.
const CH_AT = s(1.0), CH_FROM = 1.0;
const chatAt = (label: string) => clipFrame(CH_AT, ev("chat.mp4", label), CH_FROM);
const pipeline = [
  { icon: "chat", label: "Your question", d: 9.4 },
  { icon: "spark", label: "Claude picks a tool", d: 10.2 },
  { icon: "cpu", label: "Engine computes", d: 12.2 },
  { icon: "shield", label: "Guard checks every figure", d: 13.6, hot: true },
  { icon: "layers", label: "Card", d: 14.8 },
];
const PIPE = { left: 640, top: 590, width: 1184, node: 196 };
export const S05Chat: React.FC = () => {
  const W = 420, top = (1000 - phoneHeight(W)) / 2 + 10;
  const gap = (PIPE.width - pipeline.length * PIPE.node) / (pipeline.length - 1);
  return <Slide n={5}>
    <Sound src="n-chat.m4a" at={s(0.8)} />
    <In delay={s(0.2)} from="up" dist={50} style={{ position: "absolute", left: 120, top }}>
      <Phone width={W}><LiveClip src="chat.mp4" at={CH_AT} from={CH_FROM} to={len("chat.mp4")} /></Phone>
    </In>
    <div style={{ position: "absolute", left: PIPE.left, top: 76, width: PIPE.width }}>
      <Eyebrow>Chat with your money</Eyebrow>
      <Headline size={68} style={{ marginTop: 16 }}>Answers arrive as <Accent>cards</Accent>,<br />with the working shown.</Headline>
    </div>
    {/* what the phone is doing, as it happens */}
    <div style={{ position: "absolute", left: PIPE.left, top: 316, width: PIPE.width, display: "flex", gap: 48 }}>
      <Point icon="mic" title="Ask in plain words" delay={chatAt("typing-start")} size={28} style={{ width: 520 }}>Type, or hold to talk</Point>
      <Point icon="layers" title="Cards, not walls of text" delay={chatAt("answer-first-card")} size={28}>From your own transactions</Point>
    </div>
    {/* the pipeline, with "The language model never does the arithmetic" */}
    <In delay={s(9.2)} from="up" dist={14} style={{ position: "absolute", left: PIPE.left, top: PIPE.top - 76, width: PIPE.width }}>
      <div style={{ height: 2, background: C.line, marginBottom: 22 }} />
      <div style={{ fontSize: 30, fontWeight: 700, color: C.ink }}>The language model <Accent>never does the arithmetic</Accent></div>
    </In>
    {pipeline.map((p, k) => <PipeNode key={p.label} x={PIPE.left + k * (PIPE.node + gap)} w={PIPE.node} gap={gap} first={k === 0} {...p} />)}
    {/* "How I got this" opens on the phone */}
    <Point icon="search" title={<>Every number: <span style={{ color: C.green }}>How I got this</span></>} delay={chatAt("how-open")} size={28}
      style={{ position: "absolute", left: PIPE.left, top: 806 }}>The working behind each figure, one tap away</Point>
    <In delay={s(1.2)} style={{ position: "absolute", left: PIPE.left, top: 932 }}><Badge kind="live" text={liveText("chat.mp4")} /></In>
  </Slide>;
};
const PipeNode: React.FC<{ x: number; w: number; gap: number; first: boolean; icon: string; label: string; d: number; hot?: boolean }> = ({ x, w, gap, first, icon, label, d, hot }) => {
  const arrow = ease(useProgress(s(d) - 10, s(d) + 2));
  const D = 84;
  return <>
    {!first && arrow > 0 ? <svg width={gap} height={D} style={{ position: "absolute", left: x - gap, top: PIPE.top }}>
      <path d={`M 10 ${D / 2} L ${10 + (gap - 20) * arrow} ${D / 2}`} stroke={C.faint} strokeWidth={3} strokeLinecap="round" />
      {arrow > 0.95 ? <path d={`M ${gap - 20} ${D / 2 - 8} L ${gap - 10} ${D / 2} L ${gap - 20} ${D / 2 + 8}`} fill="none" stroke={C.faint} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg> : null}
    <In delay={s(d)} from="up" dist={20} style={{ position: "absolute", left: x, top: PIPE.top, width: w, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <IconDisc name={icon} size={D} bg={hot ? C.green : C.screen} color={hot ? "#fff" : C.green} />
      <div style={{ marginTop: 16, fontSize: 25, fontWeight: hot ? 700 : 600, lineHeight: 1.25, color: hot ? C.green : C.ink }}>{label}</div>
    </In>
  </>;
};

/* ============================================================ 06 · A coach that comes to you (20 s) */
// "What-if lets you try a decision before you make it.(0.8–3.2) Every week,(3.6) Vara checks in first,(4.4)
//  with the story of your week.(6.0–7.1) And it works in English(7.5) and in Finnish.(8.7–9.6)"
// Each clip starts with its sentence and plays out in full: what-if 0.8–13.3 s, check-in 3.6–17.0 s, Finnish 7.5–16.2 s.
const coach = [
  { file: "whatif.mp4", label: "What-if", at: s(0.8), sub: "Try a decision first", subEvent: "changed" },
  { file: "checkin.mp4", label: "Weekly check-in", at: s(3.6), sub: "The story of your week", subEvent: "slide-2" },
  { file: "finnish.mp4", label: "English and Finnish", at: s(7.5), sub: "EN → FI, one tap", subEvent: "switched" },
];
export const S06Coach: React.FC = () => {
  const W = 352, gap = 52, left = 1824 - 3 * W - 2 * gap, ptop = 1000 - 64 - phoneHeight(W);
  return <Slide n={6} bg={C.screen}>
    <Sound src="n-coach.m4a" at={s(0.8)} />
    <div style={{ position: "absolute", left: 96, top: 150, width: left - 96 - 40 }}>
      <Eyebrow>Every week, in your language</Eyebrow>
      <Headline size={68} style={{ marginTop: 20 }}>A coach<br />that <Accent>comes<br />to you</Accent>.</Headline>
    </div>
    <In delay={s(1.2)} style={{ position: "absolute", left: 96, top: 916 }}><Badge kind="live" style={{ background: C.white }} /></In>
    {coach.map((c, k) => {
      const x = left + k * (W + gap);
      return <React.Fragment key={c.file}>
        <In delay={c.at - 10} from="up" dist={14} style={{ position: "absolute", left: x, top: ptop - 112, width: W + 40 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: C.green, fontVariantNumeric: "tabular-nums" }}>{String(k + 1).padStart(2, "0")}</span>
            <span style={{ fontSize: 32, fontWeight: 700, color: C.ink }}>{c.label}</span>
          </div>
        </In>
        {/* a line that names what the phone is showing, when it shows it */}
        <In delay={clipFrame(c.at, ev(c.file, c.subEvent))} from="up" dist={12} style={{ position: "absolute", left: x + 36, top: ptop - 62, width: W }}>
          <div style={{ fontSize: 24, color: C.muted }}>{c.sub}</div>
        </In>
        <In delay={c.at - 12} from="up" dist={40} style={{ position: "absolute", left: x, top: ptop }}>
          <Phone width={W}><LiveClip src={c.file} at={c.at} to={len(c.file)} /></Phone>
        </In>
      </React.Fragment>;
    })}
  </Slide>;
};

/* ============================================================ 11 · For the judges (16 s) */
// "It's all written up for the judges(0.8) on a separate insights site:(2.9) eleven findings,(4.3)
//  every model card,(5.6) and the limits of what this data can tell.(6.8–9.1)"
// insights.mp4 at 1.2× from 0.8 s: header, findings, charts, the models link, the model table (ends 13.9 s).
const IN_AT = s(0.8), IN_RATE = 1.2;
const chips = [
  { icon: "doc", text: "Eleven findings", d: 4.3 },
  { icon: "cpu", text: "Eight model cards", d: 5.6 },
  { icon: "alert", text: "What this data cannot tell", d: 6.8 },
];
export const S11Insights: React.FC = () => {
  const BW = 1180;
  const tableAt = clipFrame(IN_AT, ev("insights.mp4", "model-table"), 0, IN_RATE);
  return <Slide n={11}>
    <Sound src="n-insights.m4a" at={s(0.8)} />
    <Title eyebrow="For the judges" width={1728}>Every figure, <Accent>written up</Accent>.</Title>
    <In delay={s(0.2)} from="up" dist={50} style={{ position: "absolute", left: 96, top: 240 }}>
      <Browser width={BW} url="vara-junction26.swedencentral.cloudapp.azure.com/insights/">
        <LiveClip src="insights.mp4" at={IN_AT} to={len("insights.mp4")} rate={IN_RATE} />
      </Browser>
    </In>
    <div style={{ position: "absolute", left: 96 + BW + 64, top: 262, width: 1824 - (96 + BW + 64) }}>
      <In delay={s(2.6)} from="up" dist={14}><div style={{ fontSize: 28, lineHeight: 1.35, color: C.muted }}>A separate site, at<br /><b style={{ color: C.ink, fontWeight: 700 }}>…/insights/</b></div></In>
      <div style={{ marginTop: 44, display: "grid", gap: 22 }}>
        {chips.map(c => <Chip key={c.text} {...c} ring={c.text === "Eight model cards" ? tableAt : undefined} />)}
      </div>
    </div>
    <In delay={s(1.2)} style={{ position: "absolute", left: 96 + BW + 64, top: 916 }}><Badge kind="live" text="Live site recording · 1.2× speed · synthetic data" /></In>
  </Slide>;
};
/** A card-like chip; `ring` = frame at which the matching part of the recording comes up (a ring settles onto the chip). */
const Chip: React.FC<{ icon: string; text: string; d: number; ring?: number }> = ({ icon, text, d, ring }) => {
  const r = ring !== undefined ? ease(useProgress(ring, ring + 22)) : 0;
  return <In delay={s(d)} from="up" dist={20} style={{ position: "relative" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 22px", borderRadius: 20, background: C.screen, border: `1px solid ${C.track}` }}>
      <IconDisc name={icon} size={56} bg={C.white} />
      <span style={{ fontSize: 28, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>{text}</span>
    </div>
    {r > 0 ? <div style={{ position: "absolute", inset: -10 * (1 - r), borderRadius: 24, border: `2px solid ${C.green}`, opacity: 0.25 + 0.5 * (1 - r) }} /> : null}
  </In>;
};

/* ============================================================ 12 · Built to fit S-mobiili (19 s) */
// "Vara is built to fit S-mobiili.(0.8) It lives inside the app's shell,(3.3) hands savings goals to Säästäjä,(5.3)
//  and can read other banks through an open-banking mock.(7.3) One engine,(11.1) one guarded chat endpoint,(11.9)
//  two languages.(13.3) And it's live today.(14.5–15.9)"
// more.mp4 from source 4.4 s (the end of the baskets, just before the goal) at 0.2 s, normal speed: the savings goal,
// the Säästäjä sheet (open 5.6–6.8 s, with "hands savings goals to Säästäjä"), connect another bank (connect 7.9 s,
// with "other banks through an open-banking mock"), consent and "Showing 2 banks"; ends 14.3 s.
// The recording's own baskets are left out: this narration does not mention them (slide 13 does).
const M_AT = s(0.2), M_FROM = 4.4, M_RATE = 1;
/** The Säästäjä sheet is on screen this long before the "saastaja" tap event (measured in more.mp4). */
const SHEET_OPEN_BEFORE_TAP = 1.2;
const moreAt = (label: string) => clipFrame(M_AT, ev("more.mp4", label), M_FROM, M_RATE);
export const S12Fit: React.FC = () => {
  const W = 420, top = (1000 - phoneHeight(W)) / 2 + 10;
  const RX = 640, RW = 1824 - RX;
  const tiles = [
    { icon: "phone", title: "S-mobiili shell", sub: "Vara lives inside the app", d: s(3.3) },
    { icon: "piggy", title: "Säästäjä hand-off", sub: "savings goals", mock: true, d: moreAt("saastaja") - Math.round(SHEET_OPEN_BEFORE_TAP * 30 / M_RATE) },
    { icon: "bank", title: "Other banks via PSD2", sub: "open banking", mock: true, d: moreAt("connect") },
  ];
  const core = [
    { icon: "cpu", text: "One engine", d: 11.1 },
    { icon: "shield", text: "One guarded, rate-limited chat endpoint", d: 11.9 },
    { icon: "globe", text: "English and Finnish", d: 13.3 },
  ];
  const tw = (RW - 2 * 24) / 3;
  return <Slide n={12}>
    <Sound src="n-fit.m4a" at={s(0.8)} />
    <In delay={s(0.2)} from="up" dist={50} style={{ position: "absolute", left: 120, top }}>
      <Phone width={W}><LiveClip src="more.mp4" at={M_AT} from={M_FROM} to={len("more.mp4")} rate={M_RATE} /></Phone>
    </In>
    <div style={{ position: "absolute", left: RX, top: 76, width: RW }}>
      <Eyebrow>Built to fit S-mobiili</Eyebrow>
      <Headline size={68} style={{ marginTop: 16 }}>A feature, <Accent>not a research project</Accent>.</Headline>
    </div>
    {/* the integration points, each as its screen comes up */}
    <div style={{ position: "absolute", left: RX, top: 300, width: RW, display: "flex", gap: 24 }}>
      {tiles.map(t => <In key={t.title} delay={t.d} from="up" dist={24} style={{ width: tw }}>
        <div style={{ height: 206, boxSizing: "border-box", padding: "24px 26px", borderRadius: 24, background: C.screen, border: `1px solid ${C.track}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <IconDisc name={t.icon} size={60} bg={C.white} />
            {t.mock ? <span style={{ padding: "5px 14px", borderRadius: 999, fontSize: 22, fontWeight: 700, color: C.warn, background: C.warnBg }}>mock</span> : null}
          </div>
          <div style={{ marginTop: 18, fontSize: 30, fontWeight: 700, color: C.ink, lineHeight: 1.15 }}>{t.title}</div>
          <div style={{ marginTop: 6, fontSize: 24, color: C.muted }}>{t.sub}</div>
        </div>
      </In>)}
    </div>
    {/* the shared core under them */}
    <Core x={RX} y={530} w={RW} at={s(10.9)} items={core} />
    {/* live today */}
    <In delay={s(14.5)} from="up" dist={20} style={{ position: "absolute", left: RX, top: 752, width: RW }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "22px 28px", borderRadius: 24, background: C.deep, color: "#fff" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 18px", borderRadius: 999, background: C.mint, color: C.deep, fontSize: 24, fontWeight: 800, flexShrink: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 10, background: C.green }} />Live today</span>
        <span style={{ fontSize: 28, fontWeight: 600, whiteSpace: "nowrap" }}>vara-junction26.swedencentral.cloudapp.azure.com</span>
      </div>
    </In>
    <In delay={s(1.2)} style={{ position: "absolute", left: RX, top: 916 }}><Badge kind="live" /></In>
  </Slide>;
};
const Core: React.FC<{ x: number; y: number; w: number; at: number; items: { icon: string; text: string; d: number }[] }> = ({ x, y, w, at, items }) => {
  const t = useIn(at);
  return <div style={{ position: "absolute", left: x, top: y, width: w, opacity: Math.min(1, t * 1.4), transform: `translateY(${(1 - t) * 20}px)` }}>
    <div style={{ boxSizing: "border-box", padding: "22px 26px", borderRadius: 24, border: `1.5px solid ${C.green}`, background: C.white }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2.4, textTransform: "uppercase", color: C.green }}>Underneath</div>
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1fr", gap: 24, alignItems: "center" }}>
        {items.map(it => <In key={it.text} delay={s(it.d)} from="left" dist={16} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <IconDisc name={it.icon} size={52} />
          <span style={{ fontSize: 27, fontWeight: 600, color: C.ink, lineHeight: 1.2 }}>{it.text}</span>
        </In>)}
      </div>
    </div>
  </div>;
};
