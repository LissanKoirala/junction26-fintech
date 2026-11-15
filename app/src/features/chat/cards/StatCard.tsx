import { CalendarDays, Coins, Hash, Percent, type LucideIcon } from "lucide-react";
import { CardFrame, ChartCaption, DeltaPill, StatValue } from "@/ui/chat";
import { HBars } from "@/ui/charts";
import { money, pctSigned } from "@/lib/format";
import { t } from "@/lib/i18n";
import { fmtUnit, type CardOf } from "./util";

const ICON: Record<CardOf<"stat">["unit"], LucideIcon> = { eur: Coins, pct: Percent, count: Hash, days: CalendarDays };

/** The value being compared against, derived from the deltas the server sent (no new numbers invented). */
function comparisonValue(card: CardOf<"stat">): number | null {
  const c = card.comparison;
  if (!c) return null;
  if (c.deltaAbs != null) return card.value - c.deltaAbs;
  if (c.deltaPct != null && c.deltaPct > -100) return card.value / (1 + c.deltaPct / 100);
  return null;
}

export function StatCard({ card }: { card: CardOf<"stat"> }) {
  const cmp = card.comparison;
  const tone = cmp?.good == null ? "neutral" : cmp.good ? "good" : "bad";
  const deltaText = cmp
    ? [cmp.deltaAbs != null ? (card.unit === "eur" ? money(cmp.deltaAbs, { whole: true, sign: true }) : fmtUnit(cmp.deltaAbs, card.unit)) : null, cmp.deltaPct != null ? pctSigned(cmp.deltaPct) : null]
        .filter(Boolean)
        .join(" · ")
    : "";
  const other = comparisonValue(card);
  // a two-bar comparison only when both sides are real, non-negative amounts and at least one is non-zero
  const showBars = cmp != null && other != null && card.unit !== "pct" && card.value >= 0 && other >= 0 && (card.value > 0 || other > 0);
  // Row name for the comparison bar. The "typical week" comparison gets its own wording: stripping the
  // "vs" prefix would leave Finnish in the wrong case ("tavalliseen viikkoon").
  const typical = cmp ? [t("vs a typical week"), t("vs your typical week"), t("vs all spending in a typical week")].includes(cmp.label) : false;
  const cmpName = !cmp ? "" : typical ? t("All spending in a typical week") : cmp.label.replace(/^(vs\.?|verrattuna:?)\s*/i, "").replace(/\s*\([^)]*\)\s*$/, "");
  return (
    <CardFrame icon={ICON[card.unit] ?? Coins} title={card.title ?? card.label} explain={card.explain}>
      {card.title && <p className="text-sm text-ink-muted">{card.label}</p>}
      <StatValue value={fmtUnit(card.value, card.unit)} />
      {cmp && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          {deltaText && <DeltaPill text={deltaText} tone={tone} />}
          <span>{cmp.label}</span>
        </div>
      )}
      {showBars && (
        <>
          <ChartCaption>{t("Side by side")}</ChartCaption>
          <HBars
            items={[
              { key: "now", label: t("This period"), value: card.value },
              { key: "cmp", label: cmpName || t("Compared with"), value: other! },
            ]}
            format={(v) => fmtUnit(v, card.unit, card.unit === "eur")}
            highlightKey="now"
          />
        </>
      )}
      {card.caption && <p className="mt-3 text-sm text-ink-strong">{card.caption}</p>}
    </CardFrame>
  );
}
