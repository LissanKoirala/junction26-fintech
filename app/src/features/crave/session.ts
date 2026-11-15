// Shop sessions: one streamed POST /api/crave/shop per craving, kept in module memory so a chat card can start
// (prefetch) the shop and the Crave screen picks it up, already filled in, when the customer taps it.
import { useEffect, useSyncExternalStore } from "react";
import type { CraveEvent, CraveProduct, CraveShop, CraveShopHeader } from "@shared/crave";
import { getLang, t, type Lang } from "@/lib/i18n";

export interface ShopSession {
  craving: string;
  status: "loading" | "ready" | "refused" | "error";
  label: string;
  header: CraveShopHeader | null;
  products: CraveProduct[];
  alsoBought: string[];
  message?: string;
  meta?: { model: string; cached: boolean; ms: number; firstProductMs?: number };
  startedAt: number;
  firstProductAt?: number;
}

const sessions = new Map<string, ShopSession>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
// one session per craving and language: an English and a Finnish shop never mix
const keyOf = (c: string, lang: Lang = getLang()) => `${lang}|${c.trim().toLowerCase().replace(/\s+/g, " ")}`;

function patch(key: string, fn: (s: ShopSession) => ShopSession) {
  const s = sessions.get(key);
  if (!s) return;
  sessions.set(key, fn(s));
  emit();
}

function apply(key: string, ev: CraveEvent) {
  patch(key, (s) => {
    switch (ev.type) {
      case "status":
        return { ...s, label: ev.label };
      case "shop":
        return { ...s, header: ev.shop };
      case "product": {
        if (s.products.some((p) => p.id === ev.product.id)) return s;
        return { ...s, products: [...s.products, ev.product], firstProductAt: s.firstProductAt ?? Date.now() };
      }
      case "image":
        return { ...s, products: s.products.map((p) => (p.id === ev.id ? { ...p, image: ev.url } : p)) };
      case "details":
        return { ...s, products: s.products.map((p) => (p.id === ev.id ? { ...p, variants: ev.variants, addOns: ev.addOns, reviews: ev.reviews, details: true } : p)) };
      case "refused":
        return { ...s, status: "refused", message: ev.message };
      case "error":
        return { ...s, status: "error", message: ev.message };
      case "done": {
        const shop: CraveShop = ev.shop;
        const { products, alsoBought, craving: _c, ...header } = shop;
        // keep images that arrived on the stream if the final copy has none yet
        const merged = products.map((p) => {
          const prev = s.products.find((x) => x.id === p.id);
          return { ...p, image: p.image ?? prev?.image ?? null };
        });
        return { ...s, status: "ready", header, products: merged, alsoBought, meta: ev.meta };
      }
    }
  });
}

async function run(key: string, craving: string, customerId: string, lang: Lang) {
  try {
    const res = await fetch("/api/crave/shop", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ customerId, craving, lang }),
    });
    if (!res.ok || !res.body) throw new Error(res.status === 429 ? t("Too many shops in a short time. Try again in a moment.") : `HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
        if (!data) continue;
        try {
          apply(key, JSON.parse(data) as CraveEvent);
        } catch {
          /* ignore */
        }
      }
    }
    const s = sessions.get(key);
    if (s && s.status === "loading") {
      if (s.products.length) patch(key, (x) => ({ ...x, status: "ready" }));
      else patch(key, (x) => ({ ...x, status: "error", message: t("The shop could not be opened right now.") }));
    }
  } catch (e) {
    patch(key, (x) => ({ ...x, status: x.products.length ? "ready" : "error", message: e instanceof Error && !/HTTP|fetch/i.test(e.message) ? e.message : t("The shop could not be opened right now. Please try again.") }));
  }
}

/** Starts (or reuses) the shop for this craving. Safe to call repeatedly. */
export function startShop(craving: string, customerId: string, opts: { retry?: boolean } = {}): string {
  const lang = getLang();
  const key = keyOf(craving, lang);
  const cur = sessions.get(key);
  if (cur && !(opts.retry && (cur.status === "error" || cur.status === "refused"))) return key;
  sessions.set(key, { craving: craving.trim(), status: "loading", label: "", header: null, products: [], alsoBought: [], startedAt: Date.now() });
  emit();
  void run(key, craving.trim(), customerId, lang);
  return key;
}

export function useShopSession(craving: string | null, customerId: string): ShopSession | null {
  useEffect(() => {
    if (craving) startShop(craving, customerId);
  }, [craving, customerId]);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (craving ? sessions.get(keyOf(craving)) ?? null : null),
  );
}
