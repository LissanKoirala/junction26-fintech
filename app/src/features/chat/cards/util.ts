import type { CardSpec } from "@shared/chat";
import { money, num, pct } from "@/lib/format";
import { tn } from "@/lib/i18n";

export type CardOf<K extends CardSpec["kind"]> = Extract<CardSpec, { kind: K }>;

/** Format a value by card unit. pct values: shares 0..1 are shown as percent; values > 1 are already percents. */
export function fmtUnit(v: number, unit: "eur" | "pct" | "count" | "days", whole = false): string {
  if (unit === "eur") return money(v, { whole });
  if (unit === "pct") return Math.abs(v) <= 1 ? pct(v) : `${num(v)} %`;
  if (unit === "days") return tn("{n} day", "{n} days", Math.round(v), { n: num(v) });
  return num(v);
}
