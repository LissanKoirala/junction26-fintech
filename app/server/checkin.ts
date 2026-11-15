// GET /api/checkin/:id[?refresh=1]: the weekly coaching check-in (shared/checkin.ts). Numbers and cards come from
// the engine and ML files; the language model only writes the wording (structured output). Cached on disk per
// customer and asOf so the demo is instant and stable.
import type { Hono } from "hono";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { engine } from "../shared/engine";
import { addDays, basketLabel, r2 } from "../shared/engine/util";
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
import { tr, type Lang } from "../shared/i18n";

const CACHE_DIR = path.join(DATA_DIR, "cache", "checkin");
const VERSION = 2; // v2: the two week figures got separate names ("all spending in a typical week" / "usual week of everyday extras")

interface Draft {
  facts: Record<string, unknown>;
  slides: (Omit<CheckInSlide, "eyebrow" | "title" | "body"> & { fallback: { eyebrow: string; title: string; body: string }; facts: Record<string, unknown> })[];
  challenge: Challenge;
  headlineFallback: string;
}

async function buildDraft(c: CustomerData, lang: Lang = "en"): Promise<Draft> {
  let seq = 0;
  const T = tr(lang);
  const t = T.t;
  const dn = (iso: string) => dayName(iso, lang);
  const bl = (k: Parameters<typeof basketLabel>[0]) => basketLabel(k, lang);
  const ctx: ToolCtx = { c, opts: { lang }, lang, tr: T, newCardId: () => `k${++seq}` };
  const w = engine.getWeekSummary(c, -1, { lang });
  const week = { from: w.from, to: w.to, label: `${dn(w.from)} – ${dn(w.to)}` };
  const b = engine.getBaskets(c, week, { lang });
  const s = engine.getSafeToSpend(c, { lang });
  const st = engine.getSpenderStats(c, { lang });
  const slides: Draft["slides"] = [];
  const src = t(SOURCE);

  // 1. recap
  const recapCard: CardSpec = {
    id: "recap",
    kind: "stat",
    title: t("Your week · {week}", { week: week.label }),
    label: t("Spent last week"),
    value: w.spending,
    unit: "eur",
    comparison: w.vsTypicalWeekPct == null ? undefined : { label: t("vs all spending in a typical week"), deltaAbs: r2(w.spending - (w.typicalSpending ?? 0)), deltaPct: w.vsTypicalWeekPct, good: w.vsTypicalWeekPct <= 0 },
    caption: w.smallPurchases.count ? T.tn("{n} small purchase ({v})", "{n} small purchases ({v})", w.smallPurchases.count, { v: eur(w.smallPurchases.total) }) : undefined,
    explain: { tool: "engine.getWeekSummary", filters: [t("All spending in a typical week = median of the previous 12 weeks")], period: week, source: src },
  };
  const recapFacts = { spent: w.spending, all_spending_in_a_typical_week: w.typicalSpending, vs_typical_pct: w.vsTypicalWeekPct, top_categories: w.topCategories.slice(0, 3).map((k) => ({ label: k.label, total: k.total })), small_purchases: w.smallPurchases, biggest: w.biggest ? { category: w.biggest.category, amount: -w.biggest.amount, date: w.biggest.date } : null, income: w.income, lowest_balance: w.lowestBalance };
  slides.push({
    id: "recap",
    kind: "recap",
    card: recapCard,
    facts: recapFacts,
    fallback: {
      eyebrow: t("Your week"),
      title: t("You spent {v} last week", { v: eur0(w.spending) }),
      body: w.vsTypicalWeekPct == null ? t("Here is how your week looked.") : w.vsTypicalWeekPct <= 0 ? t("That is less than all your spending in a typical week. Nice.") : t("That is a bit more than all your spending in a typical week."),
    },
  });
  // 2. baskets
  slides.push({
    id: "baskets",
    kind: "baskets",
    card: { id: "baskets", kind: "baskets", title: t("Your three baskets · {week}", { week: week.label }), data: b, explain: { tool: "engine.getBaskets", filters: [t("Basket rules from domain.json")], period: week, source: src } },
    facts: { baskets: b.baskets.map((x) => ({ name: x.label, total: x.total, top: x.categories[0]?.label ?? null })) },
    fallback: { eyebrow: t("Three baskets"), title: `${bl("everyday")}: ${eur0(b.baskets[2].total)}`, body: `${bl("must_regular")} ${eur0(b.baskets[0].total)}, ${bl("must_irregular")} ${eur0(b.baskets[1].total)}.` },
  });
  // 3. unusual or habit (ML, optional)
  const [anom, habits] = await Promise.all([loadMl<MlAnomalies>("anomalies", c.id), loadMl<MlHabits>("habits", c.id)]);
  const habit = habits?.habits?.[0];
  const odd = anom?.transactions?.find((x) => x.date >= addDays(c.asOf, -30)) ?? anom?.transactions?.[0];
  if (habit) {
    slides.push({
      id: "habit",
      kind: "habit",
      card: { id: "habit", kind: "habits", title: t("A habit Vara noticed"), data: habits!, explain: { tool: "ML: habit detector", filters: [], source: src } },
      facts: { category: T.tData(habit.category), direction: habit.direction, status: habit.status, since: habit.since, before_per_week: habit.before, after_per_week: habit.after, change_pct: habit.changePct, monthly_impact: habit.monthlyImpact },
      fallback: {
        eyebrow: t("A habit"),
        title: habit.direction === "down" ? t("{category}: down since {day}", { category: T.tData(habit.category), day: dn(habit.since) }) : t("{category}: up since {day}", { category: T.tData(habit.category), day: dn(habit.since) }),
        body: habit.direction === "down" ? t("A change that is holding. Keep it going.") : t("Something has crept up lately. Worth a look."),
      },
    });
  } else if (odd) {
    slides.push({
      id: "unusual",
      kind: "unusual",
      card: { id: "unusual", kind: "anomalies", title: t("Unusual for you"), data: anom!, explain: { tool: "ML: anomaly detection", filters: [], source: src } },
      facts: { date: odd.date, category: T.tData(odd.category), amount: Math.abs(odd.amount), reasons: odd.reasons.map((r) => T.tData(r)) },
      fallback: {
        eyebrow: t("Unusual for you"),
        title: t("{category} on {day}", { category: T.tData(odd.category), day: dn(odd.date) }),
        body: odd.reasons.map((r) => T.tData(r)).join("; ") || t("This one stood out from your usual pattern."),
      },
    });
  }
  // 4. lesson, chosen from the customer's own numbers
  const concept = st.overdraftDaysLast12m > 10 ? "buffer" : st.paydayBurnPct > 28 ? "payday_burn" : st.smallPurchasesPerMonth >= 10 ? "small_purchases_add_up" : s.upcoming.some((u) => u.kind === "housing") ? "safe_to_spend" : "pay_yourself_first";
  const lesson = await runTool(ctx, "explain_concept", { concept });
  const lessonCard = lesson.cards[0] as Extract<CardSpec, { kind: "concept" }>;
  slides.push({ id: "lesson", kind: "lesson", card: lessonCard, facts: { concept: lessonCard.term, definition: lessonCard.definition, example: lessonCard.example }, fallback: { eyebrow: t("One thing to learn"), title: lessonCard.term, body: lessonCard.example } });
  // 5. outlook to payday
  const housing = s.upcoming.find((u) => u.kind === "housing");
  slides.push({
    id: "outlook",
    kind: "outlook",
    card: { id: "outlook", kind: "safe_to_spend", title: t("Until payday"), data: s, explain: { tool: "engine.getSafeToSpend", filters: s.upcoming.map((u) => `${u.label}: ${u.basis}`), formula: t("(balance − musts still coming) ÷ weeks until payday"), source: src } },
    facts: { balance: s.balance, next_payday: s.nextPayday.estimated ? null : s.nextPayday.date, days_to_payday: s.nextPayday.estimated ? null : s.nextPayday.daysAway, income_irregular: s.nextPayday.estimated ?? false, rent_due: housing?.amount ?? null, reserved_total: s.reservedTotal, free_until_payday: s.freeUntilPayday, safe_per_week: s.safePerWeek, status: s.status },
    fallback: {
      eyebrow: t("Looking ahead"),
      title: t("About {v} a week is safe until payday", { v: eur0(s.safePerWeek) }),
      body: t("{reserved} of your {balance} is already promised to musts before {day}.", { reserved: eur(s.reservedTotal), balance: eur(s.balance), day: dn(s.nextPayday.date) }),
    },
  });
  // 6. challenge with an engine-derived target
  const baseline = s.week.typicalSpend ?? 0;
  let target = Math.max(10, Math.round((baseline * 0.85) / 5) * 5);
  if (s.safePerWeek > 0 && s.safePerWeek < target) target = Math.max(5, Math.floor(s.safePerWeek / 5) * 5);
  const chWeek = { from: addDays(c.asOf, 1), to: addDays(c.asOf, 7), label: `${dn(addDays(c.asOf, 1))} – ${dn(addDays(c.asOf, 7))}` };
  const potentialMonthlySaving = r2(Math.max(0, baseline - target) * 4.345);
  const challenge: Challenge = {
    id: `everyday-${chWeek.from}`,
    title: t("Keep {basket} under {v} this week", { basket: bl("everyday").toLowerCase(), v: eur0(target) }),
    why: t("Your usual week of everyday extras is about {v}.", { v: eur0(baseline) }),
    metric: { kind: "everyday_spend", unit: "eur" },
    target,
    baseline: r2(baseline),
    week: chWeek,
    potentialMonthlySaving,
  };
  slides.push({
    id: "challenge",
    kind: "challenge",
    card: { id: "challenge", kind: "action", action: "start_challenge", label: t("Start the challenge"), description: challenge.title, payload: { challengeId: challenge.id, metric: "everyday_spend", target, baseline: challenge.baseline }, explain: { tool: "engine", filters: [t("Target = 85% of your typical week of everyday extras (last 3 full months), capped at safe-to-spend")], source: src } },
    facts: { target, usual_week_of_everyday_extras: r2(baseline), potential_monthly_saving: potentialMonthlySaving, week: chWeek },
    fallback: { eyebrow: t("Your challenge"), title: challenge.title, body: t("If it sticks, that frees about {v} a month.", { v: eur0(potentialMonthlySaving) }) },
  });
  const persona = PERSONAS.find((p) => p.id === c.id);
  return {
    facts: { today: c.asOf, alias: persona?.alias ?? null, age: c.age, week, salary_sweep: c.hasSalarySweep, savings_rate_pct: st.savingsRatePct },
    slides,
    challenge,
    headlineFallback: w.vsTypicalWeekPct != null && w.vsTypicalWeekPct <= 0 ? t("A calmer week than usual") : t("Your week, in one minute"),
  };
}

const WordingSchema = z.object({
  headline: z.string(),
  slides: z.array(z.object({ id: z.string(), eyebrow: z.string(), title: z.string(), body: z.string() })),
  challengeTitle: z.string(),
  challengeWhy: z.string(),
});

const wordingSystem = (lang: Lang) => `You write the weekly check-in of Vara, a warm money coach for young adults in S-Pankki's S-mobiili app (a Junction 2026 concept). It is shown as swipeable full-screen story slides in ${lang === "fi" ? "Finnish" : "English"}.
${lang === "fi" ? 'Write everything in natural, informal Finnish (sinä), calm and never shaming. Terms: käyttövara (safe to spend), palkkapäivä, saldo, puskuri, säästötavoite, viikkokatsaus. Write amounts the Finnish way, like "224 €" or "1 743,50 €".\n' : ""}Rules: plain, warm, concrete, never moralising; praise small steps. Each slide: eyebrow (1-3 words), title (one short sentence, at most 70 characters), body (1-3 short sentences, at most 220 characters). Use the three basket names exactly: "${basketLabel("must_regular", lang)}", "${basketLabel("must_irregular", lang)}", "${basketLabel("everyday", lang)}".
Numbers: use only numbers that appear in the facts, copied exactly or rounded to whole euros (written like "224 €"). Never compute new numbers (no sums, differences or percentages of your own). No merchant names exist; do not invent any. The lesson slide teaches the concept using the given example. The challenge title must contain the target amount. Two different week figures: the fact all_spending_in_a_typical_week (everything spent, rent included) and the fact usual_week_of_everyday_extras (everyday extras only). In the text call them ${lang === "fi" ? '"kaikki kulusi tyypillisenä viikkona" and "tavallinen viikkosi arjen ekstroihin"' : '"all your spending in a typical week" and "your usual week of everyday extras"'}; never write the field names, and never call either just "a typical week". Say "most" (Finnish "suurin osa") only for a share above half of the total; otherwise say it was the largest part ("eniten meni"). Keep one slide per given id, same order.`;

async function wordIt(d: Draft, lang: Lang = "en"): Promise<{ headline: string; slides: Map<string, { eyebrow: string; title: string; body: string }>; challengeTitle?: string; challengeWhy?: string } | null> {
  if (!takeDailyBudget()) return null;
  const input = { customer: d.facts, slides: d.slides.map((s) => ({ id: s.id, kind: s.kind, facts: s.facts, example_wording: s.fallback })), challenge: { target: d.challenge.target, usual_week_of_everyday_extras: d.challenge.baseline, potential_monthly_saving: d.challenge.potentialMonthlySaving } };
  const res = await llm().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: wordingSystem(lang),
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

export async function generateCheckIn(c: CustomerData, lang: Lang = "en"): Promise<CheckIn & { generatedBy: string }> {
  const d = await buildDraft(c, lang);
  let words: Awaited<ReturnType<typeof wordIt>> = null;
  try {
    words = await wordIt(d, lang);
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

export const cacheFile = (id: string, asOf: string, lang: Lang = "en") =>
  path.join(CACHE_DIR, `${id}-${asOf}${lang === "en" ? "" : `-${lang}`}-v${VERSION}.json`);

export function registerCheckinRoutes(app: Hono) {
  app.get("/api/checkin/:id", async (c) => {
    const id = c.req.param("id");
    if (!isCustomerId(id)) return c.json({ error: "bad customer id" }, 400);
    const customer = await loadCustomer<CustomerData>(id);
    if (!customer) return c.json({ error: "not found" }, 404);
    const lang: Lang = c.req.query("lang") === "fi" ? "fi" : "en";
    // English keeps its old file name so existing caches stay valid
    const file = cacheFile(id, customer.asOf, lang);
    const key = `${id}-${lang}`;
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
    let p = inflight.get(key);
    if (!p) {
      p = generateCheckIn(customer, lang).then(async (doc) => {
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(file, JSON.stringify(doc));
        return doc;
      });
      inflight.set(key, p);
      p.finally(() => inflight.delete(key)).catch(() => {});
    }
    try {
      return c.json(await p);
    } catch (err) {
      console.error("[checkin] failed", err);
      return c.json({ error: "check-in could not be generated" }, 500);
    }
  });
}
