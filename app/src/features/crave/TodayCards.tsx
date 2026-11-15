// Crave mode entry points on Today: "Got a craving?" (input, example chips, the motto) and the Crave pot summary.
import { useState } from "react";
import { ArrowRight, ChevronRight, PiggyBank, ShoppingBag } from "lucide-react";
import { CRAVE_MOTTO } from "@shared/crave";
import { money } from "@/lib/format";
import { navigate } from "@/lib/router";
import { t, tn } from "@/lib/i18n";
import { useStore } from "@/state/store";
import { Card, cx, IconCircle, STROKE } from "@/ui/kit";
import { potTotals, useCravings } from "./diary";
import { startShop } from "./session";
import { craveExamples } from "./look";


export function CraveEntryCard({ compact }: { compact?: boolean }) {
  const [text, setText] = useState("");
  const customerId = useStore((s) => s.customerId);
  const go = (q: string) => {
    const v = q.trim();
    if (!v) return navigate("/crave");
    startShop(v, customerId);
    navigate(`/crave?q=${encodeURIComponent(v)}`);
  };
  if (compact)
    return (
      <Card onClick={() => navigate("/crave")} label={t("Open Crave mode")}>
        <div className="flex items-center gap-3">
          <IconCircle icon={ShoppingBag} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{t("Got a craving?")}</p>
            <p className="text-sm text-ink-muted">{t(CRAVE_MOTTO)}</p>
          </div>
          <ChevronRight size={20} strokeWidth={STROKE} className="text-icon-muted" aria-hidden />
        </div>
      </Card>
    );
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconCircle icon={ShoppingBag} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-title">{t("Got a craving?")}</p>
          <p className="text-sm text-ink-muted">{t("Shop it in Crave mode: the full hunt and checkout, nothing ships, the money lands in your savings.")}</p>
        </div>
      </div>
      <form className="mt-3 flex items-center gap-2 rounded-pill border border-icon-muted bg-card pl-4 pr-1 focus-within:border-green-700 focus-within:ring-2 focus-within:ring-green-200" onSubmit={(e) => { e.preventDefault(); go(text); }}>
        <input aria-label={t("What are you craving?")} value={text} maxLength={80} onChange={(e) => setText(e.target.value)} placeholder={t("I'm craving…")} className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none" />
        <button type="submit" aria-label={t("Open the shop")} className="flex h-9 w-9 items-center justify-center rounded-pill bg-green-700 text-white"><ArrowRight size={18} strokeWidth={STROKE} aria-hidden /></button>
      </form>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
        {craveExamples().map(({ q: x }) => (
          <button key={x} type="button" onClick={() => go(x)} className="min-h-9 shrink-0 rounded-pill border border-green-200 bg-card px-3 text-sm font-medium text-green-900 hover:bg-green-50">{x}</button>
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold italic text-green-700">{t(CRAVE_MOTTO)}</p>
    </Card>
  );
}

export function CravePotCard({ className }: { className?: string }) {
  const list = useCravings();
  const pot = potTotals(list);
  if (!list.length) return null;
  return (
    <Card onClick={() => navigate("/crave/pot")} label={t("Open your Crave pot")} className={cx(className)}>
      <div className="flex items-center gap-3">
        <IconCircle icon={PiggyBank} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{t("Crave pot")}</p>
          <p className="text-sm text-ink-muted">{tn("{n} craving redirected", "{n} cravings redirected", pot.count)} · {t("simulated")}</p>
        </div>
        <span className="tnum text-lg font-bold text-green-700">{money(pot.total)}</span>
        <ChevronRight size={20} strokeWidth={STROKE} className="text-icon-muted" aria-hidden />
      </div>
    </Card>
  );
}
