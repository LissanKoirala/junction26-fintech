// Baskets explorer: the sponsor's three baskets with drill-down to transactions and "move to another basket".
import { useMemo, useState } from "react";
import { ArrowRightLeft, Check, Lightbulb, RotateCcw } from "lucide-react";
import { engine, type BasketSummary, type PeriodName } from "@shared/engine";
import type { Basket, Category, Tx } from "@shared/types";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { actions, usePrefs } from "@/state/store";
import { useEngine } from "@/lib/safeEngine";
import { dateShort, money, pct, periodLabel } from "@/lib/format";
import { goBack, navigate, useRoute } from "@/lib/router";
import { BASKETS, basketColor, basketIcon, basketMeta, categoryIcon, categoryLabel, mccLabel, ruleKey, txTitle } from "@/lib/domain";
import { FullScreen, ScreenHeader, ScrollArea, BasketTag } from "@/ui/hero";
import { Badge, Banner, Button, Card, CardTitle, ConceptNotice, cx, IconCircle, ListRow, Muted, Page, Segmented, SkeletonCard, STROKE, Unavailable } from "@/ui/kit";
import { Sheet } from "@/ui/Sheet";
import { StackedBar } from "@/ui/charts";

type PeriodKey = "this_month" | "last_month" | "last_3_months";
const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "3 months" },
];

/** One friendly line per basket with the sponsor's example. */
const FRIENDLY: Record<Basket, string> = {
  must_regular: "Comes back every month, like rent. Plan it once and it stops being a surprise.",
  must_irregular: "Can't skip it, can't schedule it, like a broken washing machine. A small buffer turns these into non-events.",
  everyday: "Small choices that slip through your fingers, like coffees. This is where small changes add up fastest.",
};

export default function BasketsExplorer() {
  const c = useCustomer();
  const opts = useEngineOpts();
  const prefs = usePrefs();
  const route = useRoute();
  const periodKey = (PERIODS.some((p) => p.value === route.query.get("p")) ? route.query.get("p") : "this_month") as PeriodKey;
  const selBasket = route.query.get("b") as Basket | null;
  const selCat = route.query.get("c") as Category | null;

  const setQuery = (p: PeriodKey, b?: Basket | null, cat?: string | null, replace = false) => {
    const q = new URLSearchParams({ p });
    if (b) q.set("b", b);
    if (cat) q.set("c", cat);
    navigate("/flow/baskets?" + q.toString(), { replace });
  };

  const period = useEngine(c ? () => engine.resolvePeriod(c.asOf, periodKey as PeriodName) : null, [c, periodKey]);
  const res = useEngine(c && period?.ok ? () => engine.getBaskets(c, period.value, opts) : null, [c, period, opts]);

  const nOverrides = Object.keys(prefs.overrides.byTx ?? {}).length + Object.keys(prefs.overrides.byRule ?? {}).length;
  const drill = selBasket && selCat;

  return (
    <FullScreen>
      <ScreenHeader
        title={drill ? categoryLabel(selCat) : "Your three baskets"}
        onBack={() => goBack("/vara/today")}
      />
      <ScrollArea>
        <Page>
          {!drill && (
            <Segmented label="Period" value={periodKey} options={PERIODS} onChange={(p) => setQuery(p, null, null, true)} />
          )}
          {prefs.learned.length > 0 && !drill && (
            <Banner
              tone="success"
              icon={Lightbulb}
              title="What Vara learned from you"
              action={
                <Button size="sm" variant="ghost" icon={RotateCcw} onClick={actions.resetOverrides}>
                  Undo all my changes
                </Button>
              }
            >
              <ul className="flex flex-col gap-0.5">
                {prefs.learned.slice(0, 3).map((l) => (
                  <li key={l.at}>{l.text}</li>
                ))}
              </ul>
            </Banner>
          )}
          {!c || !res ? (
            <>
              <SkeletonCard tall />
              <SkeletonCard />
            </>
          ) : !res.ok ? (
            <Unavailable title="Baskets not available right now" reason={res.notImplemented ? "Vara's calculator is being updated." : res.error} />
          ) : drill ? (
            <DrillDown basket={selBasket} category={selCat} period={res.value.period} />
          ) : (
            <>
              <Card>
                <p className="text-sm text-ink-muted">{periodLabel(res.value.period)}</p>
                <p className="mt-0.5 text-base text-ink">
                  You spent <span className="tnum font-bold">{money(res.value.spending, { whole: true })}</span>
                  {res.value.income > 0 && (
                    <>
                      {" "}
                      with <span className="tnum font-bold">{money(res.value.income, { whole: true })}</span> coming in
                    </>
                  )}
                  .
                </p>
                <div className="mt-3">
                  <StackedBar
                    size="tall"
                    label="Spending by basket"
                    format={(v) => money(v, { whole: true })}
                    parts={res.value.baskets.map((b) => ({ key: b.basket, label: basketMeta(b.basket).label, value: b.total, color: basketColor(b.basket) }))}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {BASKETS.map((b) => (
                    <span key={b} className="text-sm">
                      <BasketTag color={basketColor(b)} label={<span className="text-sm">{basketMeta(b).short}</span>} variant="dot" />
                    </span>
                  ))}
                </div>
                {nOverrides > 0 && (
                  <p className="mt-2 text-xs text-ink-muted">
                    Includes your own sorting ({res.value.overridesApplied} transaction{res.value.overridesApplied === 1 ? "" : "s"} moved in this period).
                  </p>
                )}
              </Card>
              {res.value.baskets.map((b) => (
                <BasketCard key={b.basket} b={b} onCategory={(cat) => setQuery(periodKey, b.basket, cat)} />
              ))}
              <Muted className="px-1">
                Vara makes a first guess for every purchase from its category and merchant type. You know your life better: tap
                any purchase to move it.
              </Muted>
            </>
          )}
          <ConceptNotice />
        </Page>
      </ScrollArea>
    </FullScreen>
  );
}

function BasketCard({ b, onCategory }: { b: BasketSummary; onCategory: (cat: string) => void }) {
  const m = basketMeta(b.basket);
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconCircle icon={basketIcon(b.basket)} color={m.color} size={40} />
          <div className="min-w-0">
            <p className="text-lg font-bold text-title">{m.label}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{m.tagline}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum text-lg font-bold">{money(b.total, { whole: true })}</p>
          <p className="tnum text-sm text-ink-muted">{pct(b.share)} of spending</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-strong">{FRIENDLY[b.basket]}</p>
      {b.categories.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Nothing in this basket in this period.</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {b.categories.map((cat) => (
            <li key={cat.key}>
              <ListRow
                icon={categoryIcon(cat.key)}
                title={cat.label}
                subtitle={`${cat.count} payment${cat.count === 1 ? "" : "s"}`}
                right={money(cat.total, { whole: true })}
                chevron
                onClick={() => onCategory(cat.key)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DrillDown({ basket, category, period }: { basket: Basket; category: Category; period: { from: string; to: string; label?: string } }) {
  const c = useCustomer();
  const opts = useEngineOpts();
  const prefs = usePrefs();
  const [moving, setMoving] = useState<Tx | null>(null);
  const q = useEngine(
    c ? () => engine.querySpending(c, { period, baskets: [basket], categories: [category], includeTransactions: true, limit: 500 }, opts) : null,
    [c, opts, basket, category, period.from, period.to],
  );
  const txs = useMemo(() => (q?.ok ? [...(q.value.transactions ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.i - a.i)) : []), [q]);
  const m = basketMeta(basket);
  if (!q) return <SkeletonCard />;
  if (!q.ok) return <Unavailable title="Transactions not available right now" reason={q.error} />;
  const isMine = (t: Tx) => prefs.overrides.byTx?.[t.i] != null || prefs.overrides.byRule?.[ruleKey(t)] != null;
  return (
    <>
      <Card>
        <div className="flex items-center gap-2.5">
          <IconCircle icon={basketIcon(basket)} color={m.color} size={32} />
          <span className="font-semibold">{m.label}</span>
        </div>
        <p className="mt-2 text-base text-ink">
          <span className="tnum font-bold">{money(q.value.total)}</span> on {categoryLabel(category).toLowerCase()} · {q.value.count} payment
          {q.value.count === 1 ? "" : "s"}
        </p>
        <Muted>{periodLabel(period)}</Muted>
      </Card>
      <Card padded={false} className="px-4 py-1">
        {txs.length === 0 ? (
          <p className="py-4 text-sm text-ink-muted">Nothing left here: you moved these to another basket.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {txs.map((t) => (
              <li key={t.i}>
                <ListRow
                  icon={categoryIcon(t.category)}
                  title={
                    <span className="flex items-center gap-2">
                      <span className="truncate">{txTitle(t)}</span>
                      {isMine(t) && <Badge tone="accent">Your choice</Badge>}
                    </span>
                  }
                  subtitle={`${dateShort(t.date)} · ${t.time.slice(0, 5)}`}
                  right={money(t.amount)}
                  onClick={() => setMoving(t)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {q.value.count > txs.length && <Muted className="px-1">Showing the {txs.length} largest of {q.value.count}.</Muted>}
      <MoveSheet tx={moving} current={basket} onClose={() => setMoving(null)} />
    </>
  );
}

function MoveSheet({ tx, current, onClose }: { tx: Tx | null; current: Basket; onClose: () => void }) {
  const [target, setTarget] = useState<Basket | null>(null);
  const [all, setAll] = useState(true);
  const close = () => {
    setTarget(null);
    setAll(true);
    onClose();
  };
  if (!tx) return <Sheet open={false} onClose={close} title="">{null}</Sheet>;
  const kind = mccLabel(tx.mcc) ?? categoryLabel(tx.category);
  const similarLabel = tx.mcc && mccLabel(tx.mcc) ? `all ${kind.toLowerCase()} purchases` : `all ${categoryLabel(tx.category).toLowerCase()} purchases without a merchant type`;
  const save = () => {
    if (!target) return;
    const to = basketMeta(target).label;
    if (all) actions.overrideRule(ruleKey(tx), target, `Got it: ${similarLabel} now count as ${to}. Vara will sort new ones the same way.`);
    else actions.overrideTx(tx.i, target, `Moved one ${kind.toLowerCase()} purchase (${money(tx.amount)}, ${dateShort(tx.date)}) to ${to}.`);
    close();
  };
  return (
    <Sheet
      open={!!tx}
      onClose={close}
      title="Move to another basket"
      footer={
        <Button full disabled={!target} icon={Check} onClick={save}>
          {target ? `Move to ${basketMeta(target).label}` : "Choose a basket"}
        </Button>
      }
    >
      <div className="flex items-center gap-3 rounded-md bg-sunken p-3">
        <IconCircle icon={categoryIcon(tx.category)} tone="white" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{txTitle(tx)}</p>
          <p className="text-sm text-ink-muted">{dateShort(tx.date)} · {categoryLabel(tx.category)}</p>
        </div>
        <span className="tnum font-semibold">{money(tx.amount)}</span>
      </div>
      <p className="mt-4 text-sm text-ink-strong">Which basket does this really belong in for you?</p>
      <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label="Basket">
        {BASKETS.map((b) => {
          const m = basketMeta(b);
          const isCur = b === current;
          const sel = target === b;
          return (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={sel}
              disabled={isCur}
              onClick={() => setTarget(b)}
              className={cx(
                "flex min-h-14 items-start gap-3 rounded-md border p-3 text-left transition-colors duration-200",
                sel ? "border-green-700 bg-green-50" : "border-line bg-card",
                isCur && "opacity-60",
              )}
            >
              <IconCircle icon={basketIcon(b)} color={m.color} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {m.label}
                  {isCur && <span className="font-normal text-ink-muted"> · now</span>}
                </span>
                <span className="block text-sm text-ink-muted">{m.tagline}, like {m.example}</span>
              </span>
              {sel && <Check size={20} strokeWidth={STROKE} className="shrink-0 text-green-700" aria-hidden />}
            </button>
          );
        })}
      </div>
      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-5 w-5 accent-green-700" />
        <span className="text-sm text-ink">
          <ArrowRightLeft size={14} strokeWidth={STROKE} className="mr-1 inline" aria-hidden />
          Also move {similarLabel}
        </span>
      </label>
    </Sheet>
  );
}
