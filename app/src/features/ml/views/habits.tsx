// Unusual for you (anomalies) and Habits views.
import { Check, PartyPopper, MessageCircleQuestion, Umbrella, Undo2 } from "lucide-react";
import type { MlAnomalies } from "@shared/ml/typesA";
import type { CustomerData, Basket } from "@shared/types";
import { BarStrip, Sparkline } from "@/ui/charts/Sparkline";
import { Badge, Button, cx, IconCircle, STROKE } from "@/ui/kit";
import { actions, usePrefs, updatePrefs } from "@/state/store";
import { basketMeta, categoryIcon, categoryLabel, mccLabel } from "@/lib/domain";
import { addDays, dateDM, dateFi, dateShort, daysBetween, money, pctSigned } from "@/lib/format";
import { t, tn } from "@/lib/i18n";
import { HABIT_STATUS, habitGood, habitHeadline, habitLevel, habitName, tD as tData, type Habit } from "../words";

type Anom = MlAnomalies["transactions"][number];

function findTx(c: CustomerData | null, a: Anom) {
  if (!c) return null;
  const x = c.tx[a.i];
  if (x && x.i === a.i) return x;
  return c.tx.find((y) => y.i === a.i) ?? null;
}

const SURPRISE: Basket = "must_irregular";
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export function UnusualList({ a, customer, limit = 5, compact }: { a: MlAnomalies; customer: CustomerData | null; limit?: number; compact?: boolean }) {
  const prefs = usePrefs();
  const items = a.transactions.slice(0, limit);
  if (!items.length) return <p className="text-sm text-ink-muted">{t("Nothing stood out in the last 12 months. Your spending followed your own usual pattern.")}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((an) => {
        const tx = findTx(customer, an);
        const override = prefs.overrides.byTx?.[an.i];
        const current = (override ?? an.basket) as Basket | undefined;
        const isSurprise = current === SURPRISE;
        const suggested = an.suggestedBasket === SURPRISE;
        const canMove = !!tx && !compact && !isSurprise;
        const title = (tx && tx.type === "purchase" && mccLabel(tx.mcc)) || categoryLabel(an.category);
        const move = () => actions.overrideTx(an.i, SURPRISE, t("{what} on {date} ({amount}) is a Surprise must", { what: title, date: dateFi(an.date), amount: money(an.amount) }));
        return (
          <li key={an.i} className="py-2.5">
            <div className="flex items-start gap-3">
              <IconCircle icon={categoryIcon(an.category)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-ink">{cap(an.reasons[0] ? tData(an.reasons[0]) : t("Unusual for you"))}</p>
                <p className="text-xs text-ink-muted">
                  {title} · {dateShort(an.date)}
                  {an.time ? ` · ${an.time.slice(0, 5)}` : ""}
                  {an.reasons.length > 1 ? ` · ${an.reasons.slice(1).map((r) => tData(r)).join(", ")}` : ""}
                </p>
              </div>
              <span className="tnum shrink-0 text-sm font-semibold text-ink">{money(an.amount)}</span>
            </div>
            {!compact && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-12">
                {current && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                    <span className="h-2 w-2 rounded-pill" style={{ background: basketMeta(current)?.color }} aria-hidden />
                    {basketMeta(current)?.label}
                  </span>
                )}
                {override === SURPRISE ? (
                  <>
                    <Badge tone="success">
                      <Check size={12} strokeWidth={2} aria-hidden /> {t("Moved")}
                    </Badge>
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-green-700"
                      onClick={() =>
                        updatePrefs((p) => {
                          const byTx = { ...(p.overrides.byTx ?? {}) };
                          delete byTx[an.i];
                          return { ...p, overrides: { ...p.overrides, byTx } };
                        })
                      }
                    >
                      <Undo2 size={12} strokeWidth={STROKE} aria-hidden /> {t("Undo")}
                    </button>
                  </>
                ) : canMove ? (
                  suggested ? (
                    <Button size="sm" variant="soft" icon={Umbrella} className="min-h-8 px-3 text-xs" onClick={move}>
                      {t("Move to Surprise musts")}
                    </Button>
                  ) : (
                    <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-pill px-1 text-xs font-semibold text-green-700 hover:underline" onClick={move}>
                      <Umbrella size={14} strokeWidth={STROKE} aria-hidden />
                      {t("It was a must")}
                    </button>
                  )
                ) : null}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The last 52 weeks as a strip; only the unusual weeks get a bar, at their place in the year. */
export function UnusualWeeks({ a }: { a: MlAnomalies }) {
  const weeks = [...a.weeks].sort((x, y) => x.weekStart.localeCompare(y.weekStart));
  if (!weeks.length) return null;
  const start = addDays(a.asOf, -364);
  const slots = Array.from({ length: 52 }, (_, i) => ({ key: addDays(start, i * 7), label: "", value: 0, highlight: true as boolean, ref: undefined as number | undefined }));
  for (const w of weeks) {
    const i = Math.floor(daysBetween(start, w.weekStart) / 7);
    if (i < 0 || i >= 52) continue;
    const d = dateDM(w.weekStart);
    slots[i] = {
      key: w.weekStart,
      label: w.drivers[0] ? t("Week of {date} · mostly {category}", { date: d, category: categoryLabel(w.drivers[0].category) }) : t("Week of {date}", { date: d }),
      value: w.spend,
      highlight: true,
      ref: w.typical,
    };
  }
  const n = weeks.length;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-ink-muted">
        <span>{tn("{n} unusual week in the last year", "{n} unusual weeks in the last year", n)}</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-ink/50" aria-hidden />
          {t("your typical week {amount}", { amount: money(weeks[0].typical, { whole: true }) })}
        </span>
      </div>
      <BarStrip
        items={slots}
        format={(v) => money(v, { whole: true })}
        ariaLabel={tn("{n} unusual week in the last year, spending from {from} to {to} a week", "{n} unusual weeks in the last year, spending from {from} to {to} a week", n, {
          from: money(Math.min(...weeks.map((w) => w.spend)), { whole: true }),
          to: money(Math.max(...weeks.map((w) => w.spend)), { whole: true }),
        })}
        height={56}
      />
      <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
        <span>{dateDM(start)}</span>
        <span>{t("now")}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ habits
function changeIndex(h: Habit): number {
  const i = h.series.findIndex((p) => p.weekStart >= h.since);
  return i < 0 ? h.series.length - 1 : i;
}

export function HabitCard({ h, compact }: { h: Habit; compact?: boolean }) {
  const good = habitGood(h);
  const ci = changeIndex(h);
  const n = h.series.length;
  const fmt = (v: number) => habitLevel(h, v);
  return (
    <div className={cx("rounded-md p-3", good ? "bg-green-50" : "bg-sunken")}>
      <div className="flex items-start gap-2.5">
        <IconCircle icon={good ? PartyPopper : MessageCircleQuestion} tone={good ? "white" : "white"} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={good ? "success" : "warning"}>{t(HABIT_STATUS[h.status])}</Badge>
            <span className="text-xs text-ink-muted">{tn("since {date} · {n} week", "since {date} · {n} weeks", h.weeks, { date: dateDM(h.since) })}</span>
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug text-ink">{habitHeadline(h)}</p>
        </div>
      </div>
      <div className="mt-2">
        <Sparkline
          values={h.series.map((p) => p.value)}
          labels={h.series.map((p) => t("Week of {date}", { date: dateDM(p.weekStart) }))}
          format={fmt}
          color={good ? "#007841" : "#CF8300"}
          height={compact ? 46 : 58}
          markerIndex={ci}
          markerLabel={t("change")}
          levels={[
            { from: 0, to: ci, value: h.before },
            { from: ci, to: n - 1, value: h.after },
          ]}
          zero
          ariaLabel={t("{name} per week over {n} weeks: about {before} before {date}, about {after} since", { name: habitName(h), n, before: fmt(h.before), date: dateDM(h.since), after: fmt(h.after) })}
        />
      </div>
      <div className="tnum mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="text-ink">
          {fmt(h.before)} → <span className="font-semibold">{fmt(h.after)}</span>
          <span className="ml-1 text-xs text-ink-muted">({pctSigned(h.changePct)})</span>
        </span>
        <span className={cx("font-semibold", good ? "text-green-700" : "text-warning")}>
          {good ? t("≈ {amount} a month saved", { amount: money(h.monthlyImpact, { whole: true }) }) : t("≈ {amount} a month more", { amount: money(Math.abs(h.monthlyImpact), { whole: true }) })}
        </span>
      </div>
    </div>
  );
}
