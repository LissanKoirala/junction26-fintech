// Deterministic tools for the chat model. Every tool is scoped to the ONE customer of the request (there is no
// customer parameter). Each run returns (a) a compact JSON summary for the model, (b) the full result kept
// server-side for the number guard, and (c) cards built here from the engine/ML results. The model never writes
// numbers into cards: it only references card ids with [[card:ID]] markers.
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { engine, PERIOD_NAMES, type PeriodName, type SpendingQuery, type Scenario, type SafeToSpend } from "../../shared/engine";
import { matchTx } from "../../shared/engine/spending";
import { kindsOf } from "../../shared/engine/classify";
import { categoryLabel, mccLabel, basketLabel, rangeLabel, monthStart, monthEnd, r2, DOMAIN, currentBalance, addDays as addDaysIso, addMonths as addMonthsKey } from "../../shared/engine/util";
import type { BasketOverrides, Category, CustomerData, Goal, Period, Tx } from "../../shared/types";
import type { CardSpec, Explain } from "../../shared/chat";
import type { CraveSummary } from "../../shared/crave";
import type { Benchmarks, MlAnomalies, MlHabits, MlHome, MlProfile, MlTwins, ModelCard, MoneyMap, PeerStats, Tribe } from "../../shared/ml/typesA";
import type { MlForecast, MlRisk, MlTxGpt } from "../../shared/ml/typesB";
import { loadGlobal, loadMl } from "../data";
import { eur, eur0, pct, dayName } from "./format";

export const SOURCE = "Your transactions in this account (synthetic Junction 2026 dataset, Oct 2024 – Sep 2026)";

export interface ToolCtx {
  c: CustomerData;
  opts: { overrides?: BasketOverrides; goal?: Goal | null };
  newCardId: () => string;
  crave?: CraveSummary | null; // Crave mode diary summary sent by the app (client state, simulated money)
}
export interface ToolOutput {
  model: Record<string, unknown>;
  full: unknown;
  cards: CardSpec[];
}
interface ToolDef<S extends z.ZodObject> {
  name: string;
  description: string;
  schema: S;
  status: (input: z.infer<S>) => string;
  run: (ctx: ToolCtx, input: z.infer<S>) => Promise<ToolOutput> | ToolOutput;
}
const tool = <S extends z.ZodObject>(d: ToolDef<S>) => d;

// ---------------------------------------------------------------- shared input pieces
const CATEGORIES = Object.keys(DOMAIN.categories) as [Category, ...Category[]];
const BASKET_KEYS = ["must_regular", "must_irregular", "everyday"] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const periodFields = {
  period: z.enum(PERIOD_NAMES as [PeriodName, ...PeriodName[]]).optional().describe("Named period relative to today. Prefer this or `month`; never compute dates yourself."),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("A calendar month, e.g. 2026-09 for September 2026. Overrides `period`."),
  from: z.string().regex(ISO).optional().describe("Custom start date (inclusive), only if the user named exact dates."),
  to: z.string().regex(ISO).optional().describe("Custom end date (inclusive)."),
};
const filterFields = {
  categories: z.array(z.enum(CATEGORIES)).optional().describe("Transaction categories, e.g. Restaurants (eating out), Transportation."),
  mccs: z.array(z.string().regex(/^\d{4}$/)).optional().describe("Merchant category codes, e.g. 4121 taxi, 5814 fast food & cafe, 5813 bar."),
  baskets: z.array(z.enum(BASKET_KEYS)).optional().describe("must_regular = Fixed musts, must_irregular = Surprise musts, everyday = Everyday extras."),
  weekdays: z.array(z.number().int().min(1).max(7)).optional().describe("ISO weekdays, 1 = Monday ... 7 = Sunday."),
  min_amount: z.number().min(0).optional().describe("Only purchases of at least this many euros."),
  max_amount: z.number().min(0).optional().describe("Only purchases of at most this many euros."),
};

function resolve(c: CustomerData, i: { period?: PeriodName; month?: string; from?: string; to?: string }, def: PeriodName): Period {
  if (i.from && i.to) {
    const [from, to] = i.from <= i.to ? [i.from, i.to] : [i.to, i.from];
    return { from, to: to > c.asOf ? c.asOf : to, label: rangeLabel(from, to > c.asOf ? c.asOf : to) };
  }
  if (i.month) {
    const from = monthStart(i.month);
    const end = monthEnd(i.month);
    const to = end > c.asOf ? c.asOf : end;
    return { from, to, label: rangeLabel(from, end) + (to < end ? " (to date)" : "") };
  }
  return engine.resolvePeriod(c.asOf, i.period ?? def);
}
const filterQuery = (i: z.infer<z.ZodObject<typeof filterFields>>): Omit<SpendingQuery, "period"> => ({
  categories: i.categories,
  mccs: i.mccs,
  baskets: i.baskets,
  weekdays: i.weekdays,
  minAmount: i.min_amount,
  maxAmount: i.max_amount,
});
function subject(q: Omit<SpendingQuery, "period">): string {
  if (q.mccs?.length) return q.mccs.map((m) => mccLabel(m)).join(" + ");
  if (q.categories?.length) return q.categories.map(categoryLabel).join(" + ");
  if (q.baskets?.length) return q.baskets.map(basketLabel).join(" + ");
  return "All spending";
}
/** The same query per month (6 months ending with the period's month) or per ISO week (8 weeks) for short periods. */
function spendingSeries(ctx: ToolCtx, q: SpendingQuery): { series: { key: string; label: string; value: number }[]; seriesLabel: string; highlightKey: string } {
  const c = ctx.c;
  const days = (Date.parse(q.period.to) - Date.parse(q.period.from)) / 86_400_000 + 1;
  const base = { ...q, groupBy: undefined, compareTo: undefined, includeTransactions: false };
  if (days <= 14) {
    const ws = engine.resolvePeriod(q.period.to, "this_week").from;
    const series = [];
    for (let k = 7; k >= 0; k--) {
      const from = addDaysIso(ws, -7 * k);
      const end = addDaysIso(from, 6);
      const to = end > c.asOf ? c.asOf : end;
      series.push({ key: from, label: `Week of ${dayName(from).slice(4)}`, value: engine.querySpending(c, { ...base, period: { from, to } }, ctx.opts).total });
    }
    return { series, seriesLabel: "Per week, last 8 weeks", highlightKey: ws };
  }
  const endMonth = q.period.to.slice(0, 7);
  const series = [];
  for (let k = 5; k >= 0; k--) {
    const m = addMonthsKey(endMonth, -k);
    const from = monthStart(m);
    if (monthEnd(m) < (c.tx[0]?.date ?? from)) continue;
    const to = monthEnd(m) > c.asOf ? c.asOf : monthEnd(m);
    series.push({ key: m, label: rangeLabel(from, monthEnd(m)), value: engine.querySpending(c, { ...base, period: { from, to } }, ctx.opts).total });
  }
  return { series, seriesLabel: "Per month, last 6 months", highlightKey: endMonth };
}
const compactTx = (t: Tx) => ({ i: t.i, date: t.date, category: t.category, type: mccLabel(t.mcc) === "Unknown merchant type" ? t.type : mccLabel(t.mcc), amount: t.amount });
const cardRef = (cards: CardSpec[]) => cards.map((k) => ({ id: k.id, kind: k.kind, title: k.title }));
const mlMissing = (what: string) => ({
  model: { available: false, message: `The ${what} model's results are not ready yet for this customer. Say so honestly; do not guess.` },
  full: null,
  cards: [],
});
async function modelInfo(key: string): Promise<Explain["model"] | undefined> {
  const mc = await loadGlobal<ModelCard>(`modelcard-${key}`);
  if (!mc) return undefined;
  const m = mc.metrics?.[0];
  return { name: mc.name, metric: m ? `${m.label}: ${m.model} vs ${m.baseline} (${m.baselineName})` : mc.verdict };
}
const noDigits = (s: string | undefined, fallback: string) => (s && !/\d/.test(s) ? s.slice(0, 80) : fallback);

// ---------------------------------------------------------------- spending
const querySpendingTool = tool({
  name: "query_spending",
  description:
    "Total spending with optional filters, grouping and comparison. Spending = rent, bills and card purchases (saving and transfers excluded). Use for questions like 'how much did I spend on X in Y', 'which weekday do I spend most', 'compared to last month'. Returns totals and card ids.",
  schema: z.object({
    ...periodFields,
    ...filterFields,
    group_by: z.enum(["category", "mcc", "basket", "month", "week", "day", "weekday", "hour"]).optional(),
    compare_to: z.enum(["previous_period", "same_period_last_year"]).optional(),
  }),
  status: (i) => {
    const s = subject(filterQuery(i));
    return s === "All spending" ? "Adding up your spending…" : `Adding up your ${s.toLowerCase()} spending…`;
  },
  run: (ctx, i) => {
    const period = resolve(ctx.c, i, "this_month");
    const q: SpendingQuery = { period, ...filterQuery(i), groupBy: i.group_by, compareTo: i.compare_to };
    const r = engine.querySpending(ctx.c, q, ctx.opts);
    const what = subject(q);
    const explain: Explain = { tool: "engine.querySpending", filters: r.filters, period: r.period, txCount: r.count, formula: "Sum of matching outflows (positive euros)", source: SOURCE };
    const cards: CardSpec[] = [];
    const cmp = r.comparison;
    const ser = spendingSeries(ctx, q);
    cards.push({
      id: ctx.newCardId(),
      kind: "stat",
      title: `${what} · ${r.period.label}`,
      label: what,
      value: r.total,
      unit: "eur",
      caption: `${r.count} transaction${r.count === 1 ? "" : "s"}${r.count ? `, average ${eur(r.average)}` : ""}`,
      comparison: cmp ? { label: `vs ${cmp.period.label}`, deltaAbs: cmp.deltaAbs, deltaPct: cmp.deltaPct, good: cmp.deltaAbs <= 0, value: cmp.total, period: cmp.period } : undefined,
      ...ser,
      explain,
    });
    // "where did it go": a category breakdown when the question was not about one category or merchant type
    if (!r.groups && !q.categories?.length && !q.mccs?.length && r.count > 0) {
      const g = engine.querySpending(ctx.c, { ...q, groupBy: "category", compareTo: undefined }, ctx.opts);
      r.groups = g.groups;
      i.group_by = "category";
    }
    if (r.groups?.length) {
      const by = i.group_by!;
      cards.push({
        id: ctx.newCardId(),
        kind: "breakdown",
        title: `${what} by ${by} · ${r.period.label}`,
        chart: ["month", "week", "day"].includes(by) ? "trend" : (by === "basket" || (by === "category" && r.groups.length <= 6)) ? "donut" : "bars",
        unit: "eur",
        items: r.groups.slice(0, 15).map((g) => ({ key: g.key, label: g.label, value: g.total, share: g.share })),
        total: r.total,
        period: r.period,
        explain,
      });
    }
    return {
      model: {
        period: r.period,
        subject: what,
        total: r.total,
        count: r.count,
        average_per_transaction: r.average,
        per_month: r.perMonth,
        groups: r.groups?.slice(0, 12).map((g) => ({ key: g.key, label: g.label, total: g.total, count: g.count, share_pct: r2(g.share * 100) })),
        comparison: cmp ? { period: cmp.period, total: cmp.total, count: cmp.count, delta_abs: cmp.deltaAbs, delta_pct: cmp.deltaPct } : undefined,
        series: ser.series.map((p) => ({ label: p.label, total: p.value })),
        cards: cardRef(cards),
      },
      full: { r, ser },
      cards,
    };
  },
});

const listTransactionsTool = tool({
  name: "list_transactions",
  description: "List individual transactions matching filters (largest first by default, or latest first). There are no merchant names, only merchant types.",
  schema: z.object({ ...periodFields, ...filterFields, sort: z.enum(["largest", "latest"]).optional(), limit: z.number().int().min(1).max(30).optional() }),
  status: () => "Looking through your transactions…",
  run: (ctx, i) => {
    const period = resolve(ctx.c, i, "last_30_days");
    const q: SpendingQuery = { period, ...filterQuery(i) };
    const m = matchTx(ctx.c, q, period, kindsOf(ctx.c, ctx.opts));
    const sorted = i.sort === "latest" ? [...m].reverse() : [...m].sort((a, b) => b.value - a.value);
    const items = sorted.slice(0, i.limit ?? 10).map((x) => x.tx);
    const total = r2(m.reduce((t, x) => t + x.value, 0));
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "transactions",
      title: `${subject(q)} · ${period.label}`,
      items,
      total,
      count: m.length,
      note: m.length > items.length ? `Showing ${items.length} of ${m.length} (${i.sort === "latest" ? "latest" : "largest"} first)` : undefined,
      explain: { tool: "engine.querySpending", filters: engine.querySpending(ctx.c, q, ctx.opts).filters, period, txCount: m.length, source: SOURCE },
    };
    return { model: { period, total, count: m.length, shown: items.map(compactTx), cards: cardRef([card]) }, full: { items, total }, cards: [card] };
  },
});

const basketsTool = tool({
  name: "get_baskets",
  description: "The three baskets (Fixed musts, Surprise musts, Everyday extras) for a period, with income, saving and transfers.",
  schema: z.object({ ...periodFields }),
  status: () => "Sorting your spending into the three baskets…",
  run: (ctx, i) => {
    const period = resolve(ctx.c, i, "this_month");
    const b = engine.getBaskets(ctx.c, period, ctx.opts);
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "baskets",
      title: `Your three baskets · ${b.period.label}`,
      data: b,
      explain: { tool: "engine.getBaskets", filters: ["Basket rules from domain.json (Vara's first guess)", b.overridesApplied ? `${b.overridesApplied} of your own corrections applied` : "No corrections applied"], period: b.period, txCount: b.baskets.reduce((t, x) => t + x.count, 0), source: SOURCE },
    };
    return {
      model: {
        period: b.period,
        income: b.income,
        spending: b.spending,
        baskets: b.baskets.map((x) => ({ basket: x.basket, label: x.label, total: x.total, share_pct: r2(x.share * 100), share_of_income_pct: x.shareOfIncome == null ? null : r2(x.shareOfIncome * 100), top_categories: x.categories.slice(0, 3).map((k) => ({ label: k.label, total: k.total })) })),
        saving: b.saving,
        transfers_out: b.transfersOut,
        net: b.net,
        cards: cardRef([card]),
      },
      full: b,
      cards: [card],
    };
  },
});

function safeModel(s: SafeToSpend) {
  return {
    balance: s.balance,
    next_payday: s.nextPayday,
    reserved: s.upcoming.map((u) => ({ label: u.label, amount: u.amount, when: u.from ? `${u.from}..${u.to}` : null, basis: u.basis })),
    reserved_total: s.reservedTotal,
    free_until_payday: s.freeUntilPayday,
    weeks_until_payday: s.weeksUntilPayday,
    safe_per_week: s.safePerWeek,
    safe_per_day: s.safePerDay,
    this_week: s.week,
    status: s.status,
    note: s.note,
  };
}
const safeTool = tool({
  name: "get_safe_to_spend",
  description: "How much is safe to spend per week until the next payday: balance minus the musts still coming (rent, bills, groceries, investing, goal, buffer). The heart of 'your balance is not your budget'.",
  schema: z.object({ include_investing: z.boolean().optional().describe("Treat the usual investment deposit as committed (default true).") }),
  status: () => "Checking what is still coming before payday…",
  run: (ctx, i) => {
    const s = engine.getSafeToSpend(ctx.c, { ...ctx.opts, includeInvesting: i.include_investing });
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "safe_to_spend",
      title: "Safe to spend until payday",
      data: s,
      explain: { tool: "engine.getSafeToSpend", filters: s.upcoming.map((u) => `${u.label}: ${u.basis}`), period: { from: s.asOf, to: s.nextPayday.date, label: `Today to payday (${dayName(s.nextPayday.date)})` }, formula: "(balance − musts still coming before payday) ÷ weeks until payday", source: SOURCE },
    };
    return { model: { ...safeModel(s), cards: cardRef([card]) }, full: s, cards: [card] };
  },
});

const upcomingTool = tool({
  name: "get_upcoming",
  description: "Recurring items (salary, rent, utilities, investing, groceries) with typical amounts and when the next one is expected.",
  schema: z.object({}),
  status: () => "Looking at your regular payments…",
  run: (ctx) => {
    const rec = engine.getRecurring(ctx.c);
    const s = engine.getSafeToSpend(ctx.c, ctx.opts);
    const items = s.upcoming.filter((u) => u.kind !== "buffer");
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "breakdown",
      title: `Coming up before payday (${dayName(s.nextPayday.date)})`,
      chart: "bars",
      unit: "eur",
      items: items.map((u) => ({ key: u.kind, label: u.label, value: u.amount })),
      total: r2(items.reduce((t, u) => t + u.amount, 0)),
      period: { from: s.asOf, to: s.nextPayday.date },
      explain: { tool: "engine.getRecurring + engine.getSafeToSpend", filters: items.map((u) => `${u.label}: ${u.basis}`), source: SOURCE },
    };
    return {
      model: {
        recurring: rec.map((r) => ({ kind: r.kind, typical: r.typicalAmount, low: r.amountLow, high: r.amountHigh, cadence: r.cadence, last: r.lastDate, next: r.nextFrom ? `${r.nextFrom}..${r.nextTo}` : null, note: r.note })),
        before_next_payday: items.map((u) => ({ label: u.label, amount: u.amount, when: u.from ? `${u.from}..${u.to}` : null })),
        next_payday: s.nextPayday,
        cards: cardRef([card]),
      },
      full: { rec, upcoming: items },
      cards: [card],
    };
  },
});

const monthlyTool = tool({
  name: "get_monthly_overview",
  description: "Month-by-month income, spending per basket, saving, net and balances.",
  schema: z.object({ months: z.number().int().min(2).max(24).optional().describe("How many months back including the current one (default 6).") }),
  status: () => "Lining up your months…",
  run: (ctx, i) => {
    const rows = engine.getMonthly(ctx.c, i.months ?? 6, ctx.opts);
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "breakdown",
      title: "Spending per month",
      chart: "trend",
      unit: "eur",
      items: rows.map((r) => ({ key: r.month, label: r.month, value: r2(r.mustRegular + r.mustIrregular + r.everyday) })),
      period: { from: `${rows[0].month}-01`, to: ctx.c.asOf },
      explain: { tool: "engine.getMonthly", filters: ["Spending = Fixed musts + Surprise musts + Everyday extras"], source: SOURCE },
    };
    return {
      model: {
        months: rows.map((r) => ({ month: r.month, income: r.income, fixed_musts: r.mustRegular, surprise_musts: r.mustIrregular, everyday_extras: r.everyday, spending: r2(r.mustRegular + r.mustIrregular + r.everyday), saving: r.saving, transfers_out: r.transfersOut, net: r.net, end_balance: r.endBalance, min_balance: r.minBalance, complete: r.complete })),
        cards: cardRef([card]),
      },
      full: rows,
      cards: [card],
    };
  },
});

const weekTool = tool({
  name: "get_week_summary",
  description: "Summary of this week so far or last full week: spending, baskets, top categories, small purchases, versus a typical week.",
  schema: z.object({ week: z.enum(["this_week", "last_week"]).optional() }),
  status: () => "Summing up the week…",
  run: (ctx, i) => {
    const w = engine.getWeekSummary(ctx.c, i.week === "last_week" ? -1 : 0, ctx.opts);
    const period = { from: w.from, to: w.to, label: `${dayName(w.from)} – ${dayName(w.to)}` };
    const explain: Explain = { tool: "engine.getWeekSummary", filters: [`Typical week = median of the previous 12 weeks over the same ${w.days} day(s)`], period, source: SOURCE };
    const cards: CardSpec[] = [
      {
        id: ctx.newCardId(),
        kind: "stat",
        title: `Your week · ${period.label}`,
        label: "Spent this week",
        value: w.spending,
        unit: "eur",
        comparison: w.vsTypicalWeekPct == null ? undefined : { label: "vs a typical week", deltaAbs: r2(w.spending - (w.typicalSpending ?? 0)), deltaPct: w.vsTypicalWeekPct, good: w.vsTypicalWeekPct <= 0, value: w.typicalSpending },
        ...spendingSeries(ctx, { period }),
        explain,
      },
      {
        id: ctx.newCardId(),
        kind: "breakdown",
        title: `The week in three baskets`,
        chart: "donut",
        unit: "eur",
        items: (["must_regular", "must_irregular", "everyday"] as const).map((b) => ({ key: b, label: basketLabel(b), value: w.byBasket[b] })),
        total: w.spending,
        period,
        explain,
      },
    ];
    return {
      model: { ...w, biggest: w.biggest ? compactTx(w.biggest) : null, cards: cardRef(cards) },
      full: w,
      cards,
    };
  },
});

const whatIfTool = tool({
  name: "simulate_what_if",
  description: "What-if: change spending in categories, merchant types or baskets by a percentage (e.g. -20 for dining out), and/or move extra money to savings, and/or change rent. Returns monthly savings, projections and an interactive what-if card.",
  schema: z.object({
    adjustments: z.array(z.object({ category: z.enum(CATEGORIES).optional(), mcc: z.string().regex(/^\d{4}$/).optional(), basket: z.enum(BASKET_KEYS).optional(), change_pct: z.number().min(-100).max(200) })).max(6),
    extra_monthly_saving: z.number().min(0).max(100000).optional(),
    housing_change: z.number().min(-100000).max(100000).optional().describe("New monthly rent minus current (negative = cheaper)."),
  }),
  status: () => "Running the what-if…",
  run: (ctx, i) => {
    const scenario: Scenario = {
      adjustments: i.adjustments.map((a) => ({ target: { category: a.category, mcc: a.mcc, basket: a.basket }, changePct: a.change_pct })),
      extraMonthlySaving: i.extra_monthly_saving,
      housingChange: i.housing_change,
    };
    const result = engine.simulateWhatIf(ctx.c, scenario, ctx.opts);
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "whatif",
      title: "What if…",
      scenario,
      result,
      explain: { tool: "engine.simulateWhatIf", filters: [result.basis, "Projection with 4% yearly return for the 'if invested' line"], formula: "saved per month = baseline monthly − new monthly", source: SOURCE },
    };
    return { model: { ...result, cards: cardRef([card]) }, full: result, cards: [card] };
  },
});

// ---------------------------------------------------------------- profile and peers
async function tribeFor(profile: MlProfile | null): Promise<Tribe | null> {
  if (!profile) return null;
  const t = await loadGlobal<Tribe[] | { tribes: Tribe[] }>("tribes");
  const list = Array.isArray(t) ? t : (t?.tribes ?? (await loadGlobal<MoneyMap>("map"))?.tribes ?? []);
  return list.find((x) => x.id === profile.tribe.id) ?? null;
}
const profileTool = tool({
  name: "get_spender_profile",
  description: "What kind of spender the customer is: behaviour statistics from the engine plus the machine-learning spender tribe (Money Map) when available.",
  schema: z.object({}),
  status: () => "Looking at your spending style…",
  run: async (ctx) => {
    const s = engine.getSpenderStats(ctx.c, ctx.opts);
    const profile = await loadMl<MlProfile>("profile", ctx.c.id);
    const tribe = await tribeFor(profile);
    const cards: CardSpec[] = [];
    if (profile && tribe) {
      cards.push({ id: ctx.newCardId(), kind: "tribe", title: `Your spender tribe: ${tribe.name}`, data: profile, tribe, explain: { tool: "ML: Money Map (UMAP + KMeans)", filters: ["Last 12 months of behaviour, compared with customers of the same age band"], source: SOURCE, model: await modelInfo("tribes") } });
    }
    cards.push({
      id: ctx.newCardId(),
      kind: "breakdown",
      title: "Where your money goes (last 12 months)",
      chart: "donut",
      unit: "pct",
      items: (["must_regular", "must_irregular", "everyday"] as const).map((b) => ({ key: b, label: basketLabel(b), value: r2(s.basketShares[b] * 100), share: s.basketShares[b] })),
      explain: { tool: "engine.getSpenderStats", filters: [`${s.months} full months`, "Share of spending per basket"], source: SOURCE },
    });
    return {
      model: {
        engine_stats: { ...s, basketShares_pct: Object.fromEntries(Object.entries(s.basketShares).map(([k, v]) => [k, r2(v * 100)])) },
        tribe: tribe ? { name: tribe.name, tagline: tribe.tagline, description: tribe.description, strengths: tribe.strengths, watch_outs: tribe.watchOuts, fit: profile!.tribe.fit } : "The spender-tribe model is not ready yet; describe the person from engine_stats only.",
        highlights: profile?.highlights,
        cards: cardRef(cards),
      },
      full: { s, profile, tribe },
      cards,
    };
  },
});

const PEER_METRICS: Record<string, { label: string; category?: Category; unit: "eur" | "pct" }> = {
  spend_restaurants_m: { label: "Eating out per month", category: "Restaurants", unit: "eur" },
  spend_groceries_m: { label: "Groceries per month", category: "Groceries", unit: "eur" },
  spend_transportation_m: { label: "Transport per month", category: "Transportation", unit: "eur" },
  spend_entertainment_m: { label: "Entertainment per month", category: "Entertainment", unit: "eur" },
  spend_lifestyle_m: { label: "Shopping & lifestyle per month", category: "Lifestyle", unit: "eur" },
  spend_travel_m: { label: "Travel per month", category: "Travel", unit: "eur" },
  spend_health_m: { label: "Health per month", category: "Health", unit: "eur" },
  spend_home_tech_m: { label: "Home & tech per month", category: "Home & Tech", unit: "eur" },
  utilities_m: { label: "Utilities per month", category: "Utilities", unit: "eur" },
  housing_level: { label: "Housing per month", category: "Housing", unit: "eur" },
  basket_everyday_m: { label: "Everyday extras per month", unit: "eur" },
  savings_rate: { label: "Savings rate", unit: "pct" },
};
function interpPercentile(v: number, q: { p10: number; p25: number; p50: number; p75: number; p90: number }): number {
  const pts: [number, number][] = [[q.p10, 10], [q.p25, 25], [q.p50, 50], [q.p75, 75], [q.p90, 90]];
  if (v <= pts[0][0]) return 5;
  if (v >= pts[4][0]) return 95;
  for (let k = 0; k < 4; k++) {
    const [a, pa] = pts[k];
    const [b, pb] = pts[k + 1];
    if (v >= a && v <= b) return Math.round(b > a ? pa + ((v - a) / (b - a)) * (pb - pa) : pa);
  }
  return 50;
}
const peersTool = tool({
  name: "compare_with_peers",
  description: "Compare one monthly metric with other customers of the same age band in the bank dataset and with Statistics Finland household averages (when those files exist).",
  schema: z.object({ metric: z.enum(Object.keys(PEER_METRICS) as [string, ...string[]]) }),
  status: () => "Comparing with people your age…",
  run: async (ctx, i) => {
    const meta = PEER_METRICS[i.metric];
    const band = DOMAIN.ageBands.find((b) => ctx.c.age >= b.min && ctx.c.age <= b.max) ?? DOMAIN.ageBands[DOMAIN.ageBands.length - 1];
    const [peers, bench, profile] = await Promise.all([loadGlobal<PeerStats>("peers"), loadGlobal<Benchmarks>("benchmarks"), loadMl<MlProfile>("profile", ctx.c.id)]);
    // the customer's own value: the ML profile feature (same definition as peers.json) or the engine over 12 full months
    let you = profile?.features?.[i.metric];
    if (you == null) {
      const stats = engine.getSpenderStats(ctx.c, ctx.opts);
      const period = { from: "2025-10-01", to: ctx.c.asOf };
      if (meta.category) you = r2(engine.querySpending(ctx.c, { period, categories: [meta.category] }, ctx.opts).total / 12);
      else if (i.metric === "basket_everyday_m") you = r2(engine.querySpending(ctx.c, { period, baskets: ["everyday"] }, ctx.opts).total / 12);
      else you = stats.savingsRatePct;
    }
    const peerRows: { label: string; value: number; source: string }[] = [];
    const q = peers?.byAgeBand?.[band.key]?.[i.metric];
    if (q) peerRows.push({ label: `Bank customers aged ${band.key} (median)`, value: q.p50, source: `Junction dataset, ${q.n} customers` });
    const coicop = meta.category ? (DOMAIN.categories as Record<string, { coicop?: string }>)[meta.category]?.coicop : undefined;
    const grp = bench?.groups?.[`age:${band.statFi}`];
    const bval = coicop && grp ? (grp.adjusted[coicop] ?? grp.adjusted[coicop.replace(".", "")]) : undefined;
    if (bval != null) peerRows.push({ label: `Finnish households, reference person ${band.statFi}`, value: r2(bval), source: "Statistics Finland, Household Budget Survey 2022, price-adjusted (per household)" });
    if (!peerRows.length) {
      return { model: { available: false, metric: meta.label, you, message: "Peer and Statistics Finland comparison data are not ready yet. Say so honestly and offer the customer's own trend instead." }, full: { you }, cards: [] };
    }
    const percentile = profile?.percentiles?.[i.metric] ?? (q ? interpPercentile(you, q) : undefined);
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "benchmark",
      title: meta.label,
      metric: meta.label,
      you: r2(you),
      unit: meta.unit,
      peers: peerRows,
      percentile: percentile == null ? undefined : Math.round(percentile),
      note: [
        "Your value: average of the last 12 months.",
        bval != null ? "Statistics Finland figures are per household, not per person: Source: Statistics Finland, Household Budget Survey 2022, price-adjusted (CC BY 4.0)." : "",
        "Synthetic bank dataset.",
      ].filter(Boolean).join(" "),
      explain: { tool: "compare_with_peers", filters: [`Age band ${band.key}`, "Main-cohort customers, last 12 months"], source: bval != null ? "Statistics Finland, Household Budget Survey 2022 (CC BY 4.0)" : SOURCE },
    };
    return { model: { metric: meta.label, you: r2(you), peers: peerRows, percentile: card.percentile, cards: cardRef([card]) }, full: { you, peerRows, q, bval }, cards: [card] };
  },
});

// ---------------------------------------------------------------- pedagogy and actions
const CONCEPTS = ["three_baskets", "safe_to_spend", "buffer", "pay_yourself_first", "compound_interest", "small_purchases_add_up", "payday_burn", "overdraft"] as const;
const conceptTool = tool({
  name: "explain_concept",
  description: "Show a short concept card that explains one money idea with the customer's own numbers (built by the server).",
  schema: z.object({ concept: z.enum(CONCEPTS) }),
  status: () => "Finding a good example from your own numbers…",
  run: (ctx, i) => {
    const c = ctx.c;
    const s = engine.getSafeToSpend(c, ctx.opts);
    const st = engine.getSpenderStats(c, ctx.opts);
    const B = DOMAIN.baskets;
    const housing = s.upcoming.find((u) => u.kind === "housing");
    let term = "";
    let definition = "";
    let example = "";
    switch (i.concept) {
      case "three_baskets":
        term = "The three baskets";
        definition = `${B.must_regular.label}: ${B.must_regular.tagline.toLowerCase()} (like ${B.must_regular.example}). ${B.must_irregular.label}: ${B.must_irregular.tagline.toLowerCase()} (like ${B.must_irregular.example}). ${B.everyday.label}: ${B.everyday.tagline.toLowerCase()} (like ${B.everyday.example}).`;
        example = `Over the last 12 months ${pct(st.basketShares.must_regular * 100)} of your spending went to ${B.must_regular.label}, ${pct(st.basketShares.must_irregular * 100)} to ${B.must_irregular.label} and ${pct(st.basketShares.everyday * 100)} to ${B.everyday.label}.`;
        break;
      case "safe_to_spend":
        term = "Your balance is not your budget";
        definition = "Money already promised to bills before your next payday is not free to spend. Safe to spend is what is left after those musts, spread over the weeks until payday.";
        example = `You have ${eur(s.balance)} today, but ${eur(s.reservedTotal)} is already promised before ${dayName(s.nextPayday.date)}${housing ? `, including about ${eur(housing.amount)} for rent` : ""}. That leaves ${eur(s.freeUntilPayday)}, about ${eur(s.safePerWeek)} a week.`;
        break;
      case "buffer": {
        term = "A buffer (emergency fund)";
        definition = `Money kept aside for ${B.must_irregular.label.toLowerCase()}: things you cannot skip but cannot schedule. A common first target is one month of your musts.`;
        example = `Your balance covers about ${new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 1 }).format(st.bufferMonths)} months of your musts.${st.overdraftDaysLast12m ? ` Your account was below zero on ${st.overdraftDaysLast12m} days in the last 12 months; a buffer stops that.` : ""}`;
        break;
      }
      case "pay_yourself_first":
        term = "Pay yourself first";
        definition = "Move a small fixed amount to savings on payday, before everyday spending starts. What you do not see, you do not spend.";
        example = `Your salary is about ${eur(s.nextPayday.amount)}. Moving 5% on payday would be ${eur(r2(s.nextPayday.amount * 0.05))} a month, ${eur(r2(s.nextPayday.amount * 0.05 * 12))} a year.`;
        break;
      case "compound_interest": {
        term = "Compound interest";
        definition = "When savings earn a return, the return itself starts earning too. Small monthly amounts grow faster than you would expect over years.";
        const w = engine.simulateWhatIf(c, { adjustments: [], extraMonthlySaving: 50, horizonsMonths: [120] });
        example = `Saving 50 € a month for 10 years is ${eur(w.projections[0].saved)}. With a 4% yearly return it could grow to about ${eur(w.projections[0].invested)}.`;
        break;
      }
      case "small_purchases_add_up":
        term = "Small purchases add up";
        definition = `Purchases under ${DOMAIN.smallPurchaseThreshold} € feel like nothing, but they repeat. Seeing the monthly total is often a surprise.`;
        example = `You make about ${new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 1 }).format(st.smallPurchasesPerMonth)} small purchases a month, about ${eur(st.smallPurchasesMonthlyTotal)} in total: ${eur(r2(st.smallPurchasesMonthlyTotal * 12))} a year.`;
        break;
      case "payday_burn":
        term = "Payday burn";
        definition = "Spending a big share of your everyday money right after payday, so the last weeks before the next one get tight.";
        example = `${pct(st.paydayBurnPct, 1)} of your everyday extras happen on payday and the 4 days after. Spread evenly it would be about 16 %.`;
        break;
      case "overdraft":
        term = "Going below zero";
        definition = "When bills or purchases take the account below zero. It can cost fees and stress; it usually happens just before payday.";
        example = st.overdraftDaysLast12m
          ? `Your account was below zero on ${st.overdraftDaysLast12m} days in the last 12 months.`
          : "Your account did not go below zero in the last 12 months. Nice work.";
        break;
    }
    const card: CardSpec = { id: ctx.newCardId(), kind: "concept", title: term, term, definition, example, explain: { tool: "explain_concept", filters: ["Example built from your own numbers by the engine"], source: SOURCE } };
    return { model: { term, definition, example, cards: cardRef([card]) }, full: { term, definition, example, s, st }, cards: [card] };
  },
});

const SCREENS = ["today", "chat", "whatif", "you", "baskets", "checkin", "goal", "connect"] as const;
const actionTool = tool({
  name: "suggest_action",
  description:
    "Show an action button: open_saastaja (S-Pankki's Säästäjä automatic saving), set_goal (savings goal flow), start_challenge (a one-week everyday-extras challenge with a target from the engine), connect_bank (connect another bank, PSD2), open_screen (a Vara screen). The label must not contain numbers.",
  schema: z.object({ action: z.enum(["open_saastaja", "set_goal", "start_challenge", "connect_bank", "open_screen"]), screen: z.enum(SCREENS).optional(), label: z.string().max(80).optional(), description: z.string().max(160).optional() }),
  status: () => "Preparing a next step…",
  run: (ctx, i) => {
    const defaults: Record<string, string> = { open_saastaja: "Start saving with Säästäjä", set_goal: "Set a savings goal", start_challenge: "Start this week's challenge", connect_bank: "Connect your other bank", open_screen: "Open" };
    let payload: Record<string, unknown> | undefined = i.screen ? { screen: i.screen } : undefined;
    let description = noDigits(i.description, "");
    if (i.action === "start_challenge") {
      const typical = engine.getSafeToSpend(ctx.c, ctx.opts).week.typicalSpend ?? 0;
      const target = Math.max(10, Math.round((typical * 0.85) / 5) * 5);
      payload = { metric: "everyday_spend", target, baseline: r2(typical) };
      description = `Keep everyday extras under ${eur0(target)} this week (a typical week is ${eur0(typical)}).`;
    }
    const card: CardSpec = { id: ctx.newCardId(), kind: "action", action: i.action, label: noDigits(i.label, defaults[i.action]), description: description || undefined, payload, explain: { tool: "suggest_action", filters: [], source: SOURCE } };
    return { model: { action: i.action, label: (card as { label: string }).label, description, cards: cardRef([card]) }, full: payload ?? {}, cards: [card] };
  },
});

// ---------------------------------------------------------------- Crave mode
const craveTool = tool({
  name: "offer_crave_mode",
  description:
    "Offer Crave mode when the user wants, is tempted by or asks whether to buy something specific (\"I want new headphones\", \"I'm craving sushi\", \"should I buy those sneakers?\"). Crave mode opens a generated shop for the craving with a full checkout; nothing ships and the basket total goes (simulated) into the user's Crave pot in savings, releasable after a 48-hour cooling-off. Pass the craving as a short shopping phrase (e.g. \"sushi\", \"wireless headphones\").",
  schema: z.object({ craving: z.string().min(1).max(60).describe("Short phrase for what they crave, in English, e.g. 'new sneakers'") }),
  status: () => "Opening Crave mode…",
  run: (ctx, i) => {
    const craving = i.craving.replace(/[\[\]<>]/g, "").trim().slice(0, 60);
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "action",
      action: "open_crave",
      title: "Shop it in Crave mode",
      label: "Shop it in Crave mode",
      description: `Get the full hunt and checkout for “${craving}”. Nothing ships: the money goes to your Crave pot, and you can release it after 48 hours if you still want it.`,
      payload: { craving },
      explain: { tool: "offer_crave_mode", filters: ["Opt-in: the shop is generated for this craving only", "Simulation: no money is moved"], source: "Crave mode (Junction 2026 concept)" },
    };
    return { model: { offered: true, craving, cards: cardRef([card]) }, full: { craving }, cards: [card] };
  },
});

const cravePotTool = tool({
  name: "get_crave_pot",
  description: "The user's Crave mode diary: how much their redirected cravings have saved (simulated Crave pot), how many, which kinds, when cravings strike, and how many they released after the cooling-off.",
  schema: z.object({}),
  status: () => "Opening your Crave pot…",
  run: (ctx) => {
    const s = ctx.crave;
    if (!s || (!s.count && !s.releasedCount && !s.windowShops))
      return { model: { empty: true, note: "No cravings shopped in Crave mode yet. Suggest trying it (offer_crave_mode) next time they want to buy something." }, full: {}, cards: [] };
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "stat",
      title: "Your Crave pot",
      label: "Saved by redirecting cravings (simulated)",
      value: s.savedTotal,
      unit: "eur",
      caption: `${s.count} craving${s.count === 1 ? "" : "s"} redirected${s.releasedCount ? `, ${s.releasedCount} released` : ""}${s.topWeekday ? `. Most often on ${s.topWeekday}s` : ""}`,
      series: s.byCategory.length > 1 ? s.byCategory.map((c) => ({ key: c.category, label: c.category, value: c.amount })) : undefined,
      seriesLabel: s.byCategory.length > 1 ? "By kind of craving" : undefined,
      explain: { tool: "Crave mode diary (this device)", filters: ["Simulation: no money was moved"], source: "Crave mode (Junction 2026 concept)" },
    };
    return { model: { ...s, cards: cardRef([card]) }, full: s, cards: [card] };
  },
});

// ---------------------------------------------------------------- machine-learning outputs
const forecastTool = tool({
  name: "get_balance_forecast",
  description: "Balance forecast until and beyond the next payday (fan of likely balances, chance of going below zero). Uses the ML forecast when ready, else the engine's bootstrap simulation.",
  schema: z.object({}),
  status: () => "Simulating the weeks ahead…",
  run: async (ctx) => {
    let f = await loadMl<MlForecast>("forecast", ctx.c.id);
    let fromMl = true;
    if (!f) {
      fromMl = false;
      const s = engine.getSafeToSpend(ctx.c, ctx.opts);
      const fe = engine.getFixedEvents(ctx.c, 35, { goal: ctx.opts.goal });
      const sim = engine.simulateBalance(ctx.c, { days: 35, fixedEvents: fe, paydayDate: s.nextPayday.date });
      const start = currentBalance(ctx.c);
      const spendAt = (d: number) => {
        const fx = fe.filter((e) => e.date <= sim.fan[d].date).reduce((t, e) => t + e.amount, 0);
        const p = sim.fan[d];
        return { p10: r2(start + fx - p.p90), p25: r2(start + fx - p.p75), p50: r2(start + fx - p.p50), p75: r2(start + fx - p.p25), p90: r2(start + fx - p.p10) };
      };
      const tp = Math.max(1, Math.min(35, s.nextPayday.daysAway - 1));
      f = {
        id: ctx.c.id,
        asOf: ctx.c.asOf,
        balance: r2(start),
        nextPayday: { date: s.nextPayday.date, amount: s.nextPayday.amount, daysAway: s.nextPayday.daysAway },
        fixedEvents: fe,
        spend: [
          { horizon: "7d", days: 7, ...spendAt(7) },
          { horizon: "14d", days: 14, ...spendAt(14) },
          { horizon: "to_payday", days: tp, ...spendAt(tp) },
          { horizon: "30d", days: 30, ...spendAt(30) },
        ],
        sim: { historyDays: 182, scale: 1 },
        fan: sim.fan,
        overdraftProbToPayday: sim.overdraftProbToPayday,
        backtest: null,
      };
    }
    const card: CardSpec = {
      id: ctx.newCardId(),
      kind: "forecast",
      title: "Your balance in the weeks ahead",
      data: f,
      explain: { tool: fromMl ? "ML: balance forecast (ml/b_forecast.py)" : "engine.simulateBalance (bootstrap, 1,000 paths)", filters: ["Your own past days, same weekday, last 182 days", "Salary, rent and investing placed on their expected dates"], source: SOURCE, model: fromMl ? await modelInfo("forecast") : { name: "Bootstrap simulation", metric: "ML forecast not ready yet: engine simulation shown" } },
    };
    const end = f.fan[f.fan.length - 1];
    return {
      model: { source: fromMl ? "ml_forecast" : "engine_simulation", balance: f.balance, next_payday: f.nextPayday, overdraft_prob_to_payday_pct: r2(f.overdraftProbToPayday * 100), spend: f.spend, end_of_horizon: end, fixed_events: f.fixedEvents, backtest: f.backtest, cards: cardRef([card]) },
      full: f,
      cards: [card],
    };
  },
});

const riskTool = tool({
  name: "get_overdraft_risk",
  description: "Early-warning model: chance the balance goes below zero in the next 14 days, with the main drivers.",
  schema: z.object({}),
  status: () => "Checking the early-warning model…",
  run: async (ctx) => {
    const r = await loadMl<MlRisk>("risk", ctx.c.id);
    if (!r) return mlMissing("early-warning");
    const card: CardSpec = { id: ctx.newCardId(), kind: "risk", title: "Early warning", data: r, explain: { tool: "ML: early-warning model", filters: [`Horizon ${r.horizonDays} days`], source: SOURCE, model: await modelInfo("risk") } };
    return { model: { probability_pct: r2(r.probability * 100), level: r.level, base_rate_pct: r2(r.baseRate * 100), percentile: r.percentile, drivers: r.drivers.slice(0, 4).map((d) => ({ label: d.label, display: d.display, direction: d.direction })), cards: cardRef([card]) }, full: r, cards: [card] };
  },
});

const twinsTool = tool({
  name: "get_two_futures",
  description: "Two Futures: what happened over the following year to customers who looked like this customer a year earlier (built a buffer vs slipped), and which behaviours separated them.",
  schema: z.object({}),
  status: () => "Finding people who were where you are…",
  run: async (ctx) => {
    const t = await loadMl<MlTwins>("twins", ctx.c.id);
    if (!t) return mlMissing("Two Futures (financial twins)");
    const card: CardSpec = { id: ctx.newCardId(), kind: "twins", title: "Two futures", data: t, explain: { tool: "ML: financial twins (nearest neighbours)", filters: [`${t.nTwins} similar customers`, t.caveat], source: SOURCE, model: await modelInfo("twins") } };
    return { model: { n_twins: t.nTwins, groups: t.groups.map((g) => ({ key: g.key, label: g.label, n: g.n, buffer_change: g.bufferChange })), differences: t.differences.slice(0, 3), caveat: t.caveat, cards: cardRef([card]) }, full: t, cards: [card] };
  },
});

const anomaliesTool = tool({
  name: "get_unusual_transactions",
  description: "Transactions and weeks that were unusual for this customer (anomaly model).",
  schema: z.object({}),
  status: () => "Looking for anything unusual…",
  run: async (ctx) => {
    const a = await loadMl<MlAnomalies>("anomalies", ctx.c.id);
    if (!a) return mlMissing("unusual-transactions");
    const card: CardSpec = { id: ctx.newCardId(), kind: "anomalies", title: "Unusual for you", data: a, explain: { tool: "ML: anomaly detection", filters: ["Last 12 months, compared with your own history"], source: SOURCE, model: await modelInfo("anomalies") } };
    return { model: { top: a.transactions.slice(0, 5).map((x) => ({ date: x.date, category: x.category, amount: x.amount, reasons: x.reasons })), last_30_days: a.last30Days, cards: cardRef([card]) }, full: a, cards: [card] };
  },
});

const habitsTool = tool({
  name: "get_habits",
  description: "Habit detector: lasting changes in weekly spending (new good habits, forming, slipping).",
  schema: z.object({}),
  status: () => "Checking your habits…",
  run: async (ctx) => {
    const h = await loadMl<MlHabits>("habits", ctx.c.id);
    if (!h) return mlMissing("habit-detector");
    const card: CardSpec = { id: ctx.newCardId(), kind: "habits", title: "Your habits", data: h, explain: { tool: "ML: change-point habit detector", filters: ["Weekly spending series, last 40 weeks"], source: SOURCE, model: await modelInfo("habits") } };
    return { model: { habits: h.habits.slice(0, 4).map((x) => ({ category: x.category, direction: x.direction, status: x.status, since: x.since, before: x.before, after: x.after, change_pct: x.changePct, monthly_impact: x.monthlyImpact })), cards: cardRef([card]) }, full: h, cards: [card] };
  },
});

const homeTool = tool({
  name: "get_home_readiness",
  description: "First-home readiness (illustrative, from 200 mortgage applications in the dataset): reachable price, equity gap, years to ready.",
  schema: z.object({}),
  status: () => "Checking first-home readiness…",
  run: async (ctx) => {
    const h = await loadMl<MlHome>("home", ctx.c.id);
    if (!h) return mlMissing("first-home readiness");
    const card: CardSpec = { id: ctx.newCardId(), kind: "home", title: "First-home readiness", data: h, explain: { tool: "ML: first-home readiness (illustrative)", filters: [`${h.reachable.nSimilar} similar applicants`, h.caveat], source: SOURCE, model: await modelInfo("home") } };
    return { model: { reachable: h.reachable, equity: h.equity, monthly_saving_now: h.monthlySavingNow, years_to_ready: h.yearsToReady, blockers: h.blockers, caveat: h.caveat, cards: cardRef([card]) }, full: h, cards: [card] };
  },
});

const futuresTool = tool({
  name: "get_txgpt_futures",
  description: "TransactionGPT (experimental): sampled next-14-day futures (thrifty, typical, spendy) from a sequence model trained on transactions.",
  schema: z.object({}),
  status: () => "Sampling possible next two weeks…",
  run: async (ctx) => {
    const t = await loadMl<MlTxGpt>("txgpt", ctx.c.id);
    if (!t) return mlMissing("TransactionGPT");
    const card: CardSpec = { id: ctx.newCardId(), kind: "futures", title: "Three possible next two weeks", data: t, explain: { tool: "ML: TransactionGPT (experimental)", filters: [`${t.next14.nSamples} sampled futures`], source: SOURCE, model: await modelInfo("txgpt") } };
    return { model: { next14: t.next14, futures: t.futures.map((f) => ({ label: f.label, total: f.total })), next_category_top3: t.nextCategoryTop3, cards: cardRef([card]) }, full: t, cards: [card] };
  },
});

// ---------------------------------------------------------------- registry
export const TOOLS = [
  querySpendingTool,
  listTransactionsTool,
  basketsTool,
  safeTool,
  upcomingTool,
  monthlyTool,
  weekTool,
  whatIfTool,
  profileTool,
  peersTool,
  conceptTool,
  actionTool,
  craveTool,
  cravePotTool,
  forecastTool,
  riskTool,
  twinsTool,
  anomaliesTool,
  habitsTool,
  homeTool,
  futuresTool,
] as ToolDef<z.ZodObject>[];

const byName = new Map(TOOLS.map((t) => [t.name, t]));

/** Tool definitions for the Messages API (deterministic order and content, so they cache). */
export const TOOL_PARAMS: Anthropic.Tool[] = TOOLS.map((t) => {
  const { $schema: _s, ...schema } = z.toJSONSchema(t.schema) as Record<string, unknown>;
  return { name: t.name, description: t.description, input_schema: schema as Anthropic.Tool.InputSchema };
});

export function toolStatus(name: string, input: unknown): string {
  const t = byName.get(name);
  if (!t) return "Working on it…";
  const p = t.schema.safeParse(input);
  try {
    return p.success ? t.status(p.data) : "Working on it…";
  } catch {
    return "Working on it…";
  }
}

export async function runTool(ctx: ToolCtx, name: string, input: unknown): Promise<ToolOutput & { error?: string }> {
  const t = byName.get(name);
  if (!t) return { model: { error: `unknown tool ${name}` }, full: null, cards: [], error: "unknown tool" };
  const p = t.schema.safeParse(input);
  if (!p.success) return { model: { error: "invalid input", issues: p.error.issues.slice(0, 5).map((x) => `${x.path.join(".")}: ${x.message}`) }, full: null, cards: [], error: "invalid input" };
  return await t.run(ctx, p.data);
}
