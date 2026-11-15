// getSafeToSpend: "your balance is not your budget". Between today and the next payday Vara reserves the musts
// that are still coming (rent if still due, utilities, groceries and other fixed-must purchases pro-rated, the usual
// investment deposit if it is still pending, a savings-goal contribution, a buffer). What is left is free money
// until payday; divided by the weeks left it gives a safe amount per week.
import type { GetSafeToSpend, SafeToSpend, SafeToSpendOptions, UpcomingItem } from "./api";
import type { CustomerData } from "../types";
import { kindsOf } from "./classify";
import { dailyRate, housingDue, nextPayday, pendingInvestment, salaryInfo, utilitiesMonthly } from "./recurring";
import { spendingByKind } from "./spending";
import { addDays, completeMonths, currentBalance, dayLabel, daysBetween, isoWeekday, mean, median, monthEnd, monthStart, r2, weekStart, tEur } from "./util";

/** Internal knobs used by the what-if simulator (reserve multipliers and deltas). */
export interface SafeTweak {
  groceriesMult?: number;
  transportMult?: number;
  utilitiesMult?: number;
  housingDelta?: number; // new monthly housing cost minus current
  extraMonthlySaving?: number;
}

/** Average monthly income over the last 6 complete months (salary median if the salary is regular). */
export function monthlyIncome(c: CustomerData): number {
  const s = salaryInfo(c);
  if (s.regular && s.typical > 0) return s.typical;
  const ms = completeMonths(c.asOf, 6);
  const kinds = kindsOf(c);
  return mean(ms.map((m) => spendingByKind(c, kinds, monthStart(m), monthEnd(m)).income));
}

/** Monthly income that stays on this account: for salary-sweep customers, income minus the usual sweep out. */
export function keptIncome(c: CustomerData): number {
  const income = monthlyIncome(c);
  if (!c.hasSalarySweep) return income;
  const sweeps = c.tx.filter((t) => t.type === "salary_sweep").slice(-6).map((t) => -t.amount);
  return Math.max(0, income - (sweeps.length ? median(sweeps) : 0));
}

/** Typical weekly everyday-extras spending over the last 3 complete months. */
export function typicalEverydayWeek(c: CustomerData, opts?: SafeToSpendOptions): number {
  const kinds = kindsOf(c, opts);
  return dailyRate(c, 3, (_t, k) => kinds[k] === "everyday").perDay * 7;
}

export function computeSafeToSpend(c: CustomerData, opts: SafeToSpendOptions = {}, tw: SafeTweak = {}): SafeToSpend {
  const asOf = c.asOf;
  const kinds = kindsOf(c, opts);
  const balance = currentBalance(c);
  const pay = nextPayday(c);
  const nDays = Math.max(1, pay.daysAway); // spending days: tomorrow up to and including payday
  const upcoming: UpcomingItem[] = [];
  const tomorrow = addDays(asOf, 1);
  const dayBeforePay = addDays(pay.date, -1) >= tomorrow ? addDays(pay.date, -1) : tomorrow;
  const dLabel = `${nDays} day${nDays === 1 ? "" : "s"}`;

  // housing still due before payday
  for (const h of housingDue(c, pay.date)) {
    const amount = Math.max(0, h.amount + (tw.housingDelta ?? 0));
    upcoming.push({
      kind: "housing",
      label: "Rent / housing",
      amount: r2(amount),
      from: h.from,
      to: h.to,
      basis: `Median of your last 6 housing payments, usually paid between day ${dayLabel(h.from).split(" ")[0]} and ${dayLabel(h.to).split(" ")[0]} of the month${tw.housingDelta ? `, adjusted by ${tEur(tw.housingDelta)} in this scenario` : ""}.`,
    });
  }
  // utilities: monthly total pro-rated
  const u = utilitiesMonthly(c, 6);
  if (u.perMonth > 0) {
    upcoming.push({
      kind: "utilities",
      label: "Utilities",
      amount: r2(((u.perMonth * nDays) / 30.44) * (tw.utilitiesMult ?? 1)),
      from: tomorrow,
      to: dayBeforePay,
      basis: `Your utilities average ${tEur(u.perMonth)} a month (the ${u.paidMonths} of the last ${u.months.length} months that had bills), pro-rated for ${dLabel}.`,
    });
  }
  // groceries and other fixed-must purchases, pro-rated from the last 3 full months
  const gro = dailyRate(c, 3, (t, k) => kinds[k] === "must_regular" && t.type === "purchase" && t.category === "Groceries");
  if (gro.perDay > 0) {
    upcoming.push({
      kind: "groceries",
      label: "Groceries",
      amount: r2(gro.perDay * nDays * (tw.groceriesMult ?? 1)),
      from: tomorrow,
      to: dayBeforePay,
      basis: `You spend about ${tEur(gro.perDay * 7)} a week on groceries (last 3 full months), so ${dLabel} need about this much.`,
    });
  }
  const tr = dailyRate(c, 3, (t, k) => kinds[k] === "must_regular" && t.type === "purchase" && t.category !== "Groceries");
  if (tr.perDay > 0) {
    upcoming.push({
      kind: "transport",
      label: "Getting around and other fixed musts",
      amount: r2(tr.perDay * nDays * (tw.transportMult ?? 1)),
      from: tomorrow,
      to: dayBeforePay,
      basis: `Public transport, fuel and other fixed-must purchases average ${tEur(tr.perDay * 7)} a week (last 3 full months).`,
    });
  }
  // the usual investment deposit, if it is still pending before payday
  if (opts.includeInvesting !== false) {
    const inv = pendingInvestment(c);
    if (inv && inv.date < pay.date) {
      upcoming.push({
        kind: "investment",
        label: "Your usual investment deposit",
        amount: r2(inv.amount),
        from: inv.date,
        to: inv.date,
        basis: "You usually invest this amount a few days after payday, and it has not gone out yet this month.",
      });
    }
  }
  // savings goal (and extra saving from a what-if), pro-rated to the days until payday
  const share = Math.min(1, nDays / 30.44);
  if (opts.goal && opts.goal.monthlyContribution > 0) {
    upcoming.push({
      kind: "goal",
      label: `Savings goal: ${opts.goal.name}`,
      amount: r2(opts.goal.monthlyContribution * share),
      from: tomorrow,
      to: dayBeforePay,
      basis: `${tEur(opts.goal.monthlyContribution)} a month toward "${opts.goal.name}", pro-rated for ${dLabel}.`,
    });
  }
  if (tw.extraMonthlySaving && tw.extraMonthlySaving > 0) {
    upcoming.push({
      kind: "goal",
      label: "Extra saving (scenario)",
      amount: r2(tw.extraMonthlySaving * share),
      from: tomorrow,
      to: dayBeforePay,
      basis: `${tEur(tw.extraMonthlySaving)} a month moved to savings, pro-rated for ${dLabel}.`,
    });
  }
  // buffer: 10% of the income that stays on this account (at least 50 €)
  const income = keptIncome(c);
  const buffer = opts.bufferTarget ?? Math.max(50, 0.1 * income);
  if (buffer > 0) {
    upcoming.push({
      kind: "buffer",
      label: "Safety buffer",
      amount: r2(buffer),
      from: null,
      to: null,
      basis:
        opts.bufferTarget != null
          ? "The buffer you chose to keep untouched."
          : c.hasSalarySweep
            ? `A cushion for surprise musts: 10% of the income that stays on this account (at least 50 €).`
            : `A cushion for surprise musts: 10% of your monthly income (at least 50 €).`,
    });
  }

  // late pay: the main pattern is the 15th, but about 1 month in 5 pay comes at the end of the month instead.
  // lateExtra = the extra fixed musts if pay arrives on `latest`; the cushion covers it, or the shortfall is reserved.
  let late: { lateExtra: number; lateCovered: boolean; lateNote: string } | undefined;
  if (!pay.estimated && pay.latest && pay.latest > pay.date) {
    const gap = daysBetween(pay.date, pay.latest);
    const extraHousing = housingDue(c, addDays(pay.latest, 1))
      .slice(housingDue(c, pay.date).length)
      .reduce((t, h) => t + Math.max(0, h.amount + (tw.housingDelta ?? 0)), 0);
    const lateExtra = r2(
      gro.perDay * gap * (tw.groceriesMult ?? 1) +
        tr.perDay * gap * (tw.transportMult ?? 1) +
        ((u.perMonth * gap) / 30.44) * (tw.utilitiesMult ?? 1) +
        extraHousing,
    );
    const lateCovered = buffer >= lateExtra;
    const n = pay.lateCount ?? 0;
    const m = pay.monthsSeen ?? 12;
    const history = n > 0 ? `Pay usually comes on the 15th. In ${n} of the last ${m} months it came at the end of the month` : `Pay has come on the 15th in each of the last ${m} months`;
    let lateNote: string;
    if (lateCovered) lateNote = n > 0 ? `${history}; your cushion covers that.` : `${history}. If it ever comes at the end of the month, your cushion covers that.`;
    else {
      const short = r2(lateExtra - buffer);
      lateNote = n > 0 ? `${history}, so Vara keeps ${tEur(short)} aside in case it does.` : `${history}. Vara still keeps ${tEur(short)} aside in case it comes at the end of the month.`;
      upcoming.push({
        kind: "buffer",
        label: "In case pay comes late",
        amount: short,
        from: pay.date,
        to: pay.latest,
        basis: `If pay comes on ${dayLabel(pay.latest)} instead of ${dayLabel(pay.date)}, the ${gap} extra days of fixed musts need about ${tEur(lateExtra)}. Your cushion covers ${tEur(buffer)}, so Vara keeps the rest aside.`,
      });
    }
    late = { lateExtra, lateCovered, lateNote };
  }

  const reservedTotal = r2(upcoming.reduce((t, x) => t + x.amount, 0));
  const free = r2(balance - reservedTotal);
  const weeks = Math.max(1, nDays / 7);
  const safePerWeek = r2(Math.max(0, free / weeks));
  const safePerDay = r2(Math.max(0, free) / nDays);

  // this ISO week: everyday extras spent so far, and what can still go this week
  const wFrom = weekStart(asOf);
  const wTo = addDays(wFrom, 6);
  const spentSoFar = r2(spendingByKind(c, kinds, wFrom, asOf).everyday);
  const daysLeftInWeek = Math.min(7 - isoWeekday(asOf), nDays);
  const remaining = r2(Math.min(Math.max(0, free), safePerDay * daysLeftInWeek));

  const typicalWeek = typicalEverydayWeek(c, opts);
  // comfortable only when the safe weekly amount covers a usual everyday week; half of it or more is "a bit tight"
  const status: SafeToSpend["status"] =
    free < 0 ? "over" : safePerWeek < Math.max(25, 0.5 * typicalWeek) ? "tight" : safePerWeek < typicalWeek ? "a_bit_tight" : "comfortable";
  // far more room than a usual week: the UI shows "well covered" instead of a giant weekly figure
  const wellCovered = free > 0 && typicalWeek > 0 && safePerWeek > 3 * typicalWeek && safePerWeek > 200;

  const steps: SafeToSpend["steps"] = [{ label: "Balance today", amount: r2(balance), sign: "+" }];
  for (const x of upcoming) steps.push({ label: x.label, amount: x.amount, sign: "-" });
  steps.push({ label: "Free until payday", amount: free, sign: "=" });
  steps.push({ label: `Weeks until payday (${dLabel})`, amount: Math.round(weeks * 100) / 100, sign: "/" });
  steps.push({ label: "Safe to spend per week", amount: safePerWeek, sign: "=" });

  let note: string | undefined;
  if (safePerWeek > 200 && safePerWeek > 3 * typicalWeek)
    note = `Most of this is savings you have already built up. Your everyday extras usually take about ${tEur(typicalWeek)} a week; staying near that keeps the cushion growing.`;
  else if (free < 0) note = "The musts coming before payday are bigger than your balance. Small cuts now, or moving a bill, can stop the account going below zero.";
  if (pay.estimated) note = (note ? note + " " : "") + pay.basis;
  else if (c.hasSalarySweep) note = (note ? note + " " : "") + "Most of your salary moves to another account right after payday, so this only covers the money in this account.";

  return {
    asOf,
    note,
    balance: r2(balance),
    nextPayday: {
      date: pay.date,
      amount: pay.amount,
      daysAway: pay.daysAway,
      estimated: pay.estimated,
      basis: pay.basis,
      latest: pay.latest,
      irregular: pay.irregular,
      lateCount: pay.lateCount,
      lateExtra: late?.lateExtra,
      lateCovered: late?.lateCovered,
      lateNote: late?.lateNote,
    },
    upcoming,
    reservedTotal,
    freeUntilPayday: free,
    weeksUntilPayday: Math.round(weeks * 100) / 100,
    safePerWeek,
    safePerDay,
    week: { from: wFrom, to: wTo, spentSoFar, remaining, daysLeft: daysLeftInWeek, typicalSpend: r2(typicalWeek) },
    status,
    wellCovered: wellCovered || undefined,
    steps,
  };
}

export const getSafeToSpend: GetSafeToSpend = (c, opts) => computeSafeToSpend(c, opts ?? {});
