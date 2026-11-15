// Dev smoke test: print engine outputs for one customer. Usage: npx tsx server/scripts/smoke.ts CUST04754
import { readFileSync } from "node:fs";
import { engine } from "../../shared/engine";
import type { CustomerData } from "../../shared/types";

const id = process.argv[2] ?? "CUST04754";
const c = JSON.parse(readFileSync(`${process.env.DATA_DIR}/customers/${id}.json`, "utf8")) as CustomerData;
const show = (name: string, v: unknown) => console.log(`\n== ${name}\n${JSON.stringify(v, null, 1).slice(0, 2500)}`);
show("recurring", engine.getRecurring(c));
show("safe", engine.getSafeToSpend(c));
show("baskets Sep", engine.getBaskets(c, engine.resolvePeriod(c.asOf, "this_month")));
show("week", engine.getWeekSummary(c, 0));
show("stats", engine.getSpenderStats(c));
show("whatif", engine.simulateWhatIf(c, { adjustments: [{ target: { category: "Restaurants" }, changePct: -20 }] }));
const fe = engine.getFixedEvents(c, 35);
show("fixed", fe);
const t0 = performance.now();
const sim = engine.simulateBalance(c, { days: 35, fixedEvents: fe, paydayDate: engine.getSafeToSpend(c).nextPayday.date });
const t1 = performance.now();
show("sim", { ...sim, fan: sim.fan.filter((_, i) => i % 7 === 0), ms: t1 - t0 });
show("monthly", engine.getMonthly(c, 3));
