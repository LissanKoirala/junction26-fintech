// Real wallet sheet for the Crave pay moment, through Stripe in TEST MODE ONLY.
// Off unless both test keys are present (see stripe-keys.ts). No Stripe SDK: REST + fetch.
// Stripe receives an amount, a fixed demo description and metadata demo=crave. Nothing about the person.
import type { Hono } from "hono";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { tr } from "../../shared/i18n";
import { clientIp } from "../llm";
import { CRAVE_DIR } from "./images";
import { basicAuth, intentForm, validAmountCents, walletConfig, type WalletConfig } from "./stripe-keys";

const INTENTS_PER_IP_PER_10MIN = Number(process.env.CRAVE_WALLET_PER_10MIN ?? 10);
const INTENTS_PER_DAY = Number(process.env.CRAVE_WALLET_PER_DAY ?? 300);
const STRIPE_TIMEOUT_MS = 8_000;

const ReqSchema = z.object({ amountCents: z.unknown(), lang: z.enum(["en", "fi"]).optional() });

let cfg: WalletConfig | null = null;
function config(): WalletConfig {
  if (cfg) return cfg;
  cfg = walletConfig(process.env);
  // one clear line; never the key itself
  console.log(cfg.enabled ? "[crave] wallet: Stripe TEST mode on (real wallet sheet, nothing is charged)" : `[crave] wallet: off (${cfg.reason}); simulated pay sheet only`);
  return cfg;
}

const ipHits = new Map<string, number[]>();
function ipLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (arr.length >= INTENTS_PER_IP_PER_10MIN) return true;
  arr.push(now);
  ipHits.set(ip, arr);
  if (ipHits.size > 5000) for (const [k, v] of ipHits) if (!v.some((t) => now - t < 10 * 60_000)) ipHits.delete(k);
  return false;
}

// daily cap persisted on disk so a restart does not reset it
const usageFile = path.join(CRAVE_DIR, "wallet-usage.json");
let usage: { day: string; n: number } | null = null;
function takeDaily(): boolean {
  if (!usage) {
    try {
      usage = JSON.parse(readFileSync(usageFile, "utf8"));
    } catch {
      usage = { day: "", n: 0 };
    }
  }
  const u = usage!;
  const d = new Date().toISOString().slice(0, 10);
  if (u.day !== d) Object.assign(u, { day: d, n: 0 });
  if (u.n >= INTENTS_PER_DAY) return false;
  u.n++;
  try {
    mkdirSync(path.dirname(usageFile), { recursive: true });
    writeFileSync(usageFile, JSON.stringify(u));
  } catch {
    /* best effort */
  }
  return true;
}

export function registerWalletRoutes(app: Hono) {
  config(); // log the state once at startup

  app.get("/api/crave/wallet", (c) => {
    const w = config();
    c.header("Cache-Control", "no-store");
    return c.json(w.enabled ? { enabled: true, publishableKey: w.publishableKey } : { enabled: false });
  });

  app.post("/api/crave/wallet/intent", async (c) => {
    const w = config();
    if (!w.enabled) return c.json({ error: "wallet off" }, 404);
    let amount: number | null = null;
    let lang: "en" | "fi" = "en";
    try {
      const raw = await c.req.text();
      if (raw.length > 500) return c.json({ error: "request too large" }, 413);
      const req = ReqSchema.parse(JSON.parse(raw));
      lang = req.lang ?? "en";
      amount = validAmountCents(req.amountCents);
    } catch {
      return c.json({ error: "bad request" }, 400);
    }
    const { t } = tr(lang);
    if (amount == null) return c.json({ error: "bad amount" }, 400);
    if (ipLimited(clientIp(c.req.raw.headers))) return c.json({ error: t("That's a lot of payments in a short time. Try again in a few minutes.") }, 429);
    if (!takeDaily()) return c.json({ error: t("The test wallet has reached today's limit. The simulated pay still works.") }, 429);

    try {
      const res = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: { Authorization: basicAuth(w.secretKey!), "Content-Type": "application/x-www-form-urlencoded" },
        body: intentForm(amount),
        signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
      });
      const j = (await res.json().catch(() => ({}))) as { client_secret?: string; livemode?: boolean; error?: { type?: string; code?: string } };
      if (!res.ok || !j.client_secret) {
        console.warn(`[crave] wallet: Stripe refused the intent (${res.status} ${j.error?.type ?? ""} ${j.error?.code ?? ""})`.trim());
        return c.json({ error: "stripe" }, 502);
      }
      // belt and braces: a live-mode object must never reach the browser
      if (j.livemode !== false) {
        console.error("[crave] wallet: Stripe returned a non-test intent; refusing");
        return c.json({ error: "stripe" }, 502);
      }
      return c.json({ clientSecret: j.client_secret });
    } catch {
      console.warn("[crave] wallet: Stripe did not answer in time");
      return c.json({ error: "stripe" }, 502);
    }
  });
}
