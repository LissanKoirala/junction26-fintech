// GET /api/checkin/:id[?refresh=1]: the weekly coaching check-in (shared/checkin.ts). Numbers and cards come from
// the engine and ML files; the language model only writes the wording (structured output). Cached on disk per
// customer and asOf so the demo is instant and stable.
import type { Hono } from "hono";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { engine } from "../shared/engine";
import { addDays, basketLabel, r2, DOMAIN } from "../shared/engine/util";
import type { CardSpec } from "../shared/chat";
import type { CheckIn, CheckInSlide, Challenge } from "../shared/checkin";
import type { CustomerData } from "../shared/types";
import type { MlAnomalies, MlHabits } from "../shared/ml/typesA";
import { DATA_DIR, isCustomerId, loadCustomer, loadMl } from "./data";
import { EFFORT, MODEL, clientIp, llm, rateLimit, takeDailyBudget } from "./llm";
import { runTool, SOURCE, type ToolCtx } from "./chat/tools";
import { checkProse } from "./chat/guard";
import { eur, eur0, dayName } from "./chat/format";
import { PERSONAS } from "../shared/personas";

const CACHE_DIR = path.join(DATA_DIR, "cache", "checkin");
const VERSION = 1;

interface Draft {
  facts: Record<string, unknown>;
  slides: (Omit<CheckInSlide, "eyebrow" | "title" | "body"> & { fallback: { eyebrow: string; title: string; body: string }; facts: Record<string, unknown> })[];
  challenge: Challenge;
  headlineFallback: string;
}

async function buildDraft(c: CustomerData): Promise<Draft> {
  let seq = 0;
  const ctx: ToolCtx = { c, opts: {}, newCardId: () => `k${++seq}` };
  const w = engine.getWeekSummary(c, -1);
  const week = { from: w.from, to: w.to, label: `${dayName(w.from)} – ${dayName(w.to)}` };
  const b = engine.getBaskets(c, week);
  const s = engine.getSafeToSpend(c);
  const st = engine.getSpenderStats(c);
  const slides: Draft["slides"] = [];

  // 1. recap
  const recapCard: CardSpec = {
    id: "recap",
    kind: "stat",
    title: `Your week · ${week.label}`,
    label: "Spent last week",
    value: w.spending,
    unit: "eur",
    comparison: w.vsTypicalWeekPct == null ? undefined : { label: "vs a typical week", deltaAbs: r2(w.spending - (w.typicalSpending ?? 0)), deltaPct: w.vsTypicalWeekPct, good: w.vsTypicalWeekPct <= 0 },
    caption: w.smallPurchases.count ? `${w.smallPurchases.count} small purchases (${eur(w.smallPurchases.total)})` : undefined,
    explain: { tool: "engine.getWeekSummary", filters: ["Typical week = median of the previous 12 weeks"], period: week, source: SOURCE },
  };
  const recapFacts = { spent: w.spending, typical_week: w.typicalSpending, vs_typical_pct: w.vsTypicalWeekPct, top_categories: w.topCategories.slice(0, 3).map((k) => ({ label: k.label, total: k.total })), small_purchases: w.smallPurchases, biggest: w.biggest ? { category: w.biggest.category, amount: -w.biggest.amount, date: w.biggest.date } : null, income: w.income, lowest_balance: w.lowestBalance };
  slides.push({
    id: "recap",
    kind: "recap",
    card: recapCard,
    facts: recapFacts,
    fallback: {
      eyebrow: "Your week",
      title: `You spent ${eur0(w.spending)} last week`,
      body: w.vsTypicalWeekPct == null ? "Here is how your week looked." : w.vsTypicalWeekPct <= 0 ? "That is less than a typical week for you. Nice." : "That is a bit more than a typical week for you.",
    },
  });
  // 2. baskets
  slides.push({
    id: "baskets",
    kind: "baskets",
    card: { id: "baskets", kind: "baskets", title: `Your three baskets · ${week.label}`, data: b, explain: { tool: "engine.getBaskets", filters: ["Basket rules from domain.json"], period: week, source: SOURCE } },
    facts: { baskets: b.baskets.map((x) => ({ name: x.label, total: x.total, top: x.categories[0]?.label ?? null })) },
    fallback: { eyebrow: "Three baskets", title: `${basketLabel("everyday")}: ${eur0(b.baskets[2].total)}`, body: `${basketLabel("must_regular")} ${eur0(b.baskets[0].total)}, ${basketLabel("must_irregular")} ${eur0(b.baskets[1].total)}.` },
  });
  // 3. unusual or habit (ML, optional)
  const [anom, habits] = await Promise.all([loadMl<MlAnomalies>("anomalies", c.id), loadMl<MlHabits>("habits", c.id)]);
  const habit = habits?.habits?.[0];
  const odd = anom?.transactions?.find((x) => x.date >= addDays(c.asOf, -30)) ?? anom?.transactions?.[0];
  if (habit) {
    slides.push({
      id: "habit",
      kind: "habit",
      card: { id: "habit", kind: "habits", title: "A habit Vara noticed", data: habits!, explain: { tool: "ML: habit detector", filters: [], source: SOURCE } },
      facts: { category: habit.category, direction: habit.direction, status: habit.status, since: habit.since, before_per_week: habit.before, after_per_week: habit.after, change_pct: habit.changePct, monthly_impact: habit.monthlyImpact },
      fallback: { eyebrow: "A habit", title: `${habit.category}: ${habit.direction === "down" ? "down" : "up"} since ${dayName(habit.since)}`, body: habit.direction === "down" ? "A change that is holding. Keep it going." : "Something has crept up lately. Worth a look." },
    });
  } else if (odd) {
    slides.push({
      id: "unusual",
      kind: "unusual",
      card: { id: "unusual", kind: "anomalies", title: "Unusual for you", data: anom!, explain: { tool: "ML: anomaly detection", filters: [], source: SOURCE } },
      facts: { date: odd.date, category: odd.category, amount: Math.abs(odd.amount), reasons: odd.reasons },
      fallback: { eyebrow: "Unusual for you", title: `${odd.category} on ${dayName(odd.date)}`, body: odd.reasons.join("; ") || "This one stood out from your usual pattern." },
    });
  }
  // 4. lesson, chosen from the customer's own numbers
  const concept = st.overdraftDaysLast12m > 10 ? "buffer" : st.paydayBurnPct > 28 ? "payday_burn" : st.smallPurchasesPerMonth >= 10 ? "small_purchases_add_up" : s.upcoming.some((u) => u.kind === "housing") ? "safe_to_spend" : "pay_yourself_first";
  const lesson = await runTool(ctx, "explain_concept", { concept });
  const lessonCard = lesson.cards[0] as Extract<CardSpec, { kind: "concept" }>;
  slides.push({ id: "lesson", kind: "lesson", card: lessonCard, facts: { concept: lessonCard.term, definition: lessonCard.definition, example: lessonCard.example }, fallback: { eyebrow: "One thing to learn", title: lessonCard.term, body: lessonCard.example } });
  // 5. outlook to payday
  const housing = s.upcoming.find((u) => u.kind === "housing");
  slides.push({
    id: "outlook",
    kind: "outlook",
    card: { id: "outlook", kind: "safe_to_spend", title: "Until payday", data: s, explain: { tool: "engine.getSafeToSpend", filters: s.upcoming.map((u) => `${u.label}: ${u.basis}`), formula: "(balance − musts still coming) ÷ weeks until payday", source: SOURCE } },
    facts: { balance: s.balance, next_payday: s.nextPayday.date, days_to_payday: s.nextPayday.daysAway, rent_due: housing?.amount ?? null, reserved_total: s.reservedTotal, free_until_payday: s.freeUntilPayday, safe_per_week: s.safePerWeek, status: s.status },
    fallback: { eyebrow: "Looking ahead", title: `About ${eur0(s.safePerWeek)} a week is safe until payday`, body: `${eur(s.reservedTotal)} of your ${eur(s.balance)} is already promised to musts before ${dayName(s.nextPayday.date)}.` },
  });
  // 6. challenge with an engine-derived target
  const baseline = s.week.typicalSpend ?? 0;
  let target = Math.max(10, Math.round((baseline * 0.85) / 5) * 5);
  if (s.safePerWeek > 0 && s.safePerWeek < target) target = Math.max(5, Math.floor(s.safePerWeek / 5) * 5);
  const chWeek = { from: addDays(c.asOf, 1), to: addDays(c.asOf, 7), label: `${dayName(addDays(c.asOf, 1))} – ${dayName(addDays(c.asOf, 7))}` };
  const potentialMonthlySaving = r2(Math.max(0, baseline - target) * 4.345);
  const challenge: Challenge = {
    id: `everyday-${chWeek.from}`,
    title: `Keep ${basketLabel("everyday").toLowerCase()} under ${eur0(target)} this week`,
    why: `A typical week for you is about ${eur0(baseline)} of ${basketLabel("everyday").toLowerCase()}.`,
    metric: { kind: "everyday_spend", unit: "eur" },
    target,
    baseline: r2(baseline),
    week: chWeek,
    potentialMonthlySaving,
  };
  slides.push({
    id: "challenge",
    kind: "challenge",
    card: { id: "challenge", kind: "action", action: "start_challenge", label: "Start the challenge", description: challenge.title, payload: { challengeId: challenge.id, metric: "everyday_spend", target, baseline: challenge.baseline }, explain: { tool: "engine", filters: ["Target = 85% of your typical week of everyday extras (last 3 full months), capped at safe-to-spend"], source: SOURCE } },
    facts: { target, typical_week: r2(baseline), potential_monthly_saving: potentialMonthlySaving, week: chWeek },
    fallback: { eyebrow: "Your challenge", title: challenge.title, body: `If it sticks, that frees about ${eur0(potentialMonthlySaving)} a month.` },
  });
  const persona = PERSONAS.find((p) => p.id === c.id);
  return {
    facts: { today: c.asOf, alias: persona?.alias ?? null, age: c.age, week, salary_sweep: c.hasSalarySweep, savings_rate_pct: st.savingsRatePct },
    slides,
    challenge,
    headlineFallback: w.vsTypicalWeekPct != null && w.vsTypicalWeekPct <= 0 ? "A calmer week than usual" : "Your week, in one minute",
  };
}

const WordingSchema = z.object({
  headline: z.string(),
  slides: z.array(z.object({ id: z.string(), eyebrow: z.string(), title: z.string(), body: z.string() })),
  challengeTitle: z.string(),
  challengeWhy: z.string(),
});

const WORDING_SYSTEM = `You write the weekly check-in of Vara, a warm money coach for young adults in S-Pankki's S-mobiili app (a Junction 2026 concept). It is shown as swipeable full-screen story slides in English.
Rules: plain, warm, concrete, never moralising; praise small steps. Each slide: eyebrow (1-3 words), title (one short sentence, at most 70 characters), body (1-3 short sentences, at most 220 characters). Use the three basket names exactly: "${DOMAIN.baskets.must_regular.label}", "${DOMAIN.baskets.must_irregular.label}", "${DOMAIN.baskets.everyday.label}".
Numbers: use only numbers that appear in the facts, copied exactly or rounded to whole euros (written like "224 €"). Never compute new numbers (no sums, differences or percentages of your own). No merchant names exist; do not invent any. The lesson slide teaches the concept using the given example. The challenge title must contain the target amount. Keep one slide per given id, same order.`;

async function wordIt(d: Draft): Promise<{ headline: string; slides: Map<string, { eyebrow: string; title: string; body: string }>; challengeTitle?: string; challengeWhy?: string } | null> {
  if (!takeDailyBudget()) return null;
  const input = { customer: d.facts, slides: d.slides.map((s) => ({ id: s.id, kind: s.kind, facts: s.facts, example_wording: s.fallback })), challenge: { target: d.challenge.target, typical_week: d.challenge.baseline, potential_monthly_saving: d.challenge.potentialMonthlySaving } };
  const res = await llm().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: WORDING_SYSTEM,
    messages: [{ role: "user", content: `Write the check-in from these facts:\n${JSON.stringify(input)}` }],
    output_config: { effort: EFFORT, format: zodOutputFormat(WordingSchema) },
  });
  const out = res.parsed_output;
  if (!out) return null;
  // number guard: drop any wording whose numbers are not in the facts
  const sources = [input, d.facts];
  const slides = new Map<string, { eyebrow: string; title: string; body: string }>();
  for (const s of out.slides) {
    const chk = checkProse(`${s.title} ${s.body}`, sources);
    if (chk.verified) slides.set(s.id, { eyebrow: s.eyebrow.slice(0, 40), title: s.title.slice(0, 120), body: s.body.slice(0, 400) });
    else console.warn(`[checkin] slide ${s.id} wording dropped, unverified: ${chk.unverified.join(", ")}`);
  }
  const chTitleOk = checkProse(out.challengeTitle + " " + out.challengeWhy, sources).verified;
  return { headline: checkProse(out.headline, sources).verified ? out.headline : d.headlineFallback, slides, challengeTitle: chTitleOk ? out.challengeTitle : undefined, challengeWhy: chTitleOk ? out.challengeWhy : undefined };
}

export async function generateCheckIn(c: CustomerData): Promise<CheckIn & { generatedBy: string }> {
  const d = await buildDraft(c);
  let words: Awaited<ReturnType<typeof wordIt>> = null;
  try {
    words = await wordIt(d);
  } catch (err) {
    console.error("[checkin] wording failed, using templates", (err as Error).message);
  }
  const slides: CheckInSlide[] = d.slides.map((s) => {
    const w = words?.slides.get(s.id) ?? s.fallback;
    return { id: s.id, kind: s.kind, eyebrow: w.eyebrow, title: w.title, body: w.body, card: s.card };
  });
  const challenge = { ...d.challenge, title: words?.challengeTitle ?? d.challenge.title, why: words?.challengeWhy ?? d.challenge.why };
  return {
    customerId: c.id,
    asOf: c.asOf,
    week: (d.facts.week as CheckIn["week"]),
    headline: words?.headline ?? d.headlineFallback,
    slides,
    challenge,
    generatedBy: words ? `${MODEL} (wording) + engine (numbers)` : "templates + engine (language model unavailable)",
  };
}

const inflight = new Map<string, Promise<unknown>>();

export function registerCheckinRoutes(app: Hono) {
  app.get("/api/checkin/:id", async (c) => {
    const id = c.req.param("id");
    if (!isCustomerId(id)) return c.json({ error: "bad customer id" }, 400);
    const customer = await loadCustomer<CustomerData>(id);
    if (!customer) return c.json({ error: "not found" }, 404);
    const file = path.join(CACHE_DIR, `${id}-${customer.asOf}-v${VERSION}.json`);
    const refresh = c.req.query("refresh") === "1";
    if (!refresh) {
      try {
        return c.json(JSON.parse(await readFile(file, "utf8")));
      } catch {
        /* not cached yet */
      }
    }
    const limited = rateLimit(clientIp(c.req.raw.headers));
    if (limited) return c.json({ error: limited }, 429);
    let p = inflight.get(id);
    if (!p) {
      p = generateCheckIn(customer).then(async (doc) => {
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(file, JSON.stringify(doc));
        return doc;
      });
      inflight.set(id, p);
      p.finally(() => inflight.delete(id)).catch(() => {});
    }
    try {
      return c.json(await p);
    } catch (err) {
      console.error("[checkin] failed", err);
      return c.json({ error: "check-in could not be generated" }, 500);
    }
  });
}
