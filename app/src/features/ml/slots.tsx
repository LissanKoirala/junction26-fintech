// EXTENSION POINTS for the ML-UI agent (this file is theirs to replace; keep the export names and props).
// Today renders these in fixed places; return null to render nothing.
import type { ComponentType } from "react";
import type { CustomerData } from "@shared/types";
import type { SafeToSpend } from "@shared/engine";
import type { CardSpec } from "@shared/chat";

export interface TodaySlotProps {
  customer: CustomerData;
  safe: SafeToSpend | null; // null if the engine could not compute it
  /** Open the chat with a question (e.g. "Why might I go below zero?"). */
  ask: (question: string) => void;
}

/** Shown right under the safe-to-spend hero on Today: the early-warning (overdraft risk / forecast) card. */
export function EarlyWarningSlot(_props: TodaySlotProps) {
  return null;
}

/** A small chip/row under the baskets on Today: e.g. "New habit: eating out down 30% since August". */
export function HabitChipSlot(_props: TodaySlotProps) {
  return null;
}

/** Chat card renderers for the ML kinds (forecast, risk, twins, tribe, anomalies, habits, home, futures).
 *  Merged into app/src/features/chat/cards/registry.tsx; kinds missing here use the generic fallback card. */
export const ML_CARD_RENDERERS: Partial<Record<CardSpec["kind"], ComponentType<{ card: CardSpec }>>> = {};
