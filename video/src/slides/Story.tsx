import React from "react";
import { useCurrentFrame } from "remotion";
import { Accent, Badge, CountUp, Eyebrow, Headline, Icon, IconDisc, In, s, Slide, Sound, Sprout, Title, useAmbient, useIn, useProgress } from "../kit";
import { C } from "../theme";

/* Story slides: 01 opening, 02 data, 03 insight, 13 criteria, 14 close.
 * Entrance times are seconds into the slide; the narration starts at 0.8 s.
 * Each is placed where the narrator reaches the phrase (about 2.9 words a second, measured line length). */

const DATA_SOURCES = ["Challenge dataset (synthetic), our analysis: /insights/"];
const ease = (t: number) => 1 - (1 - t) ** 3;

/* ============================================================ 01 · Meet Aino (15 s) */
// "Meet Aino.(0.8) She's twenty-one,(1.7) payday is two weeks away,(2.6) and she really wants new sneakers.(4.6)
//  Her banking app shows what she has.(6.4) It doesn't show what she can afford.(8.9)"
export const S01Opening: React.FC = () => {
  const glow = 0.5 + useAmbient(9) * 0.06;
  const facts = [
    { icon: <IconDisc name="user" size={76} dark />, text: "21 years old", d: 1.9 },
    { icon: <IconDisc name="calendar" size={76} dark />, text: "Payday in 15 days", d: 2.8 },
    { icon: <SneakerDisc />, text: <>Wants: <b style={{ fontWeight: 700, color: "#fff" }}>new sneakers</b></>, d: 4.7 },
  ];
  return <Slide n={1} dark bg={`radial-gradient(900px 700px at 74% 46%, rgba(145,250,155,${0.13 * glow}), rgba(0,70,40,0) 70%), ${C.deep}`}>
    <Sound src="n-opening.m4a" at={s(0.8)} />
    <div style={{ position: "absolute", left: 96, top: 268, width: 900 }}>
      <Eyebrow dark delay={s(0.6)}>Meet Aino</Eyebrow>
      <Headline dark size={76} delay={s(6.3)} style={{ marginTop: 26 }}>Her bank shows<br />what she <Accent dark>has</Accent>.</Headline>
      <Headline dark size={76} delay={s(8.8)} style={{ marginTop: 6 }}><span style={{ color: C.heroMeta }}>Not what she</span><br /><span style={{ color: C.heroMeta }}>can </span><Underlined at={s(9.8)}><Accent dark>afford</Accent></Underlined>.</Headline>
    </div>
    <In delay={s(1.0)} style={{ position: "absolute", left: 96, top: 900 }}>
      <Badge kind="illustration" dark text="Illustration · Aino is a fictional customer · synthetic data" />
    </In>
    {/* the person: a simple faceless figure */}
    <In delay={s(0.9)} from="scale" style={{ position: "absolute", left: 1140, top: 150 }}>
      <Figure size={300} />
    </In>
    <In delay={s(1.2)} from="up" dist={16} style={{ position: "absolute", left: 1140, top: 470, width: 300, textAlign: "center" }}>
      <div style={{ fontSize: 34, fontWeight: 700, color: "#fff" }}>Aino</div>
    </In>
    <div style={{ position: "absolute", left: 1140, top: 570, display: "grid", gap: 28 }}>
      {facts.map(f => <In key={f.d} delay={s(f.d)} from="left" dist={30} style={{ display: "flex", alignItems: "center", gap: 26 }}>
        {f.icon}
        <div style={{ fontSize: 34, fontWeight: 500, color: C.heroMeta, whiteSpace: "nowrap" }}>{f.text}</div>
      </In>)}
    </div>
  </Slide>;
};
const Figure: React.FC<{ size: number }> = ({ size }) =>
  <svg width={size} height={size} viewBox="0 0 300 300">
    <defs><clipPath id="fig-disc"><circle cx="150" cy="150" r="150" /></clipPath></defs>
    <circle cx="150" cy="150" r="150" fill={C.deeper} />
    <circle cx="150" cy="150" r="149" fill="none" stroke="rgba(145,250,155,.28)" strokeWidth="2" />
    <g clipPath="url(#fig-disc)">
      <circle cx="150" cy="122" r="54" fill={C.mint} />
      <path d="M52 306 C52 226 96 190 150 190 C204 190 248 226 248 306 Z" fill={C.mint} opacity={0.9} />
    </g>
  </svg>;
/** A drawn sneaker (illustration, no brand). */
const SneakerDisc: React.FC = () =>
  <div style={{ width: 76, height: 76, borderRadius: 76, background: "rgba(145,250,155,.16)", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 24 24" width={44} height={44} fill="none" stroke={C.mint} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 16V8.5h4c.4 1.9 2.4 2.6 4 1.6l2.6 1.5 4.6 1.4c2.3.7 3.8 1.6 3.8 3z" />
      <path d="M2.5 16h19v1.6c0 .5-.4.9-.9.9H3.4c-.5 0-.9-.4-.9-.9z" />
      <path d="M10.6 11.1l.9 1.4M13.1 12.2l.8 1.3" />
    </svg>
  </div>;
/** A mint underline drawn under a word (entrance only). */
const Underlined: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const p = ease(useProgress(at, at + 18));
  return <span style={{ position: "relative", display: "inline-block" }}>{children}
    <span style={{ position: "absolute", left: 0, bottom: -4, width: `${100 * p}%`, height: 6, borderRadius: 6, background: C.mint }} /></span>;
};

/* ============================================================ 02 · The data (24 s) */
// "She's not alone.(0.8) In the challenge data,(2.0) three point six million transactions(3.6) from five thousand one hundred
//  customers,(5.6) seven in ten dipped below zero(8.3) at least once in two years.(10.5) Among eighteen to twenty-four-year-olds,(13.3)
//  it's eight in ten.(15.3) Almost always in the last days before payday.(16.6)"
export const S02Data: React.FC = () => <Slide n={2} sources={DATA_SOURCES}>
  <Sound src="n-data.m4a" at={s(0.8)} />
  <Title eyebrow="The data">Seven in ten dipped <Accent>below zero</Accent>.</Title>
  <In delay={s(0.6)} style={{ position: "absolute", right: 96, top: 76 }}><Badge kind="data" /></In>
  {/* the dataset line */}
  <div style={{ position: "absolute", left: 96, top: 216, display: "flex", alignItems: "baseline", gap: 18, fontSize: 30, color: C.muted }}>
    <In delay={s(3.5)} from="up" dist={14}><span><b style={{ color: C.ink, fontWeight: 700 }}>3.6 million</b> transactions</span></In>
    <In delay={s(5.5)} from="up" dist={14}><span>· <b style={{ color: C.ink, fontWeight: 700 }}>5 100</b> customers</span></In>
    <In delay={s(7.0)} from="up" dist={14}><span>· <b style={{ color: C.ink, fontWeight: 700 }}>24 months</b>, October 2024 to September 2026</span></In>
  </div>
  <div style={{ position: "absolute", left: 96, top: 296, width: 1728, height: 2, background: C.line }} />
  <Proportion x={96} pct={69} at={s(8.2)} color={C.green} title="of all customers" />
  <Proportion x={1000} pct={80} at={s(15.0)} color={C.deep} title="of 18–24-year-olds" />
  <PayCycle at={s(16.5)} />
</Slide>;

/** 10 × 10 dots, `pct` of them filled (one dot = 1%), with the figure beside them. */
const Proportion: React.FC<{ x: number; pct: number; at: number; color: string; title: string }> = ({ x, pct, at, color, title }) => {
  const frame = useCurrentFrame();
  const shown = useIn(at - 6, 200, 20);
  const dot = 26, gap = 9, side = 10 * dot + 9 * gap;
  return <div style={{ position: "absolute", left: x, top: 350, display: "flex", gap: 46, alignItems: "center", opacity: Math.min(1, shown * 1.4) }}>
    <svg width={side} height={side} style={{ flexShrink: 0 }}>
      {Array.from({ length: 100 }, (_, k) => {
        // fill in reading order, row by row from the top, over 1.2 s
        const on = k < pct ? Math.max(0, Math.min(1, (frame - at - k * 0.36) / 6)) : 0;
        const cx = (k % 10) * (dot + gap) + dot / 2, cy = Math.floor(k / 10) * (dot + gap) + dot / 2;
        return <g key={k}>
          <circle cx={cx} cy={cy} r={dot / 2} fill={C.track} />
          {on > 0 ? <circle cx={cx} cy={cy} r={(dot / 2) * (0.6 + 0.4 * on)} fill={color} opacity={on} /> : null}
        </g>;
      })}
    </svg>
    <In delay={at + 4} from="up" dist={20} style={{ width: 420 }}>
      <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: -4, lineHeight: 0.95, color, fontVariantNumeric: "tabular-nums" }}><CountUp to={pct} delay={at} frames={36} suffix="%" /></div>
      <div style={{ marginTop: 18, fontSize: 34, fontWeight: 700, color: C.ink }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 26, lineHeight: 1.35, color: C.muted }}>dipped below zero at least once<br />in two years</div>
    </In>
  </div>;
};

/** One pay cycle of 30 days: payday at the left, the last ten days (20+ days after payday) highlighted. */
const PayCycle: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const left = 450, width = 1824 - left, gap = 6, cell = (width - 29 * gap) / 30, top = 840, h = 52;
  const strip = useIn(at, 200, 24);
  return <>
    <div style={{ position: "absolute", left: 96, top: 740, width: 1728, height: 2, background: C.line }} />
    <In delay={at + 8} from="up" dist={20} style={{ position: "absolute", left: 96, top: 788, width: 320 }}>
      <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1, color: C.green, fontVariantNumeric: "tabular-nums" }}><CountUp to={96} delay={at + 8} frames={30} suffix="%" /></div>
      <div style={{ marginTop: 10, fontSize: 24, lineHeight: 1.3, color: C.muted }}>of dips bottom out 20 or<br />more days after payday</div>
    </In>
    <In delay={at} from="up" dist={14} style={{ position: "absolute", left, top: 782, width }}>
      <div style={{ fontSize: 30, color: C.ink }}>Almost always in the <b style={{ color: C.green }}>last days before payday</b></div>
    </In>
    <div style={{ position: "absolute", left, top, opacity: Math.min(1, strip * 1.4) }}>
      {Array.from({ length: 30 }, (_, k) => {
        const late = k >= 20;
        const lit = late ? ease(Math.max(0, Math.min(1, (frame - at - 14 - (k - 20) * 2) / 10))) : 0;
        return <div key={k} style={{ position: "absolute", left: k * (cell + gap), top: 0, width: cell, height: h, borderRadius: 8,
          background: k === 0 ? C.deep : C.track, overflow: "hidden" }}>
          {late ? <div style={{ position: "absolute", inset: 0, background: C.green, opacity: lit }} /> : null}
        </div>;
      })}
      <div style={{ position: "absolute", left: 0, top: h + 12, fontSize: 22, fontWeight: 700, color: C.deep, whiteSpace: "nowrap" }}>Payday</div>
      <div style={{ position: "absolute", left: 20 * (cell + gap), top: h + 12, fontSize: 22, fontWeight: 600, color: C.green, whiteSpace: "nowrap" }}>20+ days after</div>
      <div style={{ position: "absolute", left: width, top: h + 12, transform: "translateX(-100%)", fontSize: 22, color: C.muted, whiteSpace: "nowrap" }}>Next payday</div>
    </div>
  </>;
};

/* ============================================================ 03 · The insight (20 s) */
// "And the dips are small.(0.8) A typical everyday purchase is thirty-nine euros.(2.4) The deepest dip in two years(4.6)
//  is the size of six of them.(6.6) So this isn't a maths problem.(8.8) It's about the moment,(10.7)
//  and whether the money is still there(12.0) when the dip would have come.(13.9)"
export const S03Insight: React.FC = () => <Slide n={3} sources={DATA_SOURCES}>
  <Sound src="n-insight.m4a" at={s(0.8)} />
  <Title eyebrow="The insight" width={1400}>The dips are small.<br />The <Accent>moment</Accent> is the problem.</Title>
  <In delay={s(0.6)} style={{ position: "absolute", right: 96, top: 76 }}><Badge kind="data" /></In>
  <Tokens at={s(2.3)} />
  <Trim at={s(10.4)} />
  <In delay={s(12.6)} from="up" dist={24} style={{ position: "absolute", left: 96, top: 800, width: 1728 }}>
    <div style={{ height: 2, background: C.line, marginBottom: 34 }} />
    <div style={{ fontSize: 46, fontWeight: 600, letterSpacing: -0.8, color: C.inkStrong }}>Skipping a purchase is not enough. <span style={{ color: C.green, fontWeight: 700 }}>The money has to stay.</span></div>
  </In>
</Slide>;

/** Six 39 € tokens; the deepest dip measures 5.9 of them (five full, the sixth a 90% wedge; the bracket is exactly 5.9 token widths). */
const Tokens: React.FC<{ at: number }> = ({ at }) => {
  const d = 122, gap = 14, unit = d + gap, top = 400;
  const dipAt = at + s(2.3);           // "The deepest dip in two years"
  const bracket = ease(useProgress(dipAt + s(2.2), dipAt + s(2.2) + 24));
  const dipLen = 5 * unit + 0.9 * d;   // 5.9 typical purchases
  return <div style={{ position: "absolute", left: 96, top: 318, width: 900 }}>
    <In delay={at} from="up" dist={14}><div style={{ fontSize: 28, color: C.muted }}>A typical everyday purchase · median customer</div></In>
    <div style={{ position: "absolute", left: 0, top: top - 318 }}>
      {Array.from({ length: 6 }, (_, k) => <Token key={k} x={k * unit} d={d} fill={k < 5 ? 1 : 0.9} at={k === 0 ? at + 6 : dipAt + (k - 1) * 9} />)}
      {/* the bracket: exactly 5.9 tokens long */}
      <svg width={dipLen + 4} height={34} style={{ position: "absolute", left: 0, top: d + 22, overflow: "visible" }}>
        <path d={`M2 2 V16 H${2 + dipLen * bracket}`} fill="none" stroke={C.deep} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={bracket > 0 ? 1 : 0} />
        <path d={`M${2 + dipLen} 2 V16`} fill="none" stroke={C.deep} strokeWidth={3} strokeLinecap="round" opacity={Math.max(0, Math.min(1, (bracket - 0.9) * 10))} />
      </svg>
      <In delay={dipAt + s(2.4)} from="up" dist={16} style={{ position: "absolute", left: 0, top: d + 72, width: 880 }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: C.ink }}>The deepest dip in two years = <span style={{ color: C.green }}>5.9 purchases</span></div>
        <div style={{ marginTop: 8, fontSize: 24, color: C.muted }}>median customer who went below zero</div>
      </In>
    </div>
  </div>;
};
const Token: React.FC<{ x: number; d: number; fill: number; at: number }> = ({ x, d, fill, at }) => {
  const t = useIn(at, 200, 22);
  return <div style={{ position: "absolute", left: x, top: 0, width: d, height: d, opacity: Math.min(1, t * 1.6), transform: `translateY(${(1 - t) * -40}px)` }}>
    <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`}>
      <circle cx={d / 2} cy={d / 2} r={d / 2 - 2} fill={C.track} />
      {fill < 1 ? <path d={wedge(d / 2, d / 2 - 2, fill)} fill={C.green} /> : <circle cx={d / 2} cy={d / 2} r={d / 2 - 2} fill={C.green} />}
      {fill < 1 ? <circle cx={d / 2} cy={d / 2} r={d / 2 - 2} fill="none" stroke={C.green} strokeWidth={2.5} strokeDasharray="5 6" /> : null}
    </svg>
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>{fill < 1 ? "" : "39 €"}</div>
  </div>;
};

/** A pie wedge from 12 o'clock, clockwise, covering `f` of the circle. */
const wedge = (c: number, r: number, f: number) => {
  const a = f * 2 * Math.PI, x = c + r * Math.sin(a), y = c - r * Math.cos(a);
  return `M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
};

/** A 5% trim of everyday extras: kept as a cushion vs kept only until payday. */
const Trim: React.FC<{ at: number }> = ({ at }) => {
  const rows = [
    { label: "Kept, and built up as a cushion", v: 72, color: C.green, d: at + 10 },
    { label: "Kept only until the next payday", v: 15, color: C.faint, d: at + 34 },
  ];
  return <div style={{ position: "absolute", left: 1080, top: 318, width: 744 }}>
    <In delay={at} from="up" dist={14}>
      <div style={{ fontSize: 28, color: C.muted }}>A 5% trim of everyday extras · about 44 € a month</div>
      <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700, color: C.ink }}>Fewer days below zero</div>
    </In>
    <div style={{ marginTop: 38, display: "grid", gap: 34 }}>
      {rows.map(r => <TrimBar key={r.label} {...r} />)}
    </div>
    <In delay={at + 66} from="up" dist={10} style={{ marginTop: 26 }}>
      <div style={{ fontSize: 22, color: C.muted }}>A replay of two years of data, all else unchanged. Not a prediction.</div>
    </In>
  </div>;
};
const TrimBar: React.FC<{ label: string; v: number; color: string; d: number }> = ({ label, v, color, d }) => {
  const e = ease(useProgress(d, d + 30));
  return <In delay={d - 4} from="up" dist={14}>
    <div style={{ fontSize: 26, color: C.inkStrong, marginBottom: 10 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <div style={{ flex: 1, height: 44, background: C.sunken, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ width: `${v * e}%`, height: "100%", background: color, borderRadius: "0 8px 8px 0" }} />
      </div>
      <div style={{ width: 130, textAlign: "right", fontSize: 54, fontWeight: 800, letterSpacing: -1.5, color: color === C.faint ? C.muted : color, fontVariantNumeric: "tabular-nums" }}>
        <CountUp to={v} delay={d} frames={30} suffix="%" /></div>
    </div>
  </In>;
};

/* ============================================================ 13 · The five criteria (20 s) */
// "Five criteria.(0.8) Financial literacy: every answer shows its working.(2.3) Original AI: a shop that sells nothing.(5.5)
//  A clear mobile experience, in two languages.(8.7) Feasible: it's running now.(11.9) And made for S-mobiili.(14.1)"
const criteria = [
  { c: "Financial literacy", lead: "Every answer shows its working", rest: "three baskets · honest model cards", icon: "doc", d: 2.2 },
  { c: "Originality of AI integration", lead: "Crave mode: a generated shop that sells nothing", rest: "answers as cards from tool calls", icon: "spark", d: 5.4 },
  { c: "Mobile UX clarity", lead: "One number first", rest: "cards, not walls of text · English and Finnish", icon: "phone", d: 8.6 },
  { c: "Feasibility", lead: "Live today", rest: "a deterministic engine · a guarded, rate-limited endpoint", icon: "check", d: 11.8 },
  { c: "S-mobiili integration potential", lead: "Lives in the S-mobiili shell", rest: "Säästäjä and PSD2 hand-offs (mocks)", icon: "layers", d: 14.0 },
];
export const S13Criteria: React.FC = () => <Slide n={13} sources={["Junction 2026 S-Pankki challenge: five criteria, 20% each"]}>
  <Sound src="n-criteria.m4a" at={s(0.8)} />
  <Title eyebrow="The five criteria" width={1728}>What we were asked for, and <Accent>what we built</Accent>.</Title>
  <In delay={s(0.9)} style={{ position: "absolute", left: 96, top: 236, width: 1728 }}>
    <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 2.4, textTransform: "uppercase", color: C.faint }}>
      <div style={{ width: 700 }}>Criterion · 20% each</div><div>Our answer</div>
    </div>
  </In>
  <div style={{ position: "absolute", left: 96, top: 282, width: 1728 }}>
    {criteria.map((r, k) => <Criterion key={r.c} n={k + 1} {...r} />)}
  </div>
</Slide>;
const Criterion: React.FC<{ n: number; c: string; lead: string; rest: string; icon: string; d: number }> = ({ n, c, lead, rest, icon, d }) => {
  const line = ease(useProgress(s(d), s(d) + 20));
  return <div style={{ position: "relative", height: 136 }}>
    <div style={{ position: "absolute", left: 0, top: 0, height: 2, width: `${100 * line}%`, background: n === 1 ? C.green : C.line }} />
    <In delay={s(d)} from="up" dist={18} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "flex", alignItems: "center" }}>
      <div style={{ width: 70, fontSize: 26, fontWeight: 700, color: C.green, fontVariantNumeric: "tabular-nums" }}>{String(n).padStart(2, "0")}</div>
      <div style={{ width: 630, fontSize: 34, fontWeight: 700, color: C.ink, lineHeight: 1.15 }}>{c}</div>
      <IconDisc name={icon} size={64} />
      <div style={{ marginLeft: 26, flex: 1, fontSize: 28, lineHeight: 1.35, color: C.muted }}>
        <span style={{ color: C.ink, fontWeight: 600 }}>{lead}</span><br />{rest}
      </div>
    </In>
  </div>;
};

/* ============================================================ 14 · Close (9 s) */
// "Vara.(0.8) Helping you save money, a craving at a time.(1.5–4.1)"
export const S14Close: React.FC = () => {
  const glow = 0.5 + useAmbient(9) * 0.06;
  return <Slide n={14} dark bg={`radial-gradient(1000px 700px at 50% 40%, rgba(145,250,155,${0.14 * glow}), rgba(0,70,40,0) 70%), ${C.deep}`}>
    <Sound src="n-close.m4a" at={s(0.8)} />
    <div style={{ position: "absolute", left: 96, right: 96, top: 178, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <In delay={s(0.3)} from="scale"><Sprout size={176} inverse /></In>
      <In delay={s(0.7)} from="up" dist={24} style={{ marginTop: 30 }}>
        <div style={{ fontSize: 136, fontWeight: 800, letterSpacing: -4, lineHeight: 1, color: "#fff" }}>Vara</div>
      </In>
      <Headline dark size={64} delay={s(1.4)} style={{ marginTop: 30 }}>Helping you save money, <Accent dark>a craving at a time.</Accent></Headline>
      <In delay={s(4.2)} from="up" dist={16} style={{ marginTop: 64, display: "grid", gridTemplateColumns: "auto auto auto", gap: "16px 18px", alignItems: "center", textAlign: "left" }}>
        <Address icon="phone" label="App" url="vara-junction26.swedencentral.cloudapp.azure.com" />
        <Address icon="doc" label="Insights" url="vara-junction26.swedencentral.cloudapp.azure.com/insights/" />
      </In>
      <In delay={s(4.8)} from="up" dist={12} style={{ marginTop: 48 }}>
        <div style={{ fontSize: 24, color: C.heroMeta }}>Junction 2026 concept · not an official S-Pankki product · all data synthetic</div>
      </In>
    </div>
  </Slide>;
};
const Address: React.FC<{ icon: string; label: string; url: string }> = ({ icon, label, url }) => <>
  <Icon name={icon} size={30} color={C.mint} />
  <span style={{ fontSize: 30, color: C.heroMeta, fontWeight: 500, paddingRight: 8 }}>{label}</span>
  <span style={{ fontSize: 30, color: "#fff", fontWeight: 600 }}>{url}</span>
</>;
