// Crystal ball (balance fan to payday) and Early warning (overdraft risk) views.
import { ArrowDown, ArrowUp } from "lucide-react";
import { engine, type FixedEvent, type SafeToSpend } from "@shared/engine";
import type { CustomerData, Goal } from "@shared/types";
import type { MlForecast, MlRisk } from "@shared/ml/typesB";
import { ForecastFan, type FanEvent } from "@/ui/charts/ForecastFan";
import { Sparkline } from "@/ui/charts/Sparkline";
import { dateDM, dateShort, daysBetween, money, pct } from "@/lib/format";
import { Badge, cx, STROKE } from "@/ui/kit";
import { chanceWords, RISK_WORDS } from "../words";

const KIND_LABEL: Record<FixedEvent["kind"], string> = { salary: "Payday", housing: "Rent", investment: "Investing", other_income: "Income", goal: "Goal" };

/** Same shape as the ML file, computed in the browser by the shared engine (no calibration). */
export function engineForecast(c: CustomerData, safe: SafeToSpend, goal: Goal | null): MlForecast {
  const fe = engine.getFixedEvents(c, 35, { goal });
  const sim = engine.simulateBalance(c, { days: 35, fixedEvents: fe, paydayDate: safe.nextPayday.date });
  return {
    id: c.id,
    asOf: c.asOf,
    balance: c.tx.length ? c.tx[c.tx.length - 1].balance : 0,
    nextPayday: { date: safe.nextPayday.date, amount: safe.nextPayday.amount, daysAway: safe.nextPayday.daysAway },
    fixedEvents: fe,
    spend: [],
    sim: { historyDays: 182, scale: 1 },
    fan: sim.fan,
    overdraftProbToPayday: sim.overdraftProbToPayday,
    backtest: null,
  };
}

export function fanToPayday(f: MlForecast) {
  const end = Math.max(3, Math.min(f.fan.length - 1, f.nextPayday.daysAway + 1));
  const fan = f.fan.filter((p) => p.day <= end);
  const events: FanEvent[] = f.fixedEvents
    .map((e) => ({ day: daysBetween(f.asOf, e.date), e }))
    .filter(({ day }) => day > 0 && day <= end)
    .map(({ day, e }) => ({ day, label: `${KIND_LABEL[e.kind] ?? e.kind} ${dateDM(e.date)}`, amount: money(e.amount, { whole: true, sign: true }) }));
  return { fan, events };
}

export function ForecastChart({ f, height }: { f: MlForecast; height?: number }) {
  const { fan, events } = fanToPayday(f);
  return <ForecastFan fan={fan} events={events} format={(v) => money(v, { whole: true })} dateLabel={dateShort} height={height} />;
}

export function forecastMeaning(f: MlForecast): string {
  const p = f.overdraftProbToPayday;
  const minP10 = Math.min(...fanToPayday(f).fan.map((x) => x.p10));
  if (p >= 0.05)
    return `The chance of dipping below zero before payday on ${dateShort(f.nextPayday.date)} is ${chanceWords(p)}. On a bad run your lowest point could be ${money(minP10, { whole: true })}.`;
  return `You are very likely to stay above zero until payday on ${dateShort(f.nextPayday.date)}. Even on a bad run your lowest point is about ${money(minP10, { whole: true })}.`;
}

export function ChanceTile({ p, label = "Chance of going below zero before payday" }: { p: number; label?: string }) {
  return (
    <div className="rounded-md bg-green-50 px-3 py-2.5">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="text-xl font-bold leading-tight text-ink">
        {chanceWords(p).replace(/^./, (s) => s.toUpperCase())}
        <span className="tnum ml-1.5 text-sm font-semibold text-ink-muted">({pct(p)})</span>
      </p>
    </div>
  );
}

export function FanLegend() {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-strong">
      <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-pill bg-green-700" aria-hidden />Most likely</li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: "#00AA4645" }} aria-hidden />Half of outcomes</li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: "#00AA4624" }} aria-hidden />8 in 10 outcomes</li>
      <li className="flex items-center gap-1.5"><span className="h-px w-4" style={{ background: "#B70000" }} aria-hidden />Zero</li>
    </ul>
  );
}

// ------------------------------------------------------------------ risk
export function RiskBadge({ r }: { r: MlRisk }) {
  const w = RISK_WORDS[r.level];
  return <Badge tone={w.tone === "accent" ? "accent" : "warning"}>{w.label}</Badge>;
}

export function riskMeaning(r: MlRisk): string {
  const rel = r.baseRate > 0 ? r.probability / r.baseRate : 1;
  const cmp = rel > 1.3 ? "higher than for most customers" : rel < 0.77 ? "lower than for most customers" : "about the same as for most customers";
  return `Chance of going below zero in the next ${r.horizonDays} days: ${chanceWords(r.probability)}, ${cmp} (${pct(r.baseRate)} on average).`;
}

export function RiskDrivers({ r, limit = 3 }: { r: MlRisk; limit?: number }) {
  const up = r.drivers.filter((d) => d.direction === "raises").slice(0, limit);
  const down = r.drivers.filter((d) => d.direction === "lowers").slice(0, limit);
  const Col = ({ title, items, upward }: { title: string; items: MlRisk["drivers"]; upward: boolean }) => (
    <div className="min-w-0 rounded-md bg-green-50 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-green-900">
        {upward ? <ArrowUp size={16} strokeWidth={STROKE} aria-hidden /> : <ArrowDown size={16} strokeWidth={STROKE} aria-hidden />}
        {title}
      </p>
      {items.length ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((d) => (
            <li key={d.feature} className="text-sm leading-snug">
              <span className="text-ink">{d.label}</span>
              <span className="tnum ml-1 font-semibold text-ink">{d.display}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Nothing notable</p>
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
      <Col title="Pushing risk up" items={up} upward />
      <Col title="Keeping it down" items={down} upward={false} />
    </div>
  );
}

export function RiskTrend({ r, weeks = 12 }: { r: MlRisk; weeks?: number }) {
  const h = r.history.slice(-weeks);
  if (h.length < 2) return null;
  const dipped = h.filter((x) => x.wentNegative).length;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-ink-muted">
        <span>Risk week by week, last {h.length} weeks</span>
        <span className="tnum">now {pct(r.probability)}</span>
      </div>
      <Sparkline
        values={h.map((x) => x.probability * 100)}
        labels={h.map((x) => dateDM(x.date) + (x.wentNegative ? " · went below zero" : ""))}
        format={(v) => `${Math.round(v)} %`}
        height={54}
        zero
        ariaLabel={`Risk over the last ${h.length} weeks, from ${pct(h[0].probability)} to ${pct(h[h.length - 1].probability)}`}
      />
      <p className={cx("mt-1 text-xs text-ink-muted")}>
        {dipped ? `In ${dipped} of these weeks the balance did go below zero.` : "In none of these weeks did the balance go below zero."}
      </p>
    </div>
  );
}
