import { Layers } from "lucide-react";
import { CardFrame } from "@/ui/chat";
import { StackedBar } from "@/ui/charts";
import { BasketTag } from "@/ui/hero";
import { TextLink } from "@/ui/kit";
import { basketMeta, basketColor } from "@/lib/domain";
import { money, pct, periodLabel } from "@/lib/format";
import { navigate } from "@/lib/router";
import { t } from "@/lib/i18n";
import type { CardOf } from "./util";

export function BasketsCard({ card }: { card: CardOf<"baskets"> }) {
  const d = card.data;
  const parts = d.baskets.map((b) => ({ key: b.basket, label: basketMeta(b.basket).label, value: b.total, color: basketColor(b.basket) }));
  return (
    <CardFrame icon={Layers} title={card.title ?? t("Your three baskets")} explain={card.explain}>
      <p className="-mt-1 mb-3 text-sm text-ink-muted">
        {periodLabel(d.period)} · {t("{v} spent", { v: money(d.spending, { whole: true }) })}
        {d.income > 0 ? ` · ${t("income {v}", { v: money(d.income, { whole: true }) })}` : ""}
      </p>
      <StackedBar parts={parts} size="tall" label={t("Spending by basket")} format={(v) => money(v, { whole: true })} />
      <ul className="mt-3 flex flex-col gap-2.5">
        {d.baskets.map((b) => (
          <li key={b.basket} className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <BasketTag color={basketColor(b.basket)} label={<span className="font-semibold">{basketMeta(b.basket).label}</span>} />
              <span className="block truncate text-sm text-ink-muted">
                {b.categories.slice(0, 3).map((c) => c.label).join(", ") || basketMeta(b.basket).tagline}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="tnum block font-semibold">{money(b.total, { whole: true })}</span>
              <span className="tnum block text-sm text-ink-muted">{pct(b.share)}</span>
            </span>
          </li>
        ))}
      </ul>
      <TextLink onClick={() => navigate("/flow/baskets")}>{t("Open baskets")}</TextLink>
    </CardFrame>
  );
}
