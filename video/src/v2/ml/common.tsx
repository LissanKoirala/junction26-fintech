/* Shared pieces for the ML visuals: the data, colours, number formatting, timing helpers, the status tag. */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { C, sans } from "../../theme";
import raw from "./ml-data.json";

export type MlData = typeof raw;
export const DATA: MlData = raw;
export { C, sans };

/** Tribe colours on deep green, by tribe id. Aino's tribe (3) gets the warmest; the salary-sweep tribe (4) is neutral. */
export const TRIBE_COLORS = ["#5ab4f0", "#e9c46a", "#b9a2ff", "#ff8c78", "#9fb3a8"];
export const BUILT = C.mint;          // "Built a buffer"
export const SLIPPED = "#ffb35c";     // "Slipped"
export const HELD = "#c9d6cf";        // "Held steady"
export const INK = "#ffffff";
export const INK2 = C.heroMeta;       // secondary text
export const GRID = "rgba(255,255,255,.12)";

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Ramp 0 → 1 between fractions a and b of the clip. */
export const ramp = (p: number, a: number, b: number) => clamp((p - a) / Math.max(1e-6, b - a));

/** Progress through the whole clip (0 → 1) and the clip length in seconds. */
export const useProgress = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  return { p: clamp(frame / Math.max(1, durationInFrames - 1)), frame, sec: durationInFrames / fps, t: frame / fps, fps, dur: durationInFrames };
};

/** Finnish number style, as the app shows it: "4 304", "−240". */
export const num = (v: number, digits = 0) => {
  const s = Math.abs(v).toFixed(digits).replace(".", ",");
  const [i, d] = s.split(",");
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (v < 0 && Math.abs(v) >= 0.5 * 10 ** -digits ? "−" : "") + g + (d ? "," + d : "");
};
export const eur = (v: number, sign = false) => (sign && v > 0 ? "+" : "") + num(v) + " €";
export const pct = (share: number) => num(share * 100) + " %";

/** The model's standing, top right: "experimental" outlined, "ships" filled. */
export const StatusTag: React.FC<{ status: "ships" | "experimental"; name: string; opacity?: number }> = ({ status, name, opacity = 1 }) => {
  const ships = status === "ships";
  return <div style={{ position: "absolute", right: 64, top: 56, display: "flex", alignItems: "center", gap: 14, opacity, fontFamily: sans }}>
    <span style={{ fontSize: 26, fontWeight: 600, color: INK2 }}>{name}</span>
    <span style={{ padding: "6px 16px", borderRadius: 999, fontSize: 22, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
      color: ships ? C.deep : C.mint, background: ships ? C.mint : "transparent", border: `2px solid ${C.mint}` }}>{status}</span>
  </div>;
};

/** A heading, top left, that rises in. */
export const Title: React.FC<{ k: number; children: React.ReactNode; sub?: React.ReactNode; out?: number }> = ({ k, children, sub, out = 1 }) =>
  <div style={{ position: "absolute", left: 96, top: 92, fontFamily: sans, opacity: clamp(k * 1.6) * out, transform: `translateY(${(1 - ease(k)) * 30}px)` }}>
    <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, color: INK, lineHeight: 1.05 }}>{children}</div>
    {sub ? <div style={{ fontSize: 34, fontWeight: 600, color: INK2, marginTop: 10 }}>{sub}</div> : null}
  </div>;
