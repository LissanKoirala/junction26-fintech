// Run every engine function over every customer: proves nothing throws and every number is finite, and lists
// customer classes with odd output. Usage: npx tsx server/scripts/allcustomers.ts
import { readFileSync } from "node:fs";
import { engine } from "../../shared/engine";
import type { CustomerData, CustomerIndexRow } from "../../shared/types";

const dir = `${process.env.DATA_DIR}/customers`;
const index = JSON.parse(readFileSync(`${dir}/index.json`, "utf8")) as CustomerIndexRow[];

function nonFinite(v: unknown, path = ""): string[] {
  if (typeof v === "number") return Number.isFinite(v) ? [] : [path];
  if (Array.isArray(v)) return v.flatMap((x, i) => nonFinite(x, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => nonFinite(x, `${path}.${k}`));
  return [];
}

const errors: string[] = [];
const odd: Record<string, string[]> = {};
const flag = (k: string, id: string) => (odd[k] ??= []).push(id);
const status: Record<string, Record<string, number>> = {};
let simMs = 0;
let simMax = 0;
const t0 = Date.now();
for (const row of index) {
  const c = JSON.parse(readFileSync(`${dir}/${row.id}.json`, "utf8")) as CustomerData;
  const cls = c.cohort === "tail" ? "tail" : c.hasSalarySweep ? "sweep" : !c.hasHousing ? "no-housing" : "main";
  try {
    const out: Record<string, unknown> = {};
    for (const p of ["this_week", "last_month", "last_3_months", "all_time"] as const) {
      const period = engine.resolvePeriod(c.asOf, p);
      out[`q_${p}`] = engine.querySpending(c, { period, groupBy: "category", compareTo: "previous_period", includeTransactions: true });
      out[`b_${p}`] = engine.getBaskets(c, period);
    }
    out.mcc = engine.querySpending(c, { period: engine.resolvePeriod(c.asOf, "last_12_months"), mccs: ["4121"], groupBy: "weekday" });
    out.rec = engine.getRecurring(c);
    const s = engine.getSafeToSpend(c);
    out.safe = s;
    out.safeGoal = engine.getSafeToSpend(c, { goal: { name: "g", targetAmount: 1000, targetDate: "2027-09-30", monthlyContribution: 50, createdAt: c.asOf } });
    out.month = engine.getMonthly(c, 24);
    out.week0 = engine.getWeekSummary(c, 0);
    out.week1 = engine.getWeekSummary(c, -1);
    out.stats = engine.getSpenderStats(c);
    out.whatif = engine.simulateWhatIf(c, {
      adjustments: [
        { target: { category: "Restaurants" }, changePct: -20 },
        { target: { basket: "everyday" }, changePct: -10 },
        { target: { category: "Groceries" }, changePct: -5 },
      ],
      housingChange: -50,
      extraMonthlySaving: 30,
    });
    const fe = engine.getFixedEvents(c, 35);
    out.fe = fe;
    const a = performance.now();
    out.sim = engine.simulateBalance(c, { days: 35, fixedEvents: fe, paydayDate: s.nextPayday.date });
    const ms = performance.now() - a;
    simMs += ms;
    simMax = Math.max(simMax, ms);
    const bad = nonFinite(out);
    if (bad.length) errors.push(`${c.id} non-finite: ${bad.slice(0, 5).join(", ")}`);
    (status[cls] ??= {})[s.status] = ((status[cls] ??= {})[s.status] ?? 0) + 1;
    if (s.nextPayday.estimated) flag(`${cls}: no regular salary (30-day horizon)`, c.id);
    if (s.balance < 0) flag(`${cls}: negative balance today`, c.id);
    if (s.safePerWeek > 3 * Math.max(1, (out.stats as any).monthlyIncome)) flag(`${cls}: safePerWeek > 3x monthly income`, c.id);
    if (s.nextPayday.daysAway > 32) flag(`${cls}: payday more than 32 days away`, c.id);
    if ((out.rec as any[]).length === 0) flag(`${cls}: no recurring items`, c.id);
    if ((out.stats as any).savingsRatePct < -100) flag(`${cls}: savings rate below -100%`, c.id);
    if (c.tx.some((t) => t.type === "purchase" && Math.abs(t.amount) > 20000)) flag(`${cls}: purchase over 20 000 €`, c.id);
  } catch (err) {
    errors.push(`${c.id} threw: ${(err as Error).stack?.split("\n").slice(0, 3).join(" | ")}`);
  }
}
console.log(`customers: ${index.length}, seconds: ${((Date.now() - t0) / 1000).toFixed(1)}`);
console.log(`simulateBalance 1000x35: mean ${(simMs / index.length).toFixed(2)} ms, max ${simMax.toFixed(1)} ms`);
console.log(`errors: ${errors.length}`);
for (const e of errors.slice(0, 20)) console.log("  " + e);
console.log("safe-to-spend status by class:", JSON.stringify(status));
for (const [k, ids] of Object.entries(odd)) console.log(`odd: ${k}: ${ids.length} (e.g. ${ids.slice(0, 4).join(", ")})`);
