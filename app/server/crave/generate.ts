// Generates a Crave shop with the active language model (Gemini by default, see llm.ts) using structured output, streamed: the
// header and each product are parsed out of the partial JSON as soon as they are complete, so the client can
// render them progressively. Only the craving text is sent to the model.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CRAVE_DEFAULT_MODEL, streamMessage } from "../llm";
import { capCravePrice, shortenAtWord, CRAVE_ACCENTS, CRAVE_BADGES, CRAVE_CATEGORIES, CRAVE_ICONS, type CraveAddOn, type CraveProduct, type CraveReview, type CraveShopHeader, type CraveVariant } from "../../shared/crave";
import { DetailsSchema, ShopSchema } from "./schema";
import { realBrand, scrubBrands } from "./brands";
import { tr, type Lang } from "../../shared/i18n";

export const CRAVE_MODEL = CRAVE_DEFAULT_MODEL;

const SYSTEM = `You generate a believable, original online shop on the fly for "Crave mode" in a Finnish bank's app (a Junction 2026 hackathon concept). The customer has chosen to scratch a shopping craving by browsing and checking out in a simulated shop; nothing ships and the money goes to their own savings. Your job is to make the hunt fun and realistic.

Rules:
- Everything is invented: shop name, brand names, product names. NEVER use or imitate a real retailer, delivery app, restaurant chain, brand, product line, model name or trademark (no Apple, Nike, Sony, Wolt, Foodora, Zalando, IKEA, etc.), and never a real product-line or model name in a product name (no Cloudfoam, Ultraboost, Air Max, Jordan, Gel-Kayano, Fresh Foam, AirPods, QuietComfort, Galaxy, PlayStation, Big Mac and the like), nor a near copy of one. Name things in the style of an invented Nordic label: a short Finnish or Nordic-sounding word plus a plain descriptor, in the style of "Kivi Trail Runner" or "Hiljaa ANC Over-Ear" (style only: invent fresh names, do not reuse these).
- Decide the shop type: "food" for meals, snacks, drinks, takeaway and restaurant cravings (a delivery-app style menu of one invented restaurant, with dishes, add-ons, spice levels or sizes); "store" for things (an online store with a product grid).
- Prices in euros at realistic Finnish market level (e.g. sushi set 14-24 €, wireless headphones 39-349 €, sneakers 69-189 €). Use prices like 12.90, 79.00, 149.95. Make a spread from affordable to premium.
- 10 products, varied, each with a one-line pitch and 1-2 tags drawn from the shop's 4-6 facets so filters are useful. 2-3 products on sale with compareAtPrice 15-30% higher, 1-2 with stockLeft, a few badges, most badges empty.
- imagePrompt: a concrete visual description for a product photo (object, colour, material, styling) of a plain unbranded product. No brand names, no logos, no stripes or brand markings, no text, no people.
- {LANGUAGE} Keep strings short.
- Refuse (refused=true, products empty, a kind one-sentence refusalMessage) for cravings a bank app should not simulate: weapons, drugs or other controlled substances, adult or sexual content, gambling or betting, tobacco or vaping, anything illegal or harmful, or anything about hurting people. Alcohol: keep it to food pairings, do not build a liquor shop. For non-shoppable or unclear cravings (e.g. "love", "a holiday"), still make a sensible shop if you can (e.g. a travel gear store) without refusing.`;

export interface GenCallbacks {
  onHeader: (h: CraveShopHeader & { refused: boolean; refusalMessage: string }) => void;
  onProduct: (p: CraveProduct) => void;
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : d;
  return Math.min(hi, Math.max(lo, n));
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? shortenAtWord(v, max) : d); // never cuts a word in half
const oneOf = <T extends readonly string[]>(list: T, v: unknown, d: T[number]): T[number] => (list.includes(v as string) ? (v as T[number]) : d);

export function cleanHeader(h: Record<string, unknown>): CraveShopHeader & { refused: boolean; refusalMessage: string } {
  const kind = h.kind === "food" ? "food" : "store";
  return {
    refused: h.refused === true,
    refusalMessage: str(h.refusalMessage, 240),
    kind,
    category: oneOf(CRAVE_CATEGORIES, h.category, kind === "food" ? "Restaurants" : "Lifestyle"),
    shopName: str(h.shopName, 40, "Crave Shop"),
    tagline: str(h.tagline, 80),
    accent: oneOf(CRAVE_ACCENTS, h.accent, "teal"),
    icon: oneOf(CRAVE_ICONS, h.icon, kind === "food" ? "utensils" : "bag"),
    deliveryPromise: str(h.deliveryPromise, 48, kind === "food" ? "25-35 min" : "Delivery in 1-3 days"),
    etaMinutes: Math.round(clamp(h.etaMinutes, 0, 90, kind === "food" ? 30 : 0)),
    rating: Math.round(clamp(h.rating, 3, 5, 4.6) * 10) / 10,
    reviewCount: Math.round(clamp(h.reviewCount, 10, 99999, 1200)),
    deliveryFee: r2(clamp(h.deliveryFee, 0, 15, kind === "food" ? 2.99 : 5.9)),
    freeDeliveryFrom: r2(clamp(h.freeDeliveryFrom, 0, 200, kind === "food" ? 30 : 49)),
    sections: [],
    facets: [],
  };
}

export function cleanProduct(p: Record<string, unknown>, idx: number): CraveProduct {
  // very expensive cravings (cars): squeeze over-cap prices under the cap so they stay distinct, and scale a sale
  // price by the same factor, so the cap never invents a discount
  const raw = clamp(p.price, 0.5, 1e9, 19.9);
  const capped = capCravePrice(raw);
  const price = capped === raw ? r2(raw) : capped;
  const rawCmp = typeof p.compareAtPrice === "number" && Number.isFinite(p.compareAtPrice) ? p.compareAtPrice : 0;
  const cmpRaw = rawCmp > raw * 1.04 ? Math.min(rawCmp, raw * 2) * (price / raw) : 0;
  const cmp = cmpRaw ? (capped === raw ? r2(cmpRaw) : Math.round(cmpRaw)) : null;
  return {
    id: `p${idx + 1}`,
    section: str(p.section, 30),
    brand: str(p.brand, 30),
    name: str(p.name, 60, "Item"),
    pitch: str(p.pitch, 110),
    price,
    compareAtPrice: cmp,
    rating: Math.round(clamp(p.rating, 1, 5, 4.4) * 10) / 10,
    reviewCount: Math.round(clamp(p.reviewCount, 0, 99999, 120)),
    badge: oneOf(CRAVE_BADGES, p.badge, ""),
    stockLeft: typeof p.stockLeft === "number" && p.stockLeft >= 1 && p.stockLeft <= 9 ? Math.round(p.stockLeft) : null,
    tags: (Array.isArray(p.tags) ? p.tags : []).map((t) => str(t, 24)).filter(Boolean).slice(0, 3),
    ...cleanDetails(p),
    imagePrompt: str(p.imagePrompt, 220, str(p.name, 60)),
  };
}

/** Sections in order of appearance and the most used tags, derived from the products. */
export function deriveFacets(products: CraveProduct[]): { sections: string[]; facets: string[] } {
  const sections = [...new Set(products.map((p) => p.section).filter(Boolean))].slice(0, 6);
  const n = new Map<string, number>();
  for (const p of products) for (const t of p.tags) n.set(t, (n.get(t) ?? 0) + 1);
  const facets = [...n.entries()].filter(([, c]) => c >= 2 && c < products.length).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 6);
  return { sections, facets };
}

export function cleanDetails(p: Record<string, unknown>): { variants: CraveVariant[]; addOns: CraveAddOn[]; reviews: CraveReview[] } {
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    variants: arr(p.variants)
      .map((v) => ({ name: str(v.name, 24), options: (Array.isArray(v.options) ? v.options : []).map((o) => scrubBrands(str(o, 24))).filter(Boolean).slice(0, 6) }))
      .filter((v) => v.name && v.options.length > 1)
      .slice(0, 2),
    addOns: arr(p.addOns)
      .map((a) => ({ name: scrubBrands(str(a.name, 40)), price: r2(clamp(a.price, 0, 500, 1)) }))
      .filter((a) => a.name)
      .slice(0, 4),
    reviews: arr(p.reviews)
      .map((r) => ({ name: str(r.name, 24, "Customer"), rating: Math.round(clamp(r.rating, 1, 5, 5)), text: scrubBrands(str(r.text, 200)) }))
      .filter((r) => r.text)
      .slice(0, 3),
  };
}

/** Pulls the header and the complete product objects out of a partial JSON string. */
export function scanPartial(text: string, key = "products"): { header: Record<string, unknown> | null; products: Record<string, unknown>[] } {
  const m = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(text);
  if (!m) return { header: null, products: [] };
  let header: Record<string, unknown> | null = null;
  try {
    header = JSON.parse(text.slice(0, m.index).replace(/,\s*$/, "") + "}");
  } catch {
    header = null;
  }
  const products: Record<string, unknown>[] = [];
  let depth = 0, inStr = false, esc = false, start = -1;
  for (let i = m.index + m[0].length; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") {
      if (depth === 0 && ch === "{") start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      if (depth === 0) break; // end of the products array
      depth--;
      if (depth === 0 && ch === "}" && start >= 0) {
        try {
          products.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          /* ignore */
        }
        start = -1;
      }
    }
  }
  return { header, products };
}

export interface GenResult {
  refused: boolean;
  refusalMessage: string;
  header: CraveShopHeader | null;
  products: CraveProduct[];
  alsoBought: string[];
  usage: { in: number; out: number };
  ttftMs: number;
}

const LANGUAGE: Record<Lang, string> = {
  en: "Write in English.",
  fi: "Write all customer-facing text (tagline, deliveryPromise, product names, pitches, sections, tags, refusalMessage) in natural, everyday Finnish, the way a Finnish online shop or delivery app would (e.g. deliveryPromise \"Ilmainen toimitus huomenna\" or \"25–35 min\"). Shop and brand names stay invented and may be language-neutral. imagePrompt stays in English.",
};
const systemFor = (lang: Lang) => SYSTEM.replace("{LANGUAGE}", LANGUAGE[lang]);

/** A shop needs at least this many products; fewer (an empty or cut-off stream) is retried, never cached. */
export const MIN_PRODUCTS = 6;
const STALL_MS = Number(process.env.VARA_CRAVE_STALL_MS ?? 6000); // no new output this long after the header: retry
const INVENTED_SHOPS = ["Lumo Market", "Kaamos & Co", "Revontuli Store", "Pakkas Supply", "Sisu Lane", "Kivi & Kuu", "Hanki Studio", "Tuisku Shop"];

/** Removes real brands and product lines from a product (brand falls back to the shop's own invented name); null drops it. */
export function scrubProduct(p: CraveProduct, shopName: string): CraveProduct | null {
  const hit = realBrand(p.brand) ?? realBrand(p.name) ?? realBrand(p.pitch) ?? realBrand(p.imagePrompt) ?? p.tags.map(realBrand).find(Boolean) ?? null;
  if (!hit) return p;
  const name = scrubBrands(p.name);
  console.warn(`[crave] real brand "${hit}" removed from a generated product`);
  if (name.replace(/[^\p{L}]/gu, "").length < 3) return null;
  return { ...p, brand: realBrand(p.brand) ? shopName : p.brand, name, pitch: scrubBrands(p.pitch), tags: p.tags.map(scrubBrands).filter(Boolean), imagePrompt: scrubBrands(p.imagePrompt) || name };
}

function scrubHeader<T extends CraveShopHeader>(h: T, craving: string): T {
  if (!realBrand(h.shopName) && !realBrand(h.tagline)) return h;
  console.warn(`[crave] real brand removed from a generated shop header`);
  const pick = INVENTED_SHOPS[[...craving].reduce((a, c) => a + c.charCodeAt(0), 0) % INVENTED_SHOPS.length];
  return { ...h, shopName: realBrand(h.shopName) ? pick : h.shopName, tagline: scrubBrands(h.tagline) };
}

/**
 * Streams the shop: header first, then products one by one. If the stream ends (or stalls for STALL_MS after the
 * header) with fewer than MIN_PRODUCTS products, it retries once on the same model chain, then once on the rest of
 * the chain; a retry keeps the header already shown (the model is told to use it) and adds products after those
 * already sent. Products are checked against the real-brand list before they are sent.
 */
export async function generateShop(craving: string, cb: GenCallbacks, signal: AbortSignal, model = CRAVE_MODEL, lang: Lang = "en"): Promise<GenResult> {
  const t0 = Date.now();
  let ttft = 0;
  const chain = model.split(",").map((m) => m.trim()).filter(Boolean);
  const plans = chain.length > 1 ? [model, model, chain.slice(1).join(",")] : [model, model];
  const usage = { in: 0, out: 0 };
  let shown: (CraveShopHeader & { refused: boolean; refusalMessage: string }) | null = null;
  let rawHeader: Record<string, unknown> | null = null;
  let lastFull: Record<string, unknown> | null = null;
  const products: CraveProduct[] = [];
  const take = (raw: Record<string, unknown>) => {
    if (products.length >= 10 || !shown || shown.refused) return;
    let p: CraveProduct | null = cleanProduct(raw, products.length);
    if (shown.kind === "food") p = { ...p, brand: shown.shopName };
    p = scrubProduct(p, shown.shopName);
    if (!p) return;
    products.push(p);
    cb.onProduct(p);
  };
  for (let a = 0; a < plans.length && !signal.aborted; a++) {
    const m = plans[a];
    const isHaiku = /haiku|gemini/.test(m); // Gemini: thinking "disabled" maps to the lowest thinking level
    const keep = shown ? { shopName: shown.shopName, kind: shown.kind, category: shown.category, tagline: shown.tagline, accent: shown.accent, icon: shown.icon } : null;
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: m,
      max_tokens: 8000,
      system: systemFor(lang),
      messages: [
        {
          role: "user",
          content: keep
            ? `The customer's craving: "${craving}"\nThe shop is already open with this header; use exactly these values: ${JSON.stringify(keep)}. refused is false. Generate the 10 products.`
            : `The customer's craving: "${craving}"\nGenerate the shop.`,
        },
      ],
      output_config: { effort: "low", format: zodOutputFormat(ShopSchema) },
    };
    // Fastest settings that keep quality: no thinking where the model allows it.
    if (isHaiku) (params as unknown as Record<string, unknown>).thinking = { type: "disabled" };
    else if (/sonnet-5\.5/.test(m)) (params as unknown as Record<string, unknown>).thinking = { type: "between_tools" };
    const local = new AbortController();
    let lastOut = Date.now();
    let stalled = false;
    const watchdog = setInterval(() => {
      if (shown && Date.now() - lastOut > STALL_MS) {
        stalled = true;
        local.abort(new Error("stalled"));
      }
    }, 250);
    let text = "";
    let seen = 0;
    let refusedByStop = false;
    try {
      const ms = streamMessage(params, { signal: AbortSignal.any([signal, local.signal]) });
      for await (const ev of ms) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          lastOut = Date.now();
          if (!ttft) ttft = Date.now() - t0;
          text += ev.delta.text;
          const { header, products: ps } = scanPartial(text);
          if (header && !shown) {
            rawHeader = header;
            shown = scrubHeader(cleanHeader(header), craving);
            cb.onHeader(shown);
          }
          while (seen < ps.length) take(ps[seen++]);
        }
      }
      const msg = await ms.finalMessage();
      usage.in += msg.usage.input_tokens;
      usage.out += msg.usage.output_tokens;
      refusedByStop = msg.stop_reason === "refusal";
    } catch (err) {
      if (signal.aborted) throw err;
      if (!stalled && a === plans.length - 1 && !products.length) throw err;
      console.warn(`[crave] shop attempt ${a + 1} (${m}) ${stalled ? "stalled" : "failed"}: ${(err as Error).message?.slice(0, 160)}`);
    } finally {
      clearInterval(watchdog);
    }
    if (refusedByStop && !products.length)
      return { refused: true, refusalMessage: tr(lang).t("This one is not something Crave mode can open a shop for."), header: null, products: [], alsoBought: [], usage, ttftMs: ttft };
    let full: Record<string, unknown> | null = null;
    try {
      full = JSON.parse(text);
    } catch {
      full = null;
    }
    if (full) lastFull = full;
    const scanned = scanPartial(text);
    if (!shown && (full ?? scanned.header)) {
      rawHeader = full ?? scanned.header;
      shown = scrubHeader(cleanHeader(rawHeader!), craving);
      cb.onHeader(shown);
    }
    if (shown?.refused) break;
    const rest = full && Array.isArray(full.products) ? (full.products as Record<string, unknown>[]) : scanned.products;
    while (seen < rest.length) take(rest[seen++]);
    if (products.length >= MIN_PRODUCTS) break;
    if (a < plans.length - 1) console.warn(`[crave] only ${products.length} products after attempt ${a + 1}${stalled ? " (stalled)" : ""}; retrying`);
  }
  if (shown?.refused) return { refused: true, refusalMessage: shown.refusalMessage, header: shown, products: [], alsoBought: [], usage, ttftMs: ttft };
  const hdrSrc = { ...(lastFull ?? rawHeader ?? {}), ...(rawHeader ? { shopName: shown?.shopName, kind: shown?.kind, category: shown?.category, tagline: shown?.tagline, accent: shown?.accent, icon: shown?.icon } : {}), refused: false };
  const header = shown ? { ...scrubHeader(cleanHeader(hdrSrc), craving), ...deriveFacets(products) } : null;
  const ids = new Set(products.map((p) => p.id));
  const alsoBought = (lastFull && Array.isArray(lastFull.alsoBought) ? (lastFull.alsoBought as unknown[]) : []).map(String).filter((id) => ids.has(id)).slice(0, 4);
  return { refused: false, refusalMessage: "", header, products, alsoBought, usage, ttftMs: ttft };
}

const DETAILS_SYSTEM = `You write product details for an invented online shop in a Finnish bank's "Crave mode" (a Junction 2026 concept; nothing ships). For each product id you get, write variants, add-ons and 2-3 short believable reviews. Variants must fit the product (sizes for clothes and shoes, colours for gadgets, spice level or size for dishes). Add-on prices in euros at Finnish level. Reviewer names are invented first names with an initial. Never mention real brands, retailers or people. Short strings.`;
const DETAILS_LANGUAGE: Record<Lang, string> = { en: " Write in English.", fi: " Write variant names, options, add-ons and reviews in natural everyday Finnish (reviewer names Finnish first names with an initial)." };

/** Second pass: variants, add-ons and reviews for some products, streamed item by item. */
export async function generateDetails(
  header: CraveShopHeader,
  products: CraveProduct[],
  onItem: (id: string, d: ReturnType<typeof cleanDetails>) => void,
  signal: AbortSignal,
  model = CRAVE_MODEL,
  lang: Lang = "en",
): Promise<{ in: number; out: number }> {
  const input = { shop: { name: header.shopName, kind: header.kind, tagline: header.tagline }, products: products.map((p) => ({ id: p.id, brand: p.brand, name: p.name, pitch: p.pitch, price: p.price, section: p.section })) };
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 6000,
    system: DETAILS_SYSTEM + DETAILS_LANGUAGE[lang],
    messages: [{ role: "user", content: JSON.stringify(input) }],
    output_config: { effort: "low", format: zodOutputFormat(DetailsSchema) },
  };
  if (/haiku|gemini/.test(model)) (params as unknown as Record<string, unknown>).thinking = { type: "disabled" };
  else if (/sonnet-5\.5/.test(model)) (params as unknown as Record<string, unknown>).thinking = { type: "between_tools" };
  const ids = new Set(products.map((p) => p.id));
  const done = new Set<string>();
  const ms = streamMessage(params, { signal });
  let text = "";
  for await (const ev of ms) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
      text += ev.delta.text;
      for (const it of scanPartial(text, "items").products) {
        const id = String(it.id);
        if (ids.has(id) && !done.has(id)) {
          done.add(id);
          onItem(id, cleanDetails(it));
        }
      }
    }
  }
  const msg = await ms.finalMessage();
  return { in: msg.usage.input_tokens, out: msg.usage.output_tokens };
}
