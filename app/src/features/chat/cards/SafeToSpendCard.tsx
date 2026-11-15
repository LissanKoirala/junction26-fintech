import { useState } from "react";
import { Calculator, Wallet } from "lucide-react";
import { CardFrame, ChartCaption, LegendRow, StatValue } from "@/ui/chat";
import { StackedBar } from "@/ui/charts";
import { Badge, Button, Progress } from "@/ui/kit";
import { dateShort, money } from "@/lib/format";
import { StepsSheet } from "@/features/today/SafeHero";
import { statusWording } from "@/features/vara/useVaraData";
import type { CardOf } from "./util";

// bank theme tokens: green-900 for what is spoken for, green-500 for what is free
const RESERVED = "var(--color-green-900)";
const FREE = "var(--color-green-500)";

export function SafeToSpendCard({ card }: { card: CardOf<"safe_to_spend"> }) {
  const s = card.data;
  const [open, setOpen] = useState(false);
  const w = statusWording(s);
  const room = s.week.spentSoFar + Math.max(0, s.week.remaining);
  const free = Math.max(0, s.freeUntilPayday);
  const reservedShown = Math.min(s.reservedTotal, Math.max(0, s.balance));
  const fmt = (v: number) => money(v, { whole: true });
  return (
    <CardFrame
      icon={Wallet}
      title={card.title ?? "Safe to spend this week"}
      right={<Badge tone={s.status === "comfortable" ? "success" : "warning"}>{w.label}</Badge>}
      explain={card.explain}
    >
      <StatValue value={fmt(s.safePerWeek)} sub={`a week until payday on ${dateShort(s.nextPayday.date)}`} />

      <ChartCaption>Your balance of {fmt(s.balance)}</ChartCaption>
      {s.balance > 0 ? (
        <StackedBar
          size="tall"
          label="How your balance splits"
          format={fmt}
          parts={[
            { key: "reserved", label: "Set aside for musts", value: reservedShown, color: RESERVED },
            { key: "free", label: "Free until payday", value: free, color: FREE },
          ]}
        />
      ) : null}
      <ul className="mt-2 flex flex-col gap-1.5">
        <LegendRow color={RESERVED} label="Set aside for musts before payday" value={fmt(s.reservedTotal)} />
        <LegendRow color={FREE} label="Free until payday" value={fmt(s.freeUntilPayday)} />
      </ul>

      <ChartCaption>This week</ChartCaption>
      <Progress value={room > 0 ? s.week.spentSoFar / room : s.week.spentSoFar > 0 ? 1 : 0} label="Share of this week's room already spent" tone={s.status === "comfortable" ? "accent" : "warning"} />
      <div className="tnum mt-1.5 flex justify-between text-sm text-ink-muted">
        <span>Spent {fmt(s.week.spentSoFar)}</span>
        <span className="font-semibold text-ink">{fmt(Math.max(0, s.week.remaining))} left</span>
      </div>

      <Button className="mt-3" variant="tonal" size="sm" icon={Calculator} onClick={() => setOpen(true)}>Why this number?</Button>
      <StepsSheet s={s} open={open} onClose={() => setOpen(false)} />
    </CardFrame>
  );
}
