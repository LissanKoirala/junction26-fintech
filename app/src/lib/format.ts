// Finnish money and date formatting (CONTRACTS.md section 7). Never use the real clock: "today" is customer.asOf.

const eur2 = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const num0 = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 1 });

/** "1 234,56 €" with a real minus sign for negatives. `whole` drops the cents. */
export function money(v: number | null | undefined, opts: { whole?: boolean; sign?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const f = opts.whole ? eur0 : eur2;
  const s = f.format(Math.abs(v) < 0.005 ? 0 : v).replace("-", "−");
  if (opts.sign && v > 0.004) return "+" + s;
  return s;
}

/** Splits a money string into the number part and the currency, for big hero figures. */
export function moneyParts(v: number, whole = true): { num: string; cur: string } {
  const s = money(v, { whole });
  const idx = s.lastIndexOf("€");
  return { num: s.slice(0, idx).trim(), cur: "€" };
}

export function num(v: number | null | undefined, digits: 0 | 1 = 0): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return (digits ? num1 : num0).format(v).replace("-", "−");
}

export function pct(share: number | null | undefined, digits: 0 | 1 = 0): string {
  if (share == null || !Number.isFinite(share)) return "–";
  return `${num(share * 100, digits)} %`;
}

/** Already a percent number (e.g. -20), signed. */
export function pctSigned(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "–";
  const r = Math.round(p);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)} %`;
}

function d(iso: string): Date {
  return new Date(iso.slice(0, 10) + "T12:00:00Z");
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const short = { format: (x: Date) => `${WD[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}` };
const dayMonth = { format: (x: Date) => `${x.getUTCDate()} ${MON[x.getUTCMonth()]}` };
const monthShort = { format: (x: Date) => MON[x.getUTCMonth()] };

/** "Wed 30 Sep" */
export function dateShort(iso: string | null | undefined): string {
  if (!iso) return "–";
  return short.format(d(iso));
}
/** "30 Sep" */
export function dateDM(iso: string | null | undefined): string {
  if (!iso) return "–";
  return dayMonth.format(d(iso));
}
/** "30.9.2026" */
export function dateFi(iso: string | null | undefined): string {
  if (!iso) return "–";
  const x = d(iso);
  return `${x.getUTCDate()}.${x.getUTCMonth() + 1}.${x.getUTCFullYear()}`;
}
export function monthLabel(isoMonth: string): string {
  return monthYear.format(d(isoMonth.length === 7 ? isoMonth + "-01" : isoMonth));
}
export function monthAbbr(isoMonth: string): string {
  return monthShort.format(d(isoMonth.length === 7 ? isoMonth + "-01" : isoMonth));
}
/** "1–8 Oct" or "Fri 15 Oct" for a window. */
export function dateWindow(from: string | null, to: string | null): string {
  if (!from && !to) return "";
  if (!from || !to || from === to) return dateShort(from || to);
  const a = d(from), b = d(to);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${monthShort.format(b)}`;
  return `${dateDM(from)} – ${dateDM(to)}`;
}
export function daysBetween(a: string, b: string): number {
  return Math.round((d(b).getTime() - d(a).getTime()) / 86400000);
}
export function addDays(iso: string, n: number): string {
  const x = d(iso);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
export function addMonths(iso: string, n: number): string {
  const x = d(iso);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString().slice(0, 10);
}
export function monthsBetween(a: string, b: string): number {
  const x = d(a), y = d(b);
  return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth()) + (y.getUTCDate() - x.getUTCDate()) / 30.44;
}
export function periodLabel(p: { from: string; to: string; label?: string } | undefined): string {
  if (!p) return "";
  if (p.label) return p.label;
  return `${dateDM(p.from)} – ${dateFi(p.to)}`;
}
