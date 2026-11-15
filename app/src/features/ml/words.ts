// Plain-language helpers shared by the You page, the Today slots and the chat ML cards.
import { actions } from "@/state/store";
import { navigate } from "@/lib/router";
import { categoryLabel } from "@/lib/domain";
import { money, num } from "@/lib/format";
import type { MlHabits } from "@shared/ml/typesA";
import type { MlRisk } from "@shared/ml/typesB";

/** Open the chat with a question. */
export function askVara(q: string, screen = "you") {
  actions.ask(q, screen);
  navigate("/vara/chat", { replace: true });
}
/** Jump to a section of the You page. */
export function openYou(focus?: YouSection) {
  navigate("/vara/you" + (focus ? `?focus=${focus}` : ""), { replace: true });
}
export function openModels(key?: string) {
  navigate("/vara/you?view=models" + (key ? `&model=${key}` : ""), { replace: true });
}
export type YouSection = "personality" | "map" | "twins" | "forecast" | "risk" | "unusual" | "habits" | "futures" | "home";

/** 0.367 -> "about 1 in 3"; 0.62 -> "about 6 in 10". */
export function chanceWords(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "–";
  if (p <= 0.005) return "almost none";
  if (p < 0.05) return "less than 1 in 20";
  if (p < 0.3) return `about 1 in ${Math.round(1 / p)}`;
  if (p >= 0.95) return "very likely";
  return `about ${Math.round(p * 10)} in 10`;
}

/** Feature value with its unit as written in the model files ("%" features are already 0-100). */
export function fmtFeature(v: number, unit: string): string {
  const u = unit.trim();
  if (u === "%") return `${num(v, Math.abs(v) < 10 ? 1 : 0)} %`;
  if (u === "€/month" || u === "€ per month" || u === "EUR/month") return `${money(v, { whole: true })} a month`;
  if (u === "€" || u === "EUR") return money(v, { whole: true });
  if (u === "per month") return `${num(v, v < 10 ? 1 : 0)} a month`;
  if (u === "days") return `${num(v)} days`;
  if (u === "months") return `${num(v, 1)} months`;
  return `${num(v, Math.abs(v) < 10 ? 1 : 0)}${u ? " " + u : ""}`;
}

export const RISK_WORDS: Record<MlRisk["level"], { label: string; line: string; tone: "accent" | "warning" | "error" }> = {
  low: { label: "Calm", line: "Your balance looks steady for the next two weeks.", tone: "accent" },
  elevated: { label: "Worth a look", line: "There is a real chance of dipping below zero in the next two weeks.", tone: "warning" },
  high: { label: "High", line: "A high chance of dipping below zero in the next two weeks.", tone: "error" },
};

export type Habit = MlHabits["habits"][number];
export const habitGood = (h: Habit) => h.monthlyImpact > 0;
export const HABIT_STATUS: Record<Habit["status"], string> = { new_habit: "New habit", forming: "Forming", slipping: "Slipping" };

export function habitLevel(h: Habit, v: number): string {
  return h.metric === "weekly_count" ? `${num(v, v < 10 ? 1 : 0)} a week` : `${money(v, { whole: v >= 100 })} a week`;
}
export function habitName(h: Habit): string {
  const c = categoryLabel(h.category);
  return h.metric === "weekly_count" && !/purchase/i.test(c) ? `${c} purchases` : c;
}
/** One-line headline. Good habits celebrate; slipping ones are a gentle question. */
export function habitHeadline(h: Habit): string {
  const name = habitName(h);
  const pctTxt = `${Math.abs(Math.round(h.changePct))} %`;
  const dir = h.direction === "down" ? "down" : "up";
  if (habitGood(h)) return `${name} ${dir} ${pctTxt}. Nice work!`;
  return `${name} ${dir} ${pctTxt}. Is that on purpose?`;
}
/** Most notable habit: biggest monthly euro impact, weighted by confidence. */
export function topHabit(habits: Habit[]): Habit | null {
  if (!habits.length) return null;
  return [...habits].sort((a, b) => Math.abs(b.monthlyImpact) * b.confidence - Math.abs(a.monthlyImpact) * a.confidence)[0];
}

export const FUTURE_LABEL: Record<"thrifty" | "typical" | "spendy", string> = { thrifty: "Thrifty", typical: "Typical", spendy: "Spendy" };

export const VERDICT: Record<string, { label: string; tone: "success" | "info" | "warning" }> = {
  ships: { label: "Ships", tone: "success" },
  experimental: { label: "Experimental", tone: "info" },
  not_better_than_baseline: { label: "Not better than baseline", tone: "warning" },
};
