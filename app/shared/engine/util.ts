// Small pure helpers shared by the engine modules: dates (ISO strings, UTC arithmetic), rounding, stats, labels.
// No Node or DOM APIs. Dates are plain "YYYY-MM-DD" strings; "today" is always customer.asOf.
import domainJson from "../domain.json";
import type { Basket, Category, CustomerData } from "../types";

export const DOMAIN = domainJson;

const DAY = 86_400_000;

/** Round half away from zero (so -1277.365 and 1277.365 round to the same magnitude), with an epsilon for FP noise. */
const roundTo = (x: number, f: number): number => {
  if (!Number.isFinite(x)) return 0;
  const v = (Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9)) / f;
  return v === 0 ? 0 : v; // no -0
};
export const r2 = (x: number): number => roundTo(x, 100);
export const r1 = (x: number): number => roundTo(x, 10);

export function dayNum(s: string): number {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;
}
export function fromDayNum(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10);
}
export const addDays = (s: string, n: number) => fromDayNum(dayNum(s) + n);
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a); // b - a
/** ISO weekday 1 = Monday ... 7 = Sunday. */
export function isoWeekday(s: string): number {
  const d = new Date(dayNum(s) * DAY).getUTCDay();
  return d === 0 ? 7 : d;
}
export const weekStart = (s: string) => addDays(s, 1 - isoWeekday(s));
export const monthKey = (s: string) => s.slice(0, 7);
export const dayOfMonth = (s: string) => +s.slice(8, 10);
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based
}
export function monthStart(key: string): string {
  return `${key}-01`;
}
export function monthEnd(key: string): string {
  const y = +key.slice(0, 4);
  const m = +key.slice(5, 7);
  return `${key}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
}
export function addMonths(key: string, n: number): string {
  const y = +key.slice(0, 4);
  const m = +key.slice(5, 7) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}
/** Date in month `key` at day `d`, clamped to the month length. */
export function dateInMonth(key: string, d: number): string {
  const y = +key.slice(0, 4);
  const m = +key.slice(5, 7);
  const dd = Math.max(1, Math.min(daysInMonth(y, m), Math.round(d)));
  return `${key}-${String(dd).padStart(2, "0")}`;
}
export const isMonthEnd = (s: string) => s === monthEnd(monthKey(s));

/** The last `n` complete calendar months as of `asOf` (the asOf month counts when asOf is its last day), oldest first. */
export function completeMonths(asOf: string, n: number): string[] {
  let last = monthKey(asOf);
  if (!isMonthEnd(asOf)) last = addMonths(last, -1);
  const out: string[] = [];
  for (let k = n - 1; k >= 0; k--) out.push(addMonths(last, -k));
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (key: string) => `${MONTHS_LONG[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
export const monthShort = (key: string) => `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
export const dayLabel = (s: string) => `${+s.slice(8, 10)} ${MONTHS[+s.slice(5, 7) - 1]}`;
export function rangeLabel(from: string, to: string): string {
  if (from === to) return `${dayLabel(from)} ${from.slice(0, 4)}`;
  const mf = monthKey(from);
  const mt = monthKey(to);
  if (from === monthStart(mf) && to === monthEnd(mt)) {
    if (mf === mt) return monthLabel(mf);
    return mf.slice(0, 4) === mt.slice(0, 4)
      ? `${MONTHS[+mf.slice(5, 7) - 1]}–${monthShort(mt)}`
      : `${monthShort(mf)}–${monthShort(mt)}`;
  }
  return `${dayLabel(from)}–${dayLabel(to)} ${to.slice(0, 4)}`;
}
export const WEEKDAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}
/** Linear-interpolated quantile of a sorted array. */
export function quantileSorted(s: ArrayLike<number>, q: number): number {
  const n = s.length;
  if (!n) return 0;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(n - 1, lo + 1);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

type CategoryInfo = { label: string; icon: string };
export const categoryLabel = (c: string) => (DOMAIN.categories as Record<string, CategoryInfo>)[c]?.label ?? c;
export const mccLabel = (mcc: string | null) =>
  mcc ? ((DOMAIN.mcc as unknown as Record<string, { label: string }>)[mcc]?.label ?? `MCC ${mcc}`) : "Unknown merchant type";
export const basketLabel = (b: Basket) => DOMAIN.baskets[b].label;
export const BASKETS: Basket[] = ["must_regular", "must_irregular", "everyday"];
export const SMALL = DOMAIN.smallPurchaseThreshold;
export const PURCHASE_CATS: Category[] = ["Groceries", "Restaurants", "Transportation", "Entertainment", "Health", "Home & Tech", "Lifestyle", "Travel"];

/** Balance after the last transaction on or before `date` (the first transaction's opening balance if none). */
export function balanceAt(c: CustomerData, date: string): number {
  const tx = c.tx;
  if (!tx.length) return 0;
  let lo = 0;
  let hi = tx.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tx[mid].date <= date) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (ans < 0) return tx[0].balance - tx[0].amount;
  return tx[ans].balance;
}
export const currentBalance = (c: CustomerData) => (c.tx.length ? c.tx[c.tx.length - 1].balance : 0);

/** Index range [start, end) of transactions with from <= date <= to (tx are chronological). */
export function txRange(c: CustomerData, from: string, to: string): [number, number] {
  const tx = c.tx;
  const lb = (d: string, strict: boolean) => {
    let lo = 0;
    let hi = tx.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strict ? tx[mid].date <= d : tx[mid].date < d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return [lb(from, false), lb(to, true)];
}
