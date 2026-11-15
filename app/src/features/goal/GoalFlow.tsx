// Savings goal: name → amount → date → monthly contribution and its effect on safe-to-spend, then a simulated
// hand-off to S-Pankki's existing Säästäjä product (nothing is moved).
import { useMemo, useState } from "react";
import { CircleCheck, PiggyBank, Target, Trash2, Shield, Plane, Laptop, House, Car, Coins, CalendarDays, ClipboardCheck, type LucideIcon } from "lucide-react";
import { engine } from "@shared/engine";
import type { Goal } from "@shared/types";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { actions, usePrefs } from "@/state/store";
import { useEngine } from "@/lib/safeEngine";
import { addMonths, dateFi, money, moneyParts, monthsBetween } from "@/lib/format";
import { goBack, navigate, useRoute } from "@/lib/router";
import { FullScreen, ScreenHeader, ScrollArea } from "@/ui/hero";
import { HeroCard } from "@/ui/hero";
import { Badge, Banner, Button, Card, CardTitle, Chip, ConceptNotice, Field, HeroFigure, IconCircle, IconHero, inputClass, Muted, Page, Progress, SkeletonCard, STROKE } from "@/ui/kit";
import { Sheet } from "@/ui/Sheet";

const NAME_IDEAS = ["Emergency buffer", "Trip", "New laptop", "Home deposit", "Driving licence"];
const NAME_ICONS: Record<string, LucideIcon> = { "Emergency buffer": Shield, Trip: Plane, "New laptop": Laptop, "Home deposit": House, "Driving licence": Car };
const STEP_ICONS: LucideIcon[] = [Target, Coins, CalendarDays, ClipboardCheck];
const STEP_TITLES = ["What are you saving for?", "How much do you need?", "By when?", "Your plan"];

export default function GoalFlow() {
  const c = useCustomer();
  const prefs = usePrefs();
  const route = useRoute();
  const prefMonthly = Number(route.query.get("monthly")) || 0;
  const existing = prefs.goal;
  const [mode, setMode] = useState<"view" | "edit" | "done">(existing && !prefMonthly ? "view" : "edit");
  const [step, setStep] = useState(0);
  const asOf = c?.asOf ?? "2026-09-30";
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState<string>(existing ? String(Math.round(existing.targetAmount)) : prefMonthly ? String(prefMonthly * 12) : "");
  const [date, setDate] = useState(existing?.targetDate ?? addMonths(asOf, 12));
  const [handoff, setHandoff] = useState(false);

  const close = () => goBack("/vara/today");
  const amt = Number(amount.replace(/\s/g, "").replace(",", ".")) || 0;
  const months = Math.max(1, Math.round(monthsBetween(asOf, date)));
  const monthly = Math.round((amt / months) * 100) / 100;
  const draft: Goal | null = name.trim() && amt > 0 ? { name: name.trim(), targetAmount: amt, targetDate: date, monthlyContribution: monthly, createdAt: asOf } : null;

  const opts = useEngineOpts();
  const baseOpts = useMemo(() => ({ overrides: opts.overrides, goal: null }), [opts.overrides]);
  const before = useEngine(c ? () => engine.getSafeToSpend(c, baseOpts) : null, [c, baseOpts]);
  const after = useEngine(c && draft ? () => engine.getSafeToSpend(c, { ...baseOpts, goal: draft }) : null, [c, baseOpts, draft?.monthlyContribution, draft?.name]);
  const monthlyNet = useEngine(c ? () => engine.getSpenderStats(c, { overrides: opts.overrides }) : null, [c, opts.overrides]);

  const save = () => {
    if (!draft) return;
    actions.setGoal(draft);
    setHandoff(true);
  };

  const header = <ScreenHeader title="Savings goal" onBack={mode === "edit" && step > 0 ? () => setStep(step - 1) : close} />;
  if (!c)
    return (
      <FullScreen>
        {header}
        <Page><SkeletonCard tall /></Page>
      </FullScreen>
    );

  // ------------------------------------------------------------ existing goal
  if (mode === "view" && existing) {
    const m = Math.max(0, Math.ceil(monthsBetween(asOf, existing.targetDate)));
    return (
      <FullScreen>
        {header}
        <ScrollArea>
          <Page>
            <Card>
              <div className="flex items-start gap-3">
                <IconCircle icon={Target} />
                <div className="min-w-0 flex-1">
                  <CardTitle right={prefs.goalHandedOff ? <Badge tone="success">In Säästäjä (simulated)</Badge> : undefined}>{existing.name}</CardTitle>
                  <p className="tnum text-ink">{money(existing.targetAmount, { whole: true })} by {dateFi(existing.targetDate)}</p>
                  <Muted>{m} months to go</Muted>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-ink-muted">Every month</p>
                <HeroFigure value={moneyParts(existing.monthlyContribution).num} />
              </div>
              <Muted className="mt-2">Vara sets this aside first when it works out your safe-to-spend, and tells the chat about it.</Muted>
            </Card>
            <div className="flex flex-col gap-2">
              {!prefs.goalHandedOff && <Button icon={PiggyBank} full onClick={() => setHandoff(true)}>Continue in Säästäjä</Button>}
              <Button variant="soft" full onClick={() => { setMode("edit"); setStep(0); }}>Edit goal</Button>
              <Button variant="ghost" icon={Trash2} full onClick={() => { actions.setGoal(null); setName(""); setAmount(""); setMode("edit"); setStep(0); }}>Remove goal</Button>
            </div>
            <ConceptNotice />
          </Page>
        </ScrollArea>
        <HandoffSheet open={handoff} goal={existing} onClose={() => setHandoff(false)} onDone={() => { setHandoff(false); setMode("done"); }} />
      </FullScreen>
    );
  }

  // ------------------------------------------------------------ success
  if (mode === "done" && prefs.goal) {
    return (
      <FullScreen>
        {header}
        <ScrollArea>
          <Page className="items-center pt-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-green-150 text-green-700">
              <CircleCheck size={36} strokeWidth={STROKE} aria-hidden />
            </span>
            <h2 className="text-2xl font-bold text-title">Goal set: {prefs.goal.name}</h2>
            <p className="text-ink">
              {money(prefs.goal.monthlyContribution, { whole: true })} a month towards {money(prefs.goal.targetAmount, { whole: true })}. Nice
              first step.
            </p>
            <Badge tone="info">Simulation: no money was moved</Badge>
            <Muted className="max-w-[300px]">In the real S-mobiili this would open Säästäjä with the goal filled in, ready for you to confirm.</Muted>
            <div className="mt-4 flex w-full flex-col gap-2">
              <Button full onClick={() => navigate("/vara/today", { replace: true })}>Back to Today</Button>
              <Button variant="ghost" full onClick={() => navigate("/vara/whatif", { replace: true })}>Try a what-if</Button>
            </div>
            <ConceptNotice />
          </Page>
        </ScrollArea>
      </FullScreen>
    );
  }

  // ------------------------------------------------------------ stepper
  const canNext = step === 0 ? name.trim().length > 0 : step === 1 ? amt > 0 : step === 2 ? date > asOf : !!draft;
  const b = before?.ok ? before.value.safePerWeek : null;
  const a = after?.ok ? after.value.safePerWeek : null;
  const netMonthly = monthlyNet?.ok ? monthlyNet.value.monthlyIncome - monthlyNet.value.monthlySpending : null;

  return (
    <FullScreen>
      {header}
      <ScrollArea>
        <Page>
          <div className="px-1">
            <Progress value={(step + 1) / 4} label={`Step ${step + 1} of 4`} />
            <div className="mt-4 flex items-center gap-4">
              <IconHero icon={STEP_ICONS[step] ?? PiggyBank} />
              <div>
                <p className="text-xs text-ink-muted">Step {step + 1} of 4</p>
                <h2 className="text-2xl font-bold text-title">{STEP_TITLES[step]}</h2>
              </div>
            </div>
          </div>

          {step === 0 && (
            <Card>
              <Field label="Goal name">
                {(id) => <input id={id} className={inputClass} value={name} maxLength={40} placeholder="e.g. Trip to Lapland" onChange={(e) => setName(e.target.value)} autoFocus />}
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {NAME_IDEAS.map((n) => (
                  <Chip key={n} icon={NAME_ICONS[n]} selected={name === n} onClick={() => setName(n)}>{n}</Chip>
                ))}
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <Field label="Amount (€)" hint={prefMonthly ? `Your what-if frees about ${money(prefMonthly, { whole: true })} a month, so a year of it is ${money(prefMonthly * 12, { whole: true })}.` : undefined}>
                {(id) => <input id={id} className={inputClass} inputMode="decimal" value={amount} placeholder="e.g. 1200" onChange={(e) => setAmount(e.target.value.replace(/[^\d,.\s]/g, ""))} autoFocus />}
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {[300, 500, 1000, 2000, 5000].map((v) => (
                  <Chip key={v} icon={Coins} selected={amt === v} onClick={() => setAmount(String(v))}>{money(v, { whole: true })}</Chip>
                ))}
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <div className="flex flex-wrap gap-2">
                {[6, 12, 24, 36].map((m) => {
                  const d = addMonths(asOf, m);
                  return <Chip key={m} icon={CalendarDays} selected={date === d} onClick={() => setDate(d)}>{m < 12 ? `${m} months` : `${m / 12} year${m > 12 ? "s" : ""}`}</Chip>;
                })}
              </div>
              <div className="mt-3">
                <Field label="Or pick a date">
                  {(id) => <input id={id} type="date" className={inputClass} value={date} min={addMonths(asOf, 1)} onChange={(e) => e.target.value && setDate(e.target.value)} />}
                </Field>
              </div>
              {amt > 0 && <Muted className="mt-3">That's {money(monthly, { whole: true })} a month for {months} months.</Muted>}
            </Card>
          )}

          {step === 3 && draft && (
            <>
              <HeroCard label="Your plan">
                <p className="flex items-center gap-2 text-lg font-bold text-white"><Target size={20} strokeWidth={STROKE} className="text-hero-num" aria-hidden />{draft.name}</p>
                <p className="tnum text-hero-meta">{money(draft.targetAmount, { whole: true })} by {dateFi(draft.targetDate)} · {months} months</p>
                <div className="mt-4">
                  <p className="text-sm text-hero-meta">Set aside every month</p>
                  <HeroFigure value={moneyParts(monthly).num} ink="inverse" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white/10 p-3">
                    <p className="text-xs text-hero-meta">Safe to spend / week now</p>
                    <p className="tnum text-lg font-bold text-white">{b != null ? money(b, { whole: true }) : "–"}</p>
                  </div>
                  <div className="rounded-md bg-white/10 p-3">
                    <p className="text-xs text-hero-meta">With this goal</p>
                    <p className="tnum text-lg font-bold text-hero-num">{a != null ? money(a, { whole: true }) : "–"}</p>
                  </div>
                </div>
                {after && !after.ok && <p className="mt-2 text-sm text-hero-meta">The effect on safe-to-spend could not be calculated right now.</p>}
              </HeroCard>
              {netMonthly != null && monthly > Math.max(0, netMonthly) && (
                <Banner tone="warning" title="This is a stretch">
                  On average you have about {money(Math.max(0, netMonthly), { whole: true })} a month left after spending. A later date or a smaller amount would make it easier to keep.
                </Banner>
              )}
              {b != null && a != null && a <= 0 && b > 0 && (
                <Banner tone="warning" title="Nothing left to spend this week">
                  With this goal your safe-to-spend drops to zero until payday. You could start it after payday instead.
                </Banner>
              )}
            </>
          )}

          <div className="mt-2 flex flex-col gap-2">
            {step < 3 ? (
              <Button full disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>
            ) : (
              <Button full icon={Target} disabled={!draft} onClick={save}>Save goal</Button>
            )}
            {existing && <Button variant="ghost" full onClick={() => setMode("view")}>Cancel</Button>}
          </div>
          <ConceptNotice />
        </Page>
      </ScrollArea>
      <HandoffSheet open={handoff} goal={prefs.goal} onClose={() => { setHandoff(false); setMode("view"); }} onDone={() => { setHandoff(false); setMode("done"); }} />
    </FullScreen>
  );
}

function HandoffSheet({ open, goal, onClose, onDone }: { open: boolean; goal: Goal | null; onClose: () => void; onDone: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Continue in Säästäjä"
      footer={
        <div className="flex flex-col gap-2">
          <Button full icon={PiggyBank} onClick={() => { actions.markGoalHandedOff(); onDone(); }}>Open Säästäjä (simulated)</Button>
          <Button full variant="ghost" onClick={onClose}>Maybe later</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-ink">
          Säästäjä is S-Pankki's existing saving tool: it puts aside 0,50–5 € with every card purchase automatically, and lets you save towards a goal.
        </p>
        {goal && (
          <Card className="bg-green-50 shadow-none">
            <p className="font-semibold text-ink">{goal.name}</p>
            <p className="tnum text-sm text-ink-muted">{money(goal.targetAmount, { whole: true })} by {dateFi(goal.targetDate)} · {money(goal.monthlyContribution, { whole: true })} a month</p>
          </Card>
        )}
        <Muted>Vara would hand over the goal so you only confirm it there. This demo is a simulation: no money is moved and nothing is set up.</Muted>
      </div>
    </Sheet>
  );
}
