// Named periods relative to asOf. Weeks are ISO weeks (Monday start). "last_N_months" are the N previous full
// calendar months, not counting the asOf month (so on 30 Sep 2026 last_month = August 2026, this_month = September).
import type { PeriodName, ResolvePeriod } from "./api";
import type { Period } from "../types";
import { DOMAIN, addDays, addMonths, monthEnd, monthKey, monthStart, rangeLabel, weekStart, dayLabel } from "./util";

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
      return prevMonths(asOf, 3);
    case "last_6_months":
      return prevMonths(asOf, 6);
    case "last_12_months":
      return prevMonths(asOf, 12);
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
