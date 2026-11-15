// After "payment": a real-looking order confirmation, then the twist on a deep-green hero: nothing is on its way,
// the money flew into the Crave pot. Real engine numbers put it in context; the cooling-off offer keeps it the
// customer's choice.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Check, Inbox, MessageCircle, PackageCheck, PiggyBank, RotateCcw, ShoppingBag, Target, Truck, Bike } from "lucide-react";
import type { CraveEntry, CraveProduct, CraveShopHeader } from "@shared/crave";
import { CRAVE_MOTTO } from "@shared/crave";
import type { Category } from "@shared/types";
import { engine } from "@shared/engine";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { actions, usePrefs } from "@/state/store";
import { useEngine } from "@/lib/safeEngine";
import { money, pct } from "@/lib/format";
import { locale, rich, t, tn } from "@/lib/i18n";
import { navigate } from "@/lib/router";
import { Badge, Button, ConceptNotice, STROKE } from "@/ui/kit";
import { VaraAvatar } from "@/ui/hero";
import { toast } from "@/ui/toast";
import { accentOf, Confetti, iconOf, ProductImage } from "./look";
import { craveActions, potTotals, useCravings, useInbox, quietEmailToasts, COOLING_OFF_MS } from "./diary";
import { sfx } from "./sfx";

function useCountUp(target: number, start: boolean, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(target * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, ms]);
  return v;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export function etaLabel(e: { kind: string; at: number }, header?: { etaMinutes: number; deliveryPromise: string }) {
  if (e.kind === "food") {
    const m = header?.etaMinutes || 30;
    return t("Today {time}", { time: hhmm(new Date(e.at + m * 60_000)) });
  }
  return header?.deliveryPromise ?? new Date(e.at + 2 * 86400_000).toLocaleDateString(locale(), { weekday: "long" });
}

export function Reveal({ entry, header, lines, onNewCraving }: { entry: CraveEntry; header: CraveShopHeader; products: CraveProduct[]; lines: { key: string; qty: number; product?: CraveProduct }[]; onNewCraving: () => void }) {
  const [phase, setPhase] = useState<"confirmed" | "twist">("confirmed");
  const [landed, setLanded] = useState(false);
  const a = accentOf(header.accent);
  const c = useCustomer();
  const opts = useEngineOpts();
  const prefs = usePrefs();
  const list = useCravings();
  const live = list.find((e) => e.id === entry.id) ?? entry;
  const pot = potTotals(list);
  const counted = useCountUp(pot.total, landed);

  const typical = useEngine(
    c ? () => engine.querySpending(c, { period: engine.resolvePeriod(c.asOf, "last_12_months"), categories: [entry.category as Category] }) : null,
    [c, entry.category],
  );
  const safe = useEngine(c ? () => engine.getSafeToSpend(c, opts) : null, [c, opts]);
  const perMonth = typical?.ok ? typical.value.perMonth : null;

  useEffect(() => {
    const tm = setTimeout(() => setPhase("twist"), 3200);
    return () => clearTimeout(tm);
  }, []);
  useEffect(() => {
    if (phase !== "twist") return;
    const tm = setTimeout(() => {
      setLanded(true);
      if (entry.amount > 0) sfx.coin();
    }, 1300);
    return () => clearTimeout(tm);
  }, [phase, entry.amount]);

  const thumbs = useMemo(() => lines.filter((l) => l.product).slice(0, 4), [lines]);
  const coolingEnds = new Date(entry.at + COOLING_OFF_MS);
  const coolingLabel = t("{day} {date} at {time}", { day: coolingEnds.toLocaleDateString(locale(), { weekday: "short" }), date: `${coolingEnds.getDate()}.${coolingEnds.getMonth() + 1}.`, time: hhmm(coolingEnds) });
  const inbox = useInbox();
  const unread = inbox.filter((m) => m.orderId === entry.id && !m.read && m.at <= Date.now() + 500).length;
  // the "New email" toasts would sit on top of the release button here; the Inbox button shows a count instead
  useEffect(() => quietEmailToasts(), []);
  const [, rerender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => rerender((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-full overflow-hidden bg-card">
      {/* phase 1: the order confirmation, exactly as a shop would show it */}
      <div className="flex h-full flex-col items-center px-6 pt-16 text-center">
        <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 12 }} className="flex h-20 w-20 items-center justify-center rounded-pill text-white" style={{ background: a.main }}>
          <Check size={44} strokeWidth={2.4} aria-hidden />
        </motion.span>
        <Confetti accent={a.main} count={36} />
        <p className="mt-5 text-sm font-semibold uppercase tracking-wide" style={{ color: a.main }}>{header.shopName}</p>
        <h1 className="mt-1 text-3xl font-bold text-ink">{t("Order confirmed!")}</h1>
        <p className="mt-1 text-ink-muted">{t("Order {id}", { id: entry.id })}</p>
        <p className="mt-4 flex items-center gap-2 rounded-pill px-4 py-2 font-semibold" style={{ background: a.soft, color: a.ink }}>
          {header.kind === "food" ? <Bike size={18} strokeWidth={STROKE} aria-hidden /> : <Truck size={18} strokeWidth={STROKE} aria-hidden />}
          {t("Estimated arrival: {eta}", { eta: etaLabel(entry, header) })}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {thumbs.map((l) => (
            <div key={l.key} className="w-16"><ProductImage src={l.product!.image} icon={iconOf(header.icon)} accent={header.accent} alt={l.product!.name} /></div>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-muted">{t("A confirmation email is on its way to your inbox.")}</p>
      </div>

      {/* phase 2: the twist */}
      <AnimatePresence>
        {phase === "twist" && (
          <motion.div
            className="no-scrollbar absolute inset-0 z-10 overflow-y-auto bg-hero-deep text-white"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: [0.33, 0, 0.34, 1] }}
          >
            <div className="flex flex-col gap-4 px-gutter pb-8 pt-12">
              <div className="flex items-center gap-2">
                <VaraAvatar size={36} inverse />
                <p className="text-sm font-semibold uppercase tracking-wide text-hero-num">{t("Plot twist")}</p>
              </div>
              <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-3xl font-bold leading-tight">
                {t("Nothing is on its way.")}
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-lg text-hero-meta">
                {entry.amount > 0 ? (
                  <>{rich(t("You got the hunt, the basket and the checkout. The **{amount}** went into your Crave pot instead.", { amount: money(entry.amount) }))}</>
                ) : (
                  <>{t("You got the hunt, the basket and the checkout, and kept every euro where it was. Pure window-shopping.")}</>
                )}
              </motion.p>

              {/* coin → pot */}
              <div className="relative flex h-40 items-end justify-center">
                {entry.amount > 0 && (
                  <motion.span
                    className="tnum absolute left-1/2 top-0 -translate-x-1/2 rounded-pill bg-hero-num px-4 py-2 text-lg font-bold text-green-900 shadow-middle"
                    initial={{ y: -10, opacity: 0, scale: 1 }}
                    animate={{ y: [-10, 0, 78], opacity: [0, 1, 0], scale: [1, 1.05, 0.4] }}
                    transition={{ duration: 1.3, times: [0, 0.3, 1], delay: 0.2, ease: "easeIn" }}
                  >
                    {money(entry.amount)}
                  </motion.span>
                )}
                <motion.span
                  className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/10 text-hero-num"
                  animate={landed ? { scale: [1, 1.18, 1], rotate: [0, -6, 6, 0] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <PiggyBank size={52} strokeWidth={STROKE} aria-hidden />
                </motion.span>
              </div>

              <div className="text-center">
                <p className="text-sm text-hero-meta">{t("Your Crave pot")}</p>
                <p className="pnum text-hero font-bold text-hero-num">{money(landed ? counted : Math.max(0, pot.total - entry.amount))}</p>
                <p className="text-hero-meta">
                  {tn("{n} craving redirected", "{n} cravings redirected", pot.count)}{pot.count > 1 ? ` · ${t("{amount} in total", { amount: money(pot.total) })}` : ""}
                </p>
                <div className="mt-2 flex justify-center"><span className="rounded-pill bg-white/10 px-3 py-1 text-xs font-semibold text-hero-meta">{t("Simulation: no money was moved")}</span></div>
              </div>

              {/* what it means, from the engine */}
              <div className="flex flex-col gap-2">
                {perMonth != null && perMonth > 0 && entry.amount > 0 && (
                  <div className="rounded-md bg-white/10 p-3">
                    <p className="text-sm text-hero-meta">{rich(t("You usually spend about **{amount}** a month on {what}. This craving would have been **{pct}** of that.", { amount: money(perMonth, { whole: true }), what: entry.category === "Restaurants" ? t("eating out") : t(entry.category).toLowerCase(), pct: pct(entry.amount / perMonth) }))}</p>
                  </div>
                )}
                {prefs.goal && pot.total > 0 && (
                  <div className="rounded-md bg-white/10 p-3">
                    <p className="flex items-center gap-2 text-sm text-hero-meta"><Target size={16} strokeWidth={STROKE} className="text-hero-num" aria-hidden /> <span>{rich(t("Your pot now covers **{pct}** of “{goal}” ({amount}).", { pct: pct(Math.min(1, pot.total / prefs.goal.targetAmount)), goal: prefs.goal.name, amount: money(prefs.goal.targetAmount, { whole: true }) }))}</span></p>
                  </div>
                )}
                {safe?.ok && entry.basketTotal > entry.amount && (
                  <div className="rounded-md bg-white/10 p-3">
                    <p className="text-sm text-hero-meta">{t("The basket was {basket}, but only {free} was free until payday, so Vara stashed {amount} and left your musts alone.", { basket: money(entry.basketTotal, { whole: true }), free: money(Math.max(0, safe.value.freeUntilPayday), { whole: true }), amount: money(entry.amount, { whole: true }) })}</p>
                  </div>
                )}
              </div>

              {/* cooling-off */}
              <div className="rounded-app-card bg-card p-4 text-ink">
                <p className="flex items-center gap-2 font-bold text-green-900"><CalendarClock size={20} strokeWidth={STROKE} className="text-green-700" aria-hidden /> {t("Still want it in 48 hours?")}</p>
                {live.status === "saved" ? (
                  <>
                    <p className="mt-1 text-sm text-ink-strong">{t("It's your money. If the craving is still there on {when}, release it and buy it for real. Most cravings fade by then.", { when: coolingLabel })}</p>
                    {entry.amount > 0 && (
                      <Button size="sm" variant="outline" icon={RotateCcw} className="mt-3" onClick={() => { craveActions.release(entry.id); toast(t("{amount} released back to your account (simulated)", { amount: money(entry.amount) })); }}>
                        {t("Release {amount} now", { amount: money(entry.amount) })}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-ink-strong">{t("Released: {amount} is back on your account (simulated). Enjoy it, guilt-free.", { amount: money(entry.amount) })}</p>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => craveActions.keep(entry.id)}>{t("Undo, keep it in the pot")}</Button>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="soft" icon={PackageCheck} onClick={() => navigate(`/crave/track?id=${entry.id}`)}>{t("Track order")}</Button>
                <Button variant="soft" icon={Inbox} onClick={() => navigate("/crave/inbox")}>
                  {t("Inbox")}
                  {unread > 0 && <span className="tnum ml-1 rounded-pill bg-green-700 px-1.5 text-xs font-bold text-white" aria-label={tn("{n} new email", "{n} new emails", unread)}>{unread}</span>}
                </Button>
              </div>
              <Button full icon={ShoppingBag} className="bg-hero-num text-green-900" onClick={onNewCraving}>{t("Shop another craving")}</Button>
              <Button full variant="ghost" icon={MessageCircle} className="text-hero-num hover:bg-white/10" onClick={() => { actions.ask(t("How much have my cravings saved me?"), "crave"); navigate("/vara/chat", { replace: true }); }}>{t("Back to Vara")}</Button>
              <p className="text-center text-sm italic text-hero-meta">{t(CRAVE_MOTTO)}</p>
              <Badge tone="accent">{t("Junction 2026 concept · not an official S-Pankki product")}</Badge>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {phase === "confirmed" && <ConceptNotice className="absolute inset-x-0 bottom-2" />}
    </div>
  );
}
