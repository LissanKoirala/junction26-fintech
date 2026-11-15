// Basket classification ("Vara's first guess") from domain.json basketRules, plus user overrides.
import type { ClassifyTx, EngineOptions } from "./api";
import type { Basket, CustomerData, FlowKind, Tx } from "../types";
import { DOMAIN, median } from "./util";

type PurchaseRule = { default: string; mcc?: Record<string, string>; bigPurchase?: string };
const RULES = DOMAIN.basketRules;
const BY_TYPE = RULES.byType as Record<string, FlowKind>;
const PURCHASES = RULES.purchases as unknown as Record<string, PurchaseRule>;
const BASKET_SET = new Set<FlowKind>(["must_regular", "must_irregular", "everyday"]);
export const isBasket = (k: FlowKind): k is Basket => BASKET_SET.has(k);

const bigThresholdCache = new WeakMap<CustomerData, number>();
/** Home & Tech purchases at or above this absolute amount are "Surprise musts". */
export function bigPurchaseThreshold(c: CustomerData): number {
  let t = bigThresholdCache.get(c);
  if (t === undefined) {
    const amounts = c.tx.filter((x) => x.type === "purchase" && x.category === "Home & Tech").map((x) => Math.abs(x.amount));
    t = Math.max(RULES.bigPurchase.minAmount, RULES.bigPurchase.medianMultiple * median(amounts));
    bigThresholdCache.set(c, t);
  }
  return t;
}

function defaultKind(c: CustomerData, tx: Tx): FlowKind {
  if (tx.type !== "purchase") return BY_TYPE[tx.type] ?? "transfer";
  const rule = PURCHASES[tx.category];
  if (!rule) return "everyday";
  if (tx.mcc && rule.mcc?.[tx.mcc]) return rule.mcc[tx.mcc] as FlowKind;
  if (rule.bigPurchase && Math.abs(tx.amount) >= bigPurchaseThreshold(c)) return rule.bigPurchase as FlowKind;
  return rule.default as FlowKind;
}

export const ruleKey = (tx: Tx) => `${tx.category}|${tx.mcc ?? "*"}`;

function applyOverride(tx: Tx, base: FlowKind, opts?: EngineOptions): FlowKind {
  const ov = opts?.overrides;
  if (!ov || !isBasket(base)) return base; // only real spending can be moved between baskets
  const byTx = ov.byTx?.[tx.i];
  if (byTx) return byTx;
  const r = ov.byRule?.[ruleKey(tx)] ?? ov.byRule?.[`${tx.category}|*`];
  return r ?? base;
}

export const classifyTx: ClassifyTx = (c, tx, opts) => applyOverride(tx, defaultKind(c, tx), opts);

const baseKindsCache = new WeakMap<CustomerData, FlowKind[]>();
/** Flow kind of every transaction (aligned with customer.tx). Default rules are cached; overrides are applied fresh. */
export function kindsOf(c: CustomerData, opts?: EngineOptions): FlowKind[] {
  let base = baseKindsCache.get(c);
  if (!base) {
    base = c.tx.map((t) => defaultKind(c, t));
    baseKindsCache.set(c, base);
  }
  const ov = opts?.overrides;
  if (!ov || (!ov.byTx && !ov.byRule) || (!Object.keys(ov.byTx ?? {}).length && !Object.keys(ov.byRule ?? {}).length)) return base;
  return c.tx.map((t, k) => applyOverride(t, base![k], opts));
}

/** Number of transactions in [start,end) whose kind differs from the default rules. */
export function countOverridden(c: CustomerData, kinds: FlowKind[], start: number, end: number): number {
  const base = kindsOf(c);
  if (base === kinds) return 0;
  let n = 0;
  for (let k = start; k < end; k++) if (base[k] !== kinds[k]) n++;
  return n;
}
