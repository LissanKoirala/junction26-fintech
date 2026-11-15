import { ChartColumn, ChartLine, ChartPie } from "lucide-react";
import { CardFrame, LegendRow } from "@/ui/chat";
import { Columns, Donut, HBars, SERIES, TrendLine } from "@/ui/charts";
import { monthAbbr, periodLabel } from "@/lib/format";
import { basketColor, BASKETS } from "@/lib/domain";
import type { Basket } from "@shared/types";
import { t } from "@/lib/i18n";
import { fmtUnit, type CardOf } from "./util";

const isMonthKey = (k: string) => /^\d{4}-\d{2}$/.test(k);

export function BreakdownCard({ card }: { card: CardOf<"breakdown"> }) {
  const fmt = (v: number) => fmtUnit(v, card.unit, card.unit === "eur");
  const colorOf = (key: string, i: number) => (BASKETS.includes(key as Basket) ? basketColor(key as Basket) : SERIES[i % SERIES.length]);
  const total = card.total ?? card.items.reduce((s, i) => s + i.value, 0);
  let body;
  if (card.chart === "donut") {
    const items = card.items.slice(0, 6);
    const parts = items.map((it, i) => ({ key: it.key, label: it.label, value: it.value, color: colorOf(it.key, i) }));
    body = (
      <div className="flex items-center gap-4">
        <Donut parts={parts} format={fmt} size={116} center={<><span className="text-xs text-ink-muted">{t("Total")}</span><span className="tnum text-sm font-bold">{fmt(total)}</span></>} />
        <ul className="flex min-w-0 flex-1 flex-col gap-2">
          {parts.map((p, i) => (
            <LegendRow key={p.key} color={p.color} label={p.label} value={items[i].share != null ? fmtUnit(items[i].share!, "pct") : fmt(p.value)} />
          ))}
        </ul>
      </div>
    );
  } else if (card.chart === "trend") {
    const pts = card.items.map((it) => ({ key: it.key, label: isMonthKey(it.key) ? monthAbbr(it.key) : it.label, value: it.value }));
    body = pts.length <= 12 ? <Columns items={pts} format={fmt} highlightLast /> : <TrendLine points={pts} format={fmt} />;
  } else {
    body = <HBars items={card.items.slice(0, 8)} format={fmt} />;
  }
  const icon = card.chart === "donut" ? ChartPie : card.chart === "trend" ? ChartLine : ChartColumn;
  return (
    <CardFrame icon={icon} title={card.title ?? t("Breakdown")} explain={card.explain}>
      {card.period && <p className="-mt-1 mb-3 text-sm text-ink-muted">{periodLabel(card.period)}</p>}
      {body}
    </CardFrame>
  );
}
