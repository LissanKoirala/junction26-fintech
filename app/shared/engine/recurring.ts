// Recurring items (salary, housing, utilities, investment, groceries) and the next-payday predictor.
// Recurring items are identified by transaction type only: the data has no subscriptions or merchant names.
import type { GetRecurring, RecurringItem } from "./api";
import type { CustomerData, Tx } from "../types";
import {
  addDays,
  addMonths,
  completeMonths,
  dateInMonth,
  dayNum,
  dayOfMonth,
  et,
  etn,
  daysBetween,
  fromDayNum,
  mean,
  median,
  monthEnd,
  monthKey,
  monthStart,
  r2,
  txRange,
} from "./util";

const memo = <T>() => new WeakMap<CustomerData, T>();

// ---------------------------------------------------------------- salary
export interface SalaryInfo {
  dates: string[];
  amounts: number[];
  typical: number; // median of the last 6
  low: number;
  high: number;
  share15: number; // share of the last 12 months paid on the 15th
  lateDay: number; // median day of the non-15th payments (default 29)
  monthsSeen: number; // of the last 12 months
  last: string | null;
  regular: boolean; // a steady monthly salary we can plan around (false when `irregular`)
  irregular?: boolean; // tail cohort, salaries missing in 2+ of the last 6 complete months, or scattered pay days
  irregularWhy?: "tail" | "missing" | "scattered";
  lateCount12?: number; // of the salaries in the last 12 months, how many did not come on the 15th
  midOrEnd12?: boolean; // every salary of the last 12 months came within 2 days of the 15th or on day 26 or later
}
const salaryMemo = memo<SalaryInfo>();
export function salaryInfo(c: CustomerData): SalaryInfo {
  const hit = salaryMemo.get(c);
  if (hit) return hit;
  const all = c.tx.filter((t) => t.type === "salary");
  const since12 = monthStart(addMonths(monthKey(c.asOf), -11));
  const since6 = monthStart(addMonths(monthKey(c.asOf), -5));
  const last12 = all.filter((t) => t.date >= since12);
  const last6 = all.filter((t) => t.date >= since6);
  const amounts6 = last6.slice(-6).map((t) => t.amount);
  const days = last12.map((t) => dayOfMonth(t.date));
  const late = days.filter((d) => d !== 15);
  const info: SalaryInfo = {
    dates: all.map((t) => t.date),
    amounts: all.map((t) => t.amount),
    typical: median(amounts6),
    low: amounts6.length ? Math.min(...amounts6) : 0,
    high: amounts6.length ? Math.max(...amounts6) : 0,
    share15: days.length ? days.filter((d) => d === 15).length / days.length : 0,
    lateDay: late.length ? Math.round(median(late)) : 29,
    monthsSeen: new Set(last12.map((t) => monthKey(t.date))).size,
    last: all.length ? all[all.length - 1].date : null,
    regular: new Set(last6.map((t) => monthKey(t.date))).size >= 3,
    lateCount12: late.length,
    midOrEnd12: days.length > 0 && days.every((d) => Math.abs(d - 15) <= 2 || d >= 26),
  };
  // Irregular income (no confident payday): tail cohort; or a salary missing in 2+ of the last 6 complete months;
  // or scattered pay days: 2+ of the last 6 salaries came neither within 2 days of the 15th nor on day 26 or later.
  const done6 = completeMonths(c.asOf, 6);
  const paidMonths = new Set(all.map((t) => monthKey(t.date)));
  const missing = done6.filter((m) => !paidMonths.has(m)).length;
  const off = all.slice(-6).filter((t) => {
    const d = dayOfMonth(t.date);
    return Math.abs(d - 15) > 2 && d < 26;
  }).length;
  const why = c.cohort === "tail" ? "tail" : missing >= 2 ? "missing" : off >= 2 ? "scattered" : null;
  if (why && all.length) {
    info.irregular = true;
    info.irregularWhy = why;
    info.regular = false;
  }
  salaryMemo.set(c, info);
  return info;
}

export interface PaydayPrediction {
  date: string;
  amount: number;
  daysAway: number;
  estimated: boolean; // true when there is no regular salary and the date is a 30-day planning horizon
  basis: string;
  latest?: string; // the latest plausible date if the usual pattern does not hold this month
  irregular?: boolean; // income is irregular: no date or usual amount is predicted
  lateCount?: number; // salaries in the last 12 months that did not come on the usual 15th
  monthsSeen?: number; // salaries seen in the last 12 months (denominator of lateCount)
}

/** Predicted paydays strictly after asOf, as many as fall within `horizonDays` (at least one). */
export function predictPaydays(c: CustomerData, horizonDays = 45): PaydayPrediction[] {
  const s = salaryInfo(c);
  const asOf = c.asOf;
  if (!s.regular || s.typical <= 0) {
    const date = addDays(asOf, 30);
    return [
      {
        date,
        amount: 0,
        daysAway: 30,
        estimated: true,
        irregular: s.irregular || undefined,
        basis: s.irregular
          ? et("Your income is irregular, so Vara plans for the next 30 days.")
          : et("No regular monthly salary in the last 6 months, so Vara plans for the next 30 days."),
      },
    ];
  }
  // The pay day is the 15th, sometimes late: either it was the 15th in most months, or every salary of the last 12
  // months fell near the 15th or at the end of the month (late months are not a new pay day).
  const use15 = s.share15 >= 0.5 || (s.midOrEnd12 === true && s.share15 > 0);
  const nPaid = Math.round(s.share15 * Math.max(1, Math.min(12, s.monthsSeen)));
  const basis = use15
    ? nPaid >= Math.min(12, s.monthsSeen)
      ? et("You were paid on the 15th in each of the last {m} months.", { m: Math.min(12, s.monthsSeen) })
      : et("You were paid on the 15th in {n} of the last {m} months; the other months it came at the end of the month.", { n: nPaid, m: Math.min(12, s.monthsSeen) })
    : et("Your salary usually arrives around day {day} of the month.", { day: s.lateDay });
  const out: PaydayPrediction[] = [];
  const paidThisMonth = s.last != null && monthKey(s.last) === monthKey(asOf);
  let m = paidThisMonth ? addMonths(monthKey(asOf), 1) : monthKey(asOf);
  const lateDate = (mk: string) => dateInMonth(mk, Math.max(26, s.lateDay));
  for (let guard = 0; guard < 6; guard++) {
    let date = dateInMonth(m, use15 ? 15 : s.lateDay);
    if (date <= asOf) {
      // the usual day already passed this month without a salary: it normally comes late in the month instead
      const ld = lateDate(m);
      if (ld > asOf) date = ld;
      else if (asOf < monthEnd(m)) date = addDays(asOf, 1);
      else {
        m = addMonths(m, 1);
        continue;
      }
    }
    const daysAway = daysBetween(asOf, date);
    if (out.length && daysAway > horizonDays) break;
    out.push({
      date,
      amount: r2(s.typical),
      daysAway,
      estimated: false,
      basis,
      // always defined: the end of the month, or a couple of days after a predicted end-of-month day
      latest: monthEnd(m) > date ? monthEnd(m) : addDays(date, 2),
      lateCount: use15 ? (s.lateCount12 ?? 0) : undefined,
      monthsSeen: use15 ? Math.min(12, s.monthsSeen) : undefined,
    });
    m = addMonths(m, 1);
  }
  return out;
}
export const nextPayday = (c: CustomerData) => predictPaydays(c, 0)[0];

// ---------------------------------------------------------------- housing
export interface HousingInfo {
  typical: number;
  low: number;
  high: number;
  dayFrom: number;
  dayTo: number;
  medianDay: number;
  paidMonths: Set<string>;
  monthsSeen: number; // last 12 months
  last: string | null;
  active: boolean; // a payment in the last 4 months
}
const housingMemo = memo<HousingInfo>();
export function housingInfo(c: CustomerData): HousingInfo {
  const hit = housingMemo.get(c);
  if (hit) return hit;
  const all = c.tx.filter((t) => t.type === "housing_payment");
  const since12 = monthStart(addMonths(monthKey(c.asOf), -11));
  const since4 = monthStart(addMonths(monthKey(c.asOf), -3));
  const last6 = all.slice(-6).map((t) => -t.amount);
  const days = all.slice(-12).map((t) => dayOfMonth(t.date));
  const info: HousingInfo = {
    typical: median(last6),
    low: last6.length ? Math.min(...last6) : 0,
    high: last6.length ? Math.max(...last6) : 0,
    dayFrom: days.length ? Math.min(...days) : 1,
    dayTo: days.length ? Math.max(...days) : 8,
    medianDay: days.length ? Math.round(median(days)) : 4,
    paidMonths: new Set(all.map((t) => monthKey(t.date))),
    monthsSeen: new Set(all.filter((t) => t.date >= since12).map((t) => monthKey(t.date))).size,
    last: all.length ? all[all.length - 1].date : null,
    active: all.some((t) => t.date >= since4),
  };
  housingMemo.set(c, info);
  return info;
}

/** Housing payments expected after asOf and before `until` (exclusive): one per month not yet paid. */
export function housingDue(c: CustomerData, until: string): { month: string; from: string; to: string; date: string; amount: number }[] {
  const h = housingInfo(c);
  if (!h.active || h.typical <= 0) return [];
  const out = [];
  const asOf = c.asOf;
  for (let m = monthKey(asOf), k = 0; k < 4; m = addMonths(m, 1), k++) {
    const from = dateInMonth(m, h.dayFrom);
    const to = dateInMonth(m, Math.max(h.dayTo, h.dayFrom));
    if (from >= until) break;
    if (h.paidMonths.has(m)) continue; // this month's is already paid
    if (to < asOf) continue; // window passed without a payment: a gap in the data, never "missed rent"
    const tomorrow = addDays(asOf, 1);
    const md = dateInMonth(m, h.medianDay);
    const f = from > asOf ? from : tomorrow;
    const date = md > asOf ? md : tomorrow;
    out.push({ month: m, from: f, to: to < f ? f : to, date, amount: h.typical });
  }
  return out;
}

// ---------------------------------------------------------------- utilities, investing, groceries
/** Utilities total per complete month (last `n`). perMonth averages only the months that have a utilities payment
 *  (a month with no payment is a gap in the data, not a month with no bills). */
export function utilitiesMonthly(c: CustomerData, n = 6): { months: string[]; totals: number[]; perMonth: number; paidMonths: number } {
  const months = completeMonths(c.asOf, n).filter((m) => monthEnd(m) >= (c.tx[0]?.date ?? c.asOf));
  const totals = months.map((m) => {
    const [s, e] = txRange(c, monthStart(m), monthEnd(m));
    let t = 0;
    for (let k = s; k < e; k++) if (c.tx[k].type === "utilities_payment") t += -c.tx[k].amount;
    return t;
  });
  const paid = totals.filter((t) => t > 0);
  return { months, totals, perMonth: mean(paid), paidMonths: paid.length };
}

export interface InvestInfo {
  typical: number;
  low: number;
  high: number;
  lagDays: number; // median days after the preceding salary
  monthsSeen: number;
  last: string | null;
  regular: boolean; // in at least 3 of the last 6 months
}
const investMemo = memo<InvestInfo>();
export function investInfo(c: CustomerData): InvestInfo {
  const hit = investMemo.get(c);
  if (hit) return hit;
  const all = c.tx.filter((t) => t.type === "investment_deposit");
  const sal = salaryInfo(c).dates;
  const lags: number[] = [];
  for (const d of all.slice(-12)) {
    let prev: string | null = null;
    for (const s of sal) if (s <= d.date) prev = s;
    if (prev && daysBetween(prev, d.date) <= 10) lags.push(daysBetween(prev, d.date));
  }
  const since12 = monthStart(addMonths(monthKey(c.asOf), -11));
  const since6 = monthStart(addMonths(monthKey(c.asOf), -5));
  const last6 = all.slice(-6).map((t) => -t.amount);
  const info: InvestInfo = {
    typical: median(last6),
    low: last6.length ? Math.min(...last6) : 0,
    high: last6.length ? Math.max(...last6) : 0,
    lagDays: lags.length ? Math.round(median(lags)) : 2,
    monthsSeen: new Set(all.filter((t) => t.date >= since12).map((t) => monthKey(t.date))).size,
    last: all.length ? all[all.length - 1].date : null,
    regular: new Set(all.filter((t) => t.date >= since6).map((t) => monthKey(t.date))).size >= 3,
  };
  investMemo.set(c, info);
  return info;
}

/** Usual deposit still pending after the most recent salary (salary arrived, deposit not yet made). */
export function pendingInvestment(c: CustomerData): { date: string; amount: number } | null {
  const inv = investInfo(c);
  const s = salaryInfo(c);
  if (!inv.regular || !s.last || inv.typical <= 0) return null;
  if (inv.last && inv.last >= s.last) return null;
  if (daysBetween(s.last, c.asOf) > 7) return null;
  const d = addDays(s.last, inv.lagDays);
  return { date: d > c.asOf ? d : addDays(c.asOf, 1), amount: inv.typical };
}

/** Daily rate of a set of purchases over the last `months` complete months. */
export function dailyRate(c: CustomerData, months: number, pred: (t: Tx, k: number) => boolean): { perDay: number; from: string; to: string } {
  const ms = completeMonths(c.asOf, months);
  const from = monthStart(ms[0]);
  const to = monthEnd(ms[ms.length - 1]);
  const first = c.tx[0]?.date ?? from;
  const effFrom = first > from ? first : from;
  const days = Math.max(1, daysBetween(effFrom, to) + 1);
  const [s, e] = txRange(c, effFrom, to);
  let t = 0;
  for (let k = s; k < e; k++) if (c.tx[k].amount < 0 && pred(c.tx[k], k)) t += -c.tx[k].amount;
  return { perDay: t / days, from: effFrom, to };
}

// ---------------------------------------------------------------- the public function
export const getRecurring: GetRecurring = (c) => {
  const items: RecurringItem[] = [];
  const s = salaryInfo(c);
  const pay = predictPaydays(c, 0)[0];
  if (s.dates.length) {
    items.push({
      kind: "salary",
      label: et("Salary"),
      typicalAmount: r2(s.typical),
      amountLow: r2(s.low),
      amountHigh: r2(s.high),
      cadence: "monthly",
      typicalDayFrom: s.share15 >= 0.5 || (s.midOrEnd12 && s.share15 > 0) ? 15 : Math.max(26, s.lateDay - 2),
      typicalDayTo: s.share15 >= 0.5 || (s.midOrEnd12 && s.share15 > 0) ? 15 : 31,
      monthsSeen: s.monthsSeen,
      lastDate: s.last,
      nextFrom: pay && !pay.estimated ? pay.date : null,
      nextTo: pay && !pay.estimated ? (pay.latest ?? pay.date) : null,
      note: s.regular ? pay?.basis : s.irregular ? et("Income is irregular, so Vara plans for the next 30 days instead of predicting a payday.") : et("Income is irregular: no steady monthly salary in the last 6 months."),
    });
    if (s.irregular) items[items.length - 1].label = et("Income (irregular)");
  }
  const h = housingInfo(c);
  if (h.paidMonths.size) {
    const next = housingDue(c, addDays(c.asOf, 70))[0];
    items.push({
      kind: "housing",
      label: et("Rent / housing"),
      typicalAmount: r2(h.typical),
      amountLow: r2(h.low),
      amountHigh: r2(h.high),
      cadence: "monthly",
      typicalDayFrom: h.dayFrom,
      typicalDayTo: h.dayTo,
      monthsSeen: h.monthsSeen,
      lastDate: h.last,
      nextFrom: h.active && next ? next.from : null,
      nextTo: h.active && next ? next.to : null,
      note:
        h.monthsSeen < 12
          ? et("Some months have no housing payment in the data (a gap in the data, not a missed payment).")
          : undefined,
    });
  }
  const u = utilitiesMonthly(c, 6);
  if (u.perMonth > 0) {
    const nUtil = c.tx.filter((t) => t.type === "utilities_payment" && t.date >= monthStart(u.months[0])).length;
    items.push({
      kind: "utilities",
      label: et("Utilities (electricity, water, internet …)"),
      typicalAmount: r2(u.perMonth),
      amountLow: r2(Math.min(...u.totals.filter((t) => t > 0))),
      amountHigh: r2(Math.max(...u.totals)),
      cadence: "several_per_month",
      monthsSeen: new Set(c.tx.filter((t) => t.type === "utilities_payment" && t.date >= monthStart(addMonths(monthKey(c.asOf), -11))).map((t) => monthKey(t.date))).size,
      lastDate: [...c.tx].reverse().find((t) => t.type === "utilities_payment")?.date ?? null,
      nextFrom: addDays(c.asOf, 1),
      nextTo: monthEnd(monthKey(addDays(c.asOf, 1))),
      note: et("About {n} bills a month; budgeted as a monthly total.", { n: Math.round(nUtil / Math.max(1, u.paidMonths)) }),
    });
  }
  const inv = investInfo(c);
  if (inv.monthsSeen > 0) {
    const pending = pendingInvestment(c);
    const nextPay = pay && !pay.estimated ? pay.date : null;
    const nf = pending ? pending.date : nextPay ? addDays(nextPay, Math.max(1, inv.lagDays - 1)) : null;
    items.push({
      kind: "investment",
      label: et("Investing"),
      typicalAmount: r2(inv.typical),
      amountLow: r2(inv.low),
      amountHigh: r2(inv.high),
      cadence: "monthly",
      monthsSeen: inv.monthsSeen,
      lastDate: inv.last,
      nextFrom: inv.regular ? nf : null,
      nextTo: inv.regular && nf ? addDays(nf, 3) : null,
      note: etn("Usually {n} day after payday.", "Usually {n} days after payday.", inv.lagDays),
    });
  }
  const g = dailyRate(c, 3, (t) => t.category === "Groceries");
  if (g.perDay > 0) {
    // weekly grocery totals over the same window, for a low/high range
    const weekly: number[] = [];
    for (let d = dayNum(g.from); d + 6 <= dayNum(g.to); d += 7) {
      const [s0, e0] = txRange(c, fromDayNum(d), fromDayNum(d + 6));
      let t = 0;
      for (let k = s0; k < e0; k++) if (c.tx[k].category === "Groceries") t += -c.tx[k].amount;
      weekly.push(t);
    }
    items.push({
      kind: "groceries",
      label: et("Groceries"),
      typicalAmount: r2(g.perDay * 7),
      amountLow: r2(weekly.length ? Math.min(...weekly) : 0),
      amountHigh: r2(weekly.length ? Math.max(...weekly) : 0),
      cadence: "weekly",
      monthsSeen: new Set(c.tx.filter((t) => t.category === "Groceries" && t.date >= monthStart(addMonths(monthKey(c.asOf), -11))).map((t) => monthKey(t.date))).size,
      lastDate: [...c.tx].reverse().find((t) => t.category === "Groceries")?.date ?? null,
      nextFrom: addDays(c.asOf, 1),
      nextTo: addDays(c.asOf, 7),
      note: et("Weekly average over the last 3 full months."),
    });
  }
  return items;
};
