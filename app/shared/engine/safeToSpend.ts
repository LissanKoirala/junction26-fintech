// getSafeToSpend: "your balance is not your budget". Between today and the next payday Vara reserves the musts
// that are still coming (rent if still due, utilities, groceries and other fixed-must purchases pro-rated, the usual
// investment deposit if it is still pending, a savings-goal contribution, a buffer). What is left is free money
// until payday; divided by the weeks left it gives a safe amount per week.
import type { GetSafeToSpend, SafeToSpend, SafeToSpendOptions, UpcomingItem } from "./api";
import type { CustomerData } from "../types";
import { kindsOf } from "./classify";
import { dailyRate, housingDue, nextPayday, pendingInvestment, salaryInfo, utilitiesMonthly } from "./recurring";
import { spendingByKind } from "./spending";
import { addDays, completeMonths, currentBalance, dateInMonth, dayLabel, dayOfMonth, daysBetween, et, etn, isoWeekday, mean, median, monthEnd, monthStart, r2, weekStart, tEur } from "./util";

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
  const dLabel = etn("{n} day", "{n} days", nDays);

  // housing still due before payday
  for (const h of housingDue(c, pay.date)) {
    const amount = Math.max(0, h.amount + (tw.housingDelta ?? 0));
    upcoming.push({
      kind: "housing",
      label: et("Rent / housing"),
      amount: r2(amount),
      from: h.from,
      to: h.to,
      basis: tw.housingDelta
        ? et("Median of your last 6 housing payments, usually paid between day {from} and {to} of the month, adjusted by {delta} in this scenario.", { from: dayOfMonth(h.from), to: dayOfMonth(h.to), delta: tEur(tw.housingDelta) })
        : et("Median of your last 6 housing payments, usually paid between day {from} and {to} of the month.", { from: dayOfMonth(h.from), to: dayOfMonth(h.to) }),
    });
  }
  // utilities: monthly total pro-rated
  const u = utilitiesMonthly(c, 6);
  if (u.perMonth > 0) {
    upcoming.push({
      kind: "utilities",
      label: et("Utilities"),
      amount: r2(((u.perMonth * nDays) / 30.44) * (tw.utilitiesMult ?? 1)),
      from: tomorrow,
      to: dayBeforePay,
      basis: et("Your utilities average {amount} a month (the {n} of the last {m} months that had bills), pro-rated for {days}.", { amount: tEur(u.perMonth), n: u.paidMonths, m: u.months.length, days: dLabel }),
    });
  }
  // groceries and other fixed-must purchases, pro-rated from the last 3 full months
  const gro = dailyRate(c, 3, (t, k) => kinds[k] === "must_regular" && t.type === "purchase" && t.category === "Groceries");
  if (gro.perDay > 0) {
    upcoming.push({
      kind: "groceries",
      label: et("Groceries"),
      amount: r2(gro.perDay * nDays * (tw.groceriesMult ?? 1)),
      from: tomorrow,
      to: dayBeforePay,
      basis: et("You spend about {amount} a week on groceries (last 3 full months), so {days} need about this much.", { amount: tEur(gro.perDay * 7), days: dLabel }),
    });
  }
  const tr = dailyRate(c, 3, (t, k) => kinds[k] === "must_regular" && t.type === "purchase" && t.category !== "Groceries");
  if (tr.perDay > 0) {
    upcoming.push({
      kind: "transport",
      label: et("Getting around and other fixed musts"),
      amount: r2(tr.perDay * nDays * (tw.transportMult ?? 1)),
      from: tomorrow,
      to: dayBeforePay,
      basis: et("Public transport, fuel and other fixed-must purchases average {amount} a week (last 3 full months).", { amount: tEur(tr.perDay * 7) }),
    });
  }
  // the usual investment deposit, if it is still pending before payday
  if (opts.includeInvesting !== false) {
    const inv = pendingInvestment(c);
    if (inv && inv.date < pay.date) {
      upcoming.push({
        kind: "investment",
        label: et("Your usual investment deposit"),
        amount: r2(inv.amount),
        from: inv.date,
        to: inv.date,
        basis: et("You usually invest this amount a few days after payday, and it has not gone out yet this month."),
      });
    }
  }
  // savings goal (and extra saving from a what-if), pro-rated to the days until payday
  const share = Math.min(1, nDays / 30.44);
  if (opts.goal && opts.goal.monthlyContribution > 0) {
    upcoming.push({
      kind: "goal",
      label: et("Savings goal: {name}", { name: opts.goal.name }),
      amount: r2(opts.goal.monthlyContribution * share),
      from: tomorrow,
      to: dayBeforePay,
      basis: et("{amount} a month toward \"{name}\", pro-rated for {days}.", { amount: tEur(opts.goal.monthlyContribution), name: opts.goal.name, days: dLabel }),
    });
  }
  // money held in the Crave pot (simulated): it has moved out of the free money until it is released
  const cravePot = Number.isFinite(opts.cravePot) && (opts.cravePot ?? 0) > 0 ? r2(opts.cravePot!) : 0;
  if (cravePot > 0) {
    upcoming.push({
      kind: "goal",
      label: et("Held in your Crave pot"),
      amount: cravePot,
      from: null,
      to: null,
      basis: et("Money you moved to your Crave pot. It is not free to spend until you release it."),
    });
  }
  if (tw.extraMonthlySaving && tw.extraMonthlySaving > 0) {
    upcoming.push({
      kind: "goal",
      label: et("Extra saving (scenario)"),
      amount: r2(tw.extraMonthlySaving * share),
      from: tomorrow,
      to: dayBeforePay,
      basis: et("{amount} a month moved to savings, pro-rated for {days}.", { amount: tEur(tw.extraMonthlySaving), days: dLabel }),
    });
  }
  // buffer: 10% of the income that stays on this account (at least 50 €)
  const income = keptIncome(c);
  const buffer = opts.bufferTarget ?? Math.max(50, 0.1 * income);
  if (buffer > 0) {
    upcoming.push({
      kind: "buffer",
      label: et("Safety buffer"),
      amount: r2(buffer),
      from: null,
      to: null,
      basis:
        opts.bufferTarget != null
          ? et("The buffer you chose to keep untouched.")
          : c.hasSalarySweep
            ? et("A cushion for surprise musts: 10% of the income that stays on this account (at least 50 €).")
            : et("A cushion for surprise musts: 10% of your monthly income (at least 50 €)."),
    });
  }

  // late pay: the main pattern is the 15th, but about 1 month in 5 pay comes at the end of the month instead.
  // lateExtra = the extra fixed musts if pay arrives on `latest`: the larger of the pro-rated average and what this
  // customer's own fixed musts (rent, bills, groceries, transport) were in that same stretch of the month in 3 of 4 of
  // the last 12 months. The cushion covers it, or the shortfall is reserved. Backtested over 9 month-ends: the
  // cushion then covers more than half of the real gap in 96% of late months, the full gap in about 6 of 10, so the
  // note says "most of that gap".
  let late: { lateExtra: number; lateCovered: boolean; lateNote: string } | undefined;
  if (!pay.estimated && pay.lateCount != null && pay.latest && pay.latest > pay.date) {
    const gap = daysBetween(pay.date, pay.latest);
    const extraHousing = housingDue(c, addDays(pay.latest, 1))
      .slice(housingDue(c, pay.date).length)
      .reduce((t, h) => t + Math.max(0, h.amount + (tw.housingDelta ?? 0)), 0);
    const averageNeed =
      gro.perDay * gap * (tw.groceriesMult ?? 1) +
      tr.perDay * gap * (tw.transportMult ?? 1) +
      ((u.perMonth * gap) / 30.44) * (tw.utilitiesMult ?? 1) +
      extraHousing;
    const d1 = dayOfMonth(pay.date);
    const d2 = dayOfMonth(pay.latest);
    const ownWindows = completeMonths(c.asOf, 12).map((m) => {
      const from = dateInMonth(m, d1);
      const to = d2 >= 28 ? monthEnd(m) : dateInMonth(m, d2);
      let sum = 0;
      c.tx.forEach((t, i) => {
        if (t.date >= from && t.date < to && t.amount < 0 && kinds[i] === "must_regular") sum -= t.amount;
      });
      return sum;
    });
    const sortedOwn = [...ownWindows].sort((a, b) => a - b);
    const ownP75 = sortedOwn.length ? sortedOwn[Math.min(sortedOwn.length - 1, Math.floor(0.75 * sortedOwn.length))] : 0;
    const lateExtra = r2(Math.max(averageNeed, ownP75 + (tw.housingDelta ?? 0) * (gap / 30.44)));
    const lateCovered = buffer >= lateExtra;
    const n = pay.lateCount ?? 0;
    const m = pay.monthsSeen ?? 12;
    let lateNote: string;
    const mostlyLate = n * 2 > m; // paid on the 15th in fewer than half of the months: do not say "usually"
    if (lateCovered)
      lateNote = mostlyLate
        ? et("Your pay day is the 15th, but in {n} of the last {m} months it came at the end of the month; your cushion covers most of that gap.", { n, m })
        : n > 0
          ? et("Pay usually comes on the 15th. In {n} of the last {m} months it came at the end of the month; your cushion covers most of that gap.", { n, m })
          : et("Pay has come on the 15th in each of the last {m} months. If it ever comes at the end of the month, your cushion covers most of that gap.", { m });
    else {
      const short = r2(lateExtra - buffer);
      lateNote = mostlyLate
        ? et("Your pay day is the 15th, but in {n} of the last {m} months it came at the end of the month, so Vara keeps {amount} aside in case it does.", { n, m, amount: tEur(short) })
        : n > 0
          ? et("Pay usually comes on the 15th. In {n} of the last {m} months it came at the end of the month, so Vara keeps {amount} aside in case it does.", { n, m, amount: tEur(short) })
          : et("Pay has come on the 15th in each of the last {m} months. Vara still keeps {amount} aside in case it comes at the end of the month.", { m, amount: tEur(short) });
      upcoming.push({
        kind: "buffer",
        label: et("In case pay comes late"),
        amount: short,
        from: pay.date,
        to: pay.latest,
        basis: et("If pay comes on {late} instead of {date}, the {n} extra days of fixed musts need about {extra}. Your cushion covers {buffer}, so Vara keeps the rest aside.", { late: dayLabel(pay.latest), date: dayLabel(pay.date), n: gap, extra: tEur(lateExtra), buffer: tEur(buffer) }),
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

  const steps: SafeToSpend["steps"] = [{ label: et("Balance today"), amount: r2(balance), sign: "+" }];
  for (const x of upcoming) steps.push({ label: x.label, amount: x.amount, sign: "-" });
  steps.push({ label: et("Free until payday"), amount: free, sign: "=" });
  steps.push({ label: et("Weeks until payday ({days})", { days: dLabel }), amount: Math.round(weeks * 100) / 100, sign: "/" });
  steps.push({ label: et("Safe to spend per week"), amount: safePerWeek, sign: "=" });

  let note: string | undefined;
  if (safePerWeek > 200 && safePerWeek > 3 * typicalWeek)
    note = et("Most of this is savings you have already built up. Your everyday extras usually take about {amount} a week; staying near that keeps the cushion growing.", { amount: tEur(typicalWeek) });
  else if (free < 0) note = et("The musts coming before payday are bigger than your balance. Small cuts now, or moving a bill, can stop the account going below zero.");
  if (pay.estimated) note = (note ? note + " " : "") + pay.basis;
  else if (c.hasSalarySweep) note = (note ? note + " " : "") + et("Most of your salary moves to another account right after payday, so this only covers the money in this account.");

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
    cravePot: cravePot || undefined,
    steps,
  };
}

export const getSafeToSpend: GetSafeToSpend = (c, opts) => computeSafeToSpend(c, opts ?? {});
