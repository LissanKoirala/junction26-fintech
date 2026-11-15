// Afterglow: order tracking that plays along (the courier arrives at the savings pot, not the door) and an in-app
// inbox with order emails. No real emails are sent.
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bike, Box, Check, Inbox as InboxIcon, Mail, PiggyBank, Truck, UtensilsCrossed } from "lucide-react";
import { CRAVE_MOTTO, type CraveEntry } from "@shared/crave";
import { money } from "@/lib/format";
import { goBack, navigate, useRoute } from "@/lib/router";
import { FullScreen, ScreenHeader, ScrollArea } from "@/ui/hero";
import { Badge, Button, Card, ConceptNotice, cx, Muted, Page, STROKE, Unavailable } from "@/ui/kit";
import type { CraveEmail } from "@/state/store";
import { craveActions, useCravings, useInbox } from "./diary";
import { NothingShipsPill } from "./look";

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const STAGES = [
  { at: 0, food: "Order received", store: "Order received", icon: Check },
  { at: 4000, food: "Being prepared", store: "Packed", icon: Box },
  { at: 10000, food: "On its way", store: "On its way", icon: Truck },
  { at: 25000, food: "Delivered to your Crave pot", store: "Delivered to your Crave pot", icon: PiggyBank },
];

function FoodRoute({ progress }: { progress: number }) {
  const d = "M30 150 C 90 150, 80 60, 160 70 S 250 140, 300 50";
  return (
    <svg viewBox="0 0 330 190" className="w-full" role="img" aria-label="Courier route from the restaurant to your savings pot">
      <rect x="0" y="0" width="330" height="190" rx="16" fill="#ebf7ec" />
      {[40, 90, 140].map((y) => <line key={y} x1="0" x2="330" y1={y} y2={y} stroke="#dcefdf" strokeWidth="10" />)}
      {[70, 170, 260].map((x) => <line key={x} y1="0" y2="190" x1={x} x2={x} stroke="#dcefdf" strokeWidth="10" />)}
      <path d={d} fill="none" stroke="#99d59f" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 10" />
      <motion.path d={d} fill="none" stroke="#007841" strokeWidth="5" strokeLinecap="round" initial={false} animate={{ pathLength: progress }} transition={{ duration: 0.8 }} />
      <circle cx="30" cy="150" r="12" fill="#fff" stroke="#007841" strokeWidth="2" />
      <UtensilsCrossed x={22} y={142} width={16} height={16} color="#007841" strokeWidth={STROKE} />
      <circle cx="300" cy="50" r="16" fill="#004628" />
      <PiggyBank x={290} y={40} width={20} height={20} color="#91fa9b" strokeWidth={STROKE} />
      <motion.g style={{ offsetPath: `path("${d}")` } as React.CSSProperties} initial={false} animate={{ offsetDistance: `${progress * 100}%` } as never} transition={{ duration: 0.8 }}>
        <circle r="11" fill="#00eb5a" stroke="#fff" strokeWidth="2" />
      </motion.g>
    </svg>
  );
}

export function Tracking() {
  const route = useRoute();
  const id = route.query.get("id");
  const list = useCravings();
  const e = list.find((x) => x.id === id) ?? list[0];
  const now = useNow(500);
  if (!e)
    return (
      <FullScreen>
        <ScreenHeader title="Track order" onBack={() => goBack("/crave")} />
        <Page><Unavailable title="No orders yet" reason="Shop a craving first." /></Page>
      </FullScreen>
    );
  const elapsed = now - e.at;
  const stage = STAGES.filter((s) => elapsed >= s.at).length - 1;
  const progress = Math.min(1, Math.max(0.04, (elapsed - 10000) / 15000));
  const Vehicle = e.kind === "food" ? Bike : Truck;
  return (
    <FullScreen>
      <ScreenHeader title="Track order" onBack={() => goBack("/crave/pot")} right={<span className="pr-2"><NothingShipsPill className="scale-90" /></span>} />
      <ScrollArea>
        <Page>
          <Card>
            <p className="text-sm text-ink-muted">{e.shopName} · {e.id}</p>
            <p className="text-xl font-bold text-ink">{STAGES[stage][e.kind]}</p>
            <p className="text-sm text-ink-muted">{e.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</p>
            <div className="mt-3">
              {e.kind === "food" ? (
                <FoodRoute progress={stage >= 2 ? progress : 0} />
              ) : (
                <div className="relative h-16 rounded-md bg-green-100">
                  <div className="absolute inset-x-6 top-1/2 h-1 -translate-y-1/2 rounded-pill bg-green-200" />
                  <motion.div className="absolute top-1/2 -translate-y-1/2" initial={false} animate={{ left: `calc(${(stage >= 2 ? progress : 0) * 80 + 4}% )` }} transition={{ duration: 0.8 }}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-green-700 text-white shadow-low"><Vehicle size={20} strokeWidth={STROKE} aria-hidden /></span>
                  </motion.div>
                  <span className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill bg-green-900 text-hero-num"><PiggyBank size={20} strokeWidth={STROKE} aria-hidden /></span>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <ol className="flex flex-col">
              {STAGES.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cx("flex h-8 w-8 items-center justify-center rounded-pill", i <= stage ? "bg-green-700 text-white" : "bg-sunken text-icon-muted")}>
                      <s.icon size={16} strokeWidth={STROKE} aria-hidden />
                    </span>
                    {i < STAGES.length - 1 && <span className={cx("w-0.5 flex-1", i < stage ? "bg-green-700" : "bg-line")} style={{ minHeight: 20 }} />}
                  </div>
                  <div className="pb-4">
                    <p className={cx("font-semibold", i <= stage ? "text-ink" : "text-ink-muted")}>{s[e.kind]}</p>
                    {i === 3 && <p className="text-sm text-ink-muted">The courier rings at your savings pot instead of your door: {money(e.amount)} delivered.</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          {stage === 3 && (
            <Card className="bg-hero-deep text-white">
              <p className="font-bold text-hero-num">Delivered. To your future self.</p>
              <p className="text-sm text-hero-meta">{CRAVE_MOTTO}</p>
            </Card>
          )}
          <Button variant="soft" icon={InboxIcon} onClick={() => navigate("/crave/inbox")}>Open inbox</Button>
          <Badge tone="info">Simulation: no money was moved, nothing ships</Badge>
          <ConceptNotice />
        </Page>
      </ScrollArea>
    </FullScreen>
  );
}

// ------------------------------------------------------------------ inbox
function EmailBody({ m, e }: { m: CraveEmail; e: CraveEntry | undefined }) {
  if (!e) return <Muted>This order is no longer in your diary.</Muted>;
  const items = (
    <table className="mt-3 w-full text-sm">
      <tbody>
        {e.items.map((i, k) => (
          <tr key={k} className="border-b border-line"><td className="py-1.5 text-ink">{i.qty} × {i.name}</td><td className="tnum py-1.5 text-right text-ink">{money(i.price)}</td></tr>
        ))}
        <tr><td className="pt-2 font-bold text-ink">Total</td><td className="tnum pt-2 text-right font-bold text-ink">{money(e.basketTotal)}</td></tr>
      </tbody>
    </table>
  );
  if (m.kind === "confirmation")
    return (
      <div>
        <div className="rounded-t-md bg-green-900 px-4 py-5 text-white"><p className="text-xs uppercase tracking-wide text-hero-meta">{e.shopName}</p><p className="text-2xl font-bold">Thanks for your order!</p></div>
        <div className="rounded-b-md border border-t-0 border-line bg-card p-4">
          <p className="text-ink">Hi! We've received your order <b>{e.id}</b> and we're getting it ready.</p>
          {items}
          <p className="mt-3 text-sm text-ink-muted">Delivery address: Esimerkkikatu 12 B 7, 00100 Helsinki (demo data)</p>
          <p className="mt-1 text-sm text-ink-muted">Paid with S-Pankki Debit •••• 4821 (simulation)</p>
        </div>
      </div>
    );
  if (m.kind === "shipped")
    return (
      <div>
        <div className="rounded-t-md bg-green-700 px-4 py-5 text-white"><p className="text-xs uppercase tracking-wide text-green-150">{e.shopName}</p><p className="text-2xl font-bold">It's on its way!</p></div>
        <div className="rounded-b-md border border-t-0 border-line bg-card p-4">
          <p className="text-ink">Good news: order <b>{e.id}</b> has left {e.kind === "food" ? "the kitchen" : "our warehouse"}.</p>
          <p className="mt-2 text-ink">Small detail: it is heading to your <b>savings</b>, not your door. The courier is carrying <b className="tnum">{money(e.amount)}</b> straight into your Crave pot.</p>
          <p className="mt-3 text-sm text-ink-muted">Track it any time in Vara.</p>
        </div>
      </div>
    );
  return (
    <div>
      <div className="rounded-t-md bg-hero-deep px-4 py-5 text-white"><p className="text-xs uppercase tracking-wide text-hero-num">Vara · Crave mode</p><p className="text-2xl font-bold">Delivered to your Crave pot</p></div>
      <div className="rounded-b-md border border-t-0 border-line bg-card p-4">
        <p className="text-ink">Your “{e.craving}” craving has been delivered: <b className="tnum">{money(e.amount)}</b> is now in your Crave pot.</p>
        <p className="mt-2 text-ink">Still want it in 48 hours? Release it with one tap in Vara and buy it for real. It's your money either way.</p>
        <p className="mt-4 text-lg font-bold text-green-700">{CRAVE_MOTTO}</p>
        <p className="mt-2 text-xs text-ink-muted">Simulation: no money was moved. Junction 2026 concept · not an official S-Pankki product.</p>
      </div>
    </div>
  );
}

export function InboxView() {
  const route = useRoute();
  const openId = route.query.get("mail");
  const mails = useInbox();
  const list = useCravings();
  const now = useNow(1000);
  const visible = mails.filter((m) => m.at <= now).sort((a, b) => b.at - a.at);
  const open = openId ? visible.find((m) => m.id === openId) : null;
  useEffect(() => {
    if (open && !open.read) craveActions.readMail(open.id);
  }, [open]);
  if (open)
    return (
      <FullScreen>
        <ScreenHeader title="Email" onBack={() => goBack("/crave/inbox")} />
        <ScrollArea>
          <Page>
            <div className="px-1">
              <p className="text-lg font-bold text-ink">{open.subject}</p>
              <p className="text-sm text-ink-muted">From: {open.from} &lt;orders@example.invalid&gt;</p>
              <p className="text-sm text-ink-muted">To: you (in-app inbox, demo)</p>
            </div>
            <EmailBody m={open} e={list.find((e) => e.id === open.orderId)} />
            <ConceptNotice />
          </Page>
        </ScrollArea>
      </FullScreen>
    );
  const pending = mails.filter((m) => m.at > now).length;
  return (
    <FullScreen>
      <ScreenHeader title="Inbox" onBack={() => goBack("/crave/pot")} />
      <ScrollArea>
        <Page>
          <Muted className="px-1">Order emails from Crave mode land here, inside the app. No real emails are sent.</Muted>
          <Card padded={false} className="divide-y divide-line">
            {visible.map((m) => (
              <motion.button key={m.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} type="button" onClick={() => navigate(`/crave/inbox?mail=${m.id}`)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-green-50">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-pill" style={{ background: m.read ? "transparent" : "#00aa46" }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cx("block truncate text-sm", m.read ? "text-ink-muted" : "font-bold text-ink")}>{m.from}</span>
                  <span className={cx("block truncate", m.read ? "text-ink-strong" : "font-semibold text-ink")}>{m.subject}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-muted">{new Date(m.at).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}</span>
              </motion.button>
            ))}
            {!visible.length && <p className="flex items-center gap-2 p-4 text-ink-muted"><Mail size={18} strokeWidth={STROKE} aria-hidden /> No emails yet.</p>}
          </Card>
          {pending > 0 && <Muted className="px-1">{pending} more on the way…</Muted>}
          <ConceptNotice />
        </Page>
      </ScrollArea>
    </FullScreen>
  );
}
