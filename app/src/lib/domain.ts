// Typed access to app/shared/domain.json plus the icon mapping to lucide.
import domainJson from "@shared/domain.json";
import type { Basket, Category, FlowKind, Tx } from "@shared/types";
import {
  ArrowRightLeft, Banknote, Bus, CirclePlus, HeartPulse, House, Plane, Shirt, ShoppingBasket, Sofa, Ticket,
  TrendingDown, TrendingUp, Utensils, Zap, CircleDashed, CalendarCheck, Umbrella, Coffee, type LucideIcon,
} from "lucide-react";

export interface BasketMeta { label: string; short: string; tagline: string; description: string; example: string; color: string }
export const domain = domainJson as unknown as {
  asOf: string;
  baskets: Record<Basket, BasketMeta>;
  flowKinds: Record<"saving" | "transfer" | "income", { label: string; color: string }>;
  categories: Record<Category, { label: string; icon: string; coicop?: string; benchmarkLabel?: string }>;
  mcc: Record<string, { label: string; category: string }>;
  smallPurchaseThreshold: number;
  basketRules: { purchases: Record<string, { default: Basket; mcc?: Record<string, Basket>; bigPurchase?: Basket }>; byType: Record<string, string> };
};

export const BASKETS: Basket[] = ["must_regular", "must_irregular", "everyday"];
export const basketMeta = (b: Basket) => domain.baskets[b];
export const basketColor = (b: Basket) => domain.baskets[b]?.color ?? "#949494";

/** Basket icons: regular musts (like rent), surprise musts (rainy-day), everyday extras (like coffees). */
const BASKET_ICONS: Record<Basket, LucideIcon> = { must_regular: CalendarCheck, must_irregular: Umbrella, everyday: Coffee };
export const basketIcon = (b: Basket): LucideIcon => BASKET_ICONS[b] ?? CircleDashed;

export function flowColor(k: FlowKind): string {
  if (k === "must_regular" || k === "must_irregular" || k === "everyday") return basketColor(k);
  return domain.flowKinds[k]?.color ?? "#949494";
}
export function flowLabel(k: FlowKind): string {
  if (k === "must_regular" || k === "must_irregular" || k === "everyday") return domain.baskets[k].label;
  return domain.flowKinds[k]?.label ?? k;
}

const ICONS: Record<string, LucideIcon> = {
  "shopping-basket": ShoppingBasket, utensils: Utensils, bus: Bus, ticket: Ticket, "heart-pulse": HeartPulse,
  sofa: Sofa, shirt: Shirt, plane: Plane, zap: Zap, home: House, banknote: Banknote, "plus-circle": CirclePlus,
  "trending-up": TrendingUp, "trending-down": TrendingDown, "arrow-right-left": ArrowRightLeft,
};

export function categoryLabel(c: string): string {
  return (domain.categories as Record<string, { label: string }>)[c]?.label ?? c;
}
export function categoryIcon(c: string): LucideIcon {
  const name = (domain.categories as Record<string, { icon: string }>)[c]?.icon;
  return (name && ICONS[name]) || CircleDashed;
}
export function mccLabel(mcc: string | null | undefined): string | null {
  if (!mcc) return null;
  return domain.mcc[mcc]?.label ?? null;
}
/** What to show as the "merchant" of a transaction: the merchant type from the MCC, else the category label. */
export function txTitle(tx: Tx): string {
  if (tx.type === "purchase") return mccLabel(tx.mcc) ?? categoryLabel(tx.category);
  return categoryLabel(tx.category);
}
export function ruleKey(tx: Pick<Tx, "category" | "mcc">): string {
  return `${tx.category}|${tx.mcc ?? "*"}`;
}

/** The main everyday purchase categories (for what-if sliders). */
export const PURCHASE_CATEGORIES: Category[] = ["Groceries", "Restaurants", "Transportation", "Entertainment", "Health", "Home & Tech", "Lifestyle", "Travel"];
