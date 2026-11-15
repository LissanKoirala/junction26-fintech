// The Crave pot and diary: total redirected, every craving with its cooling-off choice, and when cravings strike.
import { CalendarClock, Clock, Inbox, PiggyBank, RotateCcw, ShoppingBag, Target, Trash2 } from "lucide-react";
import { CRAVE_MOTTO } from "@shared/crave";
import { money, pct } from "@/lib/format";
import { locale, t, tn } from "@/lib/i18n";
import { goBack, navigate } from "@/lib/router";
import { usePrefs } from "@/state/store";
import { FullScreen, HeroCard, ScreenHeader, ScrollArea, VaraAvatar } from "@/ui/hero";
import { Badge, Button, Card, CardTitle, ConceptNotice, Muted, Page, Progress, SectionTitle, STROKE } from "@/ui/kit";
import { toast } from "@/ui/toast";
import { useState } from "react";
import { Volume2 } from "lucide-react";
import { CHIME_IDS, chimeId, setChimeId, sfx, type ChimeId } from "./sfx";
import { COOLING_OFF_MS, craveActions, potTotals, summarise, TIME_SLOTS, useCravings, WEEKDAYS, weekdayOf, slotOf } from "./diary";

/** Single-series bar chart (one hue, rounded data ends, value labels, per-bar tooltip). */
function Bars({ items, label }: { items: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure aria-label={label} className="mt-2">
      <div className="flex h-28 items-end gap-2">
        {items.map((i) => (
          <div key={i.label} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${i.label}: ${i.value}`}>
            <span className="tnum text-xs font-semibold text-ink-strong">{i.value || ""}</span>
            <span className="w-full max-w-9 rounded-t-[4px] bg-green-700 transition-all" style={{ height: `${Math.max(i.value ? 6 : 2, (i.value / max) * 80)}px`, opacity: i.value ? 1 : 0.25 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 border-t border-line pt-1">
        {items.map((i) => <span key={i.label} className="flex-1 text-center text-xs text-ink-muted">{i.label}</span>)}
      </div>
      <table className="sr-only"><caption>{label}</caption><tbody>{items.map((i) => <tr key={i.label}><th>{i.label}</th><td>{i.value}</td></tr>)}</tbody></table>
    </figure>
  );
}

/** Audition the three pay-sound variants and keep one (also settable with ?chime=a|b|c). */
function PaySoundPicker() {
  const [cur, setCur] = useState<ChimeId>(() => chimeId());
  return (
    <Card>
      <CardTitle>{t("Preview the pay sound")}</CardTitle>
      <Muted className="mt-0.5">{t("Tap to hear each one; the one you tap last plays at checkout.")}</Muted>
      <div className="mt-2 flex flex-wrap gap-2">
        {CHIME_IDS.map((id) => (
          <Button
            key={id}
            size="sm"
            variant={cur === id ? "primary" : "outline"}
            icon={Volume2}
            aria-pressed={cur === id}
            onClick={() => { sfx.preview(id); setChimeId(id); setCur(id); }}
          >
            {t("Sound {id}", { id: id.toUpperCase() })}
          </Button>
        ))}
      </div>
    </Card>
  );
}

export function PotView() {
  const list = useCravings();
  const prefs = usePrefs();
  const pot = potTotals(list);
  const sum = summarise(list);
  const now = Date.now();
  return (
    <FullScreen>
      <ScreenHeader title={t("Crave pot")} onBack={() => goBack("/vara/today")} right={<Button size="sm" variant="ghost" icon={Inbox} onClick={() => navigate("/crave/inbox")}>{t("Inbox")}</Button>} />
      <ScrollArea>
        <Page>
          <HeroCard label={t("Your Crave pot")}>
            <div className="flex items-center gap-2">
              <VaraAvatar size={28} inverse />
              <p className="text-sm font-semibold uppercase tracking-wide text-hero-num">{t("Crave pot · savings")}</p>
            </div>
            <p className="pnum mt-3 text-hero font-bold text-hero-num">{money(pot.total)}</p>
            <p className="text-hero-meta">{tn("{n} craving redirected", "{n} cravings redirected", pot.count)}{sum.releasedCount ? ` · ${t("{n} released", { n: sum.releasedCount })}` : ""}{sum.windowShops ? ` · ${t("{n} window-shopped", { n: sum.windowShops })}` : ""}</p>
            {prefs.goal && pot.total > 0 && (
              <div className="mt-4">
                <p className="mb-1 flex items-center gap-1.5 text-sm text-hero-meta"><Target size={14} strokeWidth={STROKE} aria-hidden /> {t("Towards “{goal}”: {pct} of {amount}", { goal: prefs.goal.name, pct: pct(Math.min(1, pot.total / prefs.goal.targetAmount)), amount: money(prefs.goal.targetAmount, { whole: true }) })}</p>
                <Progress tone="inverse" value={pot.total / prefs.goal.targetAmount} label={t("Crave pot towards your goal")} />
              </div>
            )}
            <p className="mt-3 text-sm italic text-hero-meta">{t(CRAVE_MOTTO)}</p>
            <span className="mt-2 inline-block rounded-pill bg-white/10 px-3 py-1 text-xs font-semibold text-hero-meta">{t("Simulation: no money was moved")}</span>
          </HeroCard>
          <Button full icon={ShoppingBag} onClick={() => navigate("/crave")}>{t("Shop a craving")}</Button>

          {list.length > 0 && (
            <>
              <SectionTitle icon={Clock}>{t("When cravings strike")}</SectionTitle>
              <Card>
                <CardTitle>{t("Time of day")}</CardTitle>
                <Bars label={t("Cravings by time of day")} items={TIME_SLOTS.map((s) => ({ label: t(s.label), value: list.filter((e) => slotOf(e.at) === s.key).length }))} />
                <div className="mt-4"><CardTitle>{t("Weekday")}</CardTitle></div>
                <Bars label={t("Cravings by weekday")} items={WEEKDAYS.map((d, i) => ({ label: t(d), value: list.filter((e) => weekdayOf(e.at) === i).length }))} />
                {sum.byCategory.length > 0 && (
                  <>
                    <div className="mt-4"><CardTitle>{t("What you crave")}</CardTitle></div>
                    <ul className="mt-1 divide-y divide-line">
                      {sum.byCategory.map((c) => (
                        <li key={c.category} className="flex justify-between py-2 text-sm"><span className="text-ink">{c.category === "Restaurants" ? t("Food & takeaway") : t(c.category)} · {c.count}×</span><span className="tnum font-semibold text-ink">{money(c.amount)}</span></li>
                      ))}
                    </ul>
                  </>
                )}
                <Muted className="mt-2">{t("Times are when you opened the shop, on this device's clock.")}</Muted>
              </Card>

              <SectionTitle icon={CalendarClock}>{t("Your craving diary")}</SectionTitle>
              <Card padded={false} className="divide-y divide-line">
                {list.map((e) => {
                  const coolingLeft = e.at + COOLING_OFF_MS - now;
                  return (
                    <div key={e.id} className="flex items-start gap-3 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-green-100 text-green-700"><PiggyBank size={18} strokeWidth={STROKE} aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">“{e.craving}”</p>
                        <p className="truncate text-sm text-ink-muted">{e.shopName} · {new Date(e.at).toLocaleString(locale(), { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {e.status === "saved" ? <Badge tone="success">{e.amount > 0 ? t("In the pot") : t("Window-shopped")}</Badge> : <Badge tone="neutral">{t("Released")}</Badge>}
                          {e.status === "saved" && e.amount > 0 && <span className="text-xs text-ink-muted">{coolingLeft > 0 ? t("Cooling-off: {n} h left", { n: Math.ceil(coolingLeft / 3600_000) }) : t("Cooling-off over")}</span>}
                        </div>
                        <div className="mt-1 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/crave/track?id=${e.id}`)}>{t("Track")}</Button>
                          {e.status === "saved" && e.amount > 0 && (
                            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => { craveActions.release(e.id); toast(t("{amount} released back to your account (simulated)", { amount: money(e.amount) })); }}>{t("Release")}</Button>
                          )}
                          {e.status === "released" && <Button size="sm" variant="ghost" onClick={() => craveActions.keep(e.id)}>{t("Keep in pot")}</Button>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tnum font-semibold text-ink">{money(e.amount)}</p>
                        {e.basketTotal !== e.amount && <p className="tnum text-xs text-ink-muted line-through">{money(e.basketTotal)}</p>}
                      </div>
                    </div>
                  );
                })}
              </Card>
              <Button variant="ghost" icon={Trash2} onClick={() => { if (window.confirm(t("Clear the craving diary for this demo customer?"))) craveActions.clearAll(); }}>{t("Clear diary (demo)")}</Button>
            </>
          )}
          <PaySoundPicker />
          {!list.length && <Muted className="px-1">{t("No cravings yet. Next time you want to buy something on impulse, shop it here first.")}</Muted>}
          <ConceptNotice />
        </Page>
      </ScrollArea>
    </FullScreen>
  );
}
