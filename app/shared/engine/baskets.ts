// getBaskets: the sponsor's three baskets for a period, plus income, saving and transfers.
import type { BasketSummary, GetBaskets } from "./api";
import type { Basket, Tx } from "../types";
import { countOverridden, isBasket, kindsOf } from "./classify";
import { BASKETS, basketLabel, categoryLabel, r2, rangeLabel, txRange } from "./util";

export const getBaskets: GetBaskets = (c, period, opts) => {
  const kinds = kindsOf(c, opts);
  const [s, e] = txRange(c, period.from, period.to);
  const acc = new Map<Basket, { total: number; count: number; cats: Map<string, { total: number; count: number }>; txs: Tx[] }>();
  for (const b of BASKETS) acc.set(b, { total: 0, count: 0, cats: new Map(), txs: [] });
  let income = 0;
  let saving = 0;
  let transfersOut = 0;
  for (let k = s; k < e; k++) {
    const tx = c.tx[k];
    const kind = kinds[k];
    if (isBasket(kind)) {
      if (tx.amount >= 0) continue;
      const a = acc.get(kind)!;
      const v = -tx.amount;
      a.total += v;
      a.count++;
      const cc = a.cats.get(tx.category) ?? { total: 0, count: 0 };
      cc.total += v;
      cc.count++;
      a.cats.set(tx.category, cc);
      a.txs.push(tx);
    } else if (kind === "income") income += tx.amount;
    else if (kind === "saving") saving += -tx.amount;
    else if (kind === "transfer") transfersOut += -tx.amount;
  }
  const spending = BASKETS.reduce((t, b) => t + acc.get(b)!.total, 0);
  const baskets: BasketSummary[] = BASKETS.map((b) => {
    const a = acc.get(b)!;
    return {
      basket: b,
      label: basketLabel(b),
      total: r2(a.total),
      share: spending > 0 ? Math.round((a.total / spending) * 10000) / 10000 : 0,
      shareOfIncome: income > 0 ? Math.round((a.total / income) * 10000) / 10000 : null,
      count: a.count,
      categories: [...a.cats.entries()]
        .map(([key, v]) => ({ key, label: categoryLabel(key), total: r2(v.total), count: v.count }))
        .sort((x, y) => y.total - x.total),
      topTransactions: a.txs.sort((x, y) => x.amount - y.amount).slice(0, 5),
    };
  });
  return {
    period: { ...period, label: period.label ?? rangeLabel(period.from, period.to) },
    income: r2(income),
    spending: r2(spending),
    baskets,
    saving: r2(saving),
    transfersOut: r2(transfersOut),
    net: r2(income - spending - saving - transfersOut),
    overridesApplied: countOverridden(c, kinds, s, e),
  };
};
