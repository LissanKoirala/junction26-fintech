// The UI kit. Every visual decision lives here (and in styles/tokens.css). Feature components compose these.
import { type ButtonHTMLAttributes, type ComponentType, type ReactNode, useId, useState } from "react";
import { ChevronDown, ChevronRight, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { LANGS, LANG_NAMES, setLang, t, useLang } from "@/lib/i18n";

export const STROKE = 1.5;
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

// ------------------------------------------------------------------ layout
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-col gap-3 px-gutter pb-6 pt-2", className)}>{children}</div>;
}

export function Card({
  children, className, onClick, padded = true, as, label,
}: { children: ReactNode; className?: string; onClick?: () => void; padded?: boolean; as?: "section" | "div"; label?: string }) {
  const base = cx("block w-full rounded-app-card bg-card text-left shadow-app-card", padded && "p-4", className);
  if (onClick)
    return (
      <button type="button" onClick={onClick} aria-label={label} className={cx(base, "transition-transform duration-200 active:scale-[0.99]")}>
        {children}
      </button>
    );
  const Tag = as ?? "div";
  return <Tag className={base}>{children}</Tag>;
}

export function CardTitle({ children, right, className, icon }: { children: ReactNode; right?: ReactNode; className?: string; icon?: LucideIcon }) {
  return (
    <div className={cx("flex items-center justify-between gap-2", className)}>
      <h3 className="flex min-w-0 items-center gap-2.5 text-lg font-bold text-title">
        {icon && <IconCircle icon={icon} size={32} />}
        <span className="min-w-0">{children}</span>
      </h3>
      {right}
    </div>
  );
}

export function SectionTitle({ children, right, icon: Icon }: { children: ReactNode; right?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mt-3 flex items-end justify-between gap-2 px-1">
      <h2 className="flex items-center gap-2 text-lg font-bold text-title">
        {Icon && <Icon size={20} strokeWidth={STROKE} className="text-green-700" aria-hidden />}
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-xs font-semibold uppercase tracking-wide text-ink-muted", className)}>{children}</p>;
}
export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-sm text-ink-muted", className)}>{children}</p>;
}
export function Divider() {
  return <hr className="my-1 border-0 border-t border-line" />;
}

// ------------------------------------------------------------------ buttons
type BtnVariant = "primary" | "soft" | "tonal" | "outline" | "ghost";
const btnVariant: Record<BtnVariant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  soft: "bg-accent-soft text-accent-soft-ink hover:bg-green-300-hover",
  tonal: "bg-green-100 text-green-900 hover:bg-green-100-hover",
  outline: "border border-green-700 text-green-700 bg-card hover:bg-green-50",
  ghost: "text-green-700 hover:bg-green-100",
};
export function Button({
  variant = "primary", size = "md", icon: Icon, iconRight: IconR, full, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "md" | "sm"; icon?: LucideIcon; iconRight?: LucideIcon; full?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-pill font-semibold transition duration-200 disabled:opacity-50",
        size === "md" ? "min-h-11 px-5 text-base" : "min-h-9 px-4 text-sm",
        btnVariant[variant],
        full && "w-full",
        className,
      )}
    >
      {Icon && <Icon size={size === "md" ? 20 : 16} strokeWidth={STROKE} aria-hidden />}
      {children}
      {IconR && <IconR size={size === "md" ? 20 : 16} strokeWidth={STROKE} aria-hidden />}
    </button>
  );
}

export function IconButton({
  icon: Icon, label, onClick, className, tone = "plain", badge,
}: { icon: LucideIcon; label: string; onClick?: () => void; className?: string; tone?: "plain" | "tonal"; badge?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-green-900 transition duration-200",
        tone === "tonal" ? "bg-card shadow-app-card hover:bg-green-50" : "hover:bg-green-100-hover",
        className,
      )}
    >
      <Icon size={24} strokeWidth={STROKE} aria-hidden />
      {badge && <span className="absolute right-2 top-2 h-2 w-2 rounded-pill bg-green-500" />}
    </button>
  );
}

export function TextLink({ children, onClick, icon = true }: { children: ReactNode; onClick?: () => void; icon?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-green-700 hover:underline">
      {children}
      {icon && <ChevronRight size={16} strokeWidth={STROKE} aria-hidden />}
    </button>
  );
}

// ------------------------------------------------------------------ chips
export function Chip({
  children, onClick, selected, icon: Icon, className,
}: { children: ReactNode; onClick?: () => void; selected?: boolean; icon?: LucideIcon; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border px-4 text-sm font-medium transition duration-200",
        selected ? "border-green-700 bg-green-700 text-white" : "border-green-200 bg-card text-green-900 hover:bg-green-50",
        className,
      )}
    >
      {Icon && <Icon size={16} strokeWidth={STROKE} aria-hidden className="shrink-0" />}
      <span className="text-left">{children}</span>
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "info" | "warning" | "success" | "accent" }) {
  const t = {
    neutral: "bg-sunken text-ink-strong",
    info: "bg-info-bg text-info",
    warning: "bg-warning-bg text-warning",
    success: "bg-success-bg text-success",
    accent: "bg-green-150 text-green-900",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold", t)}>{children}</span>;
}

/** Colour swatch for a basket or series. */
export function Swatch({ color, size = 10, shape = "dot" }: { color: string; size?: number; shape?: "dot" | "bar" }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{ width: shape === "bar" ? 4 : size, height: shape === "bar" ? size * 1.6 : size, background: color, borderRadius: shape === "bar" ? 2 : 999 }}
    />
  );
}

// ------------------------------------------------------------------ segmented control
export function Segmented<T extends string>({
  value, options, onChange, label, className,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cx("flex rounded-pill bg-card p-1 shadow-app-card", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-10 flex-1 rounded-pill px-2 text-sm font-semibold transition-colors duration-200",
            o.value === value ? "bg-green-700 text-white" : "text-green-900 hover:bg-green-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ list rows
/** Icon tile: ~36px, radius 12, green-100 with a green-700 icon; or tinted with a basket/series colour. */
export function IconCircle({
  icon: Icon, tone = "green", size = 36, color,
}: { icon: LucideIcon; tone?: "green" | "white" | "sunken" | "hero"; size?: number; color?: string }) {
  const bg = {
    green: "bg-green-100 text-green-700",
    white: "bg-card text-green-700",
    sunken: "bg-sunken text-ink-strong",
    hero: "bg-white/10 text-hero-num",
  }[tone];
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-tile", !color && bg)}
      style={{ width: size, height: size, ...(color ? { background: color + "1f", color } : {}) }}
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={STROKE} aria-hidden />
    </span>
  );
}
export const IconTile = IconCircle;

/** Big illustration built from an icon (empty states, flow steps). */
export function IconHero({ icon: Icon, tone = "green" }: { icon: LucideIcon; tone?: "green" | "hero" }) {
  return (
    <span className={cx("relative inline-flex h-20 w-20 items-center justify-center rounded-[24px]", tone === "hero" ? "bg-white/10 text-hero-num" : "bg-green-150 text-green-700")}>
      <span className={cx("absolute -right-1.5 -top-1.5 h-5 w-5 rounded-pill", tone === "hero" ? "bg-hero-num/50" : "bg-green-300")} aria-hidden />
      <Icon size={40} strokeWidth={STROKE} aria-hidden />
    </span>
  );
}

export function ListRow({
  icon, leading, title, subtitle, right, rightSub, onClick, chevron, className, wrap,
}: {
  wrap?: boolean;
  icon?: LucideIcon; leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; rightSub?: ReactNode;
  onClick?: () => void; chevron?: boolean; className?: string;
}) {
  const inner = (
    <>
      {leading ?? (icon && <IconCircle icon={icon} />)}
      <span className="min-w-0 flex-1">
        <span className={cx("block text-base text-ink", !wrap && "truncate")}>{title}</span>
        {subtitle && <span className={cx("block text-sm text-ink-muted", !wrap && "truncate")}>{subtitle}</span>}
      </span>
      {(right || rightSub) && (
        <span className="shrink-0 text-right">
          {right && <span className="tnum block text-base font-semibold text-ink">{right}</span>}
          {rightSub && <span className="tnum block text-sm text-ink-muted">{rightSub}</span>}
        </span>
      )}
      {chevron && <ChevronRight size={20} strokeWidth={STROKE} className="shrink-0 text-icon-muted" aria-hidden />}
    </>
  );
  const cls = cx("flex w-full min-h-14 items-center gap-3 py-2 text-left", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, "rounded-md transition-colors hover:bg-green-50")}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

// ------------------------------------------------------------------ money
export function MoneyText({ children, className, tone }: { children: ReactNode; className?: string; tone?: "in" | "out" }) {
  return <span className={cx("tnum whitespace-nowrap", tone === "in" && "text-green-700", className)}>{children}</span>;
}

/** The one big number on a view. Proportional figures, same sans. */
export function HeroFigure({ value, unit = "€", className, ink = "default" }: { value: string; unit?: string; className?: string; ink?: "default" | "inverse" }) {
  return (
    <span className={cx("pnum inline-flex items-baseline gap-1.5 whitespace-nowrap font-bold tracking-tight", ink === "inverse" ? "text-hero-num" : "text-ink", className)}>
      <span className="text-hero">{value}</span>
      <span className="text-2xl font-semibold">{unit}</span>
    </span>
  );
}

// ------------------------------------------------------------------ progress
export function Progress({ value, label, tone = "accent", className }: { value: number; label: string; tone?: "accent" | "warning" | "inverse"; className?: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const fill = { accent: "bg-accent", warning: "bg-warning-border", inverse: "bg-hero-fill" }[tone];
  const track = tone === "inverse" ? "bg-hero-track" : "bg-track";
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className={cx("h-2 w-full overflow-hidden rounded-pill", track, className)}>
      <motion.div className={cx("h-full rounded-pill", fill)} initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.3, ease: [0, 0, 0.3, 1] }} />
    </div>
  );
}

// ------------------------------------------------------------------ states
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx("skeleton block rounded-sm", className)} />;
}
export function SkeletonCard({ lines = 3, tall }: { lines?: number; tall?: boolean }) {
  return (
    <Card>
      <div aria-busy="true" aria-label={t("Loading")}className="flex flex-col gap-3">
        <Skeleton className="h-5 w-1/2" />
        {tall && <Skeleton className="h-12 w-2/3" />}
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cx("h-4", i % 2 ? "w-3/4" : "w-full")} />
        ))}
      </div>
    </Card>
  );
}

/** Plain "we can't show this right now" state. */
export function Unavailable({ title, reason, compact, action }: { title: string; reason?: string; compact?: boolean; action?: ReactNode }) {
  return (
    <div className={cx("flex items-start gap-3 rounded-md bg-sunken text-sm text-ink-strong", compact ? "p-3" : "p-4")}>
      <Info size={18} strokeWidth={STROKE} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {reason && <p className="text-ink-muted">{reason}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function Banner({
  tone = "info", icon, title, children, action,
}: { tone?: "info" | "warning" | "success" | "error"; icon?: LucideIcon; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const t = {
    info: "bg-info-bg border-info-border text-info",
    warning: "bg-warning-bg border-warning-border text-warning",
    success: "bg-success-bg border-success-border text-success",
    error: "bg-error-bg border-error-border text-error",
  }[tone];
  const I = icon ?? (tone === "warning" || tone === "error" ? TriangleAlert : Info);
  return (
    <div className={cx("flex items-start gap-3 rounded-md border-l-4 p-3 text-sm", t)}>
      <I size={20} strokeWidth={STROKE} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-ink">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-strong">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ disclosure
export function Disclosure({ label, children, icon: Icon, className }: { label: ReactNode; children: ReactNode; icon?: LucideIcon; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-green-700"
      >
        {Icon && <Icon size={16} strokeWidth={STROKE} aria-hidden />}
        {label}
        <ChevronDown size={16} strokeWidth={STROKE} aria-hidden className={cx("transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ inputs
export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink-strong">{label}</label>
      {children(id)}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
export const inputClass =
  "min-h-12 w-full rounded-md border border-icon-muted bg-card px-3 text-base text-ink outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200";

export function Slider({
  label, value, min, max, step = 1, onChange, valueLabel, hint, icon,
}: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; valueLabel: string; hint?: ReactNode; icon?: LucideIcon }) {
  const id = useId();
  const pctPos = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col py-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-2.5 text-base text-ink">
          {icon && <IconCircle icon={icon} size={32} />}
          {label}
        </label>
        <span className="tnum text-base font-semibold text-green-900">{valueLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={valueLabel}
        className="vara-range h-8 w-full cursor-pointer"
        style={{ ["--pos" as string]: `${pctPos}%` }}
      />
      {hint && <div className="text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ concept notice
export function ConceptNotice({ className }: { className?: string }) {
  return (
    <p className={cx("px-4 py-3 text-center text-xs text-ink-muted", className)}>
      {t("Junction 2026 concept · not an official S-Pankki product")}
    </p>
  );
}

// ------------------------------------------------------------------ language switch
/** Compact "EN | FI" switch for the top bars. The screen tree remounts on change, so callers need nothing else. */
export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang();
  return (
    <div role="radiogroup" aria-label={t("App language")} className={cx("inline-flex items-center rounded-pill bg-card p-0.5 text-xs font-bold shadow-app-card", className)}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          lang={l}
          aria-checked={l === lang}
          aria-label={LANG_NAMES[l]}
          title={LANG_NAMES[l]}
          onClick={() => setLang(l)}
          className={cx("min-h-8 min-w-8 rounded-pill px-1.5 tracking-wide transition-colors duration-200", l === lang ? "bg-green-700 text-white" : "text-green-900 hover:bg-green-50")}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export type IconType = LucideIcon | ComponentType<{ size?: number; strokeWidth?: number }>;
