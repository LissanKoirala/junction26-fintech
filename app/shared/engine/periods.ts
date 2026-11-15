// Named periods relative to asOf. Weeks are ISO weeks (Monday start). "last_N_months" (3, 6, 12) are the N latest
// complete months as decided by util.completeMonths, the same helper safe-to-spend and what-if use: on the last day of
// a month that month is complete (so on 30 Sep 2026 last_12_months = Oct 2025-Sep 2026). "last_month" stays the
// previous calendar month (August on 30 Sep), because that is what people mean by "last month".
import type { PeriodName, ResolvePeriod } from "./api";
import type { Period } from "../types";
import { DOMAIN, addDays, addMonths, completeMonths, monthEnd, monthKey, monthStart, rangeLabel, weekStart, dayLabel } from "./util";

export const PERIOD_NAMES: PeriodName[] = [
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_30_days",
  "last_90_days",
  "last_3_months",
  "last_6_months",
  "last_12_months",
  "this_year",
  "all_time",
];

/** The N latest complete months (util.completeMonths decides whether the asOf month is complete). */
const lastMonths = (asOf: string, n: number): Period => {
  const ms = completeMonths(asOf, n);
  const from = monthStart(ms[0]);
  const to = monthEnd(ms[ms.length - 1]);
  return { from, to, label: rangeLabel(from, to) };
};

const prevMonths = (asOf: string, n: number, label?: string): Period => {
  const last = addMonths(monthKey(asOf), -1);
  const first = addMonths(last, -(n - 1));
  const from = monthStart(first);
  const to = monthEnd(last);
  return { from, to, label: label ?? rangeLabel(from, to) };
};

export const resolvePeriod: ResolvePeriod = (asOf, name) => {
  switch (name) {
    case "this_week": {
      const from = weekStart(asOf);
      return { from, to: asOf, label: `This week (${dayLabel(from)}–${dayLabel(asOf)})` };
    }
    case "last_week": {
      const from = addDays(weekStart(asOf), -7);
      const to = addDays(from, 6);
      return { from, to, label: `Last week (${dayLabel(from)}–${dayLabel(to)})` };
    }
    case "this_month": {
      const from = monthStart(monthKey(asOf));
      return { from, to: asOf, label: asOf === monthEnd(monthKey(asOf)) ? rangeLabel(from, asOf) : `${rangeLabel(from, asOf)} (month to date)` };
    }
    case "last_month":
      return prevMonths(asOf, 1);
    case "last_30_days": {
      const from = addDays(asOf, -29);
      return { from, to: asOf, label: `Last 30 days (${rangeLabel(from, asOf)})` };
    }
    case "last_90_days": {
      const from = addDays(asOf, -89);
      return { from, to: asOf, label: `Last 90 days (${rangeLabel(from, asOf)})` };
    }
    case "last_3_months":
      return lastMonths(asOf, 3);
    case "last_6_months":
      return lastMonths(asOf, 6);
    case "last_12_months":
      return lastMonths(asOf, 12);
    case "this_year": {
      const from = `${asOf.slice(0, 4)}-01-01`;
      return { from, to: asOf, label: `${asOf.slice(0, 4)} so far` };
    }
    case "all_time": {
      const from = DOMAIN.dataStart;
      return { from, to: asOf, label: `All data (${rangeLabel(from, asOf)})` };
    }
    default:
      throw new Error(`unknown period name: ${String(name)}`);
  }
};

/** A whole calendar month as a Period, e.g. monthPeriod("2026-09"). */
export const monthPeriod = (key: string): Period => {
  const from = monthStart(key);
  const to = monthEnd(key);
  return { from, to, label: rangeLabel(from, to) };
};
