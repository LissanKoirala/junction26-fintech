// The cards of the You page. Each one loads its own model file and shows a tidy state when it is missing.
import { lazy, Suspense, type ReactNode } from "react";
import { BellRing, CalendarRange, Fingerprint, GitFork, House, Repeat, ScanSearch, Sparkles, Telescope } from "lucide-react";
import { useCustomer } from "@/state/customer";
import { usePrefs } from "@/state/store";
import { useSafeToSpend } from "@/features/vara/useVaraData";
import { safe as safeCall } from "@/lib/safeEngine";
import { dateShort, money, pct } from "@/lib/format";
import { Badge } from "@/ui/kit";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { isReady, tribesOf, useMl, useTribes, type Loaded } from "@/features/ml/data";
import { Caveat, CardSkeleton, ExperimentBadge, Meaning, MlCard, MiniStat, NotForYou, StillTraining } from "@/features/ml/ui";
import { Highlights, PersonalityHero, TribeStory } from "@/features/ml/views/personality";
import { TwinDifferences, TwinsChart, TwinsLegend, TwinsMatched, twinsMeaning } from "@/features/ml/views/twins";
import { ChanceTile, engineForecast, FanLegend, ForecastChart, forecastMeaning, RiskBadge, RiskDrivers, riskMeaning, RiskTrend } from "@/features/ml/views/forecast";
import { HabitCard, UnusualList, UnusualWeeks } from "@/features/ml/views/habits";
import { FuturesView, HomeView, yearsText } from "@/features/ml/views/home";
import { RISK_WORDS } from "@/features/ml/words";

const MapSection = lazy(() => import("./MapSection"));

export function Guard({ children, h = 200, label }: { children: ReactNode; h?: number; label: string }) {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={<CardSkeleton h={h} />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

/** Shared handling of loading / missing / error for one model file. */
function gate<T>(l: Loaded<T>, opts: { name: string; tail?: boolean; tailReason?: string; h?: number }): ReactNode | null {
  if (l.status === "loading") return <CardSkeleton h={opts.h} />;
  if (l.status === "missing")
    return opts.tail && opts.tailReason ? <NotForYou title={`${opts.name} is not available for this account`} reason={opts.tailReason} /> : <StillTraining name={opts.name} />;
  if (l.status === "error") return <NotForYou title={`${opts.name} could not be loaded`} reason={`The model file did not load (${l.error}). The rest of the page still works.`} />;
  return null;
}

function Shell({ id, icon, title, eyebrow, children }: { id: string; icon: typeof Fingerprint; title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <MlCard id={id} icon={icon} title={title} eyebrow={eyebrow}>
      {children}
    </MlCard>
  );
}

// ------------------------------------------------------------------ a. personality
export function PersonalitySection() {
  const c = useCustomer();
  const prof = useMl("profile", c?.id);
  const tribesL = useTribes();
  const tribes = tribesOf(tribesL);
  if (!isReady(prof)) {
    const g = gate(prof, { name: "Your money personality" });
    return <Shell id="personality" icon={Fingerprint} title="Your money personality">{g}</Shell>;
  }
  const p = prof.data;
  const main = tribes?.find((t) => t.id === p.tribe.id);
  return (
    <>
      <div id="you-personality" className="scroll-mt-2">
        <PersonalityHero profile={p} tribes={tribes} />
      </div>
      <MlCard icon={Fingerprint} eyebrow={main ? `About the ${main.name} tribe` : undefined} title="What this tribe is like" ask="What kind of spender am I?" model="tribes">
        {p.hasSalarySweep && <Caveat className="mb-3 mt-0">Most of your salary moves to another account right after payday, so this is based on the part of your money we can see here.</Caveat>}
        {p.cohort === "tail" && <Caveat className="mb-3 mt-0">Your income pattern is unusual, so you were placed on the map after it was built. Read this loosely.</Caveat>}
        {main && <TribeStory tribe={main} />}
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">What sets you apart from people aged {p.ageBand}</p>
        <Highlights profile={p} limit={4} />
      </MlCard>
    </>
  );
}

// ------------------------------------------------------------------ b. money map
export function MoneyMapSection() {
  return (
    <Guard label="The Money Map" h={300}>
      <MapSection />
    </Guard>
  );
}

// ------------------------------------------------------------------ c. two futures
export function TwinsSection() {
  const c = useCustomer();
  const tw = useMl("twins", c?.id);
  const title = "Two futures for people like you";
  if (!isReady(tw))
    return (
      <Shell id="twins" icon={GitFork} title={title} eyebrow="What happened next">
        {gate(tw, { name: "Two Futures", tail: c?.cohort === "tail", tailReason: "It matches you with customers who had a steady income a year ago, and your account has an irregular income pattern.", h: 260 })}
      </Shell>
    );
  const t = tw.data;
  return (
    <MlCard id="twins" icon={GitFork} eyebrow="What happened next to people like you" title={title} ask="What happened next to people like me?" model="twins">
      <TwinsChart t={t} />
      <TwinsLegend t={t} />
      <Meaning>{twinsMeaning(t)}</Meaning>
      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">What the builders did differently</p>
      <TwinDifferences t={t} />
      <Caveat>
        This is not a prediction: it shows what happened to other people. {t.caveat}
      </Caveat>
      <TwinsMatched t={t} />
    </MlCard>
  );
}

// ------------------------------------------------------------------ d. crystal ball
export function ForecastSection() {
  const c = useCustomer();
  const prefs = usePrefs();
  const fl = useMl("forecast", c?.id);
  const sts = useSafeToSpend();
  const title = "Crystal ball: your balance until payday";
  if (fl.status === "loading" || !c) return <CardSkeleton h={210} />;
  let f = isReady(fl) ? fl.data : null;
  const fromModel = !!f;
  if (!f && sts?.ok) {
    const r = safeCall(() => engineForecast(c, sts.value, prefs.goal));
    f = r.ok ? r.value : null;
  }
  if (!f || f.fan.length < 2)
    return <Shell id="forecast" icon={Telescope} title={title}><NotForYou title="No forecast for this account" reason="There is not enough regular history to simulate the weeks ahead." /></Shell>;
  const tp = f.spend.find((s) => s.horizon === "to_payday");
  return (
    <MlCard
      id="forecast"
      icon={Telescope}
      eyebrow={`Next payday ${dateShort(f.nextPayday.date)} · in ${f.nextPayday.daysAway} days`}
      title={title}
      right={!fromModel ? <Badge tone="neutral">Simulation</Badge> : undefined}
      ask="Am I at risk of going below zero before payday?"
      model="forecast"
    >
      <ChanceTile p={f.overdraftProbToPayday} />
      <div className="mt-3">
        <ForecastChart f={f} />
        <FanLegend />
      </div>
      <Meaning>{forecastMeaning(f)}</Meaning>
      {tp && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat label="Likely spending to payday" value={money(tp.p50, { whole: true })} sub={`8 in 10: ${money(tp.p10, { whole: true })}–${money(tp.p90, { whole: true })}`} />
          {f.backtest && (
            <MiniStat label="Tested on your past" value={`± ${money(f.backtest.mae, { whole: true })}`} sub={`simple average: ± ${money(f.backtest.naiveMae, { whole: true })}`} />
          )}
        </div>
      )}
      {!fromModel && (
        <Caveat>The calibrated forecast model is not loaded for this account, so this is the in-app simulation of your own past days (1,000 runs).</Caveat>
      )}
    </MlCard>
  );
}

// ------------------------------------------------------------------ e. early warning
export function RiskSection() {
  const c = useCustomer();
  const rl = useMl("risk", c?.id);
  const title = "Early warning";
  if (!isReady(rl))
    return <Shell id="risk" icon={BellRing} title={title} eyebrow="Overdraft risk, next 14 days">{gate(rl, { name: "The early-warning model", tail: c?.cohort === "tail", tailReason: "It was trained on customers with a regular monthly salary, and your income pattern is irregular. The Crystal ball above still works for you." })}</Shell>;
  const r = rl.data;
  const w = RISK_WORDS[r.level];
  return (
    <MlCard id="risk" icon={BellRing} eyebrow={`Overdraft risk, next ${r.horizonDays} days`} title={title} right={<RiskBadge r={r} />} ask="Why might I go below zero?" model="risk">
      <p className="text-lg font-bold leading-snug text-ink">{w.line}</p>
      <Meaning className="mt-1 text-sm text-ink-strong">{riskMeaning(r)}</Meaning>
      <div className="mt-3">
        <RiskDrivers r={r} />
      </div>
      <div className="mt-4">
        <RiskTrend r={r} />
      </div>
    </MlCard>
  );
}

// ------------------------------------------------------------------ f. unusual for you
export function UnusualSection() {
  const c = useCustomer();
  const al = useMl("anomalies", c?.id);
  const title = "Unusual for you";
  if (!isReady(al)) return <Shell id="unusual" icon={ScanSearch} title={title}>{gate(al, { name: "Unusual for you" })}</Shell>;
  const a = al.data;
  return (
    <MlCard id="unusual" icon={ScanSearch} eyebrow="Compared with your own normal" title={title} ask="Anything unusual lately?" model="anomalies">
      <p className="text-sm text-ink-strong">
        {a.last30Days.count
          ? <>In the last 30 days, <span className="font-semibold">{a.last30Days.count}</span> {a.last30Days.count === 1 ? "purchase was" : "purchases were"} unusual for you, <span className="tnum font-semibold">{money(a.last30Days.total, { whole: true })}</span> in total.</>
          : "Nothing unusual in the last 30 days."}
        {" "}One-offs like these are often Surprise musts: moving them there keeps your everyday budget honest.
      </p>
      <div className="mt-2">
        <UnusualList a={a} customer={c} limit={5} />
      </div>
      {a.weeks.length > 0 && (
        <div className="mt-3">
          <UnusualWeeks a={a} />
        </div>
      )}
    </MlCard>
  );
}

// ------------------------------------------------------------------ g. habits
export function HabitsSection() {
  const c = useCustomer();
  const hl = useMl("habits", c?.id);
  const title = "Your habits";
  if (!isReady(hl)) return <Shell id="habits" icon={Repeat} title={title}>{gate(hl, { name: "The habit detector" })}</Shell>;
  const hs = hl.data.habits;
  return (
    <MlCard id="habits" icon={Repeat} eyebrow="Lasting changes in your weekly spending" title={title} ask="Have my habits changed?" model="habits">
      {hs.length ? (
        <div className="flex flex-col gap-2.5">
          {hs.map((h) => <HabitCard key={h.key} h={h} />)}
        </div>
      ) : (
        <p className="rounded-md bg-green-50 p-3 text-sm text-ink-strong">
          No lasting change in your weekly spending over the last year. Steady is fine too: if you start a new habit, it shows up here after about six weeks.
        </p>
      )}
      {hs.length > 0 && (
        <Caveat>
          These are patterns in your weekly numbers, not judgements.
          {hl.data.chanceShare ? ` Up to about 1 in ${Math.max(2, Math.round(1 / hl.data.chanceShare))} flagged changes could be chance.` : " Some flagged changes could be chance."}
        </Caveat>
      )}
    </MlCard>
  );
}

// ------------------------------------------------------------------ h. possible futures
export function FuturesSection() {
  const c = useCustomer();
  const tl = useMl("txgpt", c?.id);
  const title = "Possible next two weeks";
  if (!isReady(tl))
    return (
      <MlCard id="futures" icon={Sparkles} eyebrow="TransactionGPT" title={title} right={<ExperimentBadge />}>
        {gate(tl, { name: "TransactionGPT" })}
      </MlCard>
    );
  const t = tl.data;
  return (
    <MlCard id="futures" icon={Sparkles} eyebrow="TransactionGPT" title={title} right={<ExperimentBadge />} ask="What might my next two weeks look like?" model="txgpt">
      <p className="mb-2 text-sm text-ink-strong">A small language model trained on transaction sequences imagined your next 14 days many times. Here are a thrifty, a typical and a spendy version.</p>
      <FuturesView t={t} />
      <Caveat>An experiment: sampled stories, not a forecast. The Crystal ball above is the tested forecast.</Caveat>
    </MlCard>
  );
}

// ------------------------------------------------------------------ i. first home
export function HomeSection() {
  const c = useCustomer();
  const hl = useMl("home", c?.id);
  const title = "Your first home";
  if (!isReady(hl))
    return (
      <Shell id="home" icon={House} title={title} eyebrow="First-home readiness">
        {gate(hl, { name: "First-home readiness", tail: c?.cohort === "tail", tailReason: "It compares you with mortgage applicants who had a regular salary, and your income pattern is irregular." })}
      </Shell>
    );
  const h = hl.data;
  return (
    <MlCard
      id="home"
      icon={House}
      eyebrow="First-home readiness"
      title={title}
      right={<ExperimentBadge>Illustrative</ExperimentBadge>}
      ask="Could I buy a home?"
      model="home"
    >
      <HomeView h={h} />
      <Meaning className="text-sm">
        At your current pace that is {yearsText(h.yearsToReady)}. Drag the slider to see how a little more each month changes it.
      </Meaning>
      <Caveat>{h.caveat}{h.approval.probabilityIfAppliedNow != null ? ` The approval figure comes from a model with ${pct(h.approval.cvAccuracy)} accuracy (always saying "approved" gets ${pct(h.approval.baselineAccuracy ?? 0.75)}).` : ""}</Caveat>
    </MlCard>
  );
}

export const SECTION_ICONS = { CalendarRange };
