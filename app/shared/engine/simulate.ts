// Fixed events and the bootstrap balance simulator (spec: comment above SimParams in ./api.ts).
// Draw order (for parity with ml/b_forecast.py): one mulberry32 stream seeded with `seed`; paths outer loop,
// days inner loop; each simulated day consumes exactly one draw: idx = floor(u * poolSize) into the chronological
// list of history days that share the simulated day's ISO weekday. History days with no transactions count (zero).
import type { FanPoint, FixedEvent, GetFixedEvents, SimResult, SimulateBalance } from "./api";
import type { Category } from "../types";
import { housingDue, investInfo, pendingInvestment, predictPaydays } from "./recurring";
import { PURCHASE_CATS, addDays, currentBalance, dayNum, fromDayNum, isoWeekday, median, quantileSorted, r2, txRange } from "./util";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const getFixedEvents: GetFixedEvents = (c, days, opts) => {
  const asOf = c.asOf;
  const end = addDays(asOf, Math.max(0, days));
  const ev: FixedEvent[] = [];
  const paydays = predictPaydays(c, days).filter((p) => !p.estimated && p.date <= end);
  const sweeps = c.tx.filter((t) => t.type === "salary_sweep").slice(-6).map((t) => -t.amount);
  const sweep = c.hasSalarySweep && sweeps.length ? median(sweeps) : 0;
  const inv = investInfo(c);
  for (const p of paydays) {
    // salary-sweep customers move most of the salary out right away: the event is the salary net of the usual sweep
    ev.push({ date: p.date, kind: "salary", amount: r2(p.amount - sweep) });
    if (inv.regular && inv.typical > 0) {
      const d = addDays(p.date, inv.lagDays);
      if (d <= end) ev.push({ date: d, kind: "investment", amount: r2(-inv.typical) });
    }
    if (opts?.goal && opts.goal.monthlyContribution > 0) ev.push({ date: p.date, kind: "goal", amount: r2(-opts.goal.monthlyContribution) });
  }
  const pend = pendingInvestment(c);
  if (pend && pend.date <= end) ev.push({ date: pend.date, kind: "investment", amount: r2(-pend.amount) });
  for (const h of housingDue(c, addDays(end, 1))) if (h.date <= end) ev.push({ date: h.date, kind: "housing", amount: r2(-h.amount) });
  return ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind < b.kind ? -1 : 1));
};

const SIM_CATS: Category[] = [...PURCHASE_CATS, "Utilities"];

export const simulateBalance: SimulateBalance = (c, params) => {
  const days = Math.max(1, Math.min(400, Math.round(params.days)));
  const nPaths = Math.max(1, Math.min(20000, Math.round(params.nPaths ?? 1000)));
  const H = Math.max(7, Math.round(params.historyDays ?? 182));
  const scale = params.scale ?? 1;
  const asOf = c.asOf;
  const h0 = dayNum(asOf) - H + 1;

  // per-history-day variable outflow, with multipliers and scale applied
  const nc = SIM_CATS.length;
  const catIdx = new Map<string, number>(SIM_CATS.map((k, i) => [k, i]));
  const mult = SIM_CATS.map((k) => params.multipliers?.[k] ?? 1);
  const raw = new Float64Array(H * nc);
  const [s, e] = txRange(c, fromDayNum(h0), asOf);
  for (let k = s; k < e; k++) {
    const t = c.tx[k];
    if (t.type !== "purchase" && t.type !== "utilities_payment") continue; // fixed kinds are excluded
    const ci = catIdx.get(t.category);
    if (ci === undefined) continue;
    raw[(dayNum(t.date) - h0) * nc + ci] += -t.amount;
  }
  const dayTotal = new Float64Array(H);
  for (let d = 0; d < H; d++) {
    let tot = 0;
    for (let ci = 0; ci < nc; ci++) tot += raw[d * nc + ci] * mult[ci];
    dayTotal[d] = tot * scale;
  }
  // pools of history days by ISO weekday
  const dataStart = c.tx.length ? dayNum(c.tx[0].date) : h0;
  const pools: number[][] = [[], [], [], [], [], [], [], []];
  for (let d = 0; d < H; d++) if (h0 + d >= dataStart) pools[isoWeekday(fromDayNum(h0 + d))].push(d);
  const allDays = pools.flat();

  // simulated-day weekday pools and fixed-event flows
  const dayPool: number[][] = [];
  const fixed = new Float64Array(days + 1);
  const evByDate = new Map<string, number>();
  for (const ev of params.fixedEvents ?? []) evByDate.set(ev.date, (evByDate.get(ev.date) ?? 0) + ev.amount);
  const base = dayNum(asOf);
  const dates: string[] = [asOf];
  for (let k = 1; k <= days; k++) {
    const date = fromDayNum(base + k);
    dates.push(date);
    const p = pools[isoWeekday(date)];
    dayPool.push(p.length ? p : allDays);
    fixed[k] = evByDate.get(date) ?? 0;
  }
  const paydayK = params.paydayDate ? Math.max(0, Math.min(days + 1, dayNum(params.paydayDate) - base)) : days + 1; // check days [0, paydayK)

  const start = currentBalance(c);
  const rnd = mulberry32(params.seed ?? 42);
  const W = days + 1;
  const bal = new Float64Array(W * nPaths); // day-major
  const minB = new Float64Array(nPaths);
  let overdrafts = 0;
  for (let p = 0; p < nPaths; p++) {
    let b = start;
    bal[p] = b;
    let mn = b;
    let od = paydayK > 0 && b < 0;
    for (let k = 1; k <= days; k++) {
      const pool = dayPool[k - 1];
      const u = rnd();
      const spend = pool.length ? dayTotal[pool[Math.floor(u * pool.length)]] : 0;
      b += fixed[k] - spend;
      bal[k * nPaths + p] = b;
      if (b < mn) mn = b;
      if (k < paydayK && b < 0) od = true;
    }
    minB[p] = mn;
    if (od) overdrafts++;
  }
  const fan: FanPoint[] = [];
  const col = new Float64Array(nPaths);
  for (let k = 0; k <= days; k++) {
    col.set(bal.subarray(k * nPaths, (k + 1) * nPaths));
    col.sort();
    fan.push({
      day: k,
      date: dates[k],
      p10: r2(quantileSorted(col, 0.1)),
      p25: r2(quantileSorted(col, 0.25)),
      p50: r2(quantileSorted(col, 0.5)),
      p75: r2(quantileSorted(col, 0.75)),
      p90: r2(quantileSorted(col, 0.9)),
    });
  }
  minB.sort();
  const res: SimResult = {
    fan,
    overdraftProbToPayday: Math.round((overdrafts / nPaths) * 1000) / 1000,
    minBalanceP10: r2(quantileSorted(minB, 0.1)),
    endBalanceP50: fan[fan.length - 1].p50,
    nPaths,
  };
  return res;
};
