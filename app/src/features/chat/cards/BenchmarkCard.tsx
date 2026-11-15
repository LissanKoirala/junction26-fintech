import { UsersRound } from "lucide-react";
import { CardFrame } from "@/ui/chat";
import { HBars } from "@/ui/charts";
import { fmtUnit, type CardOf } from "./util";

export function BenchmarkCard({ card }: { card: CardOf<"benchmark"> }) {
  const fmt = (v: number) => fmtUnit(v, card.unit, true);
  const items = [{ key: "you", label: "You", value: card.you }, ...card.peers.map((p, i) => ({ key: "p" + i, label: p.label, value: p.value }))];
  const sources = [...new Set(card.peers.map((p) => p.source))];
  return (
    <CardFrame icon={UsersRound} title={card.title ?? card.metric} explain={card.explain}>
      {card.title && <p className="-mt-1 mb-2 text-sm text-ink-muted">{card.metric}</p>}
      <HBars items={items} format={fmt} highlightKey="you" />
      {card.percentile != null && (
        <p className="mt-3 text-sm text-ink">
          You spend more than about <span className="font-semibold">{Math.round(card.percentile)} %</span> of customers your age in this bank.
        </p>
      )}
      <p className="mt-2 text-xs text-ink-muted">{card.note}</p>
      {sources.length > 0 && <p className="mt-1 text-xs text-ink-muted">Source: {sources.join("; ")}</p>}
    </CardFrame>
  );
}
