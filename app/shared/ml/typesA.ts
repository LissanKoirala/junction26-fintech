// Model outputs owned by the ML-A pipeline (ml/a_*.py). Files live on the VM under DATA_DIR.
// Rule: the Python that writes a file and the type here must always agree. Add fields freely (optional),
// never rename or remove one without updating this file. All euro amounts are plain numbers (EUR).
import type { Basket } from "../types";

// ------------------------------------------------------------------ global/tribes.json + global/map.json  ("Money Map")
export interface Tribe {
  id: number;
  name: string; // short and friendly, written by the language model from the centroid stats, e.g. "Payday Sprinter"
  tagline: string; // one line
  description: string; // 2-3 plain sentences, non-judgemental
  strengths: string[];
  watchOuts: string[];
  share: number; // fraction of customers in this tribe
  color: string; // hex, distinct per tribe, readable on white
  centroid: Record<string, number>; // feature -> mean (raw units)
  distinctive: { feature: string; label: string; value: number; vsAll: number }[]; // what sets it apart
  medianIncome?: number; // median monthly income of members (context only; not used for clustering)
}
/** global/map.json: column arrays (one entry per main-cohort customer) to keep the file small. */
export interface MoneyMap {
  ids: string[];
  x: number[]; // UMAP coordinates normalised to 0..1
  y: number[];
  tribe: number[]; // Tribe.id
  tribes: Tribe[];
  method: string; // e.g. "UMAP(n_neighbors=30) on 24 standardised behaviour features; KMeans k=7"
  features: { key: string; label: string; unit: string }[]; // the feature dictionary
}

// ------------------------------------------------------------------ ml/profile/{id}.json
export interface MlProfile {
  id: string;
  asOf: string;
  ageBand: string;
  /** Last 12 months (window). Display units: "%" features are 0-100, euros per month, counts per month. Dictionary: map.json features + ml/FEATURES.md. */
  features: Record<string, number>;
  /** Percentile (0-100) of each feature among same-age-band customers of the bank dataset. */
  percentiles: Record<string, number>;
  map: { x: number; y: number };
  tribe: { id: number; name: string; fit: number; mix: { id: number; name: string; weight: number }[] }; // soft membership sums to 1
  /** The 4-6 traits that most distinguish this customer from peers, already phrased for display. */
  highlights: { feature: string; label: string; value: number; unit: string; percentile: number; direction: "high" | "low" }[];
  window?: [string, string]; // feature window, "2025-10-01".."2026-09-30"
  cohort?: "main" | "tail";
  hasSalarySweep?: boolean; // spending mostly invisible: highlights limited to saving / buffer metrics
}

// ------------------------------------------------------------------ global/peers.json  (in-bank peer benchmarks)
export interface PeerStats {
  /** ageBand -> metric -> percentiles of the monthly value among main-cohort customers. */
  byAgeBand: Record<string, Record<string, { p10: number; p25: number; p50: number; p75: number; p90: number; n: number }>>;
  metrics: { key: string; label: string; unit: string }[];
  population?: string; // who is in the reference group
  asOf?: string;
}

// ------------------------------------------------------------------ global/benchmarks.json  (Statistics Finland)
export interface Benchmarks {
  source: string; // "Statistics Finland, Household Budget Survey 2022, tables 14q4 and 14ph"
  sourceLine?: string; // the attribution line to show under any benchmark
  unit?: string; // "EUR per household per month"
  crossChecks?: { group: string; coicop: string; expected: number; ok: boolean }[];
  licence: string; // "CC BY 4.0"
  surveyYear: number;
  priceAdjustedTo: string; // e.g. "average of Nov 2025 - Oct 2026 (CPI table 15b5)"
  /** group key ("age:17-24", "age:25-34", "household:one-person-under-65", "all") -> coicop key -> euros per household per month.
   *  Group keys: "all", "age:17-24".."age:85-", "household:one-person-under-65" | couple-under-65 | single-parent | two-parent-family | over-64 | other.
   *  COICOP keys: "total", "01".."13", "11.1", "11.2", "04.2", "77", "04x". */
  groups: Record<string, { label: string; raw2022: Record<string, number>; adjusted: Record<string, number> }>;
  coicop: Record<string, { label: string; cpiFactor: number }>; // includes "04x" = housing and energy excluding imputed rent
  caveats: string[];
}

// ------------------------------------------------------------------ ml/twins/{id}.json  ("Two Futures")
export interface TwinGroup {
  key: "built" | "held" | "slipped";
  label: string; // "Built a buffer" | "Held steady" | "Slipped"
  n: number;
  /** Median change in balance over the twins' following 12 months, scaled to this customer's income. */
  bufferChange: number;
  /** Balance change path over months 0..12 (0 = now), scaled to this customer's income: add to current balance to draw. */
  path: { month: number; p25: number; p50: number; p75: number }[];
  /** How this group's monthly spending changed in the following year vs the matching year, scaled to this customer. */
  changes: { key: string; label: string; deltaMonthly: number; deltaPct: number }[];
}
export interface MlTwins {
  id: string;
  asOf: string;
  nTwins: number;
  window: { yours: [string, string]; theirs: [string, string]; followUp: [string, string] };
  matchedOn: { feature: string; label: string; yours: number; twinsMedian: number; unit: string }[];
  groups: TwinGroup[]; // built, held, slipped
  /** The 3-4 clearest behaviours separating "built" from "slipped", biggest first. */
  differences: { key: string; label: string; built: number; slipped: number; unit: string; insight: string }[];
  you: { balance: number; pastPath: { month: number; balance: number }[] }; // months -12..0, month-end balances
  quality: { medianDistance: number; note: string; randomPairDistance?: number };
  monthlyIncome?: number; // this customer's monthly income used for scaling
  caveat: string; // correlation, not causation; synthetic data
}

// ------------------------------------------------------------------ ml/anomalies/{id}.json  ("Unusual for you")
export interface MlAnomalies {
  id: string;
  asOf: string;
  transactions: {
    i: number; // index into CustomerData.tx
    date: string;
    category: string;
    amount: number;
    score: number; // 0..1, 1 = most unusual for this customer
    reasons: string[]; // e.g. ["6x your usual Home & tech purchase", "unusual hour (23:00)"]
    suggestedBasket?: Basket;
    time?: string; // "06:03:49"
    basket?: string; // current default basket (domain rules) of this transaction
  }[]; // last 12 months, most unusual first, max 30
  weeks: { weekStart: string; spend: number; typical: number; z: number; drivers: { category: string; delta: number }[] }[];
  last30Days: { count: number; total: number };
  method: string;
  threshold?: number; // score at or above which a purchase counts as unusual (last30Days uses it)
  note?: string | null;
}

// ------------------------------------------------------------------ ml/habits/{id}.json  ("Habit detector")
export interface MlHabits {
  id: string;
  asOf: string;
  habits: {
    key: string;
    category: string; // category label or "Small purchases" / "All everyday extras"
    metric: "weekly_spend" | "weekly_count";
    direction: "down" | "up";
    since: string; // change-point date
    weeks: number; // how long the new level has held
    before: number; // weekly level before
    after: number;
    changePct: number;
    monthlyImpact: number; // euros per month, positive = saving
    confidence: number; // 0..1
    status: "new_habit" | "forming" | "slipping";
    series: { weekStart: string; value: number }[]; // last 40 weeks for a sparkline
  }[];
  method: string;
  falsePositiveRate?: number; // per series, measured on 4-week block-shuffled series (conservative)
  chanceShare?: number; // share of flagged shifts that could be chance on the middle (8-week block) null (0..1); longer blocks give more
  chanceShareRange?: number[]; // [4-week, 13-week block null]
}

// ------------------------------------------------------------------ ml/home/{id}.json  ("First-home readiness", illustrative)
export interface MlHome {
  id: string;
  asOf: string;
  monthlyIncome: number;
  /** What applicants with similar income were approved for (from the 200 mortgage applications in the dataset). */
  reachable: { priceP25: number; priceP50: number; priceP75: number; loanP50: number; nSimilar: number };
  equity: { typicalSharePct: number; neededForP50: number; currentSavings: number; gap: number; savingsNote?: string };
  monthlySavingNow: number;
  yearsToReady: number | null; // null if not saving
  /** probabilityIfAppliedNow is null when the hypothetical application falls outside the training support (p5-p95). */
  approval: { probabilityIfAppliedNow: number | null; cvAuc: number; cvAccuracy: number; n: number; rule: string; baselineAccuracy?: number };
  blockers: string[];
  linkedApplication?: { decision: string; reason: string | null; price: number; loan: number }; // if this customer is one of the 200
  caveat: string;
}

// ------------------------------------------------------------------ global/modelcard-<key>.json  (one per model, both pipelines)
export interface ModelCard {
  key: string;
  name: string;
  purpose: string; // one plain sentence
  method: string;
  trainedOn: string; // rows / customers / date range
  split: string; // how it was validated (time split etc.)
  metrics: {
    label: string;
    model: number;
    baseline: number;
    baselineName: string;
    unit: string;
    better: "lower" | "higher";
    /** The difference is within noise (e.g. a bootstrap interval that includes zero): shown as "about equal". */
    onPar?: boolean;
    diffCI95?: number[];
  }[];
  verdict: "ships" | "experimental" | "not_better_than_baseline";
  caveats: string[];
  trainedAt: string;
  trainSeconds?: number;
  /** Free-form extra evidence (k selection table, CV details, coefficients...). */
  validation?: unknown;
  evidence?: unknown;
  coefficients?: Record<string, number>;
  rule?: string;
}
