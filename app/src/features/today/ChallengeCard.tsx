// Accepted weekly challenge as a progress card on Today.
import { Trophy } from "lucide-react";
import { engine } from "@shared/engine";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { actions, usePrefs } from "@/state/store";
import { useEngine } from "@/lib/safeEngine";
import { dateShort, money, num } from "@/lib/format";
import { domain } from "@/lib/domain";
import { Button, Card, CardTitle, IconCircle, Muted, Progress } from "@/ui/kit";

export function ChallengeCard() {
  const c = useCustomer();
  const opts = useEngineOpts();
  const ch = usePrefs().challenge;
  const progress = useEngine(
    c && ch
      ? () => {
          if (ch.week.from > c.asOf) return { value: 0, started: false };
          const period = { from: ch.week.from, to: ch.week.to < c.asOf ? ch.week.to : c.asOf };
          if (ch.metric.kind === "small_purchases") {
            const r = engine.querySpending(c, { period, maxAmount: domain.smallPurchaseThreshold - 0.01, baskets: ["everyday"] }, opts);
            return { value: r.count, started: true };
          }
          const r = engine.querySpending(
            c,
            ch.metric.kind === "category_spend" && ch.metric.category ? { period, categories: [ch.metric.category] } : { period, baskets: ["everyday"] },
            opts,
          );
          return { value: ch.metric.unit === "count" ? r.count : r.total, started: true };
        }
      : null,
    [c, ch, opts],
  );
  if (!ch) return null;
  const fmt = (v: number) => (ch.metric.unit === "eur" ? money(v, { whole: true }) : num(v));
  const p = progress?.ok ? progress.value : null;
  const ratio = p ? p.value / Math.max(1e-9, ch.target) : 0;
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconCircle icon={Trophy} />
        <div className="min-w-0 flex-1">
          <CardTitle>This week's challenge</CardTitle>
          <p className="text-base text-ink">{ch.title}</p>
        </div>
      </div>
      <div className="mt-3">
        {p ? (
          <>
            <Progress value={ratio} label="Challenge progress" tone={ratio > 1 ? "warning" : "accent"} />
            <div className="tnum mt-1.5 flex justify-between text-sm text-ink-muted">
              <span>{p.started ? `${fmt(p.value)} so far` : `Starts ${dateShort(ch.week.from)}`}</span>
              <span>target {fmt(ch.target)} · usual {fmt(ch.baseline)}</span>
            </div>
            <Muted className="mt-2">
              {!p.started
                ? `Worth about ${money(ch.potentialMonthlySaving, { whole: true })} a month if it sticks.`
                : ratio <= 1
                  ? `On track. ${fmt(Math.max(0, ch.target - p.value))} of room left this week.`
                  : "Over the target this time. That's useful to know: next week is a fresh start."}
            </Muted>
          </>
        ) : (
          <Muted>Progress will show here once Vara's calculator is ready.</Muted>
        )}
      </div>
      <div className="mt-2">
        <Button size="sm" variant="ghost" onClick={actions.dropChallenge}>Drop challenge</Button>
      </div>
    </Card>
  );
}
