// The craving diary (the Crave pot) and the in-app inbox, stored per customer in the app state.
// All money movement is simulated: nothing leaves or enters a real account.
import type { CraveEntry, CraveSummary } from "@shared/crave";
import { getState, updatePrefs, usePrefs, type CraveEmail } from "@/state/store";
import { toast } from "@/ui/toast";

const EMPTY: CraveEntry[] = [];
const EMPTY_MAIL: CraveEmail[] = [];

export function useCravings(): CraveEntry[] {
  return usePrefs().cravings ?? EMPTY;
}
export function useInbox(): CraveEmail[] {
  return usePrefs().craveInbox ?? EMPTY_MAIL;
}

export const COOLING_OFF_MS = 48 * 3600_000;

export function potTotals(list: CraveEntry[]) {
  const saved = list.filter((e) => e.status === "saved");
  const total = Math.round(saved.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  return { total, count: saved.filter((e) => e.amount > 0).length, all: list.length };
}

export const craveActions = {
  consent(v = true) {
    updatePrefs((p) => ({ ...p, craveConsent: v }));
  },
  add(e: CraveEntry) {
    updatePrefs((p) => ({ ...p, cravings: [e, ...(p.cravings ?? []).filter((x) => x.id !== e.id)].slice(0, 200) }));
  },
  release(id: string) {
    updatePrefs((p) => ({ ...p, cravings: (p.cravings ?? []).map((e) => (e.id === id ? { ...e, status: "released" as const, releasedAt: Date.now() } : e)) }));
  },
  keep(id: string) {
    updatePrefs((p) => ({ ...p, cravings: (p.cravings ?? []).map((e) => (e.id === id ? { ...e, status: "saved" as const, releasedAt: undefined } : e)) }));
  },
  readMail(id: string) {
    updatePrefs((p) => ({ ...p, craveInbox: (p.craveInbox ?? []).map((m) => (m.id === id ? { ...m, read: true } : m)) }));
  },
  clearAll() {
    updatePrefs((p) => ({ ...p, cravings: [], craveInbox: [] }));
  },
};

/** The three order "emails", arriving over the next half minute. Toasts announce them while the app is open. */
export function scheduleEmails(e: CraveEntry) {
  const now = Date.now();
  const mails: CraveEmail[] = [
    { id: `${e.id}-1`, orderId: e.id, kind: "confirmation", from: e.shopName, subject: `Order confirmed: ${e.id}`, at: now + 2500 },
    { id: `${e.id}-2`, orderId: e.id, kind: "shipped", from: e.shopName, subject: e.kind === "food" ? "Your order is on its way… to your savings" : "Your parcel is on its way… to your savings", at: now + 11000 },
    { id: `${e.id}-3`, orderId: e.id, kind: "delivered", from: "Vara · Crave mode", subject: "Delivered to your Crave pot", at: now + 26000 },
  ];
  updatePrefs((p) => ({ ...p, craveInbox: [...mails, ...(p.craveInbox ?? [])].slice(0, 60) }));
  const cid = getState().customerId;
  for (const m of mails)
    setTimeout(() => {
      if (getState().customerId === cid) toast(`New email · ${m.subject}`);
    }, m.at - now);
}

// ---------------------------------------------------------------- insights
export const TIME_SLOTS = [
  { key: "morning", label: "Morning", from: 5, to: 11 },
  { key: "afternoon", label: "Afternoon", from: 11, to: 17 },
  { key: "evening", label: "Evening", from: 17, to: 22 },
  { key: "late", label: "Late night", from: 22, to: 29 },
] as const;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function slotOf(at: number): string {
  const h = new Date(at).getHours();
  const hh = h < 5 ? h + 24 : h;
  return TIME_SLOTS.find((s) => hh >= s.from && hh < s.to)?.key ?? "late";
}
export const weekdayOf = (at: number) => (new Date(at).getDay() + 6) % 7; // 0 = Monday

export function summarise(list: CraveEntry[]): CraveSummary {
  const saved = list.filter((e) => e.status === "saved");
  const released = list.filter((e) => e.status === "released");
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const cats = new Map<string, { count: number; amount: number }>();
  for (const e of saved) {
    const c = cats.get(e.category) ?? { count: 0, amount: 0 };
    c.count++;
    c.amount = r2(c.amount + e.amount);
    cats.set(e.category, c);
  }
  const wd = new Array(7).fill(0);
  for (const e of list) wd[weekdayOf(e.at)]++;
  const maxWd = Math.max(...wd);
  return {
    count: saved.filter((e) => e.amount > 0).length,
    savedTotal: r2(saved.reduce((s, e) => s + e.amount, 0)),
    releasedCount: released.length,
    releasedTotal: r2(released.reduce((s, e) => s + e.amount, 0)),
    windowShops: list.filter((e) => e.amount === 0).length,
    byCategory: [...cats.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount),
    byTimeOfDay: TIME_SLOTS.map((s) => ({ slot: s.label, count: list.filter((e) => slotOf(e.at) === s.key).length })),
    topWeekday: list.length ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][wd.indexOf(maxWd)] : null,
    recent: list.slice(0, 5).map((e) => ({ craving: e.craving.slice(0, 60), amount: e.amount, status: e.status })),
  };
}

export function newOrderId(): string {
  return `CR-${Math.floor(100000 + Math.random() * 900000)}`;
}
