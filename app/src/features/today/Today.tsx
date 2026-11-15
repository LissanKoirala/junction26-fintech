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

export function ask(q: string, screen = "today") {
  actions.ask(q, screen);
  navigate("/vara/chat", { replace: true });
}

const UPCOMING_ICON: Record<UpcomingItem["kind"], LucideIcon> = {
  housing: Home, utilities: Zap, groceries: ShoppingBasket, transport: Bus, investment: TrendingUp, goal: Target, buffer: Shield,
};

function unavailableReason(r: { ok: false; notImplemented: boolean; error: string }) {
  return r.notImplemented ? "Vara's calculator is being updated. Try again in a moment." : r.error;
}

export function BasketsSummary({ data, onOpen }: { data: BasketsResult; onOpen: () => void }) {
  const parts = data.baskets.map((b) => ({ key: b.basket, label: basketMeta(b.basket).label, value: b.total, color: basketColor(b.basket) }));
  return (
    <Card>
      <CardTitle icon={ChartPie} right={<TextLink onClick={onOpen}>Explore</TextLink>}>Where this month went</CardTitle>
      <Muted>
        {periodLabel(data.period)} · {money(data.spending, { whole: true })} spent
        {data.income > 0 ? ` of ${money(data.income, { whole: true })} income` : ""}
      </Muted>
      <div className="mt-3">
        <StackedBar parts={parts} label="Spending by basket" format={(v) => money(v, { whole: true })} />
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
          {data.saving > 0 && <>Plus {money(data.saving, { whole: true })} into investments. </>}
          {data.transfersOut > 0 && <>{money(data.transfersOut, { whole: true })} moved to another account.</>}
        </p>
      )}
    </Card>
  );
}

function suggestedQuestions(hasHousing: boolean, sweep: boolean): string[] {
  const q = ["Can I afford a 60 € dinner this weekend?", "How much did I spend on taxis in September?", "What kind of spender am I?"];
  if (hasHousing) q.splice(1, 0, "Is my rent too high for my income?");
  if (sweep) q.unshift("Why does my balance drop right after payday?");
  q.push("How much could I save if I ate out less?");
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
          <CardTitle icon={Wallet}>Safe to spend this week</CardTitle>
          <div className="mt-2">
            <Unavailable title="Not available right now" reason={unavailableReason(sts)} />
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
          title="Vara only sees part of your money"
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate("/flow/connect")}>Connect another bank</Button>
              <Button size="sm" variant="ghost" onClick={actions.dismissConnectPrompt}>Not now</Button>
            </div>
          }
        >
          Most of your salary leaves this account right after payday. Connect the other bank and Vara can see the whole picture.
        </Banner>
      )}
      {prefs.bank && (
        <Banner tone="success" icon={Link2} title={`Showing 2 banks (simulated)`} action={<TextLink onClick={() => navigate("/flow/connect")}>Details</TextLink>}>
          {prefs.bank.bankName} is connected for this demo. Its numbers are not part of the dataset, so they are not added to these figures.
        </Banner>
      )}

      {prefs.challenge && <ChallengeCard />}
      {prefs.goal && <GoalCard />}
      <CraveEntryCard />
      <CravePotCard />

      {safe && safe.upcoming.length > 0 && (
        <Card>
          <CardTitle icon={CalendarClock}>Coming up before payday</CardTitle>
          <Muted>Vara sets {money(safe.reservedTotal, { whole: true })} aside so these are covered.</Muted>
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {safe.upcoming.map((u, i) => (
              <li key={u.kind + i}>
                <ListRow
                  wrap
                  icon={UPCOMING_ICON[u.kind] ?? CalendarHeart}
                  title={u.label}
                  subtitle={dateWindow(u.from, u.to) || "Before payday"}
                  right={money(u.amount, { whole: true })}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {baskets && !baskets.ok ? (
        <Card>
          <CardTitle icon={ChartPie}>Where this month went</CardTitle>
          <div className="mt-2">
            <Unavailable title="Baskets not available right now" reason={unavailableReason(baskets)} />
          </div>
        </Card>
      ) : baskets?.ok ? (
        <BasketsSummary data={baskets.value} onOpen={() => navigate("/flow/baskets")} />
      ) : null}

      {/* ML-UI extension point: habit chip */}
      <HabitChipSlot {...slotProps} />

      <Card onClick={() => navigate("/flow/checkin")} label="Open your weekly check-in">
        <div className="flex items-center gap-3">
          <IconCircle icon={Sparkles} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-title">Your weekly check-in</p>
            <p className="text-sm text-ink-muted">A one-minute look back at your week, and one small challenge.</p>
          </div>
          <ChevronRight size={20} strokeWidth={STROKE} className="text-icon-muted" aria-hidden />
        </div>
      </Card>

      {!prefs.goal && (
        <Card onClick={() => navigate("/flow/goal")} label="Set a savings goal">
          <div className="flex items-center gap-3">
            <IconCircle icon={PiggyBank} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">Saving for something?</p>
              <p className="text-sm text-ink-muted">Set a goal and Vara reserves a little each month.</p>
            </div>
            <ChevronRight size={20} strokeWidth={STROKE} className="text-icon-muted" aria-hidden />
          </div>
        </Card>
      )}

      <SectionTitle icon={MessagesSquare}>Ask Vara</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {suggestedQuestions(c.hasHousing, c.hasSalarySweep).map((q) => (
          <Chip key={q} icon={MessageCircleQuestion} onClick={() => ask(q)}>{q}</Chip>
        ))}
      </div>
      <ConceptNotice />
    </Page>
  );
}

