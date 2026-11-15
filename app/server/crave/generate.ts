// Generates a Crave shop with Claude (via the existing Runware client) using structured output, streamed: the
// header and each product are parsed out of the partial JSON as soon as they are complete, so the client can
// render them progressively. Only the craving text is sent to the model.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { llm } from "../llm";
import { CRAVE_ACCENTS, CRAVE_BADGES, CRAVE_CATEGORIES, CRAVE_ICONS, type CraveAddOn, type CraveProduct, type CraveReview, type CraveShopHeader, type CraveVariant } from "../../shared/crave";
import { DetailsSchema, ShopSchema } from "./schema";

export const CRAVE_MODEL = process.env.CRAVE_MODEL ?? "anthropic:claude@haiku-5.5";

const SYSTEM = `You generate a believable, original online shop on the fly for "Crave mode" in a Finnish bank's app (a Junction 2026 hackathon concept). The customer has chosen to scratch a shopping craving by browsing and checking out in a simulated shop; nothing ships and the money goes to their own savings. Your job is to make the hunt fun and realistic.

Rules:
- Everything is invented: shop name, brand names, product names. NEVER use or imitate a real retailer, delivery app, restaurant chain, brand, product line or trademark (no Apple, Nike, Sony, Wolt, Foodora, Zalando, IKEA, etc.). Invent plausible, tasteful names (Nordic-sounding names are welcome).
- Decide the shop type: "food" for meals, snacks, drinks, takeaway and restaurant cravings (a delivery-app style menu of one invented restaurant, with dishes, add-ons, spice levels or sizes); "store" for things (an online store with a product grid).
- Prices in euros at realistic Finnish market level (e.g. sushi set 14-24 €, wireless headphones 39-349 €, sneakers 69-189 €). Use prices like 12.90, 79.00, 149.95. Make a spread from affordable to premium.
- 10 products, varied, each with a one-line pitch and 1-2 tags drawn from the shop's 4-6 facets so filters are useful. 2-3 products on sale with compareAtPrice 15-30% higher, 1-2 with stockLeft, a few badges, most badges empty.
- imagePrompt: a concrete visual description for a product photo (object, colour, material, styling). No brand names, no text, no logos, no people.
- Write in English. Keep strings short.
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
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.trim().slice(0, max) : d);
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
    deliveryPromise: str(h.deliveryPromise, 40, kind === "food" ? "25-35 min" : "Delivery in 1-3 days"),
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
  const price = r2(clamp(p.price, 0.5, 5000, 19.9));
  const cmp = typeof p.compareAtPrice === "number" && p.compareAtPrice > price * 1.04 ? r2(Math.min(p.compareAtPrice, price * 2)) : null;
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
      .map((v) => ({ name: str(v.name, 24), options: (Array.isArray(v.options) ? v.options : []).map((o) => str(o, 24)).filter(Boolean).slice(0, 6) }))
      .filter((v) => v.name && v.options.length > 1)
      .slice(0, 2),
    addOns: arr(p.addOns)
      .map((a) => ({ name: str(a.name, 40), price: r2(clamp(a.price, 0, 500, 1)) }))
      .filter((a) => a.name)
      .slice(0, 4),
    reviews: arr(p.reviews)
      .map((r) => ({ name: str(r.name, 24, "Customer"), rating: Math.round(clamp(r.rating, 1, 5, 5)), text: str(r.text, 200) }))
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

export async function generateShop(craving: string, cb: GenCallbacks, signal: AbortSignal, model = CRAVE_MODEL): Promise<GenResult> {
  const t0 = Date.now();
  let ttft = 0;
  const isHaiku = /haiku/.test(model);
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: "user", content: `The customer's craving: "${craving}"\nGenerate the shop.` }],
    output_config: { effort: "low", format: zodOutputFormat(ShopSchema) },
  };
  // Fastest settings that keep quality: no thinking where the model allows it.
  if (isHaiku) (params as unknown as Record<string, unknown>).thinking = { type: "disabled" };
  else if (/sonnet-5\.5/.test(model)) (params as unknown as Record<string, unknown>).thinking = { type: "between_tools" };
  const ms = llm().messages.stream(params, { signal });
  let text = "";
  let headerSent = false;
  let sent = 0;
  for await (const ev of ms) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
      if (!ttft) ttft = Date.now() - t0;
      text += ev.delta.text;
      const { header, products } = scanPartial(text);
      if (header && !headerSent) {
        headerSent = true;
        cb.onHeader(cleanHeader(header));
      }
      while (sent < products.length) {
        cb.onProduct(cleanProduct(products[sent], sent));
        sent++;
      }
    }
  }
  const msg = await ms.finalMessage();
  const usage = { in: msg.usage.input_tokens, out: msg.usage.output_tokens };
  if (msg.stop_reason === "refusal")
    return { refused: true, refusalMessage: "This one is not something Crave mode can open a shop for.", header: null, products: [], alsoBought: [], usage, ttftMs: ttft };
  let full: Record<string, unknown> | null = null;
  try {
    full = JSON.parse(text);
  } catch {
    full = null;
  }
  const scanned = scanPartial(text);
  const rawProducts = full && Array.isArray(full.products) ? (full.products as Record<string, unknown>[]) : scanned.products;
  const products = rawProducts.slice(0, 14).map((p, i) => cleanProduct(p, i));
  while (sent < products.length) cb.onProduct(products[sent++]);
  const hdr = full ?? scanned.header;
  const header = hdr ? { ...cleanHeader(hdr), ...deriveFacets(products) } : null;
  if (header && !headerSent) cb.onHeader(header);
  const ids = new Set(products.map((p) => p.id));
  const alsoBought = (full && Array.isArray(full.alsoBought) ? (full.alsoBought as unknown[]) : []).map(String).filter((id) => ids.has(id)).slice(0, 4);
  return { refused: !!header?.refused, refusalMessage: header?.refusalMessage ?? "", header, products, alsoBought, usage, ttftMs: ttft };
}

const DETAILS_SYSTEM = `You write product details for an invented online shop in a Finnish bank's "Crave mode" (a Junction 2026 concept; nothing ships). For each product id you get, write variants, add-ons and 2-3 short believable reviews. Variants must fit the product (sizes for clothes and shoes, colours for gadgets, spice level or size for dishes). Add-on prices in euros at Finnish level. Reviewer names are invented first names with an initial. Never mention real brands, retailers or people. English, short strings.`;

/** Second pass: variants, add-ons and reviews for some products, streamed item by item. */
export async function generateDetails(
  header: CraveShopHeader,
  products: CraveProduct[],
  onItem: (id: string, d: ReturnType<typeof cleanDetails>) => void,
  signal: AbortSignal,
  model = CRAVE_MODEL,
): Promise<{ in: number; out: number }> {
  const input = { shop: { name: header.shopName, kind: header.kind, tagline: header.tagline }, products: products.map((p) => ({ id: p.id, brand: p.brand, name: p.name, pitch: p.pitch, price: p.price, section: p.section })) };
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 6000,
    system: DETAILS_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(input) }],
    output_config: { effort: "low", format: zodOutputFormat(DetailsSchema) },
  };
  if (/haiku/.test(model)) (params as unknown as Record<string, unknown>).thinking = { type: "disabled" };
  else if (/sonnet-5\.5/.test(model)) (params as unknown as Record<string, unknown>).thinking = { type: "between_tools" };
  const ids = new Set(products.map((p) => p.id));
  const done = new Set<string>();
  const ms = llm().messages.stream(params, { signal });
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
