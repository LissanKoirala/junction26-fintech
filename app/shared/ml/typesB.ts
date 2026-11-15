// Model outputs owned by the ML-B pipeline (ml/b_*.py). Same rules as typesA.ts.
import type { FanPoint, FixedEvent } from "../engine/api";

// ------------------------------------------------------------------ ml/forecast/{id}.json  ("Crystal ball")
export interface MlForecast {
  id: string;
  asOf: string;
  balance: number;
  nextPayday: { date: string; amount: number; daysAway: number };
  fixedEvents: FixedEvent[]; // next 35 days: salary, housing, investment (signed amounts)
  /** Variable spending (purchases + utilities) over each horizon, positive euros, from the quantile model. */
  spend: { horizon: "7d" | "14d" | "to_payday" | "30d"; days: number; p10: number; p25: number; p50: number; p75: number; p90: number }[];
  /** Calibration for the shared bootstrap simulator (see shared/engine/api.ts SimParams). */
  sim: { historyDays: number; scale: number };
  fan: FanPoint[]; // baseline balance fan for the next 35 days
  overdraftProbToPayday: number; // 0..1
  /** How the model did for THIS customer on held-out windows. */
  backtest: { windows: number; mae: number; naiveMae: number; coverage80: number } | null;
}

// ------------------------------------------------------------------ ml/risk/{id}.json  ("Early warning")
export interface MlRisk {
  id: string;
  asOf: string;
  horizonDays: number; // 14
  probability: number; // 0..1 chance the balance goes below zero within the horizon
  level: "low" | "elevated" | "high";
  baseRate: number; // average probability across all customers on the same date
  percentile: number; // 0-100 among all customers
  /** SHAP attributions, largest absolute contribution first (max 6). contribution is in log-odds. */
  drivers: {
    feature: string;
    label: string; // plain words, e.g. "Rent is due in 3 days"
    value: number;
    display: string; // formatted value, e.g. "1 295 €" or "28 days"
    contribution: number;
    direction: "raises" | "lowers";
  }[];
  /** Weekly track record for this customer over the held-out period: what the model said and what happened. */
  history: { date: string; probability: number; wentNegative: boolean }[];
}

// ------------------------------------------------------------------ ml/txgpt/{id}.json  ("TransactionGPT", experimental)
export interface MlTxGpt {
  id: string;
  asOf: string;
  /** Three sampled continuations of the next 14 days, picked as the thrifty / typical / spendy samples by total. */
  futures: {
    label: "thrifty" | "typical" | "spendy";
    total: number; // positive euros of spending
    days: { date: string; events: { category: string; amount: number }[] }[];
  }[];
  next14: { p10: number; p50: number; p90: number; nSamples: number }; // spending, positive euros
  nextCategoryTop3: { category: string; p: number }[];
  /** Recent transactions the model found most surprising (high negative log-likelihood). */
  surprises: { i: number; date: string; category: string; amount: number; bits: number; percentile: number }[];
}
