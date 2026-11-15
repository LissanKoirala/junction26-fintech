// Plain-language helpers shared by the You page, the Today slots and the chat ML cards.
import { actions } from "@/state/store";
import { navigate } from "@/lib/router";
import { categoryLabel } from "@/lib/domain";
import { money, num } from "@/lib/format";
import { getLang, t, tData } from "@/lib/i18n";

/** tData for model strings, plus Finnish number style for values captured inside them ("1.2" -> "1,2", "42%" -> "42 %"). */
export function tD(text: string): string {
  const s = tData(text);
  return getLang() === "fi" ? s.replace(/(\d)\.(\d)/g, "$1,$2").replace(/(\d)%/g, "$1 %") : s;
}
import type { MlHabits } from "@shared/ml/typesA";
import type { MlRisk } from "@shared/ml/typesB";

/** Open the chat with a question (pass it already translated). */
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
  if (p <= 0.005) return t("almost none");
  if (p < 0.05) return t("less than 1 in 20");
  if (p < 0.3) return t("about 1 in {n}", { n: Math.round(1 / p) });
  if (p >= 0.95) return t("very likely");
  return t("about {n} in 10", { n: Math.round(p * 10) });
}

/** Feature value with its unit as written in the model files ("%" features are already 0-100). */
export function fmtFeature(v: number, unit: string): string {
  const u = unit.trim();
  if (u === "%") return `${num(v, Math.abs(v) < 10 ? 1 : 0)} %`;
  if (u === "€/month" || u === "€ per month" || u === "EUR/month") return t("{v} a month", { v: money(v, { whole: true }) });
  if (u === "€" || u === "EUR") return money(v, { whole: true });
  if (u === "per month") return t("{v} a month", { v: num(v, v < 10 ? 1 : 0) });
  if (u === "days") return t("{v} days", { v: num(v) });
  if (u === "months") return t("{v} months", { v: num(v, 1) });
  return `${num(v, Math.abs(v) < 10 ? 1 : 0)}${u ? " " + tData(u) : ""}`;
}

/** Module constants below keep the English; translate with t() where they are shown. */
export const RISK_WORDS: Record<MlRisk["level"], { label: string; line: string; tone: "accent" | "warning" | "error" }> = {
  low: { label: "Calm", line: "Your balance looks steady for the next two weeks.", tone: "accent" },
  elevated: { label: "Worth a look", line: "There is a real chance of dipping below zero in the next two weeks.", tone: "warning" },
  high: { label: "High", line: "A high chance of dipping below zero in the next two weeks.", tone: "error" },
};

export type Habit = MlHabits["habits"][number];
export const habitGood = (h: Habit) => h.monthlyImpact > 0;
export const HABIT_STATUS: Record<Habit["status"], string> = { new_habit: "New habit", forming: "Forming", slipping: "Slipping" };

export function habitLevel(h: Habit, v: number): string {
  return t("{v} a week", { v: h.metric === "weekly_count" ? num(v, v < 10 ? 1 : 0) : money(v, { whole: v >= 100 }) });
}
export function habitName(h: Habit): string {
  // the habits file carries display names ("Eating out", "Small purchases"); domain keys are translated by categoryLabel
  const lab = categoryLabel(h.category);
  const c = lab !== h.category ? lab : tData(h.category);
  return h.metric === "weekly_count" && !/purchase/i.test(h.category) ? t("{c} purchases", { c }) : c;
}
/** One-line headline. Good habits celebrate; slipping ones are a gentle question. */
export function habitHeadline(h: Habit): string {
  const name = habitName(h);
  const pct = `${Math.abs(Math.round(h.changePct))} %`;
  const down = h.direction === "down";
  if (habitGood(h)) return down ? t("{name} down {pct}. Nice work!", { name, pct }) : t("{name} up {pct}. Nice work!", { name, pct });
  return down ? t("{name} down {pct}. Is that on purpose?", { name, pct }) : t("{name} up {pct}. Is that on purpose?", { name, pct });
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
