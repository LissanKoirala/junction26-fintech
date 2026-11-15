// Structured-output schemas for a generated Crave shop. Two passes so the first products are on screen fast:
//   1. ShopSchema: header + "lite" products (everything the grid needs), streamed and parsed incrementally.
//   2. DetailsSchema: variants, add-ons and reviews per product, generated in parallel while the user browses.
// Field ORDER matters: structured outputs follow the schema order, so the header comes before the products.
import { z } from "zod";
import { CRAVE_ACCENTS, CRAVE_BADGES, CRAVE_CATEGORIES, CRAVE_ICONS } from "../../shared/crave";

export const LiteProductSchema = z.object({
  id: z.string().describe("p1, p2, ... in order"),
  section: z.string().describe("Menu section (food) or product type (store); 3-4 distinct sections across the shop"),
  brand: z.string().describe("Invented brand (store) or the restaurant's own name (food). Never a real brand."),
  name: z.string().describe("Product or dish name, short"),
  pitch: z.string().describe("One-line pitch, at most 60 characters"),
  price: z.number().describe("Euros, Finnish market level, e.g. 14.90"),
  compareAtPrice: z.number().nullable().describe("Previous price if on sale (2-3 products), else null"),
  rating: z.number().describe("3.6 to 4.9"),
  reviewCount: z.number().describe("Whole number, 12 to 4800"),
  badge: z.enum(CRAVE_BADGES),
  stockLeft: z.number().nullable().describe("Only for 1-2 scarce products: 2 to 6, else null"),
  tags: z.array(z.string()).describe("1-2 short filter facets, reused across products from a set of 4-6 (e.g. Wireless, Noise cancelling, Vegan, Spicy)"),
  imagePrompt: z.string().describe("Visual description for a photo in at most 12 words: object, colour, material. No brands, no text, no people."),
});

export const ShopSchema = z.object({
  refused: z.boolean().describe("true if a bank app must not simulate a shop for this craving"),
  refusalMessage: z.string().describe("If refused: one kind sentence. Else empty."),
  kind: z.enum(["store", "food"]).describe("food for meals, snacks, drinks and restaurant cravings; store for things"),
  category: z.enum(CRAVE_CATEGORIES).describe("Takeaway, delivery or restaurant cravings: Restaurants. Grocery items: Groceries."),
  shopName: z.string().describe("Invented shop or restaurant name, 1-3 words, never a real company"),
  tagline: z.string().describe("At most 45 characters"),
  accent: z.enum(CRAVE_ACCENTS),
  icon: z.enum(CRAVE_ICONS),
  products: z.array(LiteProductSchema).describe("10 products when not refused, else empty"),
  alsoBought: z.array(z.string()).describe("3 product ids that go well together"),
  deliveryPromise: z.string().describe('store: e.g. "Free delivery tomorrow"; food: e.g. "25-35 min"'),
  etaMinutes: z.number().describe("food: delivery minutes (20-45); store: 0"),
  rating: z.number().describe("Shop rating 4.1-4.9"),
  reviewCount: z.number(),
  deliveryFee: z.number().describe("store 4.90-6.90, food 1.99-4.99"),
  freeDeliveryFrom: z.number().describe("store 39-79, food 25-35"),
});

export const DetailsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      variants: z.array(z.object({ name: z.string(), options: z.array(z.string()) })).describe("0-2 groups (size, colour, flavour, spice level), 2-4 options each"),
      addOns: z.array(z.object({ name: z.string(), price: z.number() })).describe("food: 2-3 extras with prices; store: 0-2 accessories"),
      reviews: z.array(z.object({ name: z.string().describe("Invented first name + initial"), rating: z.number(), text: z.string().describe("One believable sentence, under 110 characters") })).describe("2-3 reviews, mixed but mostly positive"),
    }),
  ),
});
