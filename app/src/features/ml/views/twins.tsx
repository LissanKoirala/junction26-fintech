// Two Futures: what happened next to money twins (built a buffer / held steady / slipped).
import type { MlTwins } from "@shared/ml/typesA";
import { TwoFuturesChart, type FuturePath } from "@/ui/charts/TwoFuturesChart";
import { addMonths, monthAbbr, money, num } from "@/lib/format";
import { t } from "@/lib/i18n";
import { tD as tData } from "../words";
import { cx, Disclosure } from "@/ui/kit";
import { Users } from "lucide-react";

export const TWIN_COLORS: Record<string, string> = { built: "#007841", held: "#00A1C5", slipped: "#CF8300" };
/** English keys, translated where shown. */
const SHORT: Record<string, string> = { built: "Built a buffer", held: "Held steady", slipped: "Slipped" };
const short = (k: string, fallback: string) => (SHORT[k] ? t(SHORT[k]) : tData(fallback));

export function twinsFutures(tw: MlTwins): FuturePath[] {
  const order = ["built", "held", "slipped"];
  return [...tw.groups]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((g) => ({
      key: g.key,
      label: short(g.key, g.label),
      color: TWIN_COLORS[g.key] ?? "#949494",
      path: g.path.map((p) => ({ month: p.month, p25: tw.you.balance + p.p25, p50: tw.you.balance + p.p50, p75: tw.you.balance + p.p75 })),
    }));
}

export function TwinsChart({ t: tw, compact, height }: { t: MlTwins; compact?: boolean; height?: number }) {
  const ml = (m: number) => {
    const iso = addMonths(tw.asOf, m);
    return `${monthAbbr(iso)} ${iso.slice(2, 4)}`;
  };
  return (
    <TwoFuturesChart
      past={tw.you.pastPath}
      futures={twinsFutures(tw)}
      format={(v) => money(v, { whole: true })}
      monthLabel={ml}
      compact={compact}
      height={height ?? (compact ? 210 : 260)}
    />
  );
}

export function twinsMeaning(tw: MlTwins): string {
  const g = (k: string) => tw.groups.find((x) => x.key === k);
  const built = g("built"), slipped = g("slipped");
  const parts: string[] = [];
  if (built) parts.push(t("{n} of them grew their balance by about {amount}", { n: built.n, amount: money(Math.abs(built.bufferChange), { whole: true }) }));
  if (slipped)
    parts.push(
      slipped.bufferChange < 0
        ? t("{n} lost about {amount}", { n: slipped.n, amount: money(Math.abs(slipped.bufferChange), { whole: true }) })
        : t("{n} grew it by only {amount}", { n: slipped.n, amount: money(slipped.bufferChange, { whole: true }) }),
    );
  return t("A year ago, {n} customers had habits like yours today. Over the next 12 months {parts}.", { n: tw.nTwins, parts: parts.join(t(", while ")) });
}

/** The clearest behaviour differences between builders and slippers, with paired bars. */
export function TwinDifferences({ t: tw, limit = 3 }: { t: MlTwins; limit?: number }) {
  const diffs = tw.differences.slice(0, limit);
  return (
    <ul className="flex flex-col gap-3">
      {diffs.map((d) => {
        const max = Math.max(1e-9, Math.abs(d.built), Math.abs(d.slipped));
        const f = (v: number) => (d.unit.includes("€") ? money(v, { whole: true }) : `${num(v, Math.abs(v) < 10 ? 1 : 0)}${d.unit === "%" ? " %" : ""}`);
        return (
          <li key={d.key} className="rounded-md bg-green-50 p-3">
            <p className="text-sm leading-snug text-ink">{tData(d.insight)}</p>
            <div className="mt-2 flex flex-col gap-1">
              {(["built", "slipped"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-[92px] shrink-0 text-ink-muted">{t(SHORT[k])}</span>
                  <span className="h-2 min-w-0 flex-1">
                    <span className="block h-full rounded-r-[4px]" style={{ width: `${(Math.abs(d[k]) / max) * 100}%`, background: TWIN_COLORS[k] }} />
                  </span>
                  <span className="tnum w-[64px] shrink-0 text-right font-semibold text-ink">{f(d[k])}</span>
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TwinsLegend({ t: tw }: { t: MlTwins }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-strong">
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded-pill bg-ink" aria-hidden />
        {t("You, last 12 months")}
      </li>
      {twinsFutures(tw).map((f) => (
        <li key={f.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-pill" style={{ background: f.color }} aria-hidden />
          {f.label} ({tw.groups.find((g) => g.key === f.key)?.n})
        </li>
      ))}
      <li className="flex items-center gap-1.5 text-ink-muted">
        <span className="h-2.5 w-4 rounded-sm bg-ink/10" aria-hidden />
        {t("middle half of each group")}
      </li>
    </ul>
  );
}

export function TwinsMatched({ t: tw }: { t: MlTwins }) {
  return (
    <Disclosure label={t("How your {n} twins were chosen", { n: tw.nTwins })} icon={Users}>
      <div className="pb-1 text-sm">
        <p className="mb-2 text-ink-muted">{tData(tw.quality.note)}</p>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1">
          <span className="text-xs text-ink-muted">{t("Matched on")}</span>
          <span className="text-right text-xs text-ink-muted">{t("You now")}</span>
          <span className="text-right text-xs text-ink-muted">{t("Twins then")}</span>
          {tw.matchedOn.map((m) => {
            const f = (v: number) => (m.unit.includes("€") ? money(v, { whole: true }) : `${num(v, Math.abs(v) < 10 ? 1 : 0)}${m.unit === "%" ? " %" : m.unit ? " " + tData(m.unit) : ""}`);
            return (
              <div key={m.feature} className={cx("contents")}>
                <span className="min-w-0 text-ink">{tData(m.label)}</span>
                <span className="tnum text-right text-ink">{f(m.yours)}</span>
                <span className="tnum text-right text-ink-muted">{f(m.twinsMedian)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Disclosure>
  );
}
