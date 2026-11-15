// simulateWhatIf: what changes if spending in some area goes up or down. Baseline = average of the last N full months.
import type { Adjustment, SimulateWhatIf, WhatIfResult } from "./api";
import type { CustomerData, FlowKind } from "../types";
import { isBasket, kindsOf } from "./classify";
import { dailyRate, housingInfo, utilitiesMonthly } from "./recurring";
import { computeSafeToSpend, type SafeTweak } from "./safeToSpend";
import { spendingByKind } from "./spending";
import { basketLabel, categoryLabel, et, etn, completeMonths, mccLabel, monthEnd, monthStart, r1, r2, rangeLabel, txRange, tEur, tNum } from "./util";

const MUST_TRANSPORT = new Set(["4111", "5541", "5542"]);

export function adjustmentLabel(a: Adjustment): string {
  if (a.label) return a.label;
  const what = a.target.mcc ? mccLabel(a.target.mcc) : a.target.category ? categoryLabel(a.target.category) : a.target.basket ? basketLabel(a.target.basket) : et("All spending");
  const pct = Math.round(a.changePct);
  return `${what} ${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(pct)}%`;
}

function baselineMonthlyFor(c: CustomerData, kinds: FlowKind[], a: Adjustment, from: string, to: string, nMonths: number): number {
  const [s, e] = txRange(c, from, to);
  let t = 0;
  for (let k = s; k < e; k++) {
    const tx = c.tx[k];
    const kind = kinds[k];
    if (!isBasket(kind) || tx.amount >= 0) continue;
    if (a.target.category && tx.category !== a.target.category) continue;
    if (a.target.mcc && tx.mcc !== a.target.mcc) continue;
    if (a.target.basket && kind !== a.target.basket) continue;
    t += -tx.amount;
  }
  return t / Math.max(1, nMonths);
}

export const simulateWhatIf: SimulateWhatIf = (c, scenario, opts) => {
  const kinds = kindsOf(c, opts);
  const nWanted = Math.max(1, Math.min(24, scenario.baselineMonths ?? 6));
  const dataStart = c.tx[0]?.date ?? c.asOf;
  const months = completeMonths(c.asOf, nWanted).filter((m) => monthStart(m) >= dataStart.slice(0, 7) + "-01");
  const nMonths = Math.max(1, months.length);
  const from = monthStart(months[0] ?? c.asOf.slice(0, 7));
  const to = monthEnd(months[months.length - 1] ?? c.asOf.slice(0, 7));

  const tw: SafeTweak = {};
  const mulInto = (key: "groceriesMult" | "transportMult" | "utilitiesMult", f: number) => (tw[key] = (tw[key] ?? 1) * f);
  const perAdjustment = scenario.adjustments.map((a) => {
    const pct = Math.max(-100, Math.min(500, a.changePct));
    const baselineMonthly = baselineMonthlyFor(c, kinds, a, from, to, nMonths);
    const newMonthly = baselineMonthly * (1 + pct / 100);
    const f = 1 + pct / 100;
    const t = a.target;
    const mustBasket = !t.basket || t.basket === "must_regular";
    if (mustBasket && !t.mcc && (t.category === "Groceries" || (!t.category && t.basket === "must_regular"))) mulInto("groceriesMult", f);
    if (mustBasket && (t.category === "Transportation" || (!t.category && t.basket === "must_regular")) && (!t.mcc || MUST_TRANSPORT.has(t.mcc))) mulInto("transportMult", f);
    if (mustBasket && !t.mcc && (t.category === "Utilities" || (!t.category && t.basket === "must_regular"))) mulInto("utilitiesMult", f);
    return { label: adjustmentLabel(a), baselineMonthly: r2(baselineMonthly), newMonthly: r2(newMonthly), savedMonthly: r2(baselineMonthly - newMonthly) };
  });
  const h = housingInfo(c);
  if (scenario.housingChange) {
    tw.housingDelta = scenario.housingChange;
    const base = h.typical;
    perAdjustment.push({ label: et("Housing"), baselineMonthly: r2(base), newMonthly: r2(Math.max(0, base + scenario.housingChange)), savedMonthly: r2(-scenario.housingChange) });
  }
  const extra = Math.max(0, scenario.extraMonthlySaving ?? 0);
  if (extra) tw.extraMonthlySaving = extra;
  const savedMonthly = r2(perAdjustment.reduce((t, x) => t + x.savedMonthly, 0) + extra);

  const before = computeSafeToSpend(c, opts ?? {});
  const after = computeSafeToSpend(c, opts ?? {}, tw);

  const ret = (scenario.annualReturnPct ?? 4) / 100;
  const i = Math.pow(1 + ret, 1 / 12) - 1;
  const horizons = scenario.horizonsMonths?.length ? scenario.horizonsMonths : [1, 12, 60, 120];
  const projections = horizons.map((m) => ({
    months: m,
    saved: r2(savedMonthly * m),
    invested: r2(savedMonthly > 0 && i > 0 ? (savedMonthly * (Math.pow(1 + i, m) - 1)) / i : savedMonthly * m),
  }));

  const equivalents: string[] = [];
  if (savedMonthly > 0) {
    const gWeek = dailyRate(c, 3, (t) => t.category === "Groceries").perDay * 7;
    if (gWeek > 0) equivalents.push(et("about {n} weeks of your groceries per year", { n: tNum((savedMonthly * 12) / gWeek) }));
    const u = utilitiesMonthly(c, 6).perMonth;
    if (h.active && h.typical > 0) equivalents.push(et("about {pct}% of a month's rent, every month", { pct: Math.round((savedMonthly / h.typical) * 100) }));
    else if (u > 0) equivalents.push(et("about {n} months of your utility bills per year", { n: tNum((savedMonthly * 12) / u) }));
  } else if (savedMonthly < 0) {
    equivalents.push(et("{amount} more spending every month", { amount: tEur(-savedMonthly) }));
  }

  // what is left at the end of an average month (income minus spending and saving), before and after the change
  const flows = spendingByKind(c, kinds, from, to);
  const monthEndLeftBefore = r2((flows.income - flows.must_regular - flows.must_irregular - flows.everyday - flows.saving) / nMonths);
  const monthEndLeftAfter = r2(monthEndLeftBefore + savedMonthly - extra); // extra saving moves money, it does not stay on the account

  const res: WhatIfResult = {
    basis: etn("Monthly average of {range} ({n} full month)", "Monthly average of {range} ({n} full months)", nMonths, { range: rangeLabel(from, to) }),
    perAdjustment,
    savedMonthly,
    safePerWeekBefore: before.safePerWeek,
    safePerWeekAfter: after.safePerWeek,
    safeChanges: Math.round(after.safePerWeek) !== Math.round(before.safePerWeek),
    monthEndLeftBefore,
    monthEndLeftAfter,
    yearlySaved: r2(savedMonthly * 12),
    projections,
    equivalents: equivalents.slice(0, 2),
  };
  return res;
};
