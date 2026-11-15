// Story surface for the weekly check-in (full screen, progress segments). Visuals live here, not in the feature.
import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { t } from "@/lib/i18n";
import { cx, IconHero, STROKE } from "./kit";

export function StorySegments({ count, index, label }: { count: number; index: number; label: string }) {
  return (
    <div className="flex gap-1" role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={count} aria-valuenow={index + 1}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-1 flex-1 overflow-hidden rounded-pill bg-hero-track">
          <motion.span
            className="block h-full rounded-pill bg-hero-fill"
            initial={false}
            animate={{ width: i < index ? "100%" : i === index ? "100%" : "0%" }}
            transition={{ duration: i === index ? 0.3 : 0 }}
          />
        </span>
      ))}
    </div>
  );
}

export function StorySurface({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-hero-deep text-white">{children}</div>;
}

export function StoryClose({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={t("Close check-in")} className="flex h-11 w-11 items-center justify-center rounded-pill text-white hover:bg-white/10">
      <X size={24} strokeWidth={STROKE} aria-hidden />
    </button>
  );
}

export function StoryText({ eyebrow, title, body, icon }: { eyebrow: string; title: string; body: string; icon?: LucideIcon }) {
  return (
    <div>
      {icon && <div className="mb-5"><IconHero icon={icon} tone="hero" /></div>}
      <p className="text-sm font-semibold uppercase tracking-wide text-hero-num">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold leading-tight text-white">{title}</h2>
      <p className="mt-3 text-lg text-hero-meta">{body}</p>
    </div>
  );
}

/** A white card on the story background (hosts a chat CardSpec). */
export function StoryCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-app-card bg-card p-4 text-ink shadow-middle", className)}>{children}</div>;
}
