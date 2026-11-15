// Crave mode API.
//   POST /api/crave/shop  { customerId, craving } -> text/event-stream of CraveEvent (shared/crave.ts)
//   GET  /api/crave/img/:file                      -> cached product photo
// Shops are cached on disk by a hash of the normalised craving, so repeats (and the demo cravings) are instant.
// The customer id is only validated; it is never sent to the language or image model.
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { CraveEvent, CraveProduct, CraveShop, CraveShopHeader } from "../../shared/crave";
import { isCustomerId } from "../data";
import { clientIp, rateLimit, takeDailyBudget } from "../llm";
import { CRAVE_MODEL, generateDetails, generateShop } from "./generate";
import { CRAVE_DIR, IMAGE_MODEL, productImage, readImage } from "./images";

const VERSION = 1;
const SHOP_TIMEOUT_MS = 60_000;
const IMAGE_WAIT_MS = 16_000;
const SHOPS_PER_IP_PER_10MIN = Number(process.env.CRAVE_SHOPS_PER_10MIN ?? 12);
const SHOPS_PER_DAY = Number(process.env.CRAVE_SHOPS_PER_DAY ?? 400);

const ReqSchema = z.object({ customerId: z.string().refine(isCustomerId), craving: z.string().min(1).max(200) });

export function normaliseCraving(s: string): string {
  return s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}
const shopFile = (key: string) => path.join(CRAVE_DIR, `shop-${createHash("sha1").update(`${VERSION}|${key}`).digest("hex").slice(0, 16)}.json`);

export async function loadCachedShop(craving: string): Promise<CraveShop | null> {
  try {
    return JSON.parse(await readFile(shopFile(normaliseCraving(craving)), "utf8")) as CraveShop;
  } catch {
    return null;
  }
}

// crave-specific limits on top of the shared per-IP limit and daily LLM budget
const ipHits = new Map<string, number[]>();
let day = { d: "", n: 0 };
function craveLimit(ip: string): string | null {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (arr.length >= SHOPS_PER_IP_PER_10MIN) return "That's a lot of shops in a short time. Take a breather and try again in a few minutes.";
  const d = new Date().toISOString().slice(0, 10);
  if (day.d !== d) day = { d, n: 0 };
  if (day.n >= SHOPS_PER_DAY) return "Crave mode has opened a lot of shops today. Try one of the demo cravings, they are ready to go.";
  arr.push(now);
  ipHits.set(ip, arr);
  day.n++;
  return null;
}

export interface BuildLog {
  model: string;
  ttftMs: number;
  firstProductMs?: number;
  llmMs: number;
  totalMs: number;
  usage: { in: number; out: number };
  detailsMs?: number;
  detailsUsage: { in: number; out: number };
  images: { n: number; ok: number; cost: number; maxMs: number };
}

/** Generates a shop (LLM + images), calling `send` progressively; caches the result. Exported for the prewarm script. */
export async function buildShop(craving: string, send: (ev: CraveEvent) => void | Promise<void>, signal: AbortSignal, model = CRAVE_MODEL): Promise<{ shop: CraveShop | null; log: BuildLog }> {
  const t0 = Date.now();
  let firstProductMs: number | undefined;
  let header: CraveShopHeader | null = null;
  let refused = false;
  const imgs = new Map<string, Promise<void>>();
  const imageUrl = new Map<string, string | null>();
  const img = { n: 0, ok: 0, cost: 0, maxMs: 0 };
  const startImage = (p: CraveProduct) => {
    if (!header || imgs.has(p.id)) return;
    img.n++;
    const kind = header.kind;
    imgs.set(
      p.id,
      productImage(kind, p.imagePrompt).then(async (r) => {
        imageUrl.set(p.id, r.url);
        if (r.url) img.ok++;
        img.cost += r.cost;
        img.maxMs = Math.max(img.maxMs, r.ms);
        await send({ type: "image", id: p.id, url: r.url });
      }),
    );
  };
  const pending: CraveProduct[] = [];
  // second pass: details for the first 5 products start as soon as they have streamed, the rest at the end
  const details = new Map<string, Pick<CraveProduct, "variants" | "addOns" | "reviews">>();
  const detailJobs: Promise<void>[] = [];
  const dUsage = { in: 0, out: 0 };
  let detailsMs: number | undefined;
  const streamed: CraveProduct[] = [];
  const startDetails = (batch: CraveProduct[]) => {
    if (!header || !batch.length) return;
    detailJobs.push(
      generateDetails(header, batch, (id, d) => {
        details.set(id, d);
        void send({ type: "details", id, ...d });
      }, signal, model)
        .then((u) => {
          dUsage.in += u.in;
          dUsage.out += u.out;
          detailsMs = Date.now() - t0;
        })
        .catch((e) => console.warn("[crave] details failed", (e as Error).message)),
    );
  };
  const res = await generateShop(
    craving,
    {
      onHeader: (h) => {
        if (h.refused) {
          refused = true;
          return;
        }
        const { refused: _r, refusalMessage: _m, ...rest } = h;
        header = rest;
        void send({ type: "shop", shop: rest });
        for (const p of pending.splice(0)) startImage(p);
      },
      onProduct: (p) => {
        if (refused) return;
        firstProductMs ??= Date.now() - t0;
        void send({ type: "product", product: p });
        streamed.push(p);
        if (header) startImage(p);
        else pending.push(p);
        if (streamed.length === 5) startDetails(streamed.slice(0, 5));
      },
    },
    signal,
    model,
  );
  const llmMs = Date.now() - t0;
  const log: BuildLog = { model, ttftMs: res.ttftMs, firstProductMs, llmMs, totalMs: 0, usage: res.usage, detailsUsage: dUsage, images: img };
  if (res.refused || refused || !res.header) {
    await send({ type: "refused", message: res.refusalMessage || "Crave mode can't open a shop for that one." });
    log.totalMs = Date.now() - t0;
    return { shop: null, log };
  }
  header ??= res.header;
  for (const p of res.products) startImage(p);
  startDetails(res.products.slice(streamed.length >= 5 ? 5 : 0));
  await Promise.race([Promise.allSettled([...imgs.values(), ...detailJobs]), new Promise((r) => setTimeout(r, IMAGE_WAIT_MS))]);
  const shop: CraveShop = {
    ...res.header,
    craving,
    products: res.products.map((p) => {
      const d = details.get(p.id);
      return { ...p, ...(d ?? {}), details: !!d, image: imageUrl.get(p.id) ?? null };
    }),
    alsoBought: res.alsoBought,
  };
  log.totalMs = Date.now() - t0;
  log.detailsMs = detailsMs;
  if (shop.products.length >= 4) {
    // cache only complete shops whose images all arrived (a later visit retries missing images)
    if (shop.products.every((p) => p.image && p.details)) {
      await mkdir(CRAVE_DIR, { recursive: true });
      await writeFile(shopFile(normaliseCraving(craving)), JSON.stringify(shop));
    }
  }
  return { shop, log };
}

export function registerCraveRoutes(app: Hono) {
  app.get("/api/crave/img/:file", async (c) => {
    const buf = await readImage(c.req.param("file"));
    if (!buf) return c.json({ error: "not found" }, 404);
    return c.body(new Uint8Array(buf), 200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" });
  });

  app.post("/api/crave/shop", async (c) => {
    let req: z.infer<typeof ReqSchema>;
    try {
      const raw = await c.req.text();
      if (raw.length > 2000) return c.json({ error: "request too large" }, 413);
      req = ReqSchema.parse(JSON.parse(raw));
    } catch {
      return c.json({ error: "bad request" }, 400);
    }
    const craving = req.craving.replace(/\s+/g, " ").trim().slice(0, 120);
    const ip = clientIp(c.req.raw.headers);
    c.header("X-Accel-Buffering", "no");
    c.header("Cache-Control", "no-cache");
    return streamSSE(c, async (stream) => {
      const t0 = Date.now();
      const send = async (ev: CraveEvent) => {
        if (!stream.aborted) await stream.writeSSE({ data: JSON.stringify(ev) });
      };
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), SHOP_TIMEOUT_MS);
      stream.onAbort(() => ac.abort());
      try {
        await send({ type: "status", label: "Hunting for the best deals…" });
        const cached = await loadCachedShop(craving);
        if (cached) {
          const { products, alsoBought: _a, craving: _c, ...header } = cached;
          await send({ type: "shop", shop: header });
          for (const p of products) await send({ type: "product", product: p });
          await send({ type: "done", shop: { ...cached, craving }, meta: { model: "cache", cached: true, ms: Date.now() - t0 } });
          return;
        }
        const limited = rateLimit(ip) ?? craveLimit(ip);
        if (limited) throw new UserError(limited);
        if (!takeDailyBudget(3)) throw new UserError("Crave mode is resting for today. Try one of the demo cravings.");
        const { shop, log } = await buildShop(craving, send, ac.signal);
        console.log(`[crave] ${JSON.stringify({ ...log, imageModel: IMAGE_MODEL, chars: craving.length, ok: !!shop })}`);
        if (shop) await send({ type: "done", shop, meta: { model: log.model, cached: false, ms: log.totalMs, firstProductMs: log.firstProductMs } });
      } catch (err) {
        const msg = err instanceof UserError ? err.message : ac.signal.aborted ? "The shop took too long to open. Please try again." : "The shop could not be opened right now. Please try again.";
        if (!(err instanceof UserError)) console.error("[crave] error", (err as Error)?.message ?? err);
        await send({ type: "error", message: msg });
      } finally {
        clearTimeout(timer);
      }
    });
  });
}

class UserError extends Error {}
