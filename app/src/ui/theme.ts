// Moodboard switches. Each open design decision is ONE variant here; feature code never styles itself.
// For quick comparison on a phone, the URL can override them: ?hero=deep&avatar=mark&chips=tint&radius=24
export type HeroVariant = "card" | "deep" | "gradient";
export type AvatarVariant = "placeholder" | "mark";
export type BasketChipVariant = "dot" | "tint";

export interface ThemeConfig {
  hero: HeroVariant;
  avatar: AvatarVariant;
  basketChips: BasketChipVariant;
  cardRadius: 16 | 24;
}

const DEFAULTS: ThemeConfig = { hero: "deep", avatar: "mark", basketChips: "dot", cardRadius: 16 };

function fromUrl(): ThemeConfig {
  const t = { ...DEFAULTS };
  try {
    const q = new URLSearchParams(window.location.search);
    const h = q.get("hero");
    if (h === "card" || h === "deep" || h === "gradient") t.hero = h;
    const a = q.get("avatar");
    if (a === "placeholder" || a === "mark") t.avatar = a;
    const c = q.get("chips");
    if (c === "dot" || c === "tint") t.basketChips = c;
    if (q.get("radius") === "24") t.cardRadius = 24;
  } catch {
    /* ignore */
  }
  return t;
}

export const theme: ThemeConfig = fromUrl();

export function applyThemeToDocument() {
  document.documentElement.style.setProperty("--radius-app-card", `${theme.cardRadius}px`);
}
