// Chat visuals: bubbles, activity line, card frame with "How I got this", number-guard line, input bar parts.
// All chat styling lives here so a re-skin stays kit-level.
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ShieldCheck, TriangleAlert, Search, type LucideIcon } from "lucide-react";
import type { Explain } from "@shared/chat";
import { periodLabel } from "@/lib/format";
import { t, tn } from "@/lib/i18n";
import { cx, Disclosure, IconCircle, STROKE } from "./kit";
import { VaraAvatar } from "./hero";

export function UserBubble({ children }: { children: ReactNode }) {
  // the parent row is a flex container; ml-auto pushes the bubble right
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-[6px] bg-green-700 px-4 py-2.5 text-base text-white"
    >
      {children}
    </motion.div>
  );
}

/** Vara's turn: avatar + content column. */
export function VaraTurn({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="pt-1">
        <VaraAvatar size={28} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function VaraText({ children, streaming }: { children: ReactNode; streaming?: boolean }) {
  return (
    <div className="max-w-full whitespace-pre-wrap rounded-[20px] rounded-tl-[6px] bg-card px-4 py-2.5 text-base text-ink shadow-app-card">
      {children}
      {streaming && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-green-700 align-baseline" aria-hidden />}
    </div>
  );
}

export function ActivityLine({ label }: { label: string }) {
  return (
    <motion.div
      key={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      role="status"
      className="flex items-center gap-2 px-1 text-sm text-ink-muted"
    >
      <span className="dot-pulse inline-flex gap-0.5" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-pill bg-green-500" />
        <span className="h-1.5 w-1.5 rounded-pill bg-green-500" />
        <span className="h-1.5 w-1.5 rounded-pill bg-green-500" />
      </span>
      {label}
    </motion.div>
  );
}

/** Frame around every chat card: header (icon tile + title), body, "How I got this". */
export function CardFrame({
  title, icon, eyebrow, right, children, explain, className,
}: { title?: ReactNode; icon?: LucideIcon; eyebrow?: ReactNode; right?: ReactNode; children: ReactNode; explain?: Explain; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.26, ease: [0, 0, 0.3, 1] }}
      className={cx("w-full rounded-app-card bg-card p-4 shadow-app-card", className)}
    >
      {(title || icon) && (
        <header className="mb-3 flex items-center gap-3">
          {icon && <IconCircle icon={icon} />}
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{eyebrow}</p>}
            {title && <h3 className="text-base font-bold leading-snug text-title">{title}</h3>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      {children}
      {explain && <ExplainDrawer explain={explain} />}
    </motion.section>
  );
}

/** Small caption above a chart inside a card. */
export function ChartCaption({ children }: { children: ReactNode }) {
  return <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">{children}</p>;
}

/** Legend row: swatch, label, value. Text stays in ink; the swatch carries the colour. */
export function LegendRow({ color, label, value }: { color: string; label: ReactNode; value: ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-pill" style={{ background: color }} aria-hidden />
      <span className="min-w-0 flex-1 leading-tight text-ink">{label}</span>
      <span className="tnum shrink-0 font-semibold text-ink">{value}</span>
    </li>
  );
}

export function ExplainDrawer({ explain }: { explain: Explain }) {
  const rows: [string, ReactNode][] = [];
  if (explain.period) rows.push([t("Period"), periodLabel(explain.period)]);
  if (explain.filters?.length) rows.push([t("Filters"), explain.filters.join(" · ")]);
  if (explain.txCount != null) rows.push([t("Transactions"), explain.txCount.toLocaleString("fi-FI")]);
  if (explain.formula) rows.push([t("Formula"), explain.formula]);
  if (explain.model) rows.push([t("Model"), `${explain.model.name} · ${explain.model.metric}`]);
  if (explain.source) rows.push([t("Source"), explain.source]);
  rows.push([t("Computed by"), <code key="t" className="text-xs">{explain.tool}</code>]);
  return (
    <div className="mt-2 border-t border-line">
      <Disclosure label={t("How I got this")} icon={Search}>
        <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 pb-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="min-w-0 break-words text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </div>
  );
}

export function CheckLine({ verified, unverified, note }: { verified: boolean; unverified: string[]; note?: string }) {
  if (verified || !unverified.length)
    return (
      <p className="flex items-center gap-1.5 px-1 text-xs text-ink-muted">
        <ShieldCheck size={14} strokeWidth={STROKE} aria-hidden className="text-green-700" />
        {t("Numbers checked against your transactions")}{note ? ` · ${note}` : ""}
      </p>
    );
  return (
    <div className="flex items-start gap-2 rounded-md bg-warning-bg px-3 py-2 text-sm text-ink" role="note">
      <TriangleAlert size={16} strokeWidth={STROKE} aria-hidden className="mt-0.5 shrink-0 text-warning" />
      <span>
        {tn("I couldn't match this figure to your transactions:", "I couldn't match these figures to your transactions:", unverified.length)}{" "}
        <span className="font-semibold">{unverified.join(", ")}</span>.{" "}
        {tn("Treat it with care; the cards above are exact.", "Treat them with care; the cards above are exact.", unverified.length)}
      </span>
    </div>
  );
}

/** Pill-shaped composer container. */
export function Composer({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-line bg-card px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5">
      <div className="flex items-end gap-2">{children}</div>
    </div>
  );
}
export const composerInputClass =
  "no-scrollbar max-h-32 min-h-11 w-full min-w-0 flex-1 resize-none rounded-[22px] border border-line bg-sunken px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-muted focus:border-green-700 focus:bg-card";

export function RoundAction({ label, onClick, children, active, disabled, variant = "primary", onPointerDown, onPointerUp, onPointerLeave }: {
  label: string; onClick?: (e: React.MouseEvent) => void; children: ReactNode; active?: boolean; disabled?: boolean; variant?: "primary" | "plain";
  onPointerDown?: (e: React.PointerEvent) => void; onPointerUp?: (e: React.PointerEvent) => void; onPointerLeave?: (e: React.PointerEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      className={cx(
        "flex h-11 w-11 shrink-0 touch-none select-none items-center justify-center rounded-pill transition duration-200 disabled:opacity-40",
        variant === "primary" ? "bg-green-700 text-white" : "bg-green-100 text-green-900",
        active && "scale-110 bg-green-500 text-white ring-4 ring-green-200",
      )}
    >
      {children}
    </button>
  );
}

export function TinyToggle<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center rounded-pill bg-sunken p-0.5 text-xs font-semibold">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx("min-h-7 rounded-pill px-1.5", o.value === value ? "bg-card text-green-900 shadow-low" : "text-ink-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Big number line used by stat cards. */
export function StatValue({ value, sub }: { value: string; sub?: ReactNode }) {
  return (
    <div>
      <p className="pnum text-3xl font-bold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

export function DeltaPill({ text, tone }: { text: string; tone: "good" | "bad" | "neutral" }) {
  const t = { good: "bg-success-bg text-success", bad: "bg-warning-bg text-warning", neutral: "bg-sunken text-ink-strong" }[tone];
  return <span className={cx("tnum inline-flex rounded-pill px-2 py-0.5 text-xs font-semibold", t)}>{text}</span>;
}
