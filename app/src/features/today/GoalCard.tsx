// Savings goal summary on Today.
import { Target } from "lucide-react";
import { usePrefs } from "@/state/store";
import { dateFi, money, monthsBetween } from "@/lib/format";
import { navigate } from "@/lib/router";
import { Badge, Card, CardTitle, IconCircle, Muted, TextLink } from "@/ui/kit";
import { useCustomer } from "@/state/customer";

export function GoalCard() {
  const g = usePrefs().goal;
  const handed = usePrefs().goalHandedOff;
  const c = useCustomer();
  if (!g) return null;
  const months = c ? Math.max(0, Math.ceil(monthsBetween(c.asOf, g.targetDate))) : null;
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconCircle icon={Target} />
        <div className="min-w-0 flex-1">
          <CardTitle right={handed ? <Badge tone="success">In Säästäjä (simulated)</Badge> : undefined}>{g.name}</CardTitle>
          <p className="tnum text-base text-ink">
            {money(g.monthlyContribution, { whole: true })} a month → {money(g.targetAmount, { whole: true })} by {dateFi(g.targetDate)}
          </p>
          <Muted>
            {months != null ? `${months} months to go. ` : ""}Vara reserves this before working out your safe-to-spend.
          </Muted>
          <TextLink onClick={() => navigate("/flow/goal")}>Edit goal</TextLink>
        </div>
      </div>
    </Card>
  );
}
