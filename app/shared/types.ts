// Core data types shared by the browser, the API server and (by convention) the Python ML pipeline.
// The JSON files under DATA_DIR/customers/{id}.json have exactly the CustomerData shape.

export type TxType =
  | "purchase"
  | "utilities_payment"
  | "housing_payment"
  | "salary"
  | "other_income"
  | "investment_deposit"
  | "investment_withdrawal"
  | "salary_sweep";

export type PurchaseCategory =
  | "Groceries"
  | "Restaurants"
  | "Transportation"
  | "Entertainment"
  | "Health"
  | "Home & Tech"
  | "Lifestyle"
  | "Travel";

export type Category =
  | PurchaseCategory
  | "Utilities"
  | "Housing"
  | "Salary"
  | "Other Income"
  | "Invest Deposit"
  | "Invest Withdraw"
  | "Salary Sweep";

/** One bank transaction. Expenses are negative, inflows positive. `i` is the index inside CustomerData.tx. */
export interface Tx {
  i: number;
  date: string; // "2026-09-30"
  time: string; // "13:31:58" (local, no timezone in the data)
  category: Category;
  type: TxType;
  amount: number; // EUR, signed
  balance: number; // running balance after this transaction
  merchantId: string | null; // opaque id like "MRC-GRO-0035"; the data has NO merchant names
  mcc: string | null; // merchant category code, e.g. "4121" = taxi; null for non-purchases and ~5% of purchases
}

export interface CustomerData {
  id: string; // "CUST04754"
  age: number;
  postalCode: string; // Helsinki region (00xxx Helsinki, 01xxx Vantaa, 02xxx Espoo)
  cohort: "main" | "tail"; // "tail" = CUST05001+ with irregular income; excluded from model fitting
  hasSalarySweep: boolean; // ~90% of salary leaves right after payday: most spending is invisible (other bank)
  hasHousing: boolean;
  asOf: string; // "2026-09-30": the last day of data, treated as TODAY everywhere
  tx: Tx[]; // chronological
}

export interface CustomerIndexRow {
  id: string;
  age: number;
  postalCode: string;
  cohort: "main" | "tail";
  hasSalarySweep: boolean;
  hasHousing: boolean;
  nTx: number;
  medianSalary: number | null;
  endBalance: number;
}

/** The sponsor's three pedagogical baskets. Every outflow that is real spending lands in exactly one. */
export type Basket = "must_regular" | "must_irregular" | "everyday";
/** Everything a transaction can be once classified. */
export type FlowKind = Basket | "saving" | "transfer" | "income";

/** Inclusive ISO date range. */
export interface Period {
  from: string;
  to: string;
  label?: string; // human label such as "September 2026"
}

/** User corrections to the default basket rules (the baskets explorer writes these; stored client-side). */
export interface BasketOverrides {
  /** Per transaction index. Wins over everything. */
  byTx?: Record<number, Basket>;
  /** Per rule key `${category}|${mcc ?? "*"}`, e.g. "Transportation|4121" or "Groceries|*". */
  byRule?: Record<string, Basket>;
}

export interface Goal {
  name: string; // "Trip to Japan"
  targetAmount: number;
  targetDate: string; // ISO
  monthlyContribution: number;
  createdAt: string;
}
