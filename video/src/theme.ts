import { loadFont as loadSans } from "@remotion/google-fonts/SchibstedGrotesk";

// The app's own tokens (app/src/styles/tokens.css): a green palette chosen to sit next to S-mobiili.
// Vara is an independent Junction 2026 concept: no S-Pankki logo and no S-Pankki font is used anywhere.
export const C = {
  deep: "#004628",      // hero block, dark slides
  deeper: "#00321d",
  green: "#007841",     // titles, primary
  bright: "#00eb5a",    // progress fill on dark
  mint: "#91fa9b",      // big numbers on dark, soft buttons
  screen: "#ebf7ec",    // app screen background
  backdrop: "#dcefdf",
  track: "#e0f3e1",
  heroMeta: "#cfe9d6",  // secondary text on dark
  ink: "#1f1f1f",
  inkStrong: "#363636",
  muted: "#666666",
  faint: "#949494",
  line: "#e6e6e6",
  sunken: "#f5f5f5",
  white: "#ffffff",
  warn: "#885600", warnBg: "#fff1d8",
  info: "#006e87", infoBg: "#e0f4ff",
  error: "#b70000", errorBg: "#ffeded",
};

export const sans = loadSans("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const TOTAL = 14; // slides in the deck (footer counter)
