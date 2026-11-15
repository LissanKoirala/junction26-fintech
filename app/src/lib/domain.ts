// Typed access to app/shared/domain.json plus the icon mapping to lucide.
import domainJson from "@shared/domain.json";
import type { Basket, Category, FlowKind, Tx } from "@shared/types";
import { t } from "@shared/i18n";
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
/** Basket texts in the current language (domain.json holds the English). */
export const basketMeta = (b: Basket): BasketMeta => {
  const m = domain.baskets[b];
  return m && { ...m, label: t(m.label), short: t(m.short), tagline: t(m.tagline), description: t(m.description), example: t(m.example) };
};
export const basketColor = (b: Basket) => domain.baskets[b]?.color ?? "#949494";

/** Basket icons: regular musts (like rent), surprise musts (rainy-day), everyday extras (like coffees). */
const BASKET_ICONS: Record<Basket, LucideIcon> = { must_regular: CalendarCheck, must_irregular: Umbrella, everyday: Coffee };
export const basketIcon = (b: Basket): LucideIcon => BASKET_ICONS[b] ?? CircleDashed;

export function flowColor(k: FlowKind): string {
  if (k === "must_regular" || k === "must_irregular" || k === "everyday") return basketColor(k);
  return domain.flowKinds[k]?.color ?? "#949494";
}
export function flowLabel(k: FlowKind): string {
  if (k === "must_regular" || k === "must_irregular" || k === "everyday") return t(domain.baskets[k].label);
  const l = domain.flowKinds[k]?.label;
  return l ? t(l) : k;
}

const ICONS: Record<string, LucideIcon> = {
  "shopping-basket": ShoppingBasket, utensils: Utensils, bus: Bus, ticket: Ticket, "heart-pulse": HeartPulse,
  sofa: Sofa, shirt: Shirt, plane: Plane, zap: Zap, home: House, banknote: Banknote, "plus-circle": CirclePlus,
  "trending-up": TrendingUp, "trending-down": TrendingDown, "arrow-right-left": ArrowRightLeft,
};

export function categoryLabel(c: string): string {
  const l = (domain.categories as Record<string, { label: string }>)[c]?.label;
  return l ? t(l) : c;
}
export function categoryIcon(c: string): LucideIcon {
  const name = (domain.categories as Record<string, { icon: string }>)[c]?.icon;
  return (name && ICONS[name]) || CircleDashed;
}
export function mccLabel(mcc: string | null | undefined): string | null {
  if (!mcc) return null;
  const l = domain.mcc[mcc]?.label;
  return l ? t(l) : null;
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
