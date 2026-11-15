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
import { t, tn } from "@/lib/i18n";

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

  const header = <ScreenHeader title={t("Savings goal")}onBack={mode === "edit" && step > 0 ? () => setStep(step - 1) : close} />;
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
                  <CardTitle right={prefs.goalHandedOff ? <Badge tone="success">{t("In Säästäjä (simulated)")}</Badge> : undefined}>{existing.name}</CardTitle>
                  <p className="tnum text-ink">{t("{amount} by {date}", { amount: money(existing.targetAmount, { whole: true }), date: dateFi(existing.targetDate) })}</p>
                  <Muted>{tn("{n} month to go", "{n} months to go", m)}</Muted>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-ink-muted">{t("Every month")}</p>
                <HeroFigure value={moneyParts(existing.monthlyContribution).num} />
              </div>
              <Muted className="mt-2">{t("Vara sets this aside first when it works out your safe-to-spend, and tells the chat about it.")}</Muted>
            </Card>
            <div className="flex flex-col gap-2">
              {!prefs.goalHandedOff && <Button icon={PiggyBank} full onClick={() => setHandoff(true)}>{t("Continue in Säästäjä")}</Button>}
              <Button variant="soft" full onClick={() => { setMode("edit"); setStep(0); }}>{t("Edit goal")}</Button>
              <Button variant="ghost" icon={Trash2} full onClick={() => { actions.setGoal(null); setName(""); setAmount(""); setMode("edit"); setStep(0); }}>{t("Remove goal")}</Button>
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
            <h2 className="text-2xl font-bold text-title">{t("Goal set: {name}", { name: prefs.goal.name })}</h2>
            <p className="text-ink">
              {t("{monthly} a month towards {target}. Nice first step.", { monthly: money(prefs.goal.monthlyContribution, { whole: true }), target: money(prefs.goal.targetAmount, { whole: true }) })}
            </p>
            <Badge tone="info">{t("Simulation: no money was moved")}</Badge>
            <Muted className="max-w-[300px]">{t("In the real S-mobiili this would open Säästäjä with the goal filled in, ready for you to confirm.")}</Muted>
            <div className="mt-4 flex w-full flex-col gap-2">
              <Button full onClick={() => navigate("/vara/today", { replace: true })}>{t("Back to Today")}</Button>
              <Button variant="ghost" full onClick={() => navigate("/vara/whatif", { replace: true })}>{t("Try a what-if")}</Button>
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
            <Progress value={(step + 1) / 4} label={t("Step {i} of {n}", { i: step + 1, n: 4 })} />
            <div className="mt-4 flex items-center gap-4">
              <IconHero icon={STEP_ICONS[step] ?? PiggyBank} />
              <div>
                <p className="text-xs text-ink-muted">{t("Step {i} of {n}", { i: step + 1, n: 4 })}</p>
                <h2 className="text-2xl font-bold text-title">{t(STEP_TITLES[step])}</h2>
              </div>
            </div>
          </div>

          {step === 0 && (
            <Card>
              <Field label={t("Goal name")}>
                {(id) => <input id={id} className={inputClass} value={name} maxLength={40} placeholder={t("e.g. Trip to Lapland")} onChange={(e) => setName(e.target.value)} autoFocus />}
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {NAME_IDEAS.map((n) => (
                  <Chip key={n} icon={NAME_ICONS[n]} selected={name === t(n)} onClick={() => setName(t(n))}>{t(n)}</Chip>
                ))}
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <Field
                label={t("Amount (€)")}
                hint={prefMonthly ? t("Your what-if frees about {monthly} a month, so a year of it is {year}.", { monthly: money(prefMonthly, { whole: true }), year: money(prefMonthly * 12, { whole: true }) }) : undefined}
              >
                {(id) => <input id={id} className={inputClass} inputMode="decimal" value={amount} placeholder={t("e.g. 1200")} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.\s]/g, ""))} autoFocus />}
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
                  return <Chip key={m} icon={CalendarDays} selected={date === d} onClick={() => setDate(d)}>{m < 12 ? tn("{n} month", "{n} months", m) : tn("{n} year", "{n} years", m / 12)}</Chip>;
                })}
              </div>
              <div className="mt-3">
                <Field label={t("Or pick a date")}>
                  {(id) => <input id={id} type="date" className={inputClass} value={date} min={addMonths(asOf, 1)} onChange={(e) => e.target.value && setDate(e.target.value)} />}
                </Field>
              </div>
              {amt > 0 && (
                <Muted className="mt-3">
                  {tn("That's {v} a month for {n} month.", "That's {v} a month for {n} months.", months, { v: money(monthly, { whole: true }) })}
                </Muted>
              )}
            </Card>
          )}

          {step === 3 && draft && (
            <>
              <HeroCard label={t("Your plan")}>
                <p className="flex items-center gap-2 text-lg font-bold text-white"><Target size={20} strokeWidth={STROKE} className="text-hero-num" aria-hidden />{draft.name}</p>
                <p className="tnum text-hero-meta">
                  {t("{amount} by {date}", { amount: money(draft.targetAmount, { whole: true }), date: dateFi(draft.targetDate) })} · {tn("{n} month", "{n} months", months)}
                </p>
                <div className="mt-4">
                  <p className="text-sm text-hero-meta">{t("Set aside every month")}</p>
                  <HeroFigure value={moneyParts(monthly).num} ink="inverse" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white/10 p-3">
                    <p className="text-xs text-hero-meta">{t("Safe to spend / week now")}</p>
                    <p className="tnum text-lg font-bold text-white">{b != null ? money(b, { whole: true }) : "–"}</p>
                  </div>
                  <div className="rounded-md bg-white/10 p-3">
                    <p className="text-xs text-hero-meta">{t("With this goal")}</p>
                    <p className="tnum text-lg font-bold text-hero-num">{a != null ? money(a, { whole: true }) : "–"}</p>
                  </div>
                </div>
                {after && !after.ok && <p className="mt-2 text-sm text-hero-meta">{t("The effect on safe-to-spend could not be calculated right now.")}</p>}
              </HeroCard>
              {netMonthly != null && monthly > Math.max(0, netMonthly) && (
                <Banner tone="warning" title={t("This is a stretch")}>
                  {t("On average you have about {v} a month left after spending. A later date or a smaller amount would make it easier to keep.", { v: money(Math.max(0, netMonthly), { whole: true }) })}
                </Banner>
              )}
              {b != null && a != null && a <= 0 && b > 0 && (
                <Banner tone="warning" title={t("Nothing left to spend this week")}>
                  {t("With this goal your safe-to-spend drops to zero until payday. You could start it after payday instead.")}
                </Banner>
              )}
            </>
          )}

          <div className="mt-2 flex flex-col gap-2">
            {step < 3 ? (
              <Button full disabled={!canNext} onClick={() => setStep(step + 1)}>{t("Continue")}</Button>
            ) : (
              <Button full icon={Target} disabled={!draft} onClick={save}>{t("Save goal")}</Button>
            )}
            {existing && <Button variant="ghost" full onClick={() => setMode("view")}>{t("Cancel")}</Button>}
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
      title={t("Continue in Säästäjä")}
      footer={
        <div className="flex flex-col gap-2">
          <Button full icon={PiggyBank} onClick={() => { actions.markGoalHandedOff(); onDone(); }}>{t("Open Säästäjä (simulated)")}</Button>
          <Button full variant="ghost" onClick={onClose}>{t("Maybe later")}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-ink">
          {t("Säästäjä is S-Pankki's existing saving tool: it puts aside 0,50–5 € with every card purchase automatically, and lets you save towards a goal.")}
        </p>
        {goal && (
          <Card className="bg-green-50 shadow-none">
            <p className="font-semibold text-ink">{goal.name}</p>
            <p className="tnum text-sm text-ink-muted">
              {t("{amount} by {date}", { amount: money(goal.targetAmount, { whole: true }), date: dateFi(goal.targetDate) })} ·{" "}
              {t("{v} a month", { v: money(goal.monthlyContribution, { whole: true }) })}
            </p>
          </Card>
        )}
        <Muted>{t("Vara would hand over the goal so you only confirm it there. This demo is a simulation: no money is moved and nothing is set up.")}</Muted>
      </div>
    </Sheet>
  );
}
