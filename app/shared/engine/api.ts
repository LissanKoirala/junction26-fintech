// PUBLIC INTERFACE of the finance engine. Types only. Implementations live next to this file and are
// re-exported from ./index.ts. The engine is PURE TypeScript (no Node or DOM APIs) so the same code runs
// in the browser (instant what-if sliders) and on the server (chat tools). All money is EUR.
// Spending totals are returned as POSITIVE numbers. "Today" is always customer.asOf.
import type { Basket, BasketOverrides, Category, CustomerData, FlowKind, Goal, Period, Tx } from "../types";
import type { Lang } from "../i18n";

export interface EngineOptions {
  overrides?: BasketOverrides;
  lang?: Lang; // language of every sentence and label in the result; default getLang() (the server always passes it)
}
/** Options for entry points that only need the language. */
export interface LangOptions {
  lang?: Lang;
}

// ---------------------------------------------------------------- classification
export type ClassifyTx = (customer: CustomerData, tx: Tx, opts?: EngineOptions) => FlowKind;

// ---------------------------------------------------------------- periods
/** Named periods relative to asOf, so the chat model never does date arithmetic itself. */
export type PeriodName =
  | "this_week" // ISO week (Mon-Sun) containing asOf, up to asOf
  | "last_week"
  | "this_month" // calendar month to date
  | "last_month" // previous full calendar month
  | "last_30_days"
  | "last_90_days"
  | "last_3_months" // the three latest complete months (util.completeMonths: the asOf month counts on its last day)
  | "last_6_months"
  | "last_12_months"
  | "this_year"
  | "all_time";
export type ResolvePeriod = (asOf: string, name: PeriodName, opts?: LangOptions) => Period;

// ---------------------------------------------------------------- spending queries
export interface SpendingQuery {
  period: Period;
  categories?: Category[];
  mccs?: string[];
  baskets?: Basket[];
  minAmount?: number; // absolute euros, inclusive
  maxAmount?: number;
  weekdays?: number[]; // 1 = Monday ... 7 = Sunday
  groupBy?: "category" | "mcc" | "basket" | "month" | "week" | "day" | "weekday" | "merchant" | "hour";
  compareTo?: "previous_period" | "same_period_last_year";
  includeTransactions?: boolean; // return matching transactions (capped at `limit`, largest first)
  limit?: number;
}
export interface SpendingGroup {
  key: string;
  label: string;
  total: number;
  count: number;
  share: number; // 0..1 of the query total
}
export interface SpendingResult {
  period: Period;
  total: number;
  count: number;
  average: number; // per transaction
  perMonth: number; // total scaled to a 30.44-day month
  groups?: SpendingGroup[];
  comparison?: { period: Period; total: number; count: number; deltaAbs: number; deltaPct: number | null };
  transactions?: Tx[];
  filters: string[]; // human-readable description of each filter, shown in "How I got this"
}
export type QuerySpending = (customer: CustomerData, q: SpendingQuery, opts?: EngineOptions) => SpendingResult;

// ---------------------------------------------------------------- baskets
export interface BasketSummary {
  basket: Basket;
  label: string;
  total: number;
  share: number; // of total spending in the period
  shareOfIncome: number | null;
  count: number;
  categories: { key: string; label: string; total: number; count: number }[];
  topTransactions: Tx[]; // up to 5 largest
}
export interface BasketsResult {
  period: Period;
  income: number;
  spending: number; // sum of the three baskets
  baskets: BasketSummary[]; // always three, in order must_regular, must_irregular, everyday
  saving: number; // investment deposits
  transfersOut: number; // salary sweeps
  net: number; // income - spending - saving - transfersOut
  overridesApplied: number;
}
export type GetBaskets = (customer: CustomerData, period: Period, opts?: EngineOptions) => BasketsResult;

// ---------------------------------------------------------------- recurring & upcoming
export interface RecurringItem {
  kind: "salary" | "housing" | "utilities" | "investment" | "groceries";
  label: string;
  typicalAmount: number; // positive
  amountLow: number;
  amountHigh: number;
  cadence: "monthly" | "several_per_month" | "weekly";
  typicalDayFrom?: number; // day of month window, e.g. housing 1..8
  typicalDayTo?: number;
  monthsSeen: number; // out of the last 12
  lastDate: string | null;
  nextFrom: string | null; // expected window for the next occurrence
  nextTo: string | null;
  note?: string; // e.g. "Some months have no housing payment in the data"
}
export type GetRecurring = (customer: CustomerData, opts?: LangOptions) => RecurringItem[];

// ---------------------------------------------------------------- safe to spend
export interface SafeToSpendOptions extends EngineOptions {
  goal?: Goal | null; // a savings goal reserves its monthly contribution
  bufferTarget?: number; // euros to keep untouched; default = 10% of monthly income (min 50)
  includeInvesting?: boolean; // treat the usual investment deposit as committed (default true)
}
export interface UpcomingItem {
  kind: "housing" | "utilities" | "groceries" | "transport" | "investment" | "goal" | "buffer";
  label: string;
  amount: number; // positive euros reserved
  from: string | null;
  to: string | null;
  basis: string; // plain-language basis, e.g. "median of your last 6 rent payments"
}
export interface SafeToSpend {
  asOf: string;
  balance: number;
  nextPayday: {
    date: string;
    amount: number;
    daysAway: number;
    estimated?: boolean; // true when there is no regular salary: the date is a 30-day planning horizon, amount 0
    basis?: string; // plain-language basis of the prediction
    latest?: string; // latest plausible date if this month breaks the usual pattern (end of month)
    irregular?: boolean; // income is irregular: plan for 30 days, never state a payday or a usual salary
    lateCount?: number; // salaries in the last 12 months that came at the end of the month instead of the 15th
    lateExtra?: number; // extra fixed musts needed if pay arrives on `latest` instead of `date`
    lateCovered?: boolean; // true when the buffer covers lateExtra; otherwise the shortfall is an upcoming item
    lateNote?: string; // one plain sentence about late pay for the UI and the chat
  };
  upcoming: UpcomingItem[]; // everything reserved between today and the next payday
  reservedTotal: number;
  freeUntilPayday: number; // balance - reservedTotal (can be negative)
  weeksUntilPayday: number; // fractional, min 1
  safePerWeek: number; // max(0, freeUntilPayday / weeksUntilPayday)
  safePerDay: number;
  // Everyday-basket spending in the current ISO week. spentSoFar is already out of the balance, so
  // remaining = safePerDay x days left this week (capped at the free money); this week's budget = spentSoFar + remaining.
  week: { from: string; to: string; spentSoFar: number; remaining: number; daysLeft?: number; typicalSpend?: number };
  status: "comfortable" | "a_bit_tight" | "tight" | "over"; // a_bit_tight: safe week is 50-100% of a usual week
  wellCovered?: boolean; // safe per week is more than 3x a usual everyday week (and over 200 €): show "well covered"
  note?: string; // plain-language caveat, e.g. when most of the free money is savings already built up
  steps: { label: string; amount: number; sign: "+" | "-" | "=" | "/" }[]; // the arithmetic, for the explain drawer
}
export type GetSafeToSpend = (customer: CustomerData, opts?: SafeToSpendOptions) => SafeToSpend;

// ---------------------------------------------------------------- what-if
export interface Adjustment {
  target: { category?: Category; mcc?: string; basket?: Basket };
  changePct: number; // -20 = spend 20% less
  label?: string;
}
export interface Scenario {
  adjustments: Adjustment[];
  extraMonthlySaving?: number; // euros moved to savings each month on top
  housingChange?: number; // new monthly housing cost minus current (negative = cheaper)
  annualReturnPct?: number; // for the "if invested" line; default 4
  horizonsMonths?: number[]; // default [1, 12, 60, 120]
  baselineMonths?: number; // how many past full months define "normal"; default 6
}
export interface WhatIfResult {
  basis: string; // "average of Apr-Sep 2026"
  perAdjustment: { label: string; baselineMonthly: number; newMonthly: number; savedMonthly: number }[];
  savedMonthly: number; // total freed per month (adjustments + housing change + extra saving)
  safePerWeekBefore: number;
  safePerWeekAfter: number;
  // Cutting everyday extras changes what you spend, not what is safe: then safeChanges is false and the UI shows
  // what does change instead (money left at the end of an average month, and the yearly total).
  safeChanges?: boolean;
  monthEndLeftBefore?: number; // average monthly income minus spending and saving, baseline months
  monthEndLeftAfter?: number; // the same with this change (extra saving is moved away, so it is not counted as left)
  yearlySaved?: number; // savedMonthly x 12
  projections: { months: number; saved: number; invested: number }[]; // invested = with compound return
  equivalents: string[]; // 1-2 concrete equivalents, e.g. "about 2.3 weeks of groceries per year"
}
export type SimulateWhatIf = (customer: CustomerData, scenario: Scenario, opts?: SafeToSpendOptions) => WhatIfResult;

// ---------------------------------------------------------------- balance simulation (shared with the ML forecast)
// Bootstrap Monte Carlo, identical in spirit to ml/b_forecast.py so numbers agree:
//  * history = the customer's last `historyDays` days (default 182). Group days by weekday.
//  * for each simulated future day, draw one historical day of the same weekday uniformly at random and take
//    that day's variable outflows per category (purchases + utilities), keeping the categories of one day together;
//  * multiply each category by multipliers[category] (what-if sliders) and everything by `scale` (model calibration);
//  * apply fixedEvents (salary, housing, investment ...) on their dates; fixed kinds are EXCLUDED from the bootstrap pool;
//  * balance path = starting balance + cumulative flows. Use a seeded PRNG (mulberry32) so results are reproducible.
export interface FixedEvent {
  date: string;
  kind: "salary" | "housing" | "investment" | "other_income" | "goal";
  amount: number; // signed
}
export interface SimParams {
  days: number; // horizon, usually up to and including next payday
  nPaths?: number; // default 1000
  seed?: number; // default 42
  scale?: number; // default 1; from MlForecast.sim.scale when available
  historyDays?: number; // default 182
  multipliers?: Partial<Record<Category, number>>; // 0.8 = spend 20% less in that category
  fixedEvents: FixedEvent[];
  paydayDate?: string; // overdraft probability is measured up to (not including) this date
}
export interface FanPoint {
  day: number; // 0 = today
  date: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}
export interface SimResult {
  fan: FanPoint[];
  overdraftProbToPayday: number; // share of paths whose balance goes below 0 before payday
  minBalanceP10: number;
  endBalanceP50: number;
  nPaths: number;
}
export type SimulateBalance = (customer: CustomerData, params: SimParams) => SimResult;
/** Fixed events for the next `days` days derived from getRecurring (salary, housing, investment). */
export type GetFixedEvents = (customer: CustomerData, days: number, opts?: { goal?: Goal | null; lang?: Lang }) => FixedEvent[];

// ---------------------------------------------------------------- summaries
export interface MonthRow {
  month: string; // "2026-09"
  income: number;
  mustRegular: number;
  mustIrregular: number;
  everyday: number;
  saving: number;
  transfersOut: number;
  net: number;
  endBalance: number;
  minBalance: number;
  complete: boolean; // false for the month containing asOf if it is not finished
}
export type GetMonthly = (customer: CustomerData, months?: number, opts?: EngineOptions) => MonthRow[];

export interface WeekSummary {
  from: string;
  to: string;
  spending: number;
  byBasket: Record<Basket, number>;
  topCategories: { key: string; label: string; total: number; count: number }[];
  vsTypicalWeekPct: number | null; // against the median of the previous 12 weeks
  smallPurchases: { count: number; total: number }; // under the small-purchase threshold
  biggest: Tx | null;
  income: number;
  lowestBalance: number;
  typicalSpending?: number; // the median the vsTypicalWeekPct compares against (same weekdays, previous 12 weeks)
  days?: number; // days covered (fewer than 7 for the current week to date)
}
export type GetWeekSummary = (customer: CustomerData, weekOffset?: number, opts?: EngineOptions) => WeekSummary; // 0 = current week, -1 = last full week

/** Descriptive behaviour stats for "What kind of spender am I?" (the ML tribe adds the label on top). */
export interface SpenderStats {
  months: number;
  monthlyIncome: number;
  monthlySpending: number;
  savingsRatePct: number; // (income - spending) / income
  basketShares: Record<Basket, number>; // of spending
  housingShareOfIncomePct: number | null;
  smallPurchasesPerMonth: number;
  smallPurchasesMonthlyTotal: number;
  weekendSharePct: number; // share of everyday spending on Fri-Sun
  eveningSharePct: number; // share of purchases after 18:00
  paydayBurnPct: number; // share of monthly everyday spending in the 5 days after payday
  spendingVolatilityPct: number; // coefficient of variation of monthly spending
  overdraftDaysLast12m: number;
  bufferMonths: number; // balance / monthly must-spend
  topCategories: { key: string; label: string; monthly: number; shareOfSpending: number }[];
}
export type GetSpenderStats = (customer: CustomerData, opts?: EngineOptions) => SpenderStats;

/** Everything the engine exposes. `import { engine } from "@shared/engine"`. */
export interface Engine {
  classifyTx: ClassifyTx;
  resolvePeriod: ResolvePeriod;
  querySpending: QuerySpending;
  getBaskets: GetBaskets;
  getRecurring: GetRecurring;
  getSafeToSpend: GetSafeToSpend;
  simulateWhatIf: SimulateWhatIf;
  getFixedEvents: GetFixedEvents;
  simulateBalance: SimulateBalance;
  getMonthly: GetMonthly;
  getWeekSummary: GetWeekSummary;
  getSpenderStats: GetSpenderStats;
}
