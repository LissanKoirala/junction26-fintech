import { useState } from "react";
import { Calculator, Wallet } from "lucide-react";
import { CardFrame, ChartCaption, LegendRow, StatValue } from "@/ui/chat";
import { StackedBar } from "@/ui/charts";
import { Badge, Button, Progress } from "@/ui/kit";
import { money } from "@/lib/format";
import { t } from "@/lib/i18n";
import { StepsSheet } from "@/features/today/SafeHero";
import { safeView, statusWording } from "@/features/vara/useVaraData";
import type { CardOf } from "./util";

// bank theme tokens: green-900 for what is spoken for, green-500 for what is free
const RESERVED = "var(--color-green-900)";
const FREE = "var(--color-green-500)";

export function SafeToSpendCard({ card }: { card: CardOf<"safe_to_spend"> }) {
  const s = card.data;
  const [open, setOpen] = useState(false);
  const w = statusWording(s);
  const v = safeView(s);
  const free = Math.max(0, s.freeUntilPayday);
  const reservedShown = Math.min(s.reservedTotal, Math.max(0, s.balance));
  const fmt = (x: number) => money(x, { whole: true });
  return (
    <CardFrame icon={Wallet} title={v.title} right={<span className="whitespace-nowrap"><Badge tone={w.tone}>{w.label}</Badge></span>} explain={card.explain}>
      <StatValue value={v.figure != null ? fmt(v.figure) : t("Plenty of room")} sub={v.support} />
      {s.cravePot ? <p className="tnum mt-1 text-sm text-ink-muted">{t("After the {amount} held in your Crave pot.", { amount: money(s.cravePot) })}</p> : null}

      <ChartCaption>{t("Your balance of {amount}", { amount: fmt(s.balance) })}</ChartCaption>
      {s.balance > 0 ? (
        <StackedBar
          size="tall"
          label={t("How your balance splits")}
          format={fmt}
          parts={[
            { key: "reserved", label: t("Set aside for musts"), value: reservedShown, color: RESERVED },
            { key: "free", label: t("Free until payday"), value: free, color: FREE },
          ]}
        />
      ) : null}
      <ul className="mt-2 flex flex-col gap-1.5">
        <LegendRow color={RESERVED} label={t("Set aside for musts before payday")} value={fmt(s.reservedTotal)} />
        <LegendRow color={FREE} label={t("Free until payday")} value={fmt(s.freeUntilPayday)} />
      </ul>

      <ChartCaption>{t("This week")}</ChartCaption>
      <Progress value={v.bar.value} label={v.bar.label} tone={s.status === "tight" || s.status === "over" ? "warning" : "accent"} />
      <div className="tnum mt-1.5 flex justify-between gap-2 text-sm text-ink-muted">
        <span>{v.bar.left}</span>
        <span className="font-semibold text-ink">{v.bar.right}</span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        {v.payday}
        {v.late && <span className="mt-1 block">{v.late}</span>}
      </p>

      <Button className="mt-3" variant="tonal" size="sm" icon={Calculator} onClick={() => setOpen(true)}>{t("Why this number?")}</Button>
      <StepsSheet s={s} open={open} onClose={() => setOpen(false)} />
    </CardFrame>
  );
}
