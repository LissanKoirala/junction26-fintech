// Weekly check-in ("proactive coach"): GET /api/checkin/:id returns one CheckIn, generated from the engine's
// week summary plus ML signals and worded by the language model. Shown as swipeable full-screen stories.
import type { CardSpec } from "./chat";
import type { Category, Period } from "./types";

export interface CheckInSlide {
  id: string;
  kind: "recap" | "baskets" | "unusual" | "habit" | "lesson" | "outlook" | "challenge";
  eyebrow: string; // small label above the title, e.g. "Your week" or "One thing to learn"
  title: string; // one short sentence, can contain a number that came from the data
  body: string; // 1-3 plain sentences
  card?: CardSpec; // optional data card under the text (numbers come from tools, not from the model)
}

export interface Challenge {
  id: string;
  title: string; // "Keep everyday extras under 60 € this week"
  why: string;
  metric: { kind: "everyday_spend" | "small_purchases" | "category_spend"; category?: Category; unit: "eur" | "count" };
  target: number;
  baseline: number; // the customer's typical week on the same metric
  week: Period; // the week the challenge runs
  potentialMonthlySaving: number;
}

export interface CheckIn {
  customerId: string;
  asOf: string;
  week: Period; // the week being reviewed (last full week, or the current week to date)
  headline: string;
  slides: CheckInSlide[]; // 4-6 slides, the last one is the challenge
  challenge: Challenge;
}
