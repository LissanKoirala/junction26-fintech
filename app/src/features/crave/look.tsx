// Visual pieces shared by the Crave screens: accent palette, icons, product image tile with fallback, stars,
// the persistent "Crave mode · nothing ships" pill and confetti.
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Beer, BookOpen, Cake, Camera, Coffee, Dumbbell, Fish, Flower2, Footprints, Gamepad2, Gift, Headphones, Laptop, Pizza, Plane, Salad,
  Shirt, ShoppingBag, Smartphone, Sofa, Soup, Sparkles, Star, UtensilsCrossed, Watch, PackageX, type LucideIcon,
} from "lucide-react";
import type { CraveAccent, CraveIcon } from "@shared/crave";
import { cx, STROKE } from "@/ui/kit";
import { getLang, t } from "@/lib/i18n";

export const ACCENT: Record<CraveAccent, { main: string; soft: string; ink: string }> = {
  teal: { main: "#0f766e", soft: "#ccfbf1", ink: "#134e4a" },
  violet: { main: "#6d28d9", soft: "#ede9fe", ink: "#3b0764" },
  amber: { main: "#b45309", soft: "#fef3c7", ink: "#78350f" },
  indigo: { main: "#4338ca", soft: "#e0e7ff", ink: "#1e1b4b" },
  olive: { main: "#4d7c0f", soft: "#ecfccb", ink: "#1a2e05" },
  plum: { main: "#86198f", soft: "#fae8ff", ink: "#4a044e" },
  ocean: { main: "#0e7490", soft: "#cffafe", ink: "#164e63" },
  terracotta: { main: "#c2410c", soft: "#ffedd5", ink: "#7c2d12" },
  graphite: { main: "#374151", soft: "#e5e7eb", ink: "#111827" },
  rose: { main: "#be185d", soft: "#fce7f3", ink: "#500724" },
};
export const accentOf = (a: string | undefined) => ACCENT[(a as CraveAccent) ?? "teal"] ?? ACCENT.teal;

export const ICON: Record<CraveIcon, LucideIcon> = {
  headphones: Headphones, shirt: Shirt, footprints: Footprints, fish: Fish, pizza: Pizza, coffee: Coffee, gamepad: Gamepad2, sofa: Sofa,
  sparkles: Sparkles, dumbbell: Dumbbell, book: BookOpen, plane: Plane, laptop: Laptop, watch: Watch, utensils: UtensilsCrossed, cake: Cake,
  bag: ShoppingBag, flower: Flower2, camera: Camera, smartphone: Smartphone, salad: Salad, soup: Soup, beer: Beer, gift: Gift,
};
export const iconOf = (i: string | undefined): LucideIcon => ICON[(i as CraveIcon) ?? "bag"] ?? ShoppingBag;

/** Square product photo; while generating: shimmer; if generation failed: a gradient tile with the shop icon. */
export function ProductImage({ src, icon, accent, className, rounded = "rounded-md", alt }: { src?: string | null; icon: LucideIcon; accent: string; className?: string; rounded?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const a = accentOf(accent);
  const Icon = icon;
  const pending = src === undefined;
  return (
    <div className={cx("relative aspect-square w-full overflow-hidden", rounded, className)} style={{ background: `linear-gradient(135deg, ${a.soft}, #ffffff)` }}>
      {(pending || (!loaded && src && !failed)) && <span className="skeleton absolute inset-0" aria-hidden />}
      {(src === null || failed) && (
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: a.main }}>
          <Icon size={40} strokeWidth={STROKE} aria-hidden />
        </span>
      )}
      {src && !failed && (
        <motion.img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={loaded ? { opacity: 1, scale: 1 } : { opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export function Stars({ value, size = 12, count }: { value: number; size?: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
      <Star size={size} strokeWidth={STROKE} className="fill-amber-400 text-amber-500" aria-hidden />
      <span className="tnum font-semibold text-ink">{value.toFixed(1).replace(".", ",")}</span>
      {count != null && <span className="tnum">({count.toLocaleString("fi-FI")})</span>}
    </span>
  );
}

/** Shown on every shop screen: the customer knows the deal. */
export function NothingShipsPill({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-xs font-semibold",
        onDark ? "bg-white/12 text-hero-num" : "bg-green-900 text-green-300",
        className,
      )}
    >
      <PackageX size={14} strokeWidth={STROKE} aria-hidden />
      {t("Crave mode · nothing ships")}
    </span>
  );
}

const CONFETTI = ["#00eb5a", "#91fa9b", "#ffffff", "#ffd166", "#7dd3fc", "#f9a8d4"];
export function Confetti({ count = 44, accent }: { count?: number; accent?: string }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 360,
        y: -(160 + Math.random() * 260),
        r: Math.random() * 540 - 270,
        d: 0.9 + Math.random() * 0.7,
        w: 6 + Math.random() * 6,
        c: i % 7 === 0 && accent ? accent : CONFETTI[i % CONFETTI.length],
      })),
    [count, accent],
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10" aria-hidden>
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="absolute block rounded-[2px]"
          style={{ width: b.w, height: b.w * 0.45, background: b.c }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 420], rotate: b.r, opacity: [1, 1, 0] }}
          transition={{ duration: b.d * 1.8, ease: "easeOut", times: [0, 0.35, 1] }}
        />
      ))}
    </div>
  );
}

/** Example cravings in the current language (the cached demo shops). Call at render time. */
export function craveExamples() {
  const fi = getLang() === "fi";
  return [
    { q: "sushi", icon: Fish },
    { q: fi ? "langattomat kuulokkeet" : "wireless headphones", icon: Headphones },
    { q: fi ? "uudet lenkkarit" : "new sneakers", icon: Footprints },
  ];
}
