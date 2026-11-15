// Crave mode entry points on Today: "Got a craving?" (input, example chips, the motto) and the Crave pot summary.
import { useState } from "react";
import { ArrowRight, ChevronRight, PiggyBank, ShoppingBag } from "lucide-react";
import { CRAVE_MOTTO } from "@shared/crave";
import { money } from "@/lib/format";
import { navigate } from "@/lib/router";
import { useStore } from "@/state/store";
import { Card, cx, IconCircle, STROKE } from "@/ui/kit";
import { potTotals, useCravings } from "./diary";
import { startShop } from "./session";

const EXAMPLES = ["sushi", "wireless headphones", "new sneakers"];

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
      <Card onClick={() => navigate("/crave")} label="Open Crave mode">
        <div className="flex items-center gap-3">
          <IconCircle icon={ShoppingBag} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">Got a craving?</p>
            <p className="text-sm text-ink-muted">{CRAVE_MOTTO}</p>
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
          <p className="text-lg font-bold text-title">Got a craving?</p>
          <p className="text-sm text-ink-muted">Shop it in Crave mode: the full hunt and checkout, nothing ships, the money lands in your savings.</p>
        </div>
      </div>
      <form className="mt-3 flex items-center gap-2 rounded-pill border border-icon-muted bg-card pl-4 pr-1 focus-within:border-green-700 focus-within:ring-2 focus-within:ring-green-200" onSubmit={(e) => { e.preventDefault(); go(text); }}>
        <input aria-label="What are you craving?" value={text} maxLength={80} onChange={(e) => setText(e.target.value)} placeholder="I'm craving…" className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none" />
        <button type="submit" aria-label="Open the shop" className="flex h-9 w-9 items-center justify-center rounded-pill bg-green-700 text-white"><ArrowRight size={18} strokeWidth={STROKE} aria-hidden /></button>
      </form>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
        {EXAMPLES.map((x) => (
          <button key={x} type="button" onClick={() => go(x)} className="min-h-9 shrink-0 rounded-pill border border-green-200 bg-card px-3 text-sm font-medium text-green-900 hover:bg-green-50">{x}</button>
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold italic text-green-700">{CRAVE_MOTTO}</p>
    </Card>
  );
}

export function CravePotCard({ className }: { className?: string }) {
  const list = useCravings();
  const pot = potTotals(list);
  if (!list.length) return null;
  return (
    <Card onClick={() => navigate("/crave/pot")} label="Open your Crave pot" className={cx(className)}>
      <div className="flex items-center gap-3">
        <IconCircle icon={PiggyBank} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">Crave pot</p>
          <p className="text-sm text-ink-muted">{pot.count} {pot.count === 1 ? "craving" : "cravings"} redirected · simulated</p>
        </div>
        <span className="tnum text-lg font-bold text-green-700">{money(pot.total)}</span>
        <ChevronRight size={20} strokeWidth={STROKE} className="text-icon-muted" aria-hidden />
      </div>
    </Card>
  );
}
