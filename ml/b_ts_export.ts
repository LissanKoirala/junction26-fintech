// ML-B helper: export what the TypeScript engine computes at asOf, so ml/b_forecast.py uses EXACTLY the app's
// fixed events / next payday, and can check its numpy simulator against the TS one (parity test).
// usage (VM): cd ~/proj/app && npx tsx ../ml/b_ts_export.ts   -> $DATA_DIR/cache/b_ts_export.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { engine } from "../app/shared/engine";
import type { CustomerData, CustomerIndexRow } from "../app/shared/types";

const dataDir = process.env.DATA_DIR as string;
const dir = `${dataDir}/customers`;
const index = JSON.parse(readFileSync(`${dir}/index.json`, "utf8")) as CustomerIndexRow[];
const PARITY = new Set(["CUST04754", "CUST01408", "CUST03861", "CUST01349", "CUST00651", "CUST04375", "CUST00001"]);
const out: Record<string, unknown> = {};
for (const row of index) {
  const c = JSON.parse(readFileSync(`${dir}/${row.id}.json`, "utf8")) as CustomerData;
  const s = engine.getSafeToSpend(c);
  const fe = engine.getFixedEvents(c, 35);
  const rec: Record<string, unknown> = {
    balance: c.tx.length ? c.tx[c.tx.length - 1].balance : 0,
    nextPayday: s.nextPayday,
    fixedEvents: fe,
  };
  if (PARITY.has(c.id)) {
    rec.parity = [1, 1.37].map((scale) => {
      const r = engine.simulateBalance(c, { days: 35, nPaths: 1000, seed: 42, scale, fixedEvents: fe, paydayDate: s.nextPayday.date });
      return { scale, overdraftProbToPayday: r.overdraftProbToPayday, fan: r.fan };
    });
  }
  out[c.id] = rec;
}
mkdirSync(`${dataDir}/cache`, { recursive: true });
writeFileSync(`${dataDir}/cache/b_ts_export.json`, JSON.stringify(out));
console.log(`exported ${Object.keys(out).length} customers`);
