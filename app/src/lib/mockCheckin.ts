// Local mock of GET /api/checkin/:id (used with ?mock=1 or until BRAIN's endpoint exists).
// Built entirely from the in-browser engine: every number is a real engine result; only the wording is templated.
import { engine } from "@shared/engine";
import type { CheckIn, CheckInSlide, Challenge } from "@shared/checkin";
import type { CardSpec } from "@shared/chat";
import type { CustomerData } from "@shared/types";
import { basketMeta, BASKETS, domain } from "./domain";
import { addDays, dateDM, money } from "./format";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const round5 = (v: number) => Math.max(5, Math.round(v / 5) * 5);

export function mockCheckin(c: CustomerData): CheckIn {
  const last = engine.getWeekSummary(c, -1);
  const prev = [-2, -3, -4, -5, -6, -7, -8, -9].map((o) => engine.getWeekSummary(c, o));
  const typicalEveryday = median(prev.map((w) => w.byBasket.everyday));
  const typicalSmall = median(prev.map((w) => w.smallPurchases.count));
  const week = { from: last.from, to: last.to, label: `${dateDM(last.from)} – ${dateDM(last.to)}` };
  const tool = (t: string, extra: Partial<NonNullable<CardSpec["explain"]>> = {}) => ({ tool: t, filters: [`week ${week.label}`], period: week, ...extra });

  const slides: CheckInSlide[] = [];
  const vs = last.vsTypicalWeekPct;
  slides.push({
    id: "recap",
    kind: "recap",
    eyebrow: "Your week",
    title: `You spent ${money(last.spending, { whole: true })} last week.`,
    body:
      vs == null
        ? "That's everything that left your account as spending, from rent to coffees."
        : Math.abs(vs) < 8
          ? "That's close to a typical week for you. Steady is good."
          : vs < 0
            ? `That's ${Math.round(-vs)} % less than a typical week for you. Nice work.`
            : `That's ${Math.round(vs)} % more than a typical week for you. Let's see where it went.`,
    card: {
      id: "ci-stat",
      kind: "stat",
      label: "Spending last week",
      value: last.spending,
      unit: "eur",
      comparison: vs == null ? undefined : { label: "vs your typical week", deltaPct: vs, good: vs <= 0 },
      explain: tool("engine.getWeekSummary", { formula: "sum of purchases, bills and rent in the week; typical = median of the 12 weeks before" }),
    },
  });

  slides.push({
    id: "baskets",
    kind: "baskets",
    eyebrow: "Three baskets",
    title: `${basketMeta("everyday").label}: ${money(last.byBasket.everyday, { whole: true })}.`,
    body: `Fixed musts like rent come back every month. Surprise musts can't be planned. Everyday extras, like ${basketMeta("everyday").example}, are where small changes add up.`,
    card: {
      id: "ci-baskets",
      kind: "breakdown",
      chart: "bars",
      unit: "eur",
      items: BASKETS.map((b) => ({ key: b, label: basketMeta(b).label, value: last.byBasket[b] })),
      total: last.spending,
      period: week,
      explain: tool("engine.getWeekSummary", { filters: [`week ${week.label}`, "grouped by basket"] }),
    },
  });

  if (last.smallPurchases.count > 0) {
    slides.push({
      id: "small",
      kind: "habit",
      eyebrow: "Small stuff",
      title: `${last.smallPurchases.count} purchases under ${domain.smallPurchaseThreshold} € added up to ${money(last.smallPurchases.total, { whole: true })}.`,
      body: "Each one feels like nothing. Together they are a real line in your budget, and the easiest one to nudge.",
    });
  }

  slides.push({
    id: "lesson",
    kind: "lesson",
    eyebrow: "One thing to learn",
    title: "Your balance is not your budget.",
    body: "Part of what's on your account already belongs to rent and bills before payday. Vara sets that aside first and shows what's really free.",
    card: {
      id: "ci-concept",
      kind: "concept",
      term: "Safe to spend",
      definition: "What's left after the musts due before your next payday, shared across the weeks until then.",
      example: (() => {
        try {
          const s = engine.getSafeToSpend(c);
          return `Right now: ${money(s.balance, { whole: true })} on the account, ${money(s.reservedTotal, { whole: true })} set aside for musts, so ${money(s.safePerWeek, { whole: true })} a week is safe.`;
        } catch {
          return "Balance minus the musts before payday, divided by the weeks until payday.";
        }
      })(),
    },
  });

  // challenge for the current week
  const thisWeek = engine.getWeekSummary(c, 0);
  const sunday = addDays(thisWeek.from, 6);
  const useSmall = typicalSmall >= 4;
  const target = useSmall ? Math.max(1, Math.floor(typicalSmall * 0.7)) : round5(typicalEveryday * 0.85);
  const perItem = last.smallPurchases.count ? last.smallPurchases.total / last.smallPurchases.count : 5;
  const challenge: Challenge = {
    id: `ch-${thisWeek.from}`,
    title: useSmall
      ? `Keep purchases under ${domain.smallPurchaseThreshold} € to ${target} this week`
      : `Keep everyday extras under ${money(target, { whole: true })} this week`,
    why: useSmall
      ? `You usually make about ${Math.round(typicalSmall)} small purchases a week.`
      : `A typical week of everyday extras for you is about ${money(typicalEveryday, { whole: true })}.`,
    metric: useSmall ? { kind: "small_purchases", unit: "count" } : { kind: "everyday_spend", unit: "eur" },
    target,
    baseline: useSmall ? Math.round(typicalSmall) : Math.round(typicalEveryday),
    week: { from: thisWeek.from, to: sunday },
    potentialMonthlySaving: Math.max(0, Math.round(((useSmall ? (typicalSmall - target) * perItem : typicalEveryday - target) * 52) / 12)),
  };
  slides.push({
    id: "challenge",
    kind: "challenge",
    eyebrow: "This week's challenge",
    title: challenge.title + ".",
    body: `${challenge.why} Hitting the target would free about ${money(challenge.potentialMonthlySaving, { whole: true })} a month.`,
  });

  return {
    customerId: c.id,
    asOf: c.asOf,
    week,
    headline: slides[0].title,
    slides,
    challenge,
  };
}
