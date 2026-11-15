import { useState } from "react";
import { Receipt } from "lucide-react";
import { CardFrame } from "@/ui/chat";
import { Button, ListRow } from "@/ui/kit";
import { categoryIcon, categoryLabel, txTitle } from "@/lib/domain";
import { dateShort, money } from "@/lib/format";
import { t, tn } from "@/lib/i18n";
import type { CardOf } from "./util";

export function TransactionsCard({ card }: { card: CardOf<"transactions"> }) {
  const [all, setAll] = useState(false);
  const items = all ? card.items : card.items.slice(0, 5);
  return (
    <CardFrame icon={Receipt} title={card.title ?? t("Transactions")} explain={card.explain}>
      <p className="-mt-1 text-sm text-ink-muted">
        {tn("{n} transaction", "{n} transactions", card.count)} · {money(card.total)}
        {card.items.length < card.count ? ` · ${t("largest {n} shown", { n: card.items.length })}` : ""}
      </p>
      <ul className="mt-1 divide-y divide-line">
        {items.map((tx) => (
          <li key={tx.i}>
            <ListRow
              icon={categoryIcon(tx.category)}
              title={txTitle(tx)}
              subtitle={`${dateShort(tx.date)} · ${tx.time.slice(0, 5)}${txTitle(tx) === categoryLabel(tx.category) ? "" : ` · ${categoryLabel(tx.category)}`}`}
              right={money(tx.amount)}
            />
          </li>
        ))}
      </ul>
      {card.items.length > 5 && (
        <Button size="sm" variant="ghost" onClick={() => setAll((a) => !a)}>
          {all ? t("Show fewer") : t("Show all {n}", { n: card.items.length })}
        </Button>
      )}
      {card.note && <p className="mt-1 text-xs text-ink-muted">{card.note}</p>}
    </CardFrame>
  );
}
