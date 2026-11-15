// getSpenderStats: descriptive behaviour statistics over the last 12 full months (fewer if the data is shorter).
// Shares named *Pct are 0-100; basketShares are fractions 0..1 of spending (like BasketSummary.share).
import type { GetSpenderStats, SpenderStats } from "./api";
import type { Basket } from "../types";
import { isBasket, kindsOf } from "./classify";
import { salaryInfo } from "./recurring";
import { BASKETS, SMALL, categoryLabel, completeMonths, currentBalance, dayNum, fromDayNum, isoWeekday, mean, monthEnd, monthKey, monthStart, r1, r2, stdev, txRange } from "./util";

export const getSpenderStats: GetSpenderStats = (c, opts) => {
  const kinds = kindsOf(c, opts);
  const dataStart = c.tx[0]?.date ?? c.asOf;
  const months = completeMonths(c.asOf, 12).filter((m) => monthStart(m) >= monthStart(monthKey(dataStart)));
  const n = Math.max(1, months.length);
  const from = monthStart(months[0] ?? monthKey(c.asOf));
  const to = monthEnd(months[months.length - 1] ?? monthKey(c.asOf));
  const [s, e] = txRange(c, from, to);

  const perMonth = new Map<string, number>(months.map((m) => [m, 0]));
  const basket: Record<Basket, number> = { must_regular: 0, must_irregular: 0, everyday: 0 };
  const cats = new Map<string, number>();
  let income = 0;
  let housing = 0;
  let small = 0;
  let smallTotal = 0;
  let weekendEveryday = 0;
  let purchases = 0;
  let evening = 0;
  for (let k = s; k < e; k++) {
    const t = c.tx[k];
    const kind = kinds[k];
    if (kind === "income") income += t.amount;
    if (t.type === "housing_payment") housing += -t.amount;
    if (!isBasket(kind) || t.amount >= 0) continue;
    const v = -t.amount;
    basket[kind] += v;
    cats.set(t.category, (cats.get(t.category) ?? 0) + v);
    const mk = monthKey(t.date);
    perMonth.set(mk, (perMonth.get(mk) ?? 0) + v);
    if (t.type === "purchase") {
      purchases += v;
      if (+t.time.slice(0, 2) >= 18) evening += v;
      if (v < SMALL) {
        small++;
        smallTotal += v;
      }
    }
    if (kind === "everyday" && isoWeekday(t.date) >= 5) weekendEveryday += v;
  }
  const spending = BASKETS.reduce((t, b) => t + basket[b], 0);

  // payday burn: everyday spending on payday and the 4 days after, as a share of all everyday spending
  const sal = salaryInfo(c).dates.filter((d) => d >= from && d <= to);
  let burn = 0;
  if (sal.length) {
    const inWindow = new Set<number>();
    for (const d of sal) for (let j = 0; j < 5; j++) inWindow.add(dayNum(d) + j);
    for (let k = s; k < e; k++) {
      const t = c.tx[k];
      if (kinds[k] === "everyday" && t.amount < 0 && inWindow.has(dayNum(t.date))) burn += -t.amount;
    }
  }

  // overdraft days in the last 365 days (end-of-day balance below zero)
  let od = 0;
  {
    const start = dayNum(c.asOf) - 364;
    const [a, b] = txRange(c, fromDayNum(start), c.asOf);
    let bal = a > 0 ? c.tx[a - 1].balance : c.tx.length ? c.tx[0].balance - c.tx[0].amount : 0;
    let k = a;
    for (let d = start; d <= dayNum(c.asOf); d++) {
      const ds = fromDayNum(d);
      while (k < b && c.tx[k].date === ds) bal = c.tx[k++].balance;
      if (ds >= dataStart && bal < 0) od++;
    }
  }
  const monthlyMust = (basket.must_regular + basket.must_irregular) / n;
  const series = [...perMonth.values()];
  const res: SpenderStats = {
    months: months.length,
    monthlyIncome: r2(income / n),
    monthlySpending: r2(spending / n),
    savingsRatePct: income > 0 ? r1(((income - spending) / income) * 100) : 0,
    basketShares: {
      must_regular: spending > 0 ? Math.round((basket.must_regular / spending) * 1000) / 1000 : 0,
      must_irregular: spending > 0 ? Math.round((basket.must_irregular / spending) * 1000) / 1000 : 0,
      everyday: spending > 0 ? Math.round((basket.everyday / spending) * 1000) / 1000 : 0,
    },
    housingShareOfIncomePct: housing > 0 && income > 0 ? r1((housing / income) * 100) : null,
    smallPurchasesPerMonth: r1(small / n),
    smallPurchasesMonthlyTotal: r2(smallTotal / n),
    weekendSharePct: basket.everyday > 0 ? r1((weekendEveryday / basket.everyday) * 100) : 0,
    eveningSharePct: purchases > 0 ? r1((evening / purchases) * 100) : 0,
    paydayBurnPct: basket.everyday > 0 && sal.length ? r1((burn / basket.everyday) * 100) : 0,
    spendingVolatilityPct: mean(series) > 0 ? r1((stdev(series) / mean(series)) * 100) : 0,
    overdraftDaysLast12m: od,
    bufferMonths: monthlyMust > 0 ? r2(Math.max(0, currentBalance(c)) / monthlyMust) : 0,
    topCategories: [...cats.entries()]
      .map(([key, v]) => ({ key, label: categoryLabel(key), monthly: r2(v / n), shareOfSpending: spending > 0 ? Math.round((v / spending) * 1000) / 1000 : 0 }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 5),
  };
  return res;
};
