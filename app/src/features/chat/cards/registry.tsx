// Card registry: CardSpec.kind -> component. Kinds without a renderer use GenericCard.
// ML kinds come from ML_CARD_RENDERERS in app/src/features/ml/slots.tsx (owned by the ML-UI agent).
import type { ComponentType } from "react";
import type { CardSpec } from "@shared/chat";
import { ML_CARD_RENDERERS } from "@/features/ml/slots";
import { StatCard } from "./StatCard";
import { BreakdownCard } from "./BreakdownCard";
import { TransactionsCard } from "./TransactionsCard";
import { BasketsCard } from "./BasketsCard";
import { SafeToSpendCard } from "./SafeToSpendCard";
import { WhatIfCard } from "./WhatIfCard";
import { BenchmarkCard } from "./BenchmarkCard";
import { ConceptCard } from "./ConceptCard";
import { ActionCard } from "./ActionCard";
import { GenericCard } from "./GenericCard";

type AnyCard = ComponentType<{ card: CardSpec }>;
const as = (c: unknown) => c as AnyCard;

export const CARD_RENDERERS: Partial<Record<CardSpec["kind"], AnyCard>> = {
  stat: as(StatCard),
  breakdown: as(BreakdownCard),
  transactions: as(TransactionsCard),
  baskets: as(BasketsCard),
  safe_to_spend: as(SafeToSpendCard),
  whatif: as(WhatIfCard),
  benchmark: as(BenchmarkCard),
  concept: as(ConceptCard),
  action: as(ActionCard),
  ...ML_CARD_RENDERERS,
};

/** Renders one card (with its "How I got this" disclosure) via the registry, or the generic fallback. */
export function CardRenderer({ card }: { card: CardSpec }) {
  const C = CARD_RENDERERS[card.kind] ?? GenericCard;
  return <C card={card} />;
}
