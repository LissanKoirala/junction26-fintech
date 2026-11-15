// "How these models were tested": every model card with its metrics against a baseline, verdict and caveats.
import { useEffect } from "react";
import { ArrowLeft, ExternalLink, FlaskConical, Info } from "lucide-react";
import type { ModelCard } from "@shared/ml/typesA";
import { Badge, Card, ConceptNotice, Disclosure, Page, STROKE, cx } from "@/ui/kit";
import { MODEL_KEYS, useModelCard, type ModelKey } from "@/features/ml/data";
import { CardSkeleton, StillTraining } from "@/features/ml/ui";
import { openYou, tD as tData, VERDICT } from "@/features/ml/words";
import { num } from "@/lib/format";
import { getLang, t } from "@/lib/i18n";
import { ErrorBoundary } from "@/ui/ErrorBoundary";

/** English keys, translated where shown. */
const QUESTION: Record<ModelKey, string> = {
  tribes: "What kind of spender am I, and who is like me?",
  twins: "What happened next to people who were where I am now?",
  forecast: "How much will I spend before payday, and where will my balance be?",
  risk: "Am I likely to go below zero in the next two weeks?",
  anomalies: "Which purchases were unusual for me?",
  habits: "Has one of my spending habits really changed?",
  home: "How far am I from a first home?",
  txgpt: "What could my next two weeks of purchases look like?",
};
const NAME: Record<ModelKey, string> = {
  tribes: "Money Map and tribes", twins: "Two Futures", forecast: "Crystal ball", risk: "Early warning",
  anomalies: "Unusual for you", habits: "Habit detector", home: "First-home readiness", txgpt: "TransactionGPT",
};

function fmtMetric(v: number, unit: string): string {
  const u = unit.trim();
  if (u === "share") return `${num(v * 100, v < 0.1 ? 1 : 0)} %`;
  if (u === "EUR") return `${num(v)} €`;
  if (u === "pp") return `${num(v, 1)} ${t("pp")}`;
  if (u === "%") return `${num(v, 1)} %`;
  if (!u) return Math.abs(v) < 10 ? v.toFixed(Math.abs(v) < 1 ? 3 : 2).replace(".", ",").replace("-", "−") : num(v);
  return `${num(v, Math.abs(v) < 10 ? 1 : 0)} ${tData(u)}`;
}

function MetricRow({ m }: { m: ModelCard["metrics"][number] }) {
  const max = Math.max(1e-9, Math.abs(m.model), Math.abs(m.baseline));
  const better = m.better === "lower" ? m.model < m.baseline : m.model > m.baseline;
  const tie = m.onPar === true || Math.abs(m.model - m.baseline) / max < 0.01;
  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold leading-snug text-ink">{tData(m.label)}</p>
        <span className="shrink-0 whitespace-nowrap"><Badge tone={tie ? "neutral" : better ? "success" : "warning"}>{tie ? t("About equal") : better ? t("Model better") : t("Baseline better")}</Badge></span>
      </div>
      <p className="text-xs text-ink-muted">{m.better === "lower" ? t("Lower is better") : t("Higher is better")}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        {[
          { k: "Model", v: m.model, c: "#007841" },
          { k: m.baselineName, v: m.baseline, c: "#949494" },
        ].map((r) => (
          <div key={r.k} className="text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 text-ink-strong">{r.k === "Model" ? t("This model") : t("Baseline: {name}", { name: tData(r.k) })}</span>
              <span className="tnum shrink-0 font-semibold text-ink">{fmtMetric(r.v, m.unit)}</span>
            </div>
            <div className="mt-0.5 h-2">
              <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(1, (Math.abs(r.v) / max) * 100)}%`, background: r.c }} />
            </div>
          </div>
        ))}
      </div>
    </li>
  );
}

function ModelCardView({ k }: { k: ModelKey }) {
  const l = useModelCard(k);
  if (l.status === "loading") return <CardSkeleton h={120} />;
  if (l.status !== "ready")
    return (
      <Card>
        <p className="mb-2 text-lg font-bold text-title">{t(NAME[k])}</p>
        <StillTraining name={t(NAME[k])} reason={t("Its model card appears here as soon as training and validation finish.")} />
      </Card>
    );
  const m = l.data;
  const v = VERDICT[m.verdict] ?? VERDICT.experimental;
  return (
    <section id={`model-${k}`} className="scroll-mt-2 rounded-app-card bg-card p-4 shadow-app-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-snug text-title">{tData(m.name)}</h2>
          <p className="mt-0.5 text-sm text-ink-strong">“{t(QUESTION[k])}”</p>
        </div>
        <span className="shrink-0 whitespace-nowrap"><Badge tone={v.tone}>{t(v.label)}</Badge></span>
      </div>
      <p className="mt-2 text-sm text-ink">{tData(m.purpose)}</p>
      <ul className="mt-1 divide-y divide-line">
        {m.metrics.map((x, i) => <MetricRow key={i} m={x} />)}
      </ul>
      {m.caveats.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5 rounded-md bg-sunken p-3">
          {m.caveats.map((c) => (
            <li key={c} className="flex gap-2 text-xs leading-relaxed text-ink-strong">
              <Info size={14} strokeWidth={STROKE} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
              <span>{tData(c)}</span>
            </li>
          ))}
        </ul>
      )}
      <Disclosure label={t("Method and data")} className="mt-1">
        {/* the long technical paragraphs stay in English on purpose */}
        {getLang() !== "en" && <p className="pb-2 text-xs text-ink-muted">{t("The technical notes below are in English.")}</p>}
        <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1.5 pb-1 text-xs">
          <dt className="text-ink-muted">{t("Method")}</dt><dd className="text-ink" lang="en">{m.method}</dd>
          <dt className="text-ink-muted">{t("Trained on")}</dt><dd className="text-ink" lang="en">{m.trainedOn}</dd>
          <dt className="text-ink-muted">{t("Validation")}</dt><dd className="text-ink" lang="en">{m.split}</dd>
          <dt className="text-ink-muted">{t("Trained")}</dt><dd className="text-ink">{m.trainedAt.slice(0, 16).replace("T", " ")} UTC{m.trainSeconds ? ` · ${num(m.trainSeconds, 1)} s` : ""}</dd>
        </dl>
      </Disclosure>
    </section>
  );
}

export default function ModelCards({ focus }: { focus?: string | null }) {
  useEffect(() => {
    if (!focus) return;
    const timer = setTimeout(() => document.getElementById(`model-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
    return () => clearTimeout(timer);
  }, [focus]);
  return (
    <Page>
      <button type="button" onClick={() => openYou()} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-green-700">
        <ArrowLeft size={18} strokeWidth={STROKE} aria-hidden /> {t("Back to You")}
      </button>
      <div className="rounded-app-card bg-hero-deep p-4 text-white shadow-app-card">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-hero-meta">
          <FlaskConical size={14} strokeWidth={STROKE} aria-hidden /> {t("Model cards")}
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-tight text-hero-num">{t("How these models were tested")}</h1>
        <p className="mt-1.5 text-sm text-white">
          {t("Every model was checked against a simple baseline on data it had not seen. Where it barely beats the baseline, we say so, and the app words its results more carefully.")}
        </p>
        <a
          href="/insights/"
          target="_blank"
          rel="noreferrer"
          className={cx("mt-3 inline-flex min-h-11 items-center gap-2 rounded-pill bg-accent-soft px-4 text-sm font-semibold text-accent-soft-ink")}
        >
          {t("Open the full analysis")} <ExternalLink size={16} strokeWidth={STROKE} aria-hidden />
        </a>
      </div>
      {MODEL_KEYS.map((k) => (
        <ErrorBoundary key={k} label={t(NAME[k])}>
          <ModelCardView k={k} />
        </ErrorBoundary>
      ))}
      <ConceptNotice />
    </Page>
  );
}
