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
