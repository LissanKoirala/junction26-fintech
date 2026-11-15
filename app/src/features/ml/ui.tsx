// Building blocks shared by the You page and the chat ML cards.
import type { ReactNode } from "react";
import { FlaskConical, Hourglass, Info, MessageCircle, ArrowRight, type LucideIcon } from "lucide-react";
import { Badge, Button, cx, IconCircle, Skeleton, STROKE } from "@/ui/kit";
import { t } from "@/lib/i18n";
import { askVara, openModels, openYou, type YouSection } from "./words";
import type { ModelKey } from "./data";

/** A card on the You page: icon tile, eyebrow, plain-language title, one visual, a meaning line, and the two links. */
export function MlCard({
  id, icon, eyebrow, title, right, children, ask, model, className, tone = "card",
}: {
  id?: string;
  icon: LucideIcon;
  eyebrow?: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  ask?: string;
  model?: ModelKey;
  className?: string;
  tone?: "card" | "deep";
}) {
  const deep = tone === "deep";
  return (
    <section
      id={id ? `you-${id}` : undefined}
      className={cx("scroll-mt-2 rounded-app-card p-4 shadow-app-card", deep ? "bg-hero-deep text-hero-deep-ink" : "bg-card", className)}
    >
      <header className="mb-3 flex items-start gap-3">
        <IconCircle icon={icon} tone={deep ? "hero" : "green"} />
        <div className="min-w-0 flex-1">
          {eyebrow && <p className={cx("text-xs font-semibold uppercase tracking-wide", deep ? "text-hero-meta" : "text-ink-muted")}>{eyebrow}</p>}
          <h2 className={cx("text-lg font-bold leading-snug", deep ? "text-white" : "text-title")}>{title}</h2>
        </div>
        {right && <div className="shrink-0 pt-0.5">{right}</div>}
      </header>
      {children}
      {(ask || model) && (
        <footer className={cx("mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t pt-2", deep ? "border-white/15" : "border-line")}>
          {ask && (
            <Button size="sm" className="shrink-0 whitespace-nowrap" variant={deep ? "soft" : "tonal"} icon={MessageCircle} onClick={() => askVara(t(ask))}>
              {t("Ask Vara about this")}
            </Button>
          )}
          {model && <TestedLink model={model} inverse={deep} />}
        </footer>
      )}
    </section>
  );
}

export function TestedLink({ model, inverse }: { model: ModelKey; inverse?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => openModels(model)}
      className={cx("inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold hover:underline", inverse ? "text-hero-meta" : "text-ink-muted")}
    >
      <FlaskConical size={14} strokeWidth={STROKE} aria-hidden />
      {t("How this model was tested")}
    </button>
  );
}

/** The one sentence that says what it means for this person. */
export function Meaning({ children, inverse, className }: { children: ReactNode; inverse?: boolean; className?: string }) {
  return <p className={cx("mt-3 text-base leading-snug", inverse ? "text-white" : "text-ink", className)}>{children}</p>;
}

export function Caveat({ children, className, inverse }: { children: ReactNode; className?: string; inverse?: boolean }) {
  return (
    <p className={cx("mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-xs leading-relaxed", inverse ? "bg-white/10 text-hero-meta" : "bg-sunken text-ink-strong", className)}>
      <Info size={14} strokeWidth={STROKE} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function ExperimentBadge({ children }: { children?: ReactNode }) {
  return (
    <Badge tone="info">
      <FlaskConical size={12} strokeWidth={STROKE} aria-hidden />
      {children ?? t("Experiment")}
    </Badge>
  );
}

/** Tidy state for a model whose file is not there (yet). */
export function StillTraining({ name, compact, reason }: { name: string; compact?: boolean; reason?: string }) {
  return (
    <div className={cx("flex items-start gap-3 rounded-md bg-green-50 text-sm text-ink-strong", compact ? "p-3" : "p-4")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-green-150 text-green-700">
        <Hourglass size={18} strokeWidth={STROKE} aria-hidden className="animate-pulse" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-ink">{t("{name} is still training", { name })}</p>
        <p className="text-ink-muted">{reason ?? t("It is learning from all 5,000 customers right now. Check back in a little while.")}</p>
      </div>
    </div>
  );
}

export function NotForYou({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-sunken p-4 text-sm text-ink-strong">
      <Info size={18} strokeWidth={STROKE} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-ink-muted">{reason}</p>
      </div>
    </div>
  );
}

export function CardSkeleton({ h = 180 }: { h?: number }) {
  return (
    <div className="rounded-app-card bg-card p-4 shadow-app-card" aria-busy="true" aria-label={t("Loading")}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-tile" />
        <div className="flex-1">
          <Skeleton className="mb-1.5 h-3 w-1/3" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </div>
      <Skeleton className="mt-4 w-full rounded-md" />
      <div className="skeleton mt-4 w-full rounded-md" style={{ height: h }} />
      <Skeleton className="mt-3 h-4 w-5/6" />
    </div>
  );
}

/** Footer link of a chat card. */
export function SeeMore({ focus, label }: { focus: YouSection; label?: string }) {
  return (
    <button type="button" onClick={() => openYou(focus)} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-green-700 hover:underline">
      {label ?? t("See more in You")}
      <ArrowRight size={16} strokeWidth={STROKE} aria-hidden />
    </button>
  );
}

/** Percentile among peers: track from "lower" to "higher", median tick, dot at the person's percentile. */
export function PercentileBar({ percentile, color = "#007841", lowLabel, highLabel, bare }: { percentile: number; color?: string; lowLabel?: string; highLabel?: string; bare?: boolean }) {
  const p = Math.max(0, Math.min(100, percentile));
  return (
    <div className="w-full">
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-[8px] h-1 rounded-pill bg-track" />
        <div className="absolute top-[8px] h-1 rounded-pill" style={{ left: p < 50 ? `${p}%` : "50%", width: `${Math.abs(p - 50)}%`, background: color, opacity: 0.45 }} />
        <div className="absolute top-[4px] h-3 w-px bg-icon-muted" style={{ left: "50%" }} aria-hidden />
        <div className="absolute top-[2px] h-4 w-4 -translate-x-1/2 rounded-pill border-2 border-white shadow-low" style={{ left: `${p}%`, background: color }} />
      </div>
      {!bare && (
        <div className="flex justify-between text-[11px] leading-4 text-ink-muted">
          <span>{lowLabel ?? t("Lower")}</span>
          <span>{t("typical")}</span>
          <span>{highLabel ?? t("Higher")}</span>
        </div>
      )}
    </div>
  );
}

/** Pill-shaped stat for small figures inside a card. */
export function MiniStat({ label, value, sub, inverse }: { label: ReactNode; value: ReactNode; sub?: ReactNode; inverse?: boolean }) {
  return (
    <div className={cx("min-w-0 rounded-md px-3 py-2", inverse ? "bg-white/10" : "bg-green-50")}>
      <p className={cx("text-xs", inverse ? "text-hero-meta" : "text-ink-muted")}>{label}</p>
      <p className={cx("tnum text-lg font-bold leading-tight", inverse ? "text-hero-num" : "text-ink")}>{value}</p>
      {sub && <p className={cx("text-xs", inverse ? "text-hero-meta" : "text-ink-muted")}>{sub}</p>}
    </div>
  );
}
