// WHAT-IF: sliders over the customer's own spending; everything re-runs in the browser engine as they move.
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MessageCircle, RotateCcw, Target } from "lucide-react";
import { engine, type Adjustment, type FixedEvent, type Scenario } from "@shared/engine";
import type { Category, CustomerData } from "@shared/types";
import type { MlForecast } from "@shared/ml/typesB";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { actions } from "@/state/store";
import { safe, useEngine } from "@/lib/safeEngine";
import { fetchOptional } from "@/lib/api";
import { addDays, dateShort, money, moneyParts, pctSigned } from "@/lib/format";
import { categoryIcon, categoryLabel, PURCHASE_CATEGORIES } from "@/lib/domain";
import { navigate } from "@/lib/router";
import { HeroCard } from "@/ui/hero";
import { SlidersHorizontal, Sparkles, TrendingUp, ChartLine, PiggyBank, House } from "lucide-react";
import { Button, Card, CardTitle, ConceptNotice, Divider, HeroFigure, Muted, Page, Slider, SkeletonCard, Unavailable } from "@/ui/kit";
import { FanChart } from "@/ui/charts";

interface Sliders {
  pct: Partial<Record<Category, number>>;
  extra: number;
  housing: number;
}
const EMPTY: Sliders = { pct: {}, extra: 0, housing: 0 };
// keep the scenario while the user hops between sections
const memory = new Map<string, Sliders>();

const HORIZON_LABEL: Record<number, string> = { 1: "1 month", 12: "1 year", 60: "5 years", 120: "10 years" };

function scenarioOf(s: Sliders): Scenario {
  const adjustments: Adjustment[] = Object.entries(s.pct)
    .filter(([, v]) => v && v !== 0)
    .map(([cat, v]) => ({ target: { category: cat as Category }, changePct: v!, label: `${categoryLabel(cat)} ${pctSigned(v!)}` }));
  return { adjustments, extraMonthlySaving: s.extra || undefined, housingChange: s.housing || undefined };
}

export function describeScenario(s: Sliders): string {
  const parts: string[] = [];
  for (const [cat, v] of Object.entries(s.pct)) {
    if (!v) continue;
    parts.push(v < 0 ? `spent ${Math.abs(v)}% less on ${categoryLabel(cat).toLowerCase()}` : `spent ${v}% more on ${categoryLabel(cat).toLowerCase()}`);
  }
  if (s.extra) parts.push(`saved an extra ${s.extra} € a month`);
  if (s.housing) parts.push(s.housing < 0 ? `found a home ${Math.abs(s.housing)} € a month cheaper` : `paid ${s.housing} € a month more for housing`);
  if (!parts.length) return "What could I change to save more each month?";
  const last = parts.pop();
  return `What if I ${parts.length ? parts.join(", ") + " and " : ""}${last}? What would that mean for me?`;
}

/** Baseline monthly spend per purchase category, using the same basis as simulateWhatIf. */
function baselines(c: CustomerData) {
  const r = engine.simulateWhatIf(c, {
    adjustments: PURCHASE_CATEGORIES.map((cat) => ({ target: { category: cat }, changePct: 0, label: cat })),
  });
  return {
    basis: r.basis,
    cats: r.perAdjustment
      .map((p) => ({ cat: p.label as Category, monthly: p.baselineMonthly }))
      .filter((x) => x.monthly >= 5)
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 5),
  };
}

function useForecastScale(id: string | undefined): number | undefined {
  const [scale, setScale] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let live = true;
    fetchOptional<MlForecast>(`/api/ml/forecast/${id}`).then((f) => live && setScale(f?.sim?.scale));
    return () => {
      live = false;
    };
  }, [id]);
  return scale;
}

export default function WhatIf() {
  const c = useCustomer();
  const opts = useEngineOpts();
  const [s, setS] = useState<Sliders>(() => (c && memory.get(c.id)) || EMPTY);
  useEffect(() => {
    if (c) memory.set(c.id, s);
  }, [c, s]);
  const deferred = useDeferredValue(s);
  const scale = useForecastScale(c?.id);

  const base = useEngine(c ? () => baselines(c) : null, [c]);
  const housing = useEngine(c && c.hasHousing ? () => engine.getRecurring(c).find((r) => r.kind === "housing") ?? null : null, [c]);
  const sts = useEngine(c ? () => engine.getSafeToSpend(c, opts) : null, [c, opts]);
  const scenario = useMemo(() => scenarioOf(s), [s]);
  const result = useEngine(c ? () => engine.simulateWhatIf(c, scenario, opts) : null, [c, scenario, opts]);

  const sim = useMemo(() => {
    if (!c || !sts?.ok) return undefined;
    const days = Math.max(1, sts.value.nextPayday.daysAway);
    return safe(() => {
      const fixed: FixedEvent[] = engine.getFixedEvents(c, days, { goal: opts.goal }).map((e) =>
        e.kind === "housing" && deferred.housing ? { ...e, amount: Math.min(0, e.amount - deferred.housing) } : e,
      );
      if (deferred.extra > 0) fixed.push({ date: addDays(c.asOf, 1), kind: "goal", amount: -Math.round(deferred.extra * (days / 30.44) * 100) / 100 });
      const multipliers: Partial<Record<Category, number>> = {};
      for (const [k, v] of Object.entries(deferred.pct)) if (v) multipliers[k as Category] = Math.max(0, 1 + v / 100);
      const mk = (m: Partial<Record<Category, number>>, f: FixedEvent[]) =>
        engine.simulateBalance(c, { days, nPaths: 500, seed: 42, scale, multipliers: m, fixedEvents: f, paydayDate: sts.value.nextPayday.date });
      const after = mk(multipliers, fixed);
      const changed = Object.keys(multipliers).length > 0 || deferred.extra > 0 || deferred.housing !== 0;
      const before = changed ? mk({}, engine.getFixedEvents(c, days, { goal: opts.goal })) : after;
      return { after, before, days, payday: sts.value.nextPayday.date };
    });
  }, [c, sts, deferred, scale, opts.goal]);

  if (!c || !base) return <Page><SkeletonCard tall /><SkeletonCard lines={5} /></Page>;
  if (!base.ok)
    return (
      <Page>
        <Unavailable title="What-if is not available right now" reason={base.notImplemented ? "Vara's calculator is being updated. Try again in a moment." : base.error} />
      </Page>
    );

  const setPct = (cat: Category, v: number) => setS((o) => ({ ...o, pct: { ...o.pct, [cat]: v } }));
  const touched = scenario.adjustments.length > 0 || s.extra > 0 || s.housing !== 0;
  const r = result?.ok ? result.value : null;
  const saved = r?.savedMonthly ?? 0;
  const housingNow = housing?.ok && housing.value ? housing.value.typicalAmount : null;

  return (
    <Page>
      <div className="px-1">
        <h2 className="text-xl font-bold text-title">What if you…</h2>
        <Muted>Move a slider and see what changes. Starting points are your own monthly averages ({base.value.basis.replace(/^Monthly average of /, "").replace(/\s*\(.*\)$/, "")}).</Muted>
      </div>

      <Card>
        <CardTitle icon={SlidersHorizontal} right={touched ? <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setS(EMPTY)}>Reset</Button> : undefined}>Your spending</CardTitle>
        <div className="mt-2 flex flex-col gap-1">
          {base.value.cats.map(({ cat, monthly }) => {
            const v = s.pct[cat] ?? 0;
            return (
              <Slider
                key={cat}
                label={categoryLabel(cat)}
                icon={categoryIcon(cat)}
                value={v}
                min={-100}
                max={50}
                step={5}
                onChange={(x) => setPct(cat, x)}
                valueLabel={v === 0 ? "as now" : pctSigned(v)}
                hint={
                  v === 0
                    ? `About ${money(monthly, { whole: true })} a month now`
                    : `About ${money(monthly, { whole: true })} → ${money(monthly * (1 + v / 100), { whole: true })} a month`
                }
              />
            );
          })}
          {base.value.cats.length === 0 && <Muted>Not enough card spending in the last months to build sliders.</Muted>}
        </div>
        <Divider />
        <Slider
          label="Save extra per month"
          icon={PiggyBank}
          value={s.extra}
          min={0}
          max={500}
          step={10}
          onChange={(x) => setS((o) => ({ ...o, extra: x }))}
          valueLabel={s.extra ? money(s.extra, { whole: true }) : "nothing extra"}
          hint="Moved to savings on top of what you do now"
        />
        {c.hasHousing && (
          <Slider
            label="Rent change"
            icon={House}
            value={s.housing}
            min={-600}
            max={400}
            step={10}
            onChange={(x) => setS((o) => ({ ...o, housing: x }))}
            valueLabel={s.housing ? `${s.housing > 0 ? "+" : "−"}${money(Math.abs(s.housing), { whole: true })}` : "as now"}
            hint={housingNow != null ? `Now about ${money(housingNow, { whole: true })} a month${s.housing ? ` → ${money(Math.max(0, housingNow + s.housing), { whole: true })}` : ""}` : "Change in monthly housing cost"}
          />
        )}
      </Card>

      {result && !result.ok ? (
        <Unavailable title="Results not available right now" reason={result.error} />
      ) : r && !touched ? (
        <Card>
          <CardTitle icon={Sparkles}>What changes</CardTitle>
          <Muted>Move a slider above and Vara shows what you would free up each month, and what that does to your safe-to-spend.</Muted>
          <p className="tnum mt-3 text-ink">
            Safe to spend now: <strong>{money(r.safePerWeekBefore, { whole: true })} a week</strong>
          </p>
        </Card>
      ) : r ? (
        <>
          <HeroCard label="What this change does">
            <p className="text-sm text-hero-meta">{saved >= 0 ? "Freed up every month" : "Extra spending every month"}</p>
            <HeroFigure value={moneyParts(Math.abs(saved)).num} ink="inverse" />
            {r.equivalents.length > 0 && <p className="mt-1 text-sm text-hero-meta">That's {r.equivalents.join(", and ")}.</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-white/10 p-3">
                <p className="text-xs text-hero-meta">Safe to spend / week now</p>
                <p className="tnum text-lg font-bold text-white">{money(r.safePerWeekBefore, { whole: true })}</p>
              </div>
              <div className="rounded-md bg-white/10 p-3">
                <p className="text-xs text-hero-meta">With this change</p>
                <p className="tnum text-lg font-bold text-hero-num">{money(r.safePerWeekAfter, { whole: true })}</p>
              </div>
            </div>
            {r.perAdjustment.length > 0 && (
              <ul className="mt-3 flex flex-col divide-y divide-white/15 text-sm">
                {r.perAdjustment.map((p) => (
                  <li key={p.label} className="flex items-baseline justify-between gap-2 py-2">
                    <span className="text-white">{p.label}</span>
                    <span className="tnum text-hero-meta">
                      {money(p.baselineMonthly, { whole: true })} → {money(p.newMonthly, { whole: true })}{" "}
                      <span className="font-semibold text-white">{p.savedMonthly >= 0 ? `saves ${money(p.savedMonthly, { whole: true })}` : `costs ${money(-p.savedMonthly, { whole: true })}`}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </HeroCard>

          {saved > 0 && (
            <Card>
              <CardTitle icon={TrendingUp}>If you keep it up</CardTitle>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-muted">
                    <th className="py-1 font-normal">After</th>
                    <th className="py-1 text-right font-normal">Saved</th>
                    <th className="py-1 text-right font-normal">If invested (4 %/yr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.projections.map((p) => (
                    <tr key={p.months}>
                      <td className="py-2 text-ink">{HORIZON_LABEL[p.months] ?? `${p.months} months`}</td>
                      <td className="tnum py-2 text-right font-semibold">{money(p.saved, { whole: true })}</td>
                      <td className="tnum py-2 text-right font-semibold text-title">{money(p.invested, { whole: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-ink-muted">The invested column assumes an average 4 % yearly return. Real returns go up and down; this is an illustration, not advice.</p>
            </Card>
          )}
        </>
      ) : null}

      <Card>
        <CardTitle icon={ChartLine}>Your balance until payday</CardTitle>
        {!sim ? (
          sts && !sts.ok ? <Unavailable title="Forecast not available" reason={sts.error} compact /> : <SkeletonCard lines={2} />
        ) : !sim.ok ? (
          <div className="mt-2"><Unavailable title="Forecast not available right now" reason={sim.notImplemented ? "Vara's simulator is being updated." : sim.error} compact /></div>
        ) : (
          <>
            <Muted>
              500 possible paths to payday on {dateShort(sim.value.payday)}, replaying your own days from the last six months.
            </Muted>
            <div className="mt-3">
              <FanChart fan={sim.value.after.fan} format={(v) => money(v, { whole: true })} dateLabel={dateShort} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-pill bg-accent" aria-hidden /> most likely</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-green-200" aria-hidden /> 8 in 10 paths</span>
            </div>
            <OverdraftLine before={sim.value.before.overdraftProbToPayday} after={sim.value.after.overdraftProbToPayday} touched={touched} />
          </>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        <Button icon={MessageCircle} full onClick={() => { actions.ask(describeScenario(s), "whatif"); navigate("/vara/chat", { replace: true }); }}>
          Ask Vara about this
        </Button>
        <Button variant="soft" icon={Target} full disabled={saved <= 0} onClick={() => navigate(`/flow/goal?monthly=${Math.round(saved)}`)}>
          Make it a goal
        </Button>
      </div>
      <ConceptNotice />
    </Page>
  );
}

function chanceWords(p: number): string {
  if (p < 0.01) return "almost no chance";
  if (p < 0.05) return "a small chance (under 1 in 20)";
  const n = Math.round(p * 10);
  if (n <= 0) return `about a ${Math.round(p * 100)} % chance`;
  return `about ${n} in 10`;
}

function OverdraftLine({ before, after, touched }: { before: number; after: number; touched: boolean }) {
  const diff = Math.round((before - after) * 100);
  return (
    <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-ink">
      Chance of dipping below zero before payday: <strong>{chanceWords(after)}</strong> ({Math.round(after * 100)} %).
      {touched && diff !== 0 && (
        <> {`That's ${Math.abs(diff)} percentage point${Math.abs(diff) === 1 ? "" : "s"} ${diff > 0 ? "lower" : "higher"} than now.`}</>
      )}
    </p>
  );
}
