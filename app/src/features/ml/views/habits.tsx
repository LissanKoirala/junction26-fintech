// Unusual for you (anomalies) and Habits views.
import { Check, PartyPopper, MessageCircleQuestion, Umbrella, Undo2 } from "lucide-react";
import type { MlAnomalies } from "@shared/ml/typesA";
import type { CustomerData, Basket } from "@shared/types";
import { BarStrip, Sparkline } from "@/ui/charts/Sparkline";
import { Badge, Button, cx, IconCircle, STROKE } from "@/ui/kit";
import { actions, usePrefs, updatePrefs } from "@/state/store";
import { basketMeta, categoryIcon, categoryLabel, mccLabel } from "@/lib/domain";
import { dateDM, dateFi, dateShort, money, pctSigned } from "@/lib/format";
import { HABIT_STATUS, habitGood, habitHeadline, habitLevel, habitName, type Habit } from "../words";

type Anom = MlAnomalies["transactions"][number];

function findTx(c: CustomerData | null, a: Anom) {
  if (!c) return null;
  const t = c.tx[a.i];
  if (t && t.i === a.i) return t;
  return c.tx.find((x) => x.i === a.i) ?? null;
}

const SURPRISE: Basket = "must_irregular";

export function UnusualList({ a, customer, limit = 5, compact }: { a: MlAnomalies; customer: CustomerData | null; limit?: number; compact?: boolean }) {
  const prefs = usePrefs();
  const items = a.transactions.slice(0, limit);
  if (!items.length) return <p className="text-sm text-ink-muted">Nothing stood out in the last 12 months. Your spending followed your own usual pattern.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((t) => {
        const tx = findTx(customer, t);
        const override = prefs.overrides.byTx?.[t.i];
        const current = (override ?? t.basket) as Basket | undefined;
        const isSurprise = current === SURPRISE;
        const suggested = t.suggestedBasket === SURPRISE;
        const canMove = !!tx && !compact && !isSurprise;
        const title = (tx && tx.type === "purchase" && mccLabel(tx.mcc)) || categoryLabel(t.category);
        return (
          <li key={t.i} className="py-2.5">
            <div className="flex items-start gap-3">
              <IconCircle icon={categoryIcon(t.category)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-ink">{t.reasons[0] ?? "Unusual for you"}</p>
                <p className="text-xs text-ink-muted">
                  {title} · {dateShort(t.date)}
                  {t.time ? ` · ${t.time.slice(0, 5)}` : ""}
                  {t.reasons.length > 1 ? ` · ${t.reasons.slice(1).join(", ")}` : ""}
                </p>
              </div>
              <span className="tnum shrink-0 text-sm font-semibold text-ink">{money(t.amount)}</span>
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
                      <Check size={12} strokeWidth={2} aria-hidden /> Moved
                    </Badge>
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-green-700"
                      onClick={() =>
                        updatePrefs((p) => {
                          const byTx = { ...(p.overrides.byTx ?? {}) };
                          delete byTx[t.i];
                          return { ...p, overrides: { ...p.overrides, byTx } };
                        })
                      }
                    >
                      <Undo2 size={12} strokeWidth={STROKE} aria-hidden /> Undo
                    </button>
                  </>
                ) : canMove ? (
                  <Button
                    size="sm"
                    variant={suggested ? "soft" : "tonal"}
                    icon={Umbrella}
                    className="min-h-8 px-3 text-xs"
                    onClick={() => actions.overrideTx(t.i, SURPRISE, `${title} on ${dateFi(t.date)} (${money(t.amount)}) is a Surprise must`)}
                  >
                    {suggested ? "Move to Surprise musts (suggested)" : "It was a must: move to Surprise musts"}
                  </Button>
                ) : null}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function UnusualWeeks({ a, limit = 12 }: { a: MlAnomalies; limit?: number }) {
  const weeks = [...a.weeks].sort((x, y) => x.weekStart.localeCompare(y.weekStart)).slice(-limit);
  if (!weeks.length) return null;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-ink-muted">
        <span>Unusual weeks: what you spent</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-ink/50" aria-hidden />
          your typical week {money(weeks[0].typical, { whole: true })}
        </span>
      </div>
      <BarStrip
        items={weeks.map((w) => ({ key: w.weekStart, label: `Week of ${dateDM(w.weekStart)}${w.drivers[0] ? ` · mostly ${categoryLabel(w.drivers[0].category)}` : ""}`, value: w.spend, ref: w.typical, highlight: true }))}
        format={(v) => money(v, { whole: true })}
        ariaLabel={`${weeks.length} unusual weeks, spending from ${money(Math.min(...weeks.map((w) => w.spend)), { whole: true })} to ${money(Math.max(...weeks.map((w) => w.spend)), { whole: true })}`}
        height={64}
      />
      <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
        <span>{dateDM(weeks[0].weekStart)}</span>
        <span>{dateDM(weeks[weeks.length - 1].weekStart)}</span>
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
            <Badge tone={good ? "success" : "warning"}>{HABIT_STATUS[h.status]}</Badge>
            <span className="text-xs text-ink-muted">since {dateDM(h.since)} · {h.weeks} weeks</span>
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug text-ink">{habitHeadline(h)}</p>
        </div>
      </div>
      <div className="mt-2">
        <Sparkline
          values={h.series.map((p) => p.value)}
          labels={h.series.map((p) => `Week of ${dateDM(p.weekStart)}`)}
          format={fmt}
          color={good ? "#007841" : "#CF8300"}
          height={compact ? 46 : 58}
          markerIndex={ci}
          markerLabel="change"
          levels={[
            { from: 0, to: ci, value: h.before },
            { from: ci, to: n - 1, value: h.after },
          ]}
          zero
          ariaLabel={`${habitName(h)} per week over ${n} weeks: about ${fmt(h.before)} before ${dateDM(h.since)}, about ${fmt(h.after)} since`}
        />
      </div>
      <div className="tnum mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="text-ink">
          {fmt(h.before)} → <span className="font-semibold">{fmt(h.after)}</span>
          <span className="ml-1 text-xs text-ink-muted">({pctSigned(h.changePct)})</span>
        </span>
        <span className={cx("font-semibold", good ? "text-green-700" : "text-warning")}>
          {good ? `≈ ${money(h.monthlyImpact, { whole: true })} a month saved` : `≈ ${money(Math.abs(h.monthlyImpact), { whole: true })} a month more`}
        </span>
      </div>
    </div>
  );
}
