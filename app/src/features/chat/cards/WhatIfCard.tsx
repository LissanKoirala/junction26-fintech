// Interactive what-if: sliders re-run engine.simulateWhatIf in the browser as they move.
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { engine, type Scenario } from "@shared/engine";
import { CardFrame, ChartCaption } from "@/ui/chat";
import { HBars } from "@/ui/charts";
import { Button, Slider } from "@/ui/kit";
import { safe } from "@/lib/safeEngine";
import { money } from "@/lib/format";
import { navigate } from "@/lib/router";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { rich, t } from "@/lib/i18n";
import type { CardOf } from "./util";

export function WhatIfCard({ card }: { card: CardOf<"whatif"> }) {
  const c = useCustomer();
  const opts = useEngineOpts();
  const [pcts, setPcts] = useState(() => card.scenario.adjustments.map((a) => a.changePct));
  const [extra, setExtra] = useState(card.scenario.extraMonthlySaving ?? 0);
  const changed = pcts.some((p, i) => p !== card.scenario.adjustments[i].changePct) || extra !== (card.scenario.extraMonthlySaving ?? 0);
  const scenario: Scenario = useMemo(
    () => ({ ...card.scenario, adjustments: card.scenario.adjustments.map((a, i) => ({ ...a, changePct: pcts[i], label: undefined })), extraMonthlySaving: extra || undefined }),
    [card.scenario, pcts, extra],
  );
  const live = useMemo(() => (c && changed ? safe(() => engine.simulateWhatIf(c, scenario, opts)) : null), [c, changed, scenario, opts]);
  const r = live?.ok ? live.value : card.result;
  const base = card.result.perAdjustment;
  const n = card.scenario.adjustments.length;
  const p12 = r.projections.find((p) => p.months === 12);
  const p60 = r.projections.find((p) => p.months === 60);
  const fmt = (v: number) => money(v, { whole: true });

  // before / after visual: safe-to-spend per week when it moves, otherwise monthly spending in the adjusted areas
  const safeMoves = Math.round(r.safePerWeekAfter) !== Math.round(r.safePerWeekBefore);
  const adj = r.perAdjustment.slice(0, n);
  const spendBefore = adj.reduce((s, a) => s + a.baselineMonthly, 0);
  const spendAfter = adj.reduce((s, a) => s + a.newMonthly, 0);
  const visual = safeMoves
    ? { caption: t("Safe to spend per week"), before: r.safePerWeekBefore, after: r.safePerWeekAfter }
    : n > 0 && spendBefore > 0
      ? { caption: t("Monthly spending in these areas"), before: spendBefore, after: spendAfter }
      : null;

  return (
    <CardFrame icon={SlidersHorizontal} title={card.title ?? t("What if…")} explain={card.explain}>
      <div className="flex flex-col">
        {card.scenario.adjustments.map((a, i) => {
          const name = (base[i]?.label ?? "").replace(/\s*[+−±-]\s*\d+\s*%$/, "") || t("Spending");
          const bm = r.perAdjustment[i];
          return (
            <Slider
              key={i}
              label={name}
              min={-100}
              max={50}
              step={5}
              value={pcts[i]}
              onChange={(v) => setPcts((ps) => ps.map((p, j) => (j === i ? v : p)))}
              valueLabel={`${pcts[i] > 0 ? "+" : pcts[i] < 0 ? "−" : ""}${Math.abs(pcts[i])} %`}
              hint={bm ? t("{from} → {to} a month", { from: fmt(bm.baselineMonthly), to: fmt(bm.newMonthly) }) : undefined}
            />
          );
        })}
        {card.scenario.housingChange ? (
          <p className="py-2 text-base text-ink">
            {rich(
              card.scenario.housingChange < 0
                ? t("Rent lower by **{v}** a month", { v: fmt(Math.abs(card.scenario.housingChange)) })
                : t("Rent higher by **{v}** a month", { v: fmt(Math.abs(card.scenario.housingChange)) }),
            )}
          </p>
        ) : null}
        <Slider label={t("Save extra each month")} min={0} max={300} step={10} value={extra} onChange={setExtra} valueLabel={fmt(extra)} />
      </div>

      {visual && (
        <>
          <ChartCaption>{visual.caption}</ChartCaption>
          <HBars
            items={[
              { key: "before", label: t("Now"), value: visual.before },
              { key: "after", label: t("With this change"), value: visual.after },
            ]}
            format={fmt}
            highlightKey="after"
          />
        </>
      )}

      <div className="tnum mt-4 grid grid-cols-3 gap-2 rounded-md bg-green-50 p-3">
        <div>
          <p className="text-xs text-ink-muted">{t("Freed a month")}</p>
          <p className="text-lg font-bold text-ink">{fmt(r.savedMonthly)}</p>
        </div>
        {p12 && (
          <div>
            <p className="text-xs text-ink-muted">{t("In 1 year")}</p>
            <p className="text-lg font-bold text-ink">{fmt(p12.saved)}</p>
          </div>
        )}
        {p60 && (
          <div>
            <p className="text-xs text-ink-muted">{t("5 years, invested")}</p>
            <p className="text-lg font-bold text-ink">{fmt(p60.invested)}</p>
          </div>
        )}
      </div>
      {r.equivalents[0] && <p className="mt-2 text-sm text-ink-strong">{t("That's {what}.", { what: r.equivalents[0].replace(/^that's\s*/i, "") })}</p>}
      <p className="mt-1 text-xs text-ink-muted">{t("Baseline: {basis}", { basis: r.basis })}</p>
      <Button className="mt-2" size="sm" variant="tonal" onClick={() => navigate("/vara/whatif", { replace: true })}>
        {t("Open in What-if")}
      </Button>
    </CardFrame>
  );
}
