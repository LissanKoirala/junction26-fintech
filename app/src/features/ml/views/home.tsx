// First-home readiness (illustrative) and TransactionGPT possible futures (experiment).
import { useState } from "react";
import { House, KeyRound, Sparkles } from "lucide-react";
import type { MlHome } from "@shared/ml/typesA";
import type { MlTxGpt } from "@shared/ml/typesB";
import { Progress, Segmented, Slider, cx, IconCircle, STROKE } from "@/ui/kit";
import { categoryIcon, categoryLabel } from "@/lib/domain";
import { dateDM, dateShort, money, num, pct } from "@/lib/format";
import { rich, t, tData, tn } from "@/lib/i18n";
import { FUTURE_LABEL } from "../words";
import { MiniStat } from "../ui";

export function yearsAt(h: MlHome, extra: number): number | null {
  const m = h.monthlySavingNow + extra;
  if (h.equity.gap <= 0) return 0;
  if (m <= 0) return null;
  return h.equity.gap / m / 12;
}
export function yearsText(y: number | null): string {
  if (y == null) return t("not at the current pace");
  if (y <= 0) return t("ready now");
  if (y < 1) {
    const n = Math.max(1, Math.round(y * 12));
    return tn("about {n} month", "about {n} months", n);
  }
  if (y > 60) return t("more than 60 years");
  return t("about {n} years", { n: num(y, y < 10 ? 1 : 0) });
}

/** English keys for the decision and reason codes of a linked mortgage application. */
const DECISION: Record<string, string> = { approved: "approved", rejected: "rejected" };
const REASON: Record<string, string> = {
  insufficient_collateral: "not enough collateral",
  insufficient_income: "income too low",
  insufficient_equity: "not enough own money",
  existing_debt: "existing debt",
};

/** Price range bar: p25-p75 band with the median marked. */
function PriceRange({ h }: { h: MlHome }) {
  const { priceP25: a, priceP50: m, priceP75: b } = h.reachable;
  const lo = a * 0.85, hi = b * 1.1;
  const P = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div>
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-3 h-2 rounded-pill bg-track" />
        <div className="absolute top-3 h-2 rounded-pill bg-green-500" style={{ left: P(a), width: `calc(${P(b)} - ${P(a)})` }} />
        <div className="absolute top-1.5 h-5 w-5 -translate-x-1/2 rounded-pill border-2 border-white bg-green-900 shadow-low" style={{ left: P(m) }} />
      </div>
      <div className="tnum relative h-4 text-xs text-ink-muted">
        <span className="absolute -translate-x-1/2" style={{ left: P(a) }}>{money(a / 1000, { whole: true }).replace(/\s€$/, "k €")}</span>
        <span className="absolute -translate-x-1/2 font-semibold text-ink" style={{ left: P(m) }}>{money(m / 1000, { whole: true }).replace(/\s€$/, "k €")}</span>
        <span className="absolute -translate-x-1/2" style={{ left: P(b) }}>{money(b / 1000, { whole: true }).replace(/\s€$/, "k €")}</span>
      </div>
    </div>
  );
}

export function HomeView({ h, compact }: { h: MlHome; compact?: boolean }) {
  const [extra, setExtra] = useState(0);
  const y = yearsAt(h, extra);
  const have = Math.max(0, h.equity.currentSavings);
  const share = h.equity.neededForP50 > 0 ? have / h.equity.neededForP50 : 0;
  const p = h.approval.probabilityIfAppliedNow;
  const la = h.linkedApplication;
  const monthly = money(h.monthlySavingNow + extra, { whole: true });
  return (
    <div>
      <p className="text-sm text-ink-muted">{t("Homes that {n} applicants with an income like yours were approved for", { n: h.reachable.nSimilar })}</p>
      <div className="mt-1">
        <PriceRange h={h} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStat label={t("Typical own money")} value={money(h.equity.neededForP50, { whole: true })} sub={t("{pct} % of the price", { pct: num(h.equity.typicalSharePct) })} />
        <MiniStat label={t("Still to save")} value={money(Math.max(0, h.equity.gap), { whole: true })} sub={t("you have {amount}", { amount: money(have, { whole: true }) })} />
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-ink-muted">
          <span>{t("Your savings towards it")}</span>
          <span className="tnum">{pct(Math.min(1, share))}</span>
        </div>
        <Progress value={share} label={t("Savings towards typical own money")} />
        {h.equity.savingsNote && !compact && <p className="mt-1 text-xs text-ink-muted">{tData(h.equity.savingsNote)}</p>}
      </div>
      <div className="mt-3 rounded-md bg-hero-deep p-3 text-white">
        <p className="text-xs text-hero-meta">
          {extra
            ? t("At {amount} a month ({extra}), you'd be there in", { amount: monthly, extra: money(extra, { whole: true, sign: true }) })
            : t("At {amount} a month (your pace now), you'd be there in", { amount: monthly })}
        </p>
        <p className="text-2xl font-bold text-hero-num">{yearsText(y)}</p>
      </div>
      {!compact && (
        <div className="mt-2">
          <Slider
            label={t("Save more each month")}
            value={extra}
            min={0}
            max={600}
            step={10}
            onChange={setExtra}
            valueLabel={money(extra, { whole: true, sign: extra > 0 })}
            icon={KeyRound}
          />
        </div>
      )}
      {p != null && <p className="mt-2 text-sm text-ink">{rich(t("If you applied today, similar applications were approved about **{pct}** of the time.", { pct: pct(p) }))}</p>}
      {!compact && h.blockers.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {h.blockers.map((b) => (
            <li key={b} className="flex gap-2 text-sm leading-snug text-ink">
              <House size={16} strokeWidth={STROKE} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
              <span>{tData(b)}</span>
            </li>
          ))}
        </ul>
      )}
      {!compact && la && (
        <p className="mt-2 text-sm text-ink-muted">
          {la.reason
            ? t("You applied for a {price} home in this dataset: {decision} ({reason}).", {
                price: money(la.price, { whole: true }),
                decision: DECISION[la.decision] ? t(DECISION[la.decision]) : la.decision,
                reason: REASON[la.reason] ? t(REASON[la.reason]) : la.reason.replace(/_/g, " "),
              })
            : t("You applied for a {price} home in this dataset: {decision}.", { price: money(la.price, { whole: true }), decision: DECISION[la.decision] ? t(DECISION[la.decision]) : la.decision })}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ TransactionGPT
export function FuturesView({ t: tg, compact }: { t: MlTxGpt; compact?: boolean }) {
  const order = ["thrifty", "typical", "spendy"] as const;
  const futures = order.map((k) => tg.futures.find((f) => f.label === k)).filter(Boolean) as MlTxGpt["futures"];
  const [sel, setSel] = useState<(typeof order)[number]>("typical");
  const max = Math.max(1, ...futures.map((f) => f.total));
  const cur = futures.find((f) => f.label === sel) ?? futures[0];
  if (!cur) return <p className="text-sm text-ink-muted">{t("No sampled futures in this file.")}</p>;
  const days = cur.days.filter((d) => d.events.length);
  return (
    <div>
      <ul className="flex flex-col gap-1.5">
        {futures.map((f) => (
          <li key={f.label}>
            <button type="button" onClick={() => setSel(f.label)} className={cx("flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm", sel === f.label && "bg-green-50")}>
              <span className={cx("min-w-[60px] shrink-0", sel === f.label ? "font-semibold text-ink" : "text-ink-muted")}>{t(FUTURE_LABEL[f.label])}</span>
              <span className="h-2 min-w-0 flex-1">
                <span className="block h-full rounded-r-[4px]" style={{ width: `${(f.total / max) * 100}%`, background: sel === f.label ? "#007841" : "#99D59F" }} />
              </span>
              <span className="tnum w-[72px] shrink-0 text-right font-semibold text-ink">{money(f.total, { whole: true })}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-ink-muted">
        {t("Across {n} sampled fortnights: typically {mid}, 8 in 10 between {lo} and {hi}.", {
          n: tg.next14.nSamples,
          mid: money(tg.next14.p50, { whole: true }),
          lo: money(tg.next14.p10, { whole: true }),
          hi: money(tg.next14.p90, { whole: true }),
        })}
      </p>
      {!compact && (
        <>
          <Segmented
            className="mt-3"
            label={t("Choose a sampled future")}
            value={sel}
            onChange={setSel}
            options={futures.map((f) => ({ value: f.label, label: t(FUTURE_LABEL[f.label]) }))}
          />
          <ol className="mt-3 flex flex-col">
            {days.slice(0, 6).map((d) => (
              <li key={d.date} className="flex gap-3 border-l-2 border-green-200 pb-2.5 pl-3 last:pb-0">
                <span className="tnum w-[70px] shrink-0 text-xs font-semibold text-ink-strong">{dateShort(d.date)}</span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {d.events.slice(0, 3).map((e, i) => {
                    const I = categoryIcon(e.category);
                    return (
                      <span key={i} className="inline-flex items-center gap-1 rounded-pill bg-green-50 px-2 py-0.5 text-xs text-ink">
                        <I size={12} strokeWidth={STROKE} className="text-green-700" aria-hidden />
                        {categoryLabel(e.category)}
                        <span className="tnum font-semibold">{money(Math.abs(e.amount), { whole: Math.abs(e.amount) >= 100 })}</span>
                      </span>
                    );
                  })}
                </span>
              </li>
            ))}
            {days.length > 6 && <li className="pl-3 text-xs text-ink-muted">{tn("+ {n} more day with purchases", "+ {n} more days with purchases", days.length - 6)}</li>}
          </ol>
        </>
      )}
      {tg.nextCategoryTop3.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Most likely next purchase")}</p>
          <div className="flex flex-wrap gap-1.5">
            {tg.nextCategoryTop3.map((c) => {
              const I = categoryIcon(c.category);
              return (
                <span key={c.category} className="inline-flex items-center gap-1.5 rounded-pill border border-green-200 bg-card px-3 py-1 text-sm text-ink">
                  <I size={14} strokeWidth={STROKE} className="text-green-700" aria-hidden />
                  {categoryLabel(c.category)}
                  <span className="tnum text-ink-muted">{pct(c.p)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
      {!compact && tg.surprises.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <Sparkles size={12} strokeWidth={STROKE} aria-hidden /> {t("What surprised the model")}
          </p>
          <ul className="flex flex-col">
            {tg.surprises.slice(0, 3).map((s) => (
              <li key={s.i} className="flex items-center gap-3 py-1.5">
                <IconCircle icon={categoryIcon(s.category)} size={30} />
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {t("{category} on {date}", { category: categoryLabel(s.category), date: dateDM(s.date) })}
                  <span className="block text-xs text-ink-muted">{t("more surprising than {pct} % of your purchases", { pct: Math.round(s.percentile) })}</span>
                </span>
                <span className="tnum shrink-0 text-sm font-semibold">{money(s.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
