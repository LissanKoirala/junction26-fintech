// Local mock of GET /api/checkin/:id (used with ?mock=1 or until BRAIN's endpoint exists).
// Built entirely from the in-browser engine: every number is a real engine result; only the wording is templated.
import { engine } from "@shared/engine";
import type { CheckIn, CheckInSlide, Challenge } from "@shared/checkin";
import type { CardSpec } from "@shared/chat";
import type { CustomerData } from "@shared/types";
import { basketMeta, BASKETS, domain } from "./domain";
import { addDays, dateDM, money } from "./format";
import { getLang, t } from "@shared/i18n";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const round5 = (v: number) => Math.max(5, Math.round(v / 5) * 5);

export function mockCheckin(c: CustomerData): CheckIn {
  const lang = getLang();
  const last = engine.getWeekSummary(c, -1, { lang });
  const prev = [-2, -3, -4, -5, -6, -7, -8, -9].map((o) => engine.getWeekSummary(c, o, { lang }));
  const typicalEveryday = median(prev.map((w) => w.byBasket.everyday));
  const typicalSmall = median(prev.map((w) => w.smallPurchases.count));
  const week = { from: last.from, to: last.to, label: `${dateDM(last.from)} – ${dateDM(last.to)}` };
  const tool = (name: string, extra: Partial<NonNullable<CardSpec["explain"]>> = {}) => ({ tool: name, filters: [t("week {week}", { week: week.label })], period: week, ...extra });

  const slides: CheckInSlide[] = [];
  const vs = last.vsTypicalWeekPct;
  slides.push({
    id: "recap",
    kind: "recap",
    eyebrow: t("Your week"),
    title: t("You spent {v} last week.", { v: money(last.spending, { whole: true }) }),
    body:
      vs == null
        ? t("That's everything that left your account as spending, from rent to coffees.")
        : Math.abs(vs) < 8
          ? t("That's close to all your spending in a typical week. Steady is good.")
          : vs < 0
            ? t("That's {pct} % less than all your spending in a typical week. Nice work.", { pct: Math.round(-vs) })
            : t("That's {pct} % more than all your spending in a typical week. Let's see where it went.", { pct: Math.round(vs) }),
    card: {
      id: "ci-stat",
      kind: "stat",
      label: t("Spending last week"),
      value: last.spending,
      unit: "eur",
      comparison: vs == null ? undefined : { label: t("vs all spending in a typical week"), deltaPct: vs, good: vs <= 0 },
      explain: tool("engine.getWeekSummary", { formula: t("sum of purchases, bills and rent in the week; typical = median of the 12 weeks before") }),
    },
  });

  slides.push({
    id: "baskets",
    kind: "baskets",
    eyebrow: t("Three baskets"),
    title: `${basketMeta("everyday").label}: ${money(last.byBasket.everyday, { whole: true })}.`,
    body: t("Fixed musts like rent come back every month. Surprise musts can't be planned. Everyday extras, like {example}, are where small changes add up.", { example: basketMeta("everyday").example }),
    card: {
      id: "ci-baskets",
      kind: "breakdown",
      chart: "bars",
      unit: "eur",
      items: BASKETS.map((b) => ({ key: b, label: basketMeta(b).label, value: last.byBasket[b] })),
      total: last.spending,
      period: week,
      explain: tool("engine.getWeekSummary", { filters: [t("week {week}", { week: week.label }), t("grouped by basket")] }),
    },
  });

  if (last.smallPurchases.count > 0) {
    slides.push({
      id: "small",
      kind: "habit",
      eyebrow: t("Small stuff"),
      title: t("{n} purchases under {limit} € added up to {v}.", { n: last.smallPurchases.count, limit: domain.smallPurchaseThreshold, v: money(last.smallPurchases.total, { whole: true }) }),
      body: t("Each one feels like nothing. Together they are a real line in your budget, and the easiest one to nudge."),
    });
  }

  slides.push({
    id: "lesson",
    kind: "lesson",
    eyebrow: t("One thing to learn"),
    title: t("Your balance is not your budget."),
    body: t("Part of what's on your account already belongs to rent and bills before payday. Vara sets that aside first and shows what's really free."),
    card: {
      id: "ci-concept",
      kind: "concept",
      term: t("Safe to spend"),
      definition: t("What's left after the musts due before your next payday, shared across the weeks until then."),
      example: (() => {
        try {
          const s = engine.getSafeToSpend(c, { lang });
          return t("Right now: {balance} on the account, {reserved} set aside for musts, so {safe} a week is safe.", { balance: money(s.balance, { whole: true }), reserved: money(s.reservedTotal, { whole: true }), safe: money(s.safePerWeek, { whole: true }) });
        } catch {
          return t("Balance minus the musts before payday, divided by the weeks until payday.");
        }
      })(),
    },
  });

  // challenge for the current week
  const thisWeek = engine.getWeekSummary(c, 0, { lang });
  const sunday = addDays(thisWeek.from, 6);
  const useSmall = typicalSmall >= 4;
  const target = useSmall ? Math.max(1, Math.floor(typicalSmall * 0.7)) : round5(typicalEveryday * 0.85);
  const perItem = last.smallPurchases.count ? last.smallPurchases.total / last.smallPurchases.count : 5;
  const challenge: Challenge = {
    id: `ch-${thisWeek.from}`,
    title: useSmall
      ? t("Keep purchases under {limit} € to {n} this week", { limit: domain.smallPurchaseThreshold, n: target })
      : t("Keep everyday extras under {v} this week", { v: money(target, { whole: true }) }),
    why: useSmall
      ? t("You usually make about {n} small purchases a week.", { n: Math.round(typicalSmall) })
      : t("Your usual week of everyday extras is about {v}.", { v: money(typicalEveryday, { whole: true }) }),
    metric: useSmall ? { kind: "small_purchases", unit: "count" } : { kind: "everyday_spend", unit: "eur" },
    target,
    baseline: useSmall ? Math.round(typicalSmall) : Math.round(typicalEveryday),
    week: { from: thisWeek.from, to: sunday },
    potentialMonthlySaving: Math.max(0, Math.round(((useSmall ? (typicalSmall - target) * perItem : typicalEveryday - target) * 52) / 12)),
  };
  slides.push({
    id: "challenge",
    kind: "challenge",
    eyebrow: t("This week's challenge"),
    title: challenge.title + ".",
    body: `${challenge.why} ${t("Hitting the target would free about {v} a month.", { v: money(challenge.potentialMonthlySaving, { whole: true }) })}`,
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
