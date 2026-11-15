// Money personality (tribe mix, strengths, what sets you apart) and the Money Map.
import { useCallback, useMemo, useState } from "react";
import { Eye, Fingerprint, Map as MapIcon, Sparkle, ThumbsUp } from "lucide-react";
import type { MlProfile, MoneyMap, Tribe } from "@shared/ml/typesA";
import { StackedBar } from "@/ui/charts";
import { MoneyMapCanvas } from "@/ui/charts/MoneyMapCanvas";
import { cx, STROKE } from "@/ui/kit";
import { VaraAvatar } from "@/ui/hero";
import { num, pct } from "@/lib/format";
import { t } from "@/lib/i18n";
import { fmtFeature, tD as tData } from "../words";
import { Caveat, PercentileBar } from "../ui";

const GREY = "#949494";
export function tribeColor(tribes: Tribe[] | null, id: number): string {
  return tribes?.find((x) => x.id === id)?.color ?? GREY;
}

/** Mix as a tall segmented bar with a legend in block order. */
export function TribeMix({ profile, tribes, compact }: { profile: MlProfile; tribes: Tribe[] | null; compact?: boolean }) {
  const mix = [...profile.tribe.mix].sort((a, b) => b.weight - a.weight);
  const shown = compact ? mix.slice(0, 3) : mix;
  return (
    <div>
      <StackedBar
        size="tall"
        label={t("Your tribe mix")}
        format={(v) => pct(v)}
        parts={mix.map((m) => ({ key: String(m.id), label: tData(m.name), value: m.weight, color: tribeColor(tribes, m.id) }))}
      />
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {shown.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-pill" style={{ background: tribeColor(tribes, m.id) }} aria-hidden />
            <span className={cx("min-w-0 flex-1 leading-tight text-ink", m.id === profile.tribe.id && "font-semibold")}>{tData(m.name)}</span>
            <span className="tnum shrink-0 font-semibold text-ink">{pct(m.weight)}</span>
          </li>
        ))}
        {compact && mix.length > shown.length && (
          <li className="pl-[18px] text-xs text-ink-muted">{t("+ {n} more, each under {pct}", { n: mix.length - shown.length, pct: pct(mix[shown.length].weight) })}</li>
        )}
      </ul>
    </div>
  );
}

export function mixHeadline(profile: MlProfile): string {
  const mix = [...profile.tribe.mix].sort((a, b) => b.weight - a.weight);
  const [a, b] = mix;
  if (!a) return tData(profile.tribe.name);
  if (a.weight >= 0.6) return t("Mostly {a}", { a: tData(a.name) });
  if (b && a.weight - b.weight < 0.08) return t("Part {a}, part {b}", { a: tData(a.name), b: tData(b.name) });
  return b ? t("{a}, with a bit of {b}", { a: tData(a.name), b: tData(b.name) }) : tData(a.name);
}

/** Deep-green hero with the tribe mix. */
export function PersonalityHero({ profile, tribes }: { profile: MlProfile; tribes: Tribe[] | null; ageBand?: string }) {
  const main = tribes?.find((x) => x.id === profile.tribe.id);
  return (
    <div className="rounded-app-card bg-hero-deep p-4 text-white shadow-app-card">
      <div className="flex items-center gap-2.5">
        <VaraAvatar size={30} inverse />
        <p className="text-xs font-semibold uppercase tracking-wide text-hero-meta">{t("Your money personality")}</p>
      </div>
      <h2 className="mt-3 text-2xl font-bold leading-tight text-hero-num">{mixHeadline(profile)}</h2>
      {main && <p className="mt-1 text-base text-white">{tData(main.tagline)}</p>}
      <div className="mt-4 rounded-md bg-card p-3">
        <TribeMix profile={profile} tribes={tribes} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-hero-meta">
        {t("Nobody is just one type. These tribes are a simplification of a smooth spread of habits, so this shows how much of each you are.")}
      </p>
    </div>
  );
}

export function TribeStory({ tribe }: { tribe: Tribe }) {
  return (
    <div>
      <p className="text-base leading-snug text-ink">{tData(tribe.description)}</p>
      <p className="mt-2 text-sm leading-snug text-ink-muted">{t("This describes the tribe as a whole, so a figure here can differ from yours. Your own numbers are below.")}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        <ListBox icon={ThumbsUp} title={t("Typical strengths")} items={tribe.strengths} />
        <ListBox icon={Eye} title={t("Typical watch-outs")} items={tribe.watchOuts} />
      </div>
    </div>
  );
}

function ListBox({ icon: Icon, title, items }: { icon: typeof ThumbsUp; title: string; items: string[] }) {
  return (
    <div className="rounded-md bg-green-50 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-green-900">
        <Icon size={16} strokeWidth={STROKE} aria-hidden />
        {title}
      </p>
      <ul className="flex flex-col gap-1.5 text-sm leading-snug text-ink">
        {items.map((s) => (
          <li key={s} className="flex gap-1.5">
            <Sparkle size={12} strokeWidth={STROKE} className="mt-1 shrink-0 text-green-700" aria-hidden />
            <span>{tData(s)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "What sets you apart": highlights as percentile bars among same-age customers. */
export function Highlights({ profile, limit }: { profile: MlProfile; limit?: number }) {
  const hs = profile.highlights.slice(0, limit ?? 6);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] font-semibold text-ink-muted" aria-hidden>
        <span>{t("← lower than peers")}</span>
        <span>{t("typical")}</span>
        <span>{t("higher than peers →")}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {hs.map((h) => {
          const n = Math.max(1, Math.round(h.direction === "high" ? h.percentile : 100 - h.percentile));
          return (
            <li key={h.feature}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 text-sm font-semibold text-ink">{tData(h.label)}</span>
                <span className="tnum shrink-0 text-sm font-semibold text-ink">{fmtFeature(h.value, h.unit)}</span>
              </div>
              <PercentileBar percentile={h.percentile} bare />
              <p className="text-xs text-ink-muted">
                {h.direction === "high"
                  ? t("Higher than {n} of 100 people aged {age}", { n, age: profile.ageBand })
                  : t("Lower than {n} of 100 people aged {age}", { n, age: profile.ageBand })}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Money Map: all customers coloured by tribe; tap a tribe in the legend to highlight it. */
export function MoneyMapView({ map, profile, tribes, height = 300, compactLegend }: { map: MoneyMap; profile: MlProfile | null; tribes: Tribe[] | null; height?: number; compactLegend?: boolean }) {
  const [hl, setHl] = useState<number | null>(null);
  const list = tribes ?? map.tribes;
  const colors = useMemo(() => new Map(list.map((x) => [x.id, x.color])), [list]);
  const colorOf = useCallback((g: number) => colors.get(g) ?? GREY, [colors]);
  const you = profile ? { x: profile.map.x, y: profile.map.y, color: colorOf(profile.tribe.id) } : null;
  const sorted = [...list].sort((a, b) => b.share - a.share);
  const n = num(map.ids.length);
  return (
    <div>
      <MoneyMapCanvas
        xs={map.x}
        ys={map.y}
        groups={map.tribe}
        colorOf={colorOf}
        you={you}
        highlight={hl}
        height={height}
        onTap={() => setHl(null)}
        ariaLabel={
          profile
            ? t("Map of {n} customers coloured by tribe; you sit with the {tribe} tribe.", { n, tribe: tData(profile.tribe.name) })
            : t("Map of {n} customers coloured by tribe.", { n })
        }
      />
      <div className={cx("mt-3 flex flex-wrap gap-1.5", compactLegend && "gap-1")} role="group" aria-label={t("Highlight a tribe")}>
        {sorted.map((tr) => {
          const on = hl === tr.id;
          return (
            <button
              key={tr.id}
              type="button"
              aria-pressed={on}
              onClick={() => setHl(on ? null : tr.id)}
              className={cx(
                "inline-flex min-h-9 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition-colors",
                on ? "border-green-900 bg-green-900 text-white" : hl != null ? "border-line bg-card text-ink-muted" : "border-green-200 bg-card text-ink",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-pill" style={{ background: tr.color }} aria-hidden />
              {tData(tr.name)}
              <span className={cx("tnum", on ? "text-white/80" : "text-ink-muted")}>{pct(tr.share)}</span>
            </button>
          );
        })}
      </div>
      {hl != null && (() => {
        const tr = list.find((x) => x.id === hl);
        return tr ? <p className="mt-2 text-sm text-ink-strong"><span className="font-semibold">{tData(tr.name)}:</span> {tData(tr.tagline)}</p> : null;
      })()}
    </div>
  );
}

export const PersonalityIcons = { Fingerprint, MapIcon };
export function MapCaveat() {
  return <Caveat>{t("Each dot is one customer, placed so that people who spend in similar ways sit close together. The axes have no units; only closeness matters.")}</Caveat>;
}
