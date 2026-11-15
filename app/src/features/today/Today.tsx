// TODAY: the hero screen of the Vara space.
import { CalendarHeart, CalendarClock, ChartPie, MessageCircleQuestion, MessagesSquare, Wallet, ChevronRight, Home, Link2, PiggyBank, Sparkles, Target, Zap, ShoppingBasket, Bus, TrendingUp, Shield, type LucideIcon } from "lucide-react";
import { engine, type BasketsResult, type UpcomingItem } from "@shared/engine";
import { useCustomer, useCustomerState, useEngineOpts } from "@/state/customer";
import { actions, usePrefs } from "@/state/store";
import { useEngine } from "@/lib/safeEngine";
import { dateWindow, money, pct, periodLabel } from "@/lib/format";
import { navigate } from "@/lib/router";
import { basketMeta, basketColor, basketIcon } from "@/lib/domain";
import { Banner, Button, Card, CardTitle, Chip, ConceptNotice, IconCircle, ListRow, Muted, Page, Progress, SectionTitle, SkeletonCard, STROKE, TextLink, Unavailable } from "@/ui/kit";
import { StackedBar } from "@/ui/charts";
import { EarlyWarningSlot, HabitChipSlot } from "@/features/ml/slots";
import { useSafeToSpend } from "@/features/vara/useVaraData";
import { SafeHero } from "./SafeHero";
import { ChallengeCard } from "./ChallengeCard";
import { GoalCard } from "./GoalCard";
import { CraveEntryCard, CravePotCard } from "@/features/crave/TodayCards";
import { t } from "@/lib/i18n";

export function ask(q: string, screen = "today") {
  actions.ask(q, screen);
  navigate("/vara/chat", { replace: true });
}

const UPCOMING_ICON: Record<UpcomingItem["kind"], LucideIcon> = {
  housing: Home, utilities: Zap, groceries: ShoppingBasket, transport: Bus, investment: TrendingUp, goal: Target, buffer: Shield,
};

function unavailableReason(r: { ok: false; notImplemented: boolean; error: string }) {
  return r.notImplemented ? t("Vara's calculator is being updated. Try again in a moment.") : r.error;
}

export function BasketsSummary({ data, onOpen }: { data: BasketsResult; onOpen: () => void }) {
  const parts = data.baskets.map((b) => ({ key: b.basket, label: basketMeta(b.basket).label, value: b.total, color: basketColor(b.basket) }));
  return (
    <Card>
      <CardTitle icon={ChartPie} right={<TextLink onClick={onOpen}>{t("Explore")}</TextLink>}>{t("Where this month went")}</CardTitle>
      <Muted>
        {data.income > 0
          ? t("{period} · {spent} spent of {income} income", { period: periodLabel(data.period), spent: money(data.spending, { whole: true }), income: money(data.income, { whole: true }) })
          : t("{period} · {spent} spent", { period: periodLabel(data.period), spent: money(data.spending, { whole: true }) })}
      </Muted>
      <div className="mt-3">
        <StackedBar parts={parts} label={t("Spending by basket")} format={(v) => money(v, { whole: true })} />
      </div>
      <ul className="mt-2 flex flex-col">
        {data.baskets.map((b) => {
          const m = basketMeta(b.basket);
          return (
            <li key={b.basket}>
              <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 rounded-md py-2.5 text-left hover:bg-green-50">
                <IconCircle icon={basketIcon(b.basket)} color={m.color} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{m.label}</span>
                  <span className="mt-0.5 block text-sm text-ink-muted">{m.description}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum block font-semibold">{money(b.total, { whole: true })}</span>
                  <span className="tnum block text-sm text-ink-muted">{pct(b.share)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {(data.saving > 0 || data.transfersOut > 0) && (
        <p className="mt-1 text-sm text-ink-muted">
          {data.saving > 0 && <>{t("Plus {amount} into investments.", { amount: money(data.saving, { whole: true }) })} </>}
          {data.transfersOut > 0 && <>{t("{amount} moved to another account.", { amount: money(data.transfersOut, { whole: true }) })}</>}
        </p>
      )}
    </Card>
  );
}

function suggestedQuestions(hasHousing: boolean, sweep: boolean): string[] {
  const q = [t("Can I afford a 60 € dinner this weekend?"), t("How much did I spend on taxis in September?"), t("What kind of spender am I?")];
  if (hasHousing) q.splice(1, 0, t("Is my rent too high for my income?"));
  if (sweep) q.unshift(t("Why does my balance drop right after payday?"));
  q.push(t("How much could I save if I ate out less?"));
  return q.slice(0, 5);
}

export function Today() {
  const cs = useCustomerState();
  const c = useCustomer();
  const opts = useEngineOpts();
  const prefs = usePrefs();
  const sts = useSafeToSpend();
  const baskets = useEngine(c ? () => engine.getBaskets(c, engine.resolvePeriod(c.asOf, "this_month"), opts) : null, [c, opts]);

  if (cs.status === "loading" || !c)
    return (
      <Page>
        <SkeletonCard tall lines={3} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </Page>
    );

  const safe = sts?.ok ? sts.value : null;
  const slotProps = { customer: c, safe, ask: (q: string) => ask(q) };

  return (
    <Page>
      {sts && !sts.ok ? (
        <Card>
          <CardTitle icon={Wallet}>{t("Safe to spend")}</CardTitle>
          <div className="mt-2">
            <Unavailable title={t("Not available right now")} reason={unavailableReason(sts)} />
          </div>
        </Card>
      ) : safe ? (
        <SafeHero s={safe} />
      ) : null}

      {/* ML-UI extension point: early-warning card */}
      <EarlyWarningSlot {...slotProps} />

      {c.hasSalarySweep && !prefs.bank && !prefs.dismissedConnectPrompt && (
        <Banner
          tone="info"
          icon={Link2}
          title={t("Vara only sees part of your money")}
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate("/flow/connect")}>{t("Connect another bank")}</Button>
              <Button size="sm" variant="ghost" onClick={actions.dismissConnectPrompt}>{t("Not now")}</Button>
            </div>
          }
        >
          {t("Most of your salary leaves this account right after payday. Connect the other bank and Vara can see the whole picture.")}
        </Banner>
      )}
      {prefs.bank && (
        <Banner tone="success" icon={Link2} title={t("Showing 2 banks (simulated)")} action={<TextLink onClick={() => navigate("/flow/connect")}>{t("Details")}</TextLink>}>
          {t("{bank} is connected for this demo. Its numbers are not part of the dataset, so they are not added to these figures.", { bank: prefs.bank.bankName })}
        </Banner>
      )}

      {prefs.challenge && <ChallengeCard />}
      {prefs.goal && <GoalCard />}
      <CraveEntryCard />
      <CravePotCard />

      {safe && safe.upcoming.length > 0 && (
        <Card>
          <CardTitle icon={CalendarClock}>{safe.nextPayday.estimated ? t("Coming up in the next 30 days") : t("Coming up before payday")}</CardTitle>
          <Muted>{t("Vara sets {amount} aside so these are covered.", { amount: money(safe.reservedTotal, { whole: true }) })}</Muted>
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {safe.upcoming.map((u, i) => (
              <li key={u.kind + i}>
                <ListRow
                  wrap
                  icon={UPCOMING_ICON[u.kind] ?? CalendarHeart}
                  title={u.label}
                  subtitle={dateWindow(u.from, u.to) || t("Before payday")}
                  right={money(u.amount, { whole: true })}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {baskets && !baskets.ok ? (
        <Card>
          <CardTitle icon={ChartPie}>{t("Where this month went")}</CardTitle>
          <div className="mt-2">
            <Unavailable title={t("Baskets not available right now")} reason={unavailableReason(baskets)} />
          </div>
        </Card>
      ) : baskets?.ok ? (
        <BasketsSummary data={baskets.value} onOpen={() => navigate("/flow/baskets")} />
      ) : null}

      {/* ML-UI extension point: habit chip */}
      <HabitChipSlot {...slotProps} />

      <Card onClick={() => navigate("/flow/checkin")} label={t("Open your weekly check-in")}>
        <div className="flex items-center gap-3">
          <IconCircle icon={Sparkles} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-title">{t("Your weekly check-in")}</p>
            <p className="text-sm text-ink-muted">{t("A one-minute look back at your week, and one small challenge.")}</p>
          </div>
          <ChevronRight size={20} strokeWidth={STROKE} className="text-icon-muted" aria-hidden />
        </div>
      </Card>

      {!prefs.goal && (
        <Card onClick={() => navigate("/flow/goal")} label={t("Set a savings goal")}>
          <div className="flex items-center gap-3">
            <IconCircle icon={PiggyBank} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{t("Saving for something?")}</p>
              <p className="text-sm text-ink-muted">{t("Set a goal and Vara reserves a little each month.")}</p>
            </div>
            <ChevronRight size={20} strokeWidth={STROKE} className="text-icon-muted" aria-hidden />
          </div>
        </Card>
      )}

      <SectionTitle icon={MessagesSquare}>{t("Ask Vara")}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {suggestedQuestions(c.hasHousing, c.hasSalarySweep).map((q) => (
          <Chip key={q} icon={MessageCircleQuestion} onClick={() => ask(q)}>{q}</Chip>
        ))}
      </div>
      <ConceptNotice />
    </Page>
  );
}

