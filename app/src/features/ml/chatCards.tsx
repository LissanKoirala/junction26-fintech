// Compact chat versions of the ML cards, wrapped in CardFrame so "How I got this" works.
// Loaded lazily from slots.tsx (ML_CARD_RENDERERS), so they never weigh on the first load.
import { BellRing, Fingerprint, GitFork, House, Repeat, ScanSearch, Sparkles, Telescope } from "lucide-react";
import type { CardSpec } from "@shared/chat";
import { CardFrame, ChartCaption } from "@/ui/chat";
import { Badge } from "@/ui/kit";
import { dateShort, money } from "@/lib/format";
import { useCustomer } from "@/state/customer";
import { tribesOf, useTribes } from "./data";
import { Caveat, ExperimentBadge, SeeMore } from "./ui";
import { mixHeadline, TribeMix } from "./views/personality";
import { TwinDifferences, TwinsChart, twinsMeaning } from "./views/twins";
import { ChanceTile, ForecastChart, forecastMeaning, RiskBadge, RiskDrivers, riskMeaning, RiskTrend } from "./views/forecast";
import { HabitCard, UnusualList, UnusualWeeks } from "./views/habits";
import { FuturesView, HomeView } from "./views/home";
import { RISK_WORDS, topHabit } from "./words";

type Of<K extends CardSpec["kind"]> = Extract<CardSpec, { kind: K }>;

export function TribeChatCard({ card }: { card: Of<"tribe"> }) {
  const tribes = tribesOf(useTribes());
  const p = card.data;
  return (
    <CardFrame icon={Fingerprint} eyebrow="Money personality" title={mixHeadline(p)} explain={card.explain}>
      <p className="mb-3 text-sm text-ink-strong">{card.tribe.tagline}</p>
      <TribeMix profile={p} tribes={tribes} compact />
      <p className="mt-3 text-sm text-ink">{card.tribe.description}</p>
      <Caveat>Tribes are a simplification: most people sit between them, which is why you see a mix.</Caveat>
      <SeeMore focus="personality" />
    </CardFrame>
  );
}

export function TwinsChatCard({ card }: { card: Of<"twins"> }) {
  const t = card.data;
  return (
    <CardFrame icon={GitFork} eyebrow="What happened next to people like you" title={card.title ?? "Two futures"} explain={card.explain}>
      <TwinsChart t={t} compact />
      <p className="mt-2 text-sm text-ink">{twinsMeaning(t)}</p>
      <ChartCaption>What the builders did differently</ChartCaption>
      <TwinDifferences t={t} limit={2} />
      <Caveat>Not a prediction: other people's outcomes, correlation only.</Caveat>
      <SeeMore focus="twins" />
    </CardFrame>
  );
}

export function ForecastChatCard({ card }: { card: Of<"forecast"> }) {
  const f = card.data;
  return (
    <CardFrame icon={Telescope} eyebrow={`Until payday ${dateShort(f.nextPayday.date)}`} title={card.title ?? "Your balance in the weeks ahead"} explain={card.explain}>
      <ChanceTile p={f.overdraftProbToPayday} />
      <div className="mt-2">
        <ForecastChart f={f} height={190} />
      </div>
      <p className="mt-2 text-sm text-ink">{forecastMeaning(f)}</p>
      <SeeMore focus="forecast" />
    </CardFrame>
  );
}

export function RiskChatCard({ card }: { card: Of<"risk"> }) {
  const r = card.data;
  return (
    <CardFrame icon={BellRing} eyebrow={`Next ${r.horizonDays} days`} title={card.title ?? "Early warning"} right={<RiskBadge r={r} />} explain={card.explain}>
      <p className="text-base font-semibold text-ink">{RISK_WORDS[r.level].line}</p>
      <p className="mb-3 mt-1 text-sm text-ink-strong">{riskMeaning(r)}</p>
      <RiskDrivers r={r} limit={2} stack />
      <div className="mt-3">
        <RiskTrend r={r} />
      </div>
      <SeeMore focus="risk" />
    </CardFrame>
  );
}

export function AnomaliesChatCard({ card }: { card: Of<"anomalies"> }) {
  const a = card.data;
  const c = useCustomer();
  return (
    <CardFrame icon={ScanSearch} eyebrow="Compared with your own normal" title={card.title ?? "Unusual for you"} explain={card.explain}>
      <p className="text-sm text-ink-strong">
        Last 30 days: <span className="tnum font-semibold">{a.last30Days.count}</span> unusual {a.last30Days.count === 1 ? "purchase" : "purchases"}
        {a.last30Days.count ? <>, <span className="tnum font-semibold">{money(a.last30Days.total, { whole: true })}</span></> : null}.
      </p>
      <UnusualList a={a} customer={c} limit={3} compact />
      {a.weeks.length > 0 && (
        <div className="mt-2">
          <UnusualWeeks a={a} />
        </div>
      )}
      <SeeMore focus="unusual" label="Sort them into baskets in You" />
    </CardFrame>
  );
}

export function HabitsChatCard({ card }: { card: Of<"habits"> }) {
  const hs = card.data.habits;
  const top = topHabit(hs);
  const rest = hs.filter((h) => h !== top);
  return (
    <CardFrame icon={Repeat} eyebrow="Lasting changes in weekly spending" title={card.title ?? "Your habits"} explain={card.explain}>
      {top ? (
        <>
          <HabitCard h={top} compact />
          {rest.length > 0 && <p className="mt-2 text-sm text-ink-muted">+ {rest.length} more: {rest.map((h) => h.category).join(", ")}</p>}
        </>
      ) : (
        <p className="text-sm text-ink-strong">No lasting change in your weekly spending over the last year.</p>
      )}
      <SeeMore focus="habits" />
    </CardFrame>
  );
}

export function HomeChatCard({ card }: { card: Of<"home"> }) {
  const h = card.data;
  return (
    <CardFrame icon={House} eyebrow="From 200 mortgage applications" title={card.title ?? "Your first home"} right={<ExperimentBadge>Illustrative</ExperimentBadge>} explain={card.explain}>
      <HomeView h={h} compact />
      <Caveat>Illustrative: learned from 200 applications in this dataset. Not a credit decision.</Caveat>
      <SeeMore focus="home" label="Try the savings slider in You" />
    </CardFrame>
  );
}

export function FuturesChatCard({ card }: { card: Of<"futures"> }) {
  return (
    <CardFrame icon={Sparkles} eyebrow="TransactionGPT" title={card.title ?? "Three possible next two weeks"} right={<ExperimentBadge />} explain={card.explain}>
      <FuturesView t={card.data} compact />
      <Caveat>An experiment: sampled stories, not a forecast.</Caveat>
      <SeeMore focus="futures" />
    </CardFrame>
  );
}

export { Badge };
