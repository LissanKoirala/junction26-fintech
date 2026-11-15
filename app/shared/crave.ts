// Crave mode: protocol between the browser and POST /api/crave/shop, plus the per-customer craving diary types.
// "Saving money, a craving at a time." The customer opts in to a full shopping ritual for something they crave;
// nothing ships, and the basket total is moved (simulated) into a Crave pot in their own savings.
// Privacy: only the craving text and generic product prompts ever leave the server (to the language and image
// models). The customer id is validated and never forwarded.

export const CRAVE_MOTTO = "Saving money, a craving at a time.";

export type ShopKind = "store" | "food";

/** Spending categories of the dataset a craving can map to (so Vara can compare with real spending). */
export const CRAVE_CATEGORIES = ["Restaurants", "Groceries", "Home & Tech", "Lifestyle", "Entertainment", "Travel", "Health", "Transportation"] as const;
export type CraveCategory = (typeof CRAVE_CATEGORIES)[number];

/** Accent names the model may choose; the client maps them to tasteful colours. */
export const CRAVE_ACCENTS = ["teal", "violet", "amber", "indigo", "olive", "plum", "ocean", "terracotta", "graphite", "rose"] as const;
export type CraveAccent = (typeof CRAVE_ACCENTS)[number];

/** Icon names the model may choose; the client maps them to lucide icons. */
export const CRAVE_ICONS = [
  "headphones", "shirt", "footprints", "fish", "pizza", "coffee", "gamepad", "sofa", "sparkles", "dumbbell", "book", "plane",
  "laptop", "watch", "utensils", "cake", "bag", "flower", "camera", "smartphone", "salad", "soup", "beer", "gift",
] as const;
export type CraveIcon = (typeof CRAVE_ICONS)[number];

export const CRAVE_BADGES = ["", "Bestseller", "Deal", "Only a few left", "New", "Chef's pick", "Popular", "Staff favourite"] as const;
export type CraveBadge = (typeof CRAVE_BADGES)[number];

export interface CraveReview {
  name: string; // invented first name + initial
  rating: number; // 1..5
  text: string;
}
export interface CraveVariant {
  name: string; // "Size", "Colour", "Spice level"
  options: string[];
}
export interface CraveAddOn {
  name: string;
  price: number;
}
export interface CraveProduct {
  id: string;
  section: string; // grid category or menu section
  brand: string; // invented
  name: string;
  pitch: string;
  price: number;
  compareAtPrice: number | null; // "was" price for a deal
  rating: number;
  reviewCount: number;
  badge: CraveBadge;
  stockLeft: number | null;
  tags: string[]; // filter facets
  variants: CraveVariant[];
  addOns: CraveAddOn[]; // food: extras; store: optional accessories
  reviews: CraveReview[];
  imagePrompt: string; // generic visual description (no brands, no text)
  image?: string | null; // filled by the server: /api/crave/img/<hash>.jpg, or null when generation failed
  details?: boolean; // variants, add-ons and reviews have arrived (second, parallel pass)
}
export interface CraveShopHeader {
  kind: ShopKind;
  category: CraveCategory;
  shopName: string; // invented
  tagline: string;
  accent: CraveAccent;
  icon: CraveIcon;
  deliveryPromise: string; // "Arrives Thursday" / "25-35 min"
  etaMinutes: number; // food: minutes; store: 0
  rating: number;
  reviewCount: number;
  deliveryFee: number;
  freeDeliveryFrom: number;
  sections: string[];
  facets: string[]; // filter chips
}
export interface CraveShop extends CraveShopHeader {
  craving: string;
  products: CraveProduct[];
  alsoBought: string[]; // product ids
}

export interface CraveShopRequest {
  customerId: string;
  craving: string;
}

export type CraveEvent =
  | { type: "status"; label: string }
  | { type: "shop"; shop: CraveShopHeader }
  | { type: "product"; product: CraveProduct }
  | { type: "image"; id: string; url: string | null }
  | { type: "details"; id: string; variants: CraveVariant[]; addOns: CraveAddOn[]; reviews: CraveReview[] }
  | { type: "refused"; message: string }
  | { type: "done"; shop: CraveShop; meta: { model: string; cached: boolean; ms: number; firstProductMs?: number } }
  | { type: "error"; message: string };

// ---------------------------------------------------------------- diary (client state, per customer)
export interface CraveEntry {
  id: string; // order number
  craving: string;
  shopName: string;
  kind: ShopKind;
  category: CraveCategory;
  basketTotal: number; // what the basket would have cost
  amount: number; // what was stashed (may be smaller after the safe-to-spend guard, or 0 for window-shopping)
  items: { name: string; qty: number; price: number }[];
  at: number; // real clock: when the craving struck (time of day matters for the diary)
  status: "saved" | "released";
  releasedAt?: number;
}

/** Compact summary sent with chat requests (additive optional field) so Vara can answer from real numbers. */
export interface CraveSummary {
  count: number; // cravings redirected (saved, not released)
  savedTotal: number; // euros in the Crave pot now
  releasedCount: number;
  releasedTotal: number;
  windowShops: number; // cravings shopped with 0 € stashed
  byCategory: { category: string; count: number; amount: number }[];
  byTimeOfDay: { slot: string; count: number }[];
  topWeekday: string | null;
  recent: { craving: string; amount: number; status: string }[];
}

/**
 * The shop's generated delivery promise as a time only ("Free delivery tomorrow" -> "Tomorrow", "Delivery in 6-8 weeks"
 * -> "In 6-8 weeks", "Ilmainen toimitus huomenna" -> "Huomenna"). Whether delivery is free depends on the basket, so
 * the app says "free" itself, only when the fee really is 0. Returns "" when nothing but the promotion was left.
 */
export function deliveryWhen(promise: string | null | undefined): string {
  let s = (promise ?? "").trim();
  // "free over 49 €" / "ilmainen toimitus yli 49 €": a threshold, not a time
  s = s.replace(/[,·;]?\s*(?:free(?:\s+(?:standard\s+)?(?:delivery|shipping))?|(?:ilmainen|maksuton)(?:\s+(?:toimitus|kotiinkuljetus))?)\s+(?:over|from|above|on orders over|yli|alkaen)\s+\d[\d\s.,]*\s*(?:€|eur)?/giu, "");
  s = s.replace(/\b(?:free|ilmainen|maksuton)\s+(?:standard\s+)?(?:delivery|shipping|toimitus|kotiinkuljetus)\b/giu, "");
  s = s.replace(/\b(?:free|ilmainen|maksuton)\b/giu, "");
  s = s.replace(/^\s*(?:delivery|shipping|arrives|toimitus)\s+(?=\S)/iu, "");
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s·,:;–—-]+|[\s·,:;–—-]+$/g, "").trim();
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : "";
}

/** Shortens text to at most `max` characters at a word boundary, with an ellipsis; never cuts a word in half. */
export function shortenAtWord(text: string, max: number): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, Math.max(1, max - 1));
  const sp = cut.lastIndexOf(" ");
  const head = (sp >= max * 0.4 ? cut.slice(0, sp) : cut).replace(/[\s,;:·–—-]+$/, "");
  return `${head}…`;
}

/** Highest price a generated product may have (one product must stay payable in the simulated checkout). */
export const CRAVE_PRICE_CAP = 5000;
const CRAVE_PRICE_KNEE = 4000;
/**
 * Prices above the knee are squeezed smoothly under the cap instead of being clipped to it, so prices that differed
 * still differ and keep their order (e.g. 75 000 -> 4 947, 89 000 -> 4 955). Prices up to the knee are unchanged.
 */
export function capCravePrice(price: number): number {
  if (!(price > CRAVE_PRICE_KNEE)) return price;
  const squeezed = CRAVE_PRICE_KNEE + (CRAVE_PRICE_CAP - CRAVE_PRICE_KNEE - 1) * (1 - CRAVE_PRICE_KNEE / price);
  return Math.min(CRAVE_PRICE_CAP - 1, Math.max(CRAVE_PRICE_KNEE, Math.round(squeezed)));
}
