// getMonthly and getWeekSummary.
import type { GetMonthly, GetWeekSummary, MonthRow, WeekSummary } from "./api";
import type { Basket, Tx } from "../types";
import { isBasket, kindsOf } from "./classify";
import { spendingByKind } from "./spending";
import { BASKETS, SMALL, addDays, addMonths, balanceAt, categoryLabel, median, monthEnd, monthKey, monthStart, r2, txRange, weekStart } from "./util";

export const getMonthly: GetMonthly = (c, months = 12, opts) => {
  const kinds = kindsOf(c, opts);
  const n = Math.max(1, Math.min(months, 36));
  const last = monthKey(c.asOf);
  const first = c.tx[0]?.date ?? c.asOf;
  const rows: MonthRow[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const m = addMonths(last, -k);
    const from = monthStart(m);
    const to = monthEnd(m) < c.asOf ? monthEnd(m) : c.asOf;
    if (monthEnd(m) < first) continue; // before the data starts
    const s = spendingByKind(c, kinds, from, to);
    const [a, b] = txRange(c, from, to);
    let minBal = balanceAt(c, addDays(from, -1));
    for (let i = a; i < b; i++) if (c.tx[i].balance < minBal) minBal = c.tx[i].balance;
    rows.push({
      month: m,
      income: r2(s.income),
      mustRegular: r2(s.must_regular),
      mustIrregular: r2(s.must_irregular),
      everyday: r2(s.everyday),
      saving: r2(s.saving),
      transfersOut: r2(s.transfer),
      net: r2(s.income - s.must_regular - s.must_irregular - s.everyday - s.saving - s.transfer),
      endBalance: r2(balanceAt(c, to)),
      minBalance: r2(minBal),
      complete: monthEnd(m) <= c.asOf,
    });
  }
  return rows;
};

/** Everyday/basket spending in [from, to] for the week summary. */
function weekSpend(c: Parameters<GetWeekSummary>[0], kinds: ReturnType<typeof kindsOf>, from: string, to: string) {
  const s = spendingByKind(c, kinds, from, to);
  return s.must_regular + s.must_irregular + s.everyday;
}

export const getWeekSummary: GetWeekSummary = (c, weekOffset = 0, opts) => {
  const kinds = kindsOf(c, opts);
  const from = addDays(weekStart(c.asOf), 7 * Math.min(0, Math.round(weekOffset)));
  const sunday = addDays(from, 6);
  const to = sunday < c.asOf ? sunday : c.asOf;
  const nDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const [a, b] = txRange(c, from, to);
  const byBasket: Record<Basket, number> = { must_regular: 0, must_irregular: 0, everyday: 0 };
  const cats = new Map<string, { total: number; count: number }>();
  let income = 0;
  let small = 0;
  let smallTotal = 0;
  let biggest: Tx | null = null;
  let lowest = balanceAt(c, addDays(from, -1));
  for (let i = a; i < b; i++) {
    const t = c.tx[i];
    const k = kinds[i];
    if (t.balance < lowest) lowest = t.balance;
    if (k === "income") income += t.amount;
    if (!isBasket(k) || t.amount >= 0) continue;
    const v = -t.amount;
    byBasket[k] += v;
    const cc = cats.get(t.category) ?? { total: 0, count: 0 };
    cc.total += v;
    cc.count++;
    cats.set(t.category, cc);
    if (t.type === "purchase" && v < SMALL) {
      small++;
      smallTotal += v;
    }
    if (!biggest || t.amount < biggest.amount) biggest = t;
  }
  const spending = BASKETS.reduce((s, k) => s + byBasket[k], 0);
  // typical week: median of the previous 12 weeks over the same weekdays (so a part week compares fairly)
  const prev: number[] = [];
  const dataStart = c.tx[0]?.date ?? from;
  for (let w = 1; w <= 12; w++) {
    const f = addDays(from, -7 * w);
    if (f < dataStart) break;
    prev.push(weekSpend(c, kinds, f, addDays(f, nDays - 1)));
  }
  const typical = median(prev);
  for (const k of BASKETS) byBasket[k] = r2(byBasket[k]);
  const res: WeekSummary = {
    from,
    to,
    spending: r2(spending),
    byBasket,
    topCategories: [...cats.entries()]
      .map(([key, v]) => ({ key, label: categoryLabel(key), total: r2(v.total), count: v.count }))
      .sort((x, y) => y.total - x.total)
      .slice(0, 5),
    vsTypicalWeekPct: prev.length >= 4 && typical > 0 ? r2(((spending - typical) / typical) * 100) : null,
    smallPurchases: { count: small, total: r2(smallTotal) },
    biggest,
    income: r2(income),
    lowestBalance: r2(lowest),
    typicalSpending: r2(typical),
    days: nDays,
  };
  return res;
};
