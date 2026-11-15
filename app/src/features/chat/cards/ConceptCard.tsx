import { Lightbulb } from "lucide-react";
import { CardFrame } from "@/ui/chat";
import { t } from "@/lib/i18n";
import type { CardOf } from "./util";

/** Plain-language explainer. One idea says it better than a chart here. */
export function ConceptCard({ card }: { card: CardOf<"concept"> }) {
  return (
    <CardFrame icon={Lightbulb} eyebrow={card.title ?? t("Money word")} title={card.term} explain={card.explain}>
      <p className="text-base text-ink">{card.definition}</p>
      <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-ink-strong">
        <span className="font-semibold">{t("With your numbers:")} </span>
        {card.example}
      </p>
    </CardFrame>
  );
}
