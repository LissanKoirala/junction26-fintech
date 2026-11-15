// EXTENSION POINTS owned by the ML-UI agent: the two Today slots and the chat card renderers for the ML kinds.
// Kept light on purpose (Today is on the first load): the chat cards are lazy chunks.
import { lazy, Suspense, type ComponentType } from "react";
import { BellRing, ChevronRight, MessageCircleQuestion, PartyPopper } from "lucide-react";
import type { CustomerData } from "@shared/types";
import type { SafeToSpend } from "@shared/engine";
import type { CardSpec } from "@shared/chat";
import { Button, IconCircle, STROKE, cx } from "@/ui/kit";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { dateShort, money, pct, pctSigned, dateDM } from "@/lib/format";
import { isReady, useMl } from "./data";
import { chanceWords, habitGood, habitName, openYou, topHabit } from "./words";

export interface TodaySlotProps {
  customer: CustomerData;
  safe: SafeToSpend | null; // null if the engine could not compute it
  /** Open the chat with a question (e.g. "Why might I go below zero?"). */
  ask: (question: string) => void;
}

const KIND: Record<string, string> = { housing: "Rent", investment: "Investing", goal: "Goal saving" };

/** Shown right under the safe-to-spend hero on Today, only when it is worth the space. */
export function EarlyWarningSlot({ customer, ask }: TodaySlotProps) {
  const rl = useMl("risk", customer.id);
  const fl = useMl("forecast", customer.id);
  const r = isReady(rl) ? rl.data : null;
  const f = isReady(fl) ? fl.data : null;
  const riskOn = !!r && (r.level === "elevated" || r.level === "high");
  const fcOn = !!f && f.overdraftProbToPayday >= 0.2;
  if (!riskOn && !fcOn) return null;
  const p = riskOn ? r!.probability : f!.overdraftProbToPayday;
  const horizon = riskOn ? `in the next ${r!.horizonDays} days` : `before payday on ${dateShort(f!.nextPayday.date)}`;
  let reason: string | null = null;
  const up = r?.drivers.find((d) => d.direction === "raises");
  if (riskOn && up) reason = up.label.replace(/\s/g, "").includes(up.display.replace(/\s/g, "")) ? up.label : `${up.label}: ${up.display}`;
  else if (f) {
    const big = f.fixedEvents
      .filter((e) => e.amount < 0 && e.date < f.nextPayday.date)
      .sort((a, b) => a.amount - b.amount)[0];
    if (big) reason = `${KIND[big.kind] ?? "A fixed payment"} of ${money(-big.amount, { whole: true })} is due ${dateShort(big.date)}, before your pay arrives.`;
  }
  return (
    <section className="rounded-app-card bg-card p-4 shadow-app-card" aria-label="Early warning">
      <div className="flex items-start gap-3">
        <IconCircle icon={BellRing} color="#CF8300" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Early warning</p>
          <p className="text-base font-bold leading-snug text-ink">
            {chanceWords(p).replace(/^./, (s) => s.toUpperCase())} chance of dipping below zero {horizon}
            <span className="tnum ml-1 text-sm font-semibold text-ink-muted">({pct(p)})</span>
          </p>
          {reason && <p className="mt-1 text-sm text-ink-strong">{reason}</p>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
        <Button size="sm" variant="tonal" onClick={() => ask("Why might I go below zero before payday?")}>What can I do?</Button>
        <button type="button" onClick={() => openYou(riskOn ? "risk" : "forecast")} className="inline-flex min-h-9 items-center gap-0.5 text-sm font-semibold text-green-700">
          See the forecast <ChevronRight size={16} strokeWidth={STROKE} aria-hidden />
        </button>
      </div>
    </section>
  );
}

/** One chip with the single most notable habit. */
export function HabitChipSlot({ customer }: TodaySlotProps) {
  const hl = useMl("habits", customer.id);
  if (!isReady(hl)) return null;
  const h = topHabit(hl.data.habits);
  if (!h) return null;
  const good = habitGood(h);
  const Icon = good ? PartyPopper : MessageCircleQuestion;
  const text = good
    ? `${h.status === "new_habit" ? "New habit" : "Habit forming"}: ${habitName(h).toLowerCase()} ${h.direction} ${pctSigned(h.changePct).replace(/^[+−]/, "")} since ${dateDM(h.since)}`
    : `${habitName(h)} ${h.direction} ${pctSigned(h.changePct).replace(/^[+−]/, "")} since ${dateDM(h.since)}. On purpose?`;
  return (
    <button
      type="button"
      onClick={() => openYou("habits")}
      className={cx(
        "flex min-h-11 w-full items-center gap-2.5 rounded-pill border bg-card px-3 py-2 text-left text-sm shadow-app-card transition-transform active:scale-[0.99]",
        good ? "border-green-200" : "border-warning-border/40",
      )}
    >
      <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-pill", good ? "bg-green-150 text-green-900" : "bg-warning-bg text-warning")}>
        <Icon size={16} strokeWidth={STROKE} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 leading-snug text-ink">{text}</span>
      <ChevronRight size={16} strokeWidth={STROKE} className="shrink-0 text-icon-muted" aria-hidden />
    </button>
  );
}

// ------------------------------------------------------------------ chat cards (lazy)
type AnyCard = ComponentType<{ card: CardSpec }>;
function lazyCard(name: string): AnyCard {
  const L = lazy(() => import("./chatCards").then((m) => ({ default: (m as unknown as Record<string, AnyCard>)[name] })));
  return function MlChatCard({ card }: { card: CardSpec }) {
    return (
      <ErrorBoundary label="This card">
        <Suspense fallback={<div className="skeleton h-48 w-full rounded-app-card" aria-busy="true" aria-label="Loading" />}>
          <L card={card} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

/** Chat card renderers for the ML kinds. Merged into app/src/features/chat/cards/registry.tsx. */
export const ML_CARD_RENDERERS: Partial<Record<CardSpec["kind"], ComponentType<{ card: CardSpec }>>> = {
  forecast: lazyCard("ForecastChatCard"),
  risk: lazyCard("RiskChatCard"),
  twins: lazyCard("TwinsChatCard"),
  tribe: lazyCard("TribeChatCard"),
  anomalies: lazyCard("AnomaliesChatCard"),
  habits: lazyCard("HabitsChatCard"),
  home: lazyCard("HomeChatCard"),
  futures: lazyCard("FuturesChatCard"),
};
