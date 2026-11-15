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
import { RISK_WORDS, tD as tData } from "@/features/ml/words";
import { rich, t, tn } from "@/lib/i18n";

const MapSection = lazy(() => import("./MapSection"));

export function Guard({ children, h = 200, label }: { children: ReactNode; h?: number; label: string }) {
  return (
    <ErrorBoundary label={t(label)}>
      <Suspense fallback={<CardSkeleton h={h} />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

/** Shared handling of loading / missing / error for one model file. `name` and `tailReason` are English keys. */
function gate<T>(l: Loaded<T>, opts: { name: string; tail?: boolean; tailReason?: string; h?: number }): ReactNode | null {
  if (l.status === "loading") return <CardSkeleton h={opts.h} />;
  const name = t(opts.name);
  if (l.status === "missing")
    return opts.tail && opts.tailReason ? <NotForYou title={t("{name} is not available for this account", { name })} reason={t(opts.tailReason)} /> : <StillTraining name={name} />;
  if (l.status === "error") return <NotForYou title={t("{name} could not be loaded", { name })} reason={t("The model file did not load ({error}). The rest of the page still works.", { error: l.error })} />;
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
    return <Shell id="personality" icon={Fingerprint} title={t("Your money personality")}>{g}</Shell>;
  }
  const p = prof.data;
  const main = tribes?.find((x) => x.id === p.tribe.id);
  return (
    <>
      <div id="you-personality" className="scroll-mt-2">
        <PersonalityHero profile={p} tribes={tribes} />
      </div>
      <MlCard icon={Fingerprint} eyebrow={main ? t("About the {name} tribe", { name: tData(main.name) }) : undefined} title={t("What this tribe is like")} ask="What kind of spender am I?" model="tribes">
        {p.hasSalarySweep && <Caveat className="mb-3 mt-0">{t("Most of your salary moves to another account right after payday, so this is based on the part of your money we can see here.")}</Caveat>}
        {p.cohort === "tail" && <Caveat className="mb-3 mt-0">{t("Your income pattern is unusual, so you were placed on the map after it was built. Read this loosely.")}</Caveat>}
        {main && <TribeStory tribe={main} />}
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("What sets you apart from people aged {age}", { age: p.ageBand })}</p>
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
  const title = t("Two futures for people like you");
  if (!isReady(tw))
    return (
      <Shell id="twins" icon={GitFork} title={title} eyebrow={t("What happened next")}>
        {gate(tw, { name: "Two Futures", tail: c?.cohort === "tail", tailReason: "It matches you with customers who had a steady income a year ago, and your account has an irregular income pattern.", h: 260 })}
      </Shell>
    );
  const d = tw.data;
  return (
    <MlCard id="twins" icon={GitFork} eyebrow={t("What happened next to people like you")} title={title} ask="What happened next to people like me?" model="twins">
      <TwinsChart t={d} />
      <TwinsLegend t={d} />
      <Meaning>{twinsMeaning(d)}</Meaning>
      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("What the builders did differently")}</p>
      <TwinDifferences t={d} />
      <Caveat>
        {t("This is not a prediction: it shows what happened to other people.")} {tData(d.caveat)}
      </Caveat>
      <TwinsMatched t={d} />
    </MlCard>
  );
}

// ------------------------------------------------------------------ d. crystal ball
export function ForecastSection() {
  const c = useCustomer();
  const prefs = usePrefs();
  const fl = useMl("forecast", c?.id);
  const sts = useSafeToSpend();
  const title = t("Crystal ball: your balance until payday");
  if (fl.status === "loading" || !c) return <CardSkeleton h={210} />;
  let f = isReady(fl) ? fl.data : null;
  const fromModel = !!f;
  if (!f && sts?.ok) {
    const r = safeCall(() => engineForecast(c, sts.value, prefs.goal));
    f = r.ok ? r.value : null;
  }
  if (!f || f.fan.length < 2)
    return <Shell id="forecast" icon={Telescope} title={title}><NotForYou title={t("No forecast for this account")} reason={t("There is not enough regular history to simulate the weeks ahead.")} /></Shell>;
  const tp = f.spend.find((s) => s.horizon === "to_payday");
  return (
    <MlCard
      id="forecast"
      icon={Telescope}
      eyebrow={tn("Next payday {date} · in {n} day", "Next payday {date} · in {n} days", f.nextPayday.daysAway, { date: dateShort(f.nextPayday.date) })}
      title={title}
      right={!fromModel ? <Badge tone="neutral">{t("Simulation")}</Badge> : undefined}
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
          <MiniStat label={t("Likely spending to payday")} value={money(tp.p50, { whole: true })} sub={t("8 in 10: {lo}–{hi}", { lo: money(tp.p10, { whole: true }), hi: money(tp.p90, { whole: true }) })} />
          {f.backtest && (
            <MiniStat label={t("Tested on your past")} value={`± ${money(f.backtest.mae, { whole: true })}`} sub={t("simple average: ± {amount}", { amount: money(f.backtest.naiveMae, { whole: true }) })} />
          )}
        </div>
      )}
      {!fromModel && (
        <Caveat>{t("The calibrated forecast model is not loaded for this account, so this is the in-app simulation of your own past days (1,000 runs).")}</Caveat>
      )}
    </MlCard>
  );
}

// ------------------------------------------------------------------ e. early warning
export function RiskSection() {
  const c = useCustomer();
  const rl = useMl("risk", c?.id);
  const title = t("Early warning");
  if (!isReady(rl))
    return <Shell id="risk" icon={BellRing} title={title} eyebrow={t("Overdraft risk, next {n} days", { n: 14 })}>{gate(rl, { name: "The early-warning model", tail: c?.cohort === "tail", tailReason: "It was trained on customers with a regular monthly salary, and your income pattern is irregular. The Crystal ball above still works for you." })}</Shell>;
  const r = rl.data;
  const w = RISK_WORDS[r.level];
  return (
    <MlCard id="risk" icon={BellRing} eyebrow={t("Overdraft risk, next {n} days", { n: r.horizonDays })} title={title} right={<RiskBadge r={r} />} ask="Why might I go below zero?" model="risk">
      <p className="text-lg font-bold leading-snug text-ink">{t(w.line)}</p>
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
  const title = t("Unusual for you");
  if (!isReady(al)) return <Shell id="unusual" icon={ScanSearch} title={title}>{gate(al, { name: "Unusual for you" })}</Shell>;
  const a = al.data;
  const n = a.last30Days.count;
  return (
    <MlCard id="unusual" icon={ScanSearch} eyebrow={t("Compared with your own normal")} title={title} ask="Anything unusual lately?" model="anomalies">
      <p className="text-sm text-ink-strong">
        {n
          ? rich(tn("In the last 30 days, **{n} purchase** was unusual for you, {amount} in total.", "In the last 30 days, **{n} purchases** were unusual for you, {amount} in total.", n, { amount: money(a.last30Days.total, { whole: true }) }))
          : t("Nothing unusual in the last 30 days.")}
        {" "}{t("One-offs like these are often Surprise musts: moving them there keeps your everyday budget honest.")}
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
  const title = t("Your habits");
  if (!isReady(hl)) return <Shell id="habits" icon={Repeat} title={title}>{gate(hl, { name: "The habit detector" })}</Shell>;
  const hs = hl.data.habits;
  return (
    <MlCard id="habits" icon={Repeat} eyebrow={t("Lasting changes in your weekly spending")} title={title} ask="Have my habits changed?" model="habits">
      {hs.length ? (
        <div className="flex flex-col gap-2.5">
          {hs.map((h) => <HabitCard key={h.key} h={h} />)}
        </div>
      ) : (
        <p className="rounded-md bg-green-50 p-3 text-sm text-ink-strong">
          {t("No lasting change in your weekly spending over the last year. Steady is fine too: if you start a new habit, it shows up here after about six weeks.")}
        </p>
      )}
      {hs.length > 0 && (
        <Caveat>
          {t("These are patterns in your weekly numbers, not judgements.")}{" "}
          {hl.data.chanceShare ? t("About 1 in {n} flagged changes could be chance, possibly more.", { n: Math.max(2, Math.round(1 / hl.data.chanceShare)) }) : t("Some flagged changes could be chance.")}
        </Caveat>
      )}
    </MlCard>
  );
}

// ------------------------------------------------------------------ h. possible futures
export function FuturesSection() {
  const c = useCustomer();
  const tl = useMl("txgpt", c?.id);
  const title = t("Possible next two weeks");
  if (!isReady(tl))
    return (
      <MlCard id="futures" icon={Sparkles} eyebrow="TransactionGPT" title={title} right={<ExperimentBadge />}>
        {gate(tl, { name: "TransactionGPT" })}
      </MlCard>
    );
  const tg = tl.data;
  return (
    <MlCard id="futures" icon={Sparkles} eyebrow="TransactionGPT" title={title} right={<ExperimentBadge />} ask="What might my next two weeks look like?" model="txgpt">
      <p className="mb-2 text-sm text-ink-strong">{t("A small language model trained on transaction sequences imagined your next 14 days many times. Here are a thrifty, a typical and a spendy version.")}</p>
      <FuturesView t={tg} />
      <Caveat>{t("An experiment: sampled stories, not a forecast. The Crystal ball above is the tested forecast.")}</Caveat>
    </MlCard>
  );
}

// ------------------------------------------------------------------ i. first home
export function HomeSection() {
  const c = useCustomer();
  const hl = useMl("home", c?.id);
  const title = t("Your first home");
  if (!isReady(hl))
    return (
      <Shell id="home" icon={House} title={title} eyebrow={t("First-home readiness")}>
        {gate(hl, { name: "First-home readiness", tail: c?.cohort === "tail", tailReason: "It compares you with mortgage applicants who had a regular salary, and your income pattern is irregular." })}
      </Shell>
    );
  const h = hl.data;
  return (
    <MlCard
      id="home"
      icon={House}
      eyebrow={t("First-home readiness")}
      title={title}
      right={<ExperimentBadge>{t("Illustrative")}</ExperimentBadge>}
      ask="Could I buy a home?"
      model="home"
    >
      <HomeView h={h} />
      <Meaning className="text-sm">
        {t("At your current pace that is {years}. Drag the slider to see how a little more each month changes it.", { years: yearsText(h.yearsToReady) })}
      </Meaning>
      <Caveat>
        {tData(h.caveat)}
        {h.approval.probabilityIfAppliedNow != null
          ? " " + t("The approval figure comes from a model with {acc} accuracy (always saying \"approved\" gets {base}).", { acc: pct(h.approval.cvAccuracy), base: pct(h.approval.baselineAccuracy ?? 0.75) })
          : ""}
      </Caveat>
    </MlCard>
  );
}

export const SECTION_ICONS = { CalendarRange };
