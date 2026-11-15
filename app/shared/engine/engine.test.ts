// Engine tests against real customers on the VM. Expected numbers marked "DuckDB" were computed independently with
// DuckDB over ~/data/tx.parquet (not with the engine), see server/scripts/groundtruth.py.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { engine } from "./index";
import type { CustomerData } from "../types";
import { mulberry32 } from "./simulate";

const load = (id: string) => JSON.parse(readFileSync(`${process.env.DATA_DIR}/customers/${id}.json`, "utf8")) as CustomerData;
const aino = load("CUST04754");
const mika = load("CUST00651");
const sep = { from: "2026-09-01", to: "2026-09-30" };
const aug = { from: "2026-08-01", to: "2026-08-31" };

describe("customer file facts", () => {
  it("CUST04754 basics", () => {
    expect(aino.tx.length).toBe(660);
    const last = aino.tx[aino.tx.length - 1];
    expect(last.date).toBe("2026-09-30");
    expect(last.balance).toBe(1743.5);
    expect(aino.tx.find((t) => t.type === "salary" && t.date === "2026-09-28")?.amount).toBeCloseTo(2005.1, 1);
    expect(aino.tx.find((t) => t.type === "investment_deposit" && t.date === "2026-09-30")?.amount).toBe(-83.61);
  });
});

describe("classifyTx", () => {
  it("follows domain.json rules", () => {
    const k = (pred: (t: CustomerData["tx"][number]) => boolean) => engine.classifyTx(aino, aino.tx.find(pred)!);
    expect(k((t) => t.type === "housing_payment")).toBe("must_regular");
    expect(k((t) => t.type === "salary")).toBe("income");
    expect(k((t) => t.type === "investment_deposit")).toBe("saving");
    expect(k((t) => t.category === "Restaurants")).toBe("everyday");
    expect(k((t) => t.category === "Health")).toBe("must_irregular");
    expect(k((t) => t.category === "Transportation" && t.mcc === "4121")).toBe("everyday");
    expect(k((t) => t.category === "Transportation" && t.mcc === "4111")).toBe("must_regular");
    // the 226.49 € furniture purchase is >= max(150, 3 x median Home & Tech) -> surprise must
    expect(k((t) => t.category === "Home & Tech" && t.amount === -226.49)).toBe("must_irregular");
  });
  it("applies overrides (byTx wins over byRule)", () => {
    const tx = aino.tx.find((t) => t.category === "Restaurants")!;
    expect(engine.classifyTx(aino, tx, { overrides: { byRule: { "Restaurants|*": "must_regular" } } })).toBe("must_regular");
    expect(engine.classifyTx(aino, tx, { overrides: { byRule: { "Restaurants|*": "must_regular" }, byTx: { [tx.i]: "must_irregular" } } })).toBe("must_irregular");
    const sal = aino.tx.find((t) => t.type === "salary")!;
    expect(engine.classifyTx(aino, sal, { overrides: { byTx: { [sal.i]: "everyday" } } })).toBe("income");
  });
});

describe("resolvePeriod", () => {
  const asOf = "2026-09-30"; // a Wednesday
  it("resolves named periods relative to asOf", () => {
    expect(engine.resolvePeriod(asOf, "this_week")).toMatchObject({ from: "2026-09-28", to: "2026-09-30" });
    expect(engine.resolvePeriod(asOf, "last_week")).toMatchObject({ from: "2026-09-21", to: "2026-09-27" });
    expect(engine.resolvePeriod(asOf, "this_month")).toMatchObject({ from: "2026-09-01", to: "2026-09-30", label: "September 2026" });
    expect(engine.resolvePeriod(asOf, "last_month")).toMatchObject({ from: "2026-08-01", to: "2026-08-31", label: "August 2026" });
    expect(engine.resolvePeriod(asOf, "last_3_months")).toMatchObject({ from: "2026-06-01", to: "2026-08-31" });
    expect(engine.resolvePeriod(asOf, "last_30_days")).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(engine.resolvePeriod(asOf, "last_12_months")).toMatchObject({ from: "2025-09-01", to: "2026-08-31" });
    expect(engine.resolvePeriod(asOf, "this_year")).toMatchObject({ from: "2026-01-01", to: "2026-09-30" });
    expect(engine.resolvePeriod(asOf, "all_time")).toMatchObject({ from: "2024-10-01", to: "2026-09-30" });
    expect(engine.resolvePeriod("2026-03-01", "this_week")).toMatchObject({ from: "2026-02-23", to: "2026-03-01" }); // Sunday
  });
});

describe("querySpending (DuckDB cross-checks)", () => {
  it("CUST04754 September Restaurants = 224.22 € in 10 purchases (DuckDB)", () => {
    const r = engine.querySpending(aino, { period: sep, categories: ["Restaurants"], compareTo: "previous_period" });
    expect(r.total).toBe(224.22);
    expect(r.count).toBe(10);
    expect(r.comparison?.total).toBe(289.11); // August, DuckDB
    expect(r.comparison?.period).toMatchObject(aug);
    expect(r.comparison?.deltaAbs).toBe(-64.89);
  });
  it("CUST00651 has 35 Transportation purchases totalling 1577.97 € in September 2026 (DuckDB)", () => {
    const r = engine.querySpending(mika, { period: sep, categories: ["Transportation"], groupBy: "mcc" });
    expect(r.total).toBe(1577.97);
    expect(r.count).toBe(35);
    expect(r.groups?.find((g) => g.key === "4121")).toMatchObject({ total: 333.71, count: 6 }); // taxis, DuckDB
  });
  it("taxi MCC filter (CUST04754: 5 taxi rides, 157.89 € all time; none in August) (DuckDB)", () => {
    const all = engine.querySpending(aino, { period: engine.resolvePeriod(aino.asOf, "all_time"), mccs: ["4121"], includeTransactions: true });
    expect(all.total).toBe(157.89);
    expect(all.count).toBe(5);
    expect(all.transactions?.length).toBe(5);
    expect(engine.querySpending(aino, { period: aug, mccs: ["4121"] }).total).toBe(0);
  });
  it("September spending grouped by weekday (DuckDB)", () => {
    const r = engine.querySpending(aino, { period: sep, groupBy: "weekday" });
    expect(r.total).toBe(2535.32);
    const expected = [234.73, 1400.39, 42.45, 164.86, 208.56, 123.23, 361.1];
    expect(r.groups?.map((g) => g.total)).toEqual(expected);
    expect(engine.querySpending(aino, { period: sep, weekdays: [6, 7] }).total).toBe(484.33);
  });
});

describe("getBaskets", () => {
  it("CUST04754 September (DuckDB)", () => {
    const b = engine.getBaskets(aino, sep);
    expect(b.spending).toBe(2535.32);
    expect(b.income).toBe(2005.14);
    expect(b.baskets.map((x) => x.basket)).toEqual(["must_regular", "must_irregular", "everyday"]);
    expect(b.baskets[0].total).toBe(1519.41);
    expect(b.saving).toBe(83.61);
    expect(b.net).toBe(Math.round((2005.14 - 2535.32 - 83.61) * 100) / 100);
  });
  it("everyday extras in August (DuckDB, with the big-purchase rule)", () => {
    expect(engine.getBaskets(aino, aug).baskets[2].total).toBe(512.01);
    expect(engine.getBaskets(mika, aug).baskets[2].total).toBe(2127.74);
  });
});

describe("getRecurring / getSafeToSpend", () => {
  it("recurring items for CUST04754", () => {
    const r = engine.getRecurring(aino);
    const by = Object.fromEntries(r.map((x) => [x.kind, x]));
    expect(by.salary.typicalAmount).toBe(1959.59); // median of the last 6 salaries (hand-checked)
    expect(by.housing.typicalAmount).toBe(1277.37); // DuckDB median of the last 6 = 1277.365
    expect(by.utilities.typicalAmount).toBe(102.12); // DuckDB Apr-Sep / 6 = 102.118
    expect(by.housing.nextFrom).toBe("2026-10-01");
    expect(by.groceries.typicalAmount).toBe(Math.round((409.31 / 92) * 7 * 100) / 100); // DuckDB Jul-Sep groceries
  });
  it("safe to spend reserves the rent that is due before payday", () => {
    const s = engine.getSafeToSpend(aino);
    expect(s.balance).toBe(1743.5);
    expect(s.nextPayday.date).toBe("2026-10-15");
    expect(s.nextPayday.daysAway).toBe(15);
    const housing = s.upcoming.find((u) => u.kind === "housing");
    expect(housing?.amount).toBe(1277.37);
    expect(s.upcoming.find((u) => u.kind === "investment")).toBeUndefined(); // 83.61 already invested on 30 Sep
    expect(s.upcoming.find((u) => u.kind === "utilities")?.amount).toBe(Math.round(((102.118 * 15) / 30.44) * 100) / 100);
    // the arithmetic adds up
    const reserved = s.upcoming.reduce((t, u) => t + u.amount, 0);
    expect(s.reservedTotal).toBeCloseTo(reserved, 2);
    expect(s.freeUntilPayday).toBeCloseTo(s.balance - s.reservedTotal, 2);
    expect(s.safePerWeek).toBeCloseTo(s.freeUntilPayday / s.weeksUntilPayday, 0);
    expect(s.steps[0]).toMatchObject({ label: "Balance today", amount: 1743.5, sign: "+" });
    expect(s.week).toMatchObject({ from: "2026-09-28", to: "2026-10-04" });
  });
  it("a goal reserves money and lowers the safe amount", () => {
    const base = engine.getSafeToSpend(aino);
    const g = engine.getSafeToSpend(aino, { goal: { name: "Trip", targetAmount: 1000, targetDate: "2027-06-01", monthlyContribution: 60, createdAt: "2026-09-30" } });
    expect(g.upcoming.find((u) => u.kind === "goal")?.amount).toBe(Math.round(60 * (15 / 30.44) * 100) / 100);
    expect(g.safePerWeek).toBeLessThan(base.safePerWeek);
  });
});

describe("getMonthly / getWeekSummary / getSpenderStats", () => {
  it("monthly rows (DuckDB)", () => {
    const m = engine.getMonthly(aino, 12);
    expect(m.length).toBe(12);
    expect(m[11]).toMatchObject({ month: "2026-09", complete: true, endBalance: 1743.5, income: 2005.14 });
    const augRow = m.find((r) => r.month === "2026-08")!;
    expect(augRow.income).toBe(2048.04);
    expect(augRow.everyday).toBe(512.01);
  });
  it("last full week (DuckDB: 319.63 € in 8 transactions, 21-27 Sep)", () => {
    const w = engine.getWeekSummary(aino, -1);
    expect(w).toMatchObject({ from: "2026-09-21", to: "2026-09-27", spending: 319.63 });
    expect(w.lowestBalance).toBe(-178.03); // the dip before the 28 Sep payday
  });
  it("spender stats over the last 12 full months (DuckDB)", () => {
    const s = engine.getSpenderStats(aino);
    expect(s.months).toBe(12);
    expect(s.monthlySpending).toBe(1850.58);
    expect(s.monthlyIncome).toBe(1927.5);
    expect(s.overdraftDaysLast12m).toBe(33);
  });
});

describe("simulateWhatIf", () => {
  it("dining out -20% uses the Apr-Sep average (DuckDB 125.997 €/month)", () => {
    const r = engine.simulateWhatIf(aino, { adjustments: [{ target: { category: "Restaurants" }, changePct: -20 }] });
    expect(r.perAdjustment[0].baselineMonthly).toBe(126);
    expect(r.savedMonthly).toBe(25.2);
    expect(r.projections.find((p) => p.months === 12)?.saved).toBe(302.4);
    expect(r.projections.find((p) => p.months === 12)!.invested).toBeGreaterThan(302.4);
  });
  it("cheaper rent raises the safe amount", () => {
    const r = engine.simulateWhatIf(aino, { adjustments: [], housingChange: -100 });
    expect(r.savedMonthly).toBe(100);
    expect(r.safePerWeekAfter).toBeGreaterThan(r.safePerWeekBefore);
  });
});

describe("simulateBalance", () => {
  const fe = engine.getFixedEvents(aino, 35);
  it("fixed events", () => {
    expect(fe.find((e) => e.kind === "housing")).toMatchObject({ amount: -1277.37 });
    expect(fe.find((e) => e.kind === "salary")).toMatchObject({ date: "2026-10-15", amount: 1959.59 });
  });
  it("is reproducible, sane and fast", () => {
    const p = { days: 35, fixedEvents: fe, paydayDate: "2026-10-15" };
    const a = engine.simulateBalance(aino, p);
    const b = engine.simulateBalance(aino, p);
    expect(a).toEqual(b);
    expect(a.fan.length).toBe(36);
    expect(a.fan[0].p50).toBe(1743.5);
    for (const f of a.fan) expect(f.p10 <= f.p50 && f.p50 <= f.p90).toBe(true);
    expect(a.overdraftProbToPayday).toBeGreaterThanOrEqual(0);
    // spending less in every category cannot make the median path lower
    const thrifty = engine.simulateBalance(aino, { ...p, multipliers: { Restaurants: 0.5, Entertainment: 0.5, Lifestyle: 0.5 } });
    expect(thrifty.endBalanceP50).toBeGreaterThanOrEqual(a.endBalanceP50);
    const t0 = performance.now();
    for (let k = 0; k < 20; k++) engine.simulateBalance(aino, { ...p, seed: k });
    expect((performance.now() - t0) / 20).toBeLessThan(50);
  });
  it("mulberry32 is deterministic", () => {
    const r = mulberry32(42);
    const xs = [r(), r(), r()];
    const r2 = mulberry32(42);
    expect([r2(), r2(), r2()]).toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
  });
});
