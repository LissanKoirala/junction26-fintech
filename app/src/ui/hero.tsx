// Moodboard-dependent components. Each reads its variant from ui/theme.ts.
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { theme, type HeroVariant } from "./theme";
import { cx, IconButton } from "./kit";

/** The hero block at the top of Today (and the Vara card on Koti). */
export function HeroCard({ children, variant = theme.hero, onClick, label, className }: { children: ReactNode; variant?: HeroVariant; onClick?: () => void; label?: string; className?: string }) {
  const look = {
    card: "bg-card text-ink shadow-app-card",
    deep: "bg-hero-deep text-hero-deep-ink shadow-app-card",
    gradient: "bg-gradient-to-br from-green-150 via-card to-green-100 text-ink shadow-app-card",
  }[variant];
  const cls = cx("block w-full rounded-app-card p-5 text-left", look, className);
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={label} className={cx(cls, "transition-transform duration-200 active:scale-[0.99]")}>
      {children}
    </button>
  ) : (
    <section className={cls} aria-label={label}>{children}</section>
  );
}
/** Whether text inside the hero should use inverse colours. */
export const heroInverse = (variant: HeroVariant = theme.hero) => variant === "deep";
export const heroMuted = (variant: HeroVariant = theme.hero) => (variant === "deep" ? "text-hero-meta" : "text-ink-muted");
export const heroTitle = (variant: HeroVariant = theme.hero) => (variant === "deep" ? "text-hero-meta" : "text-title");

/** Vara's mark: the sprout. `inverse` for use on the deep green hero. */
export function VaraAvatar({ size = 32, inverse }: { size?: number; inverse?: boolean }) {
  if (theme.avatar === "placeholder")
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-pill bg-green-700 font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.48 }}>
        V
      </span>
    );
  const [bg, stem, big, small] = inverse ? ["#91FA9B", "#004628", "#007841", "#004628"] : ["#007841", "#fff", "#91FA9B", "#fff"];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <circle cx="24" cy="24" r="24" fill={bg} />
      <path d="M24 36V22" stroke={stem} strokeWidth="3" strokeLinecap="round" />
      <path d="M24 24c0-6 4-10 10-10 0 6-4 10-10 10Z" fill={big} />
      <path d="M24 28c0-5-3-8-8-8 0 5 3 8 8 8Z" fill={small} />
    </svg>
  );
}

/** Basket label with its colour: a dot (quiet) or a tinted pill (more colour). */
export function BasketTag({ color, label, variant = theme.basketChips }: { color: string; label: ReactNode; variant?: "dot" | "tint" }) {
  if (variant === "tint")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-sm font-semibold text-ink" style={{ background: color + "22" }}>
        <span className="h-2 w-2 rounded-pill" style={{ background: color }} aria-hidden />
        {label}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2 text-base text-ink">
      <span className="h-2.5 w-2.5 shrink-0 rounded-pill" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

/** Header of a full-screen flow or sub-space: back arrow, centred title, optional right slot. */
export function ScreenHeader({ title, onBack, right, leading }: { title: ReactNode; onBack?: () => void; right?: ReactNode; leading?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[48px_1fr_48px] items-center bg-screen px-1 pt-[env(safe-area-inset-top)]">
      <div>{onBack && <IconButton icon={ArrowLeft} label="Back" onClick={onBack} />}</div>
      <h1 className="flex min-h-14 items-center justify-center gap-2 truncate text-center text-lg font-bold text-green-900">
        {leading}
        {title}
      </h1>
      <div className="flex justify-end">{right}</div>
    </header>
  );
}

/** Full-screen flow container (sits above the shell, inside the phone frame). */
export function FullScreen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("absolute inset-0 z-30 flex flex-col overflow-hidden bg-screen", className)}>{children}</div>;
}
export function ScrollArea({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={cx("no-scrollbar flex-1 overflow-y-auto overscroll-contain", className)}>
      {children}
    </div>
  );
}
