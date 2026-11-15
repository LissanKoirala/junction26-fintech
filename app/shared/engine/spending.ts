// querySpending: filtered, grouped and compared spending totals. Spending = outflows classified into one of the
// three baskets (housing, utilities, purchases). Saving, transfers and income are excluded unless their category is
// named explicitly in `categories` (then those flows are summed as positive amounts too).
import type { QuerySpending, SpendingGroup, SpendingQuery, SpendingResult } from "./api";
import type { Category, CustomerData, FlowKind, Period, Tx } from "../types";
import { isBasket, kindsOf } from "./classify";
import {
  WEEKDAYS,
  addDays,
  addMonths,
  basketLabel,
  categoryLabel,
  dayLabel,
  daysBetween,
  isoWeekday,
  mccLabel,
  monthEnd,
  monthKey,
  monthLabel,
  monthStart,
  r2,
  rangeLabel,
  txRange,
  weekStart,
} from "./util";

const NON_SPENDING: Category[] = ["Salary", "Other Income", "Invest Deposit", "Invest Withdraw", "Salary Sweep"];

const isWholeMonths = (p: Period) => p.from === monthStart(monthKey(p.from)) && p.to === monthEnd(monthKey(p.to));
const monthsSpan = (p: Period) => {
  const a = monthKey(p.from);
  const b = monthKey(p.to);
  return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)) + 1;
};

export function previousPeriod(p: Period): Period {
  if (isWholeMonths(p)) {
    const n = monthsSpan(p);
    const from = monthStart(addMonths(monthKey(p.from), -n));
    const to = monthEnd(addMonths(monthKey(p.to), -n));
    return { from, to, label: rangeLabel(from, to) };
  }
  const len = daysBetween(p.from, p.to) + 1;
  const from = addDays(p.from, -len);
  const to = addDays(p.to, -len);
  return { from, to, label: rangeLabel(from, to) };
}
const minusYear = (s: string) => {
  const y = +s.slice(0, 4) - 1;
  const md = s.slice(5) === "02-29" ? "02-28" : s.slice(5);
  return `${y}-${md}`;
};
export function samePeriodLastYear(p: Period): Period {
  if (isWholeMonths(p)) {
    const from = monthStart(addMonths(monthKey(p.from), -12));
    const to = monthEnd(addMonths(monthKey(p.to), -12));
    return { from, to, label: rangeLabel(from, to) };
  }
  const from = minusYear(p.from);
  const to = minusYear(p.to);
  return { from, to, label: rangeLabel(from, to) };
}

interface Match {
  tx: Tx;
  kind: FlowKind;
  value: number; // positive euros
}

/** All transactions matching the query filters within the period. */
export function matchTx(c: CustomerData, q: SpendingQuery, period: Period, kinds: FlowKind[]): Match[] {
  const [s, e] = txRange(c, period.from, period.to);
  const cats = q.categories?.length ? new Set(q.categories) : null;
  const extraCats = cats ? new Set(NON_SPENDING.filter((k) => cats.has(k))) : new Set<Category>();
  const mccs = q.mccs?.length ? new Set(q.mccs) : null;
  const baskets = q.baskets?.length ? new Set<FlowKind>(q.baskets) : null;
  const wds = q.weekdays?.length ? new Set(q.weekdays) : null;
  const out: Match[] = [];
  for (let k = s; k < e; k++) {
    const tx = c.tx[k];
    const kind = kinds[k];
    const spending = isBasket(kind) && tx.amount < 0;
    if (!spending && !extraCats.has(tx.category)) continue;
    if (cats && !cats.has(tx.category)) continue;
    if (mccs && !(tx.mcc && mccs.has(tx.mcc))) continue;
    if (baskets && !baskets.has(kind)) continue;
    const value = Math.abs(tx.amount);
    if (q.minAmount != null && value < q.minAmount) continue;
    if (q.maxAmount != null && value > q.maxAmount) continue;
    if (wds && !wds.has(isoWeekday(tx.date))) continue;
    out.push({ tx, kind, value });
  }
  return out;
}

function groupKey(m: Match, by: NonNullable<SpendingQuery["groupBy"]>): [string, string] {
  const t = m.tx;
  switch (by) {
    case "category":
      return [t.category, categoryLabel(t.category)];
    case "mcc":
      // non-purchases (rent, bills) and the ~5% of purchases without a code are grouped by their category
      return t.mcc ? [t.mcc, `${mccLabel(t.mcc)} (${t.mcc})`] : [`cat:${t.category}`, `${categoryLabel(t.category)} (no merchant code)`];
    case "basket":
      return isBasket(m.kind) ? [m.kind, basketLabel(m.kind)] : [m.kind, m.kind];
    case "month":
      return [monthKey(t.date), monthLabel(monthKey(t.date))];
    case "week": {
      const ws = weekStart(t.date);
      return [ws, `Week of ${dayLabel(ws)}`];
    }
    case "day":
      return [t.date, dayLabel(t.date)];
    case "weekday": {
      const w = isoWeekday(t.date);
      return [String(w), WEEKDAYS[w]];
    }
    case "merchant":
      return [t.merchantId ?? "none", t.merchantId ? `${mccLabel(t.mcc)} · ${t.merchantId}` : "No merchant id"];
    case "hour": {
      const h = t.time.slice(0, 2);
      return [h, `${h}:00–${String(+h + 1).padStart(2, "0")}:00`];
    }
  }
}
const TIME_ORDERED = new Set(["month", "week", "day", "weekday", "hour"]);

export function describeFilters(q: SpendingQuery): string[] {
  const f: string[] = [`Period: ${q.period.label ?? rangeLabel(q.period.from, q.period.to)} (${q.period.from} to ${q.period.to})`];
  if (q.categories?.length) f.push(`Category: ${q.categories.map(categoryLabel).join(", ")}`);
  if (q.mccs?.length) f.push(`Merchant type: ${q.mccs.map((m) => `${mccLabel(m)} (MCC ${m})`).join(", ")}`);
  if (q.baskets?.length) f.push(`Basket: ${q.baskets.map(basketLabel).join(", ")}`);
  if (q.minAmount != null) f.push(`Amount at least ${q.minAmount} €`);
  if (q.maxAmount != null) f.push(`Amount at most ${q.maxAmount} €`);
  if (q.weekdays?.length) f.push(`Weekdays: ${q.weekdays.map((w) => WEEKDAYS[w]).join(", ")}`);
  if (!q.categories?.some((c) => NON_SPENDING.includes(c))) f.push("Spending only (rent, bills and card purchases; saving and transfers excluded)");
  if (q.groupBy) f.push(`Grouped by ${q.groupBy}`);
  return f;
}

export const querySpending: QuerySpending = (c, q, opts) => {
  const kinds = kindsOf(c, opts);
  const matches = matchTx(c, q, q.period, kinds);
  let total = 0;
  for (const m of matches) total += m.value;
  const count = matches.length;
  const days = daysBetween(q.period.from, q.period.to) + 1;
  const res: SpendingResult = {
    period: { ...q.period, label: q.period.label ?? rangeLabel(q.period.from, q.period.to) },
    total: r2(total),
    count,
    average: r2(count ? total / count : 0),
    perMonth: r2((total / Math.max(1, days)) * 30.44),
    filters: describeFilters(q),
  };
  if (q.groupBy) {
    const g = new Map<string, { label: string; total: number; count: number }>();
    for (const m of matches) {
      const [key, label] = groupKey(m, q.groupBy);
      const cur = g.get(key) ?? { label, total: 0, count: 0 };
      cur.total += m.value;
      cur.count++;
      g.set(key, cur);
    }
    let groups: SpendingGroup[] = [...g.entries()].map(([key, v]) => ({
      key,
      label: v.label,
      total: r2(v.total),
      count: v.count,
      share: total > 0 ? Math.round((v.total / total) * 10000) / 10000 : 0,
    }));
    if (TIME_ORDERED.has(q.groupBy)) groups.sort((a, b) => (q.groupBy === "weekday" || q.groupBy === "hour" ? +a.key - +b.key : a.key < b.key ? -1 : 1));
    else groups.sort((a, b) => b.total - a.total);
    if (q.groupBy === "merchant" && groups.length > 25) groups = groups.slice(0, 25);
    res.groups = groups;
  }
  if (q.compareTo) {
    const p = q.compareTo === "previous_period" ? previousPeriod(q.period) : samePeriodLastYear(q.period);
    const prev = matchTx(c, q, p, kinds);
    let pt = 0;
    for (const m of prev) pt += m.value;
    res.comparison = {
      period: p,
      total: r2(pt),
      count: prev.length,
      deltaAbs: r2(total - pt),
      deltaPct: pt > 0 ? r2(((total - pt) / pt) * 100) : null,
    };
  }
  if (q.includeTransactions) {
    const lim = Math.max(1, Math.min(q.limit ?? 20, 200));
    res.transactions = [...matches].sort((a, b) => b.value - a.value).slice(0, lim).map((m) => m.tx);
  }
  return res;
};

/** Sum of spending (positive euros) in [from,to] per kind. Internal helper used by several modules. */
export function spendingByKind(c: CustomerData, kinds: FlowKind[], from: string, to: string) {
  const [s, e] = txRange(c, from, to);
  const out = { must_regular: 0, must_irregular: 0, everyday: 0, saving: 0, transfer: 0, income: 0 } as Record<FlowKind, number>;
  for (let k = s; k < e; k++) {
    const tx = c.tx[k];
    const kind = kinds[k];
    if (kind === "income") out.income += tx.amount;
    else out[kind] += -tx.amount;
  }
  return out;
}
