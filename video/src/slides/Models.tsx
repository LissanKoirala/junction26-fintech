import React from "react";
import { Accent, Badge, Icon, In, s, Slide, Sound, Title, useIn, useProgress } from "../kit";
import { C } from "../theme";

/* ============================================================ 10 · Eight models (26 s)
 * Phrase times from the pauses measured in the narration file, plus 0.8 s:
 * "Behind the coach are eight machine-learning models trained on the challenge data,(0.8–4.9)
 *  from a balance forecast(5.4) and an overdraft early warning(7.2) to a small transformer that reads account history like text.(8.9–11.6)
 *  We tested each one against the strongest simple baseline we could find.(11.8–16.5)
 *  Two clearly win,(16.8) and ship.(18.1) Six are labelled experimental,(19.1) and the app says so.(21.1–22.2)"
 * Rows arrive with what they are; the comparison column fills at "tested … baseline"; the verdicts arrive
 * when they are spoken: shipped highlight at "Two clearly win", amber chips at "Six are labelled experimental". */

type Row = { name: string; what: string; m?: string; b?: string; lead: "model" | "baseline" | "none"; note?: string; metric?: string; ships?: boolean };
// Figures exactly as in DECK.md "Facts"; the leading value is the one set in bold.
const rows: Row[] = [
  { name: "Crystal ball", what: "Balance forecast with a range", m: "340 €", b: "373 €", lead: "model", note: "8.7% better", metric: "14-day spend error", ships: true },
  { name: "Early warning", what: "Overdraft risk, with reasons", m: "0.800", b: "0.768", lead: "model", metric: "PR AUC · ROC AUC 0.967 vs 0.963", ships: true },
  { name: "Money Map", what: "Customers on one map, “tribes”", m: "0.114", b: "0.071", lead: "model", metric: "silhouette" },
  { name: "Two Futures", what: "What happened next to people like you", lead: "none", note: "On par", metric: "with a one-feature rule" },
  { name: "Unusual for you", what: "Personal anomaly radar", m: "0.889", b: "0.901", lead: "baseline", note: "the baseline wins", metric: "ROC AUC on injected anomalies" },
  { name: "Habit detector", what: "A change that has stuck", m: "3.6%", b: "3.1%", lead: "model", metric: "flagged, vs on shuffled data" },
  { name: "TransactionGPT", what: "Small transformer over account history", m: "45.1%", b: "36.7%", lead: "model", metric: "next category" },
  { name: "First-home readiness", what: "How ready for a mortgage", m: "0.782", b: "0.732", lead: "model", note: "within noise", metric: "AUC" },
];
const ROW_AT = [5.4, 7.2, 8.6, 8.95, 9.3, 9.65, 10.0, 10.35];          // with the narration's examples
const CMP_AT = (k: number) => 12.9 + k * 0.22;                          // "We tested each one against the strongest simple baseline"
const SHIP_AT = 16.8, EXP_AT = 19.1;
const COL = { name: 0, what: 384, cmp: 904, verdict: 1540 };            // x inside the 1728-wide table
const TOP = 232, HEAD_H = 40, ROW_H = 84, GAP = 16;                    // GAP separates the shipped pair from the six
const rowTop = (k: number) => TOP + HEAD_H + k * ROW_H + (k >= 2 ? GAP : 0);
const ease = (t: number) => 1 - (1 - t) ** 3;

export const S10Models: React.FC = () => <Slide n={10} sources={["Model cards in the app and on /insights/ · each re-checked independently"]}>
  <Sound src="n-models.m4a" at={s(0.8)} />
  <Title eyebrow="Eight models" width={1728} size={64}>Tested against the <Accent>strongest simple baseline</Accent>.</Title>
  <In delay={s(0.6)} style={{ position: "absolute", right: 96, top: 66 }}><Badge kind="model" /></In>
  <div style={{ position: "absolute", left: 96, top: 0, width: 1728, height: 1000 }}>
    <In delay={s(1.6)} from="up" dist={12} style={{ position: "absolute", left: 0, top: TOP, width: 1728 }}>
      <div style={{ position: "relative", height: HEAD_H, fontSize: 22, fontWeight: 700, letterSpacing: 2.4, textTransform: "uppercase", color: C.faint }}>
        <span style={{ position: "absolute", left: COL.name + 24 }}>Model</span>
        <span style={{ position: "absolute", left: COL.what }}>What it does</span>
        <span style={{ position: "absolute", left: COL.cmp }}>Model vs strongest simple baseline</span>
        <span style={{ position: "absolute", left: COL.verdict }}>Verdict</span>
      </div>
    </In>
    {rows.map((r, k) => <ModelRow key={r.name} r={r} k={k} />)}
  </div>
</Slide>;

const ModelRow: React.FC<{ r: Row; k: number }> = ({ r, k }) => {
  const d = s(ROW_AT[k]);
  const rule = ease(useProgress(d, d + 18));
  const hi = ease(useProgress(s(SHIP_AT), s(SHIP_AT) + 18));
  const top = rowTop(k);
  return <>
    {/* highlight band behind the two shipped rows */}
    {r.ships ? <div style={{ position: "absolute", left: 0, top: top + 3, width: 1728, height: ROW_H - 6, borderRadius: 14, background: C.screen, opacity: hi }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6 * hi, borderRadius: 6, background: C.green }} />
    </div> : null}
    <div style={{ position: "absolute", left: 0, top, height: 2, width: `${100 * rule}%`, background: k === 0 ? C.green : C.line }} />
    <In delay={d} from="up" dist={16} style={{ position: "absolute", left: 0, top, width: 1728, height: ROW_H }}>
      <div style={{ position: "absolute", left: COL.name + 24, top: 0, height: ROW_H, display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700, color: C.ink, whiteSpace: "nowrap" }}>{r.name}</div>
      <div style={{ position: "absolute", left: COL.what, top: 0, width: COL.cmp - COL.what - 30, height: ROW_H, display: "flex", alignItems: "center", fontSize: 26, lineHeight: 1.25, color: C.muted }}>{r.what}</div>
    </In>
    <In delay={s(CMP_AT(k))} from="left" dist={16} style={{ position: "absolute", left: COL.cmp, top, width: COL.verdict - COL.cmp - 24, height: ROW_H, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Compare r={r} />
    </In>
    <div style={{ position: "absolute", left: COL.verdict, top, height: ROW_H, display: "flex", alignItems: "center" }}>
      {r.ships ? <ShipsChip /> : <ExpChip at={s(EXP_AT) + (k - 2) * 3} />}
    </div>
  </>;
};

/** "model vs baseline": the leading value bold, the other muted; plain-words result in the same weight for every row. */
const Compare: React.FC<{ r: Row }> = ({ r }) => {
  const val = (v: string, strong: boolean) => <span style={{ fontWeight: strong ? 700 : 500, color: strong ? C.ink : C.faint }}>{v}</span>;
  return <>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, fontSize: 30, lineHeight: 1.15, whiteSpace: "nowrap" }}>
      {r.m && r.b ? <>{val(r.m, r.lead === "model")}<span style={{ fontSize: 24, color: C.faint }}>vs</span>{val(r.b, r.lead === "baseline")}</> : null}
      {r.note ? <span style={{ fontSize: 26, fontWeight: 700, color: C.inkStrong }}>{r.m ? "· " : ""}{r.note}</span> : null}
    </div>
    {r.metric ? <div style={{ marginTop: 4, fontSize: 22, color: C.muted, whiteSpace: "nowrap" }}>{r.metric}</div> : null}
  </>;
};

const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 999, fontSize: 22, fontWeight: 700, whiteSpace: "nowrap" };
const ShipsChip: React.FC = () => {
  const t = useIn(s(SHIP_AT) + 4);
  return <div style={{ ...chip, background: C.green, color: "#fff", opacity: Math.min(1, t * 1.4), transform: `scale(${0.86 + 0.14 * t})` }}>
    <Icon name="check" size={22} color="#fff" stroke={2.6} />Ships</div>;
};
/** Amber chip whose entrance carries a ring that starts wide and settles onto the chip (entrance only). */
const ExpChip: React.FC<{ at: number }> = ({ at }) => {
  const t = useIn(at);
  const ring = ease(useProgress(at, at + 22));
  return <div style={{ position: "relative", opacity: Math.min(1, t * 1.4), transform: `scale(${0.86 + 0.14 * t})` }}>
    <div style={{ ...chip, background: C.warnBg, color: C.warn, border: `1.5px solid ${C.warn}55` }}>Experimental</div>
    <div style={{ position: "absolute", inset: -10 * (1 - ring), borderRadius: 999, border: `2px solid ${C.warn}`, opacity: 0.15 + 0.45 * (1 - ring) }} />
  </div>;
};
