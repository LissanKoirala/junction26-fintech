// Savings goal summary on Today.
import { Target } from "lucide-react";
import { usePrefs } from "@/state/store";
import { dateFi, money, monthsBetween } from "@/lib/format";
import { navigate } from "@/lib/router";
import { Badge, Card, CardTitle, IconCircle, Muted, TextLink } from "@/ui/kit";
import { useCustomer } from "@/state/customer";
import { potTotals } from "@/features/crave/diary";
import { t, tn } from "@/lib/i18n";

export function GoalCard() {
  const g = usePrefs().goal;
  const handed = usePrefs().goalHandedOff;
  const c = useCustomer();
  const pot = potTotals(usePrefs().cravings ?? []).total;
  if (!g) return null;
  const months = c ? Math.max(0, Math.ceil(monthsBetween(c.asOf, g.targetDate))) : null;
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconCircle icon={Target} />
        <div className="min-w-0 flex-1">
          <CardTitle right={handed ? <Badge tone="success">{t("In Säästäjä (simulated)")}</Badge> : undefined}>{g.name}</CardTitle>
          <p className="tnum text-base text-ink">
            {t("{monthly} a month → {target} by {date}", { monthly: money(g.monthlyContribution, { whole: true }), target: money(g.targetAmount, { whole: true }), date: dateFi(g.targetDate) })}
          </p>
          <Muted>
            {months != null ? tn("{n} month to go.", "{n} months to go.", months) + " " : ""}{t("Vara reserves this before working out your safe-to-spend.")}
          </Muted>
          {pot > 0 && <p className="tnum mt-1 text-sm text-green-700">{t("Crave pot adds {amount} towards this ({pct} %, simulated)", { amount: money(pot), pct: Math.round(Math.min(1, pot / g.targetAmount) * 100) })}</p>}
          <TextLink onClick={() => navigate("/flow/goal")}>{t("Edit goal")}</TextLink>
        </div>
      </div>
    </Card>
  );
}
