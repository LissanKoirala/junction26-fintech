import { Sparkles } from "lucide-react";
import type { CardSpec } from "@shared/chat";
import { CardFrame } from "@/ui/chat";
import { Unavailable } from "@/ui/kit";
import { t } from "@/lib/i18n";

/** Fallback for card kinds that have no renderer yet: show the title and a plain note, never raw JSON. */
export function GenericCard({ card }: { card: CardSpec }) {
  return (
    <CardFrame icon={Sparkles} title={card.title ?? t("More from Vara")} explain={card.explain}>
      <Unavailable
        compact
        title={t("This view is coming soon")}
        reason={t("Vara prepared it, but this screen can't draw it yet. Open the You tab for the full picture.")}
      />
    </CardFrame>
  );
}
