/* The Money Map as a 3D point cloud, drawn on a canvas: own projection (orbit camera, perspective divide, depth sort).
 * Positions are the model's own: x, y = the app's Money Map (UMAP), height = the customer's savings rate (ml-data.json). */
import React, { useLayoutEffect, useRef } from "react";
import { DATA, TRIBE_COLORS, BUILT, SLIPPED, HELD, clamp } from "./common";

export const W = 1920, H = 1080;
const HS = 1.15;       // world height span of the savings-rate axis
// Framing only (a uniform scale and shift of the map, same for every point): the main body of the map
// (x 0.65-1.0, y 0-1) is centred; the salary-sweep island (x ~0.02) sits further out.
const MX = 0.84, MY = 0.53, S = 2.3;
const DIST = 3.6;      // camera distance at zoom 1
const FOCAL = 1250;

export type Cam = {
  az: number; el: number; zoom: number;
  target: [number, number, number];   // look-at point, world coords
  cx?: number; cy?: number;           // where the target lands on screen
  lift: number;                       // 0 = flat 2D map, 1 = full savings-rate height
};
export type CloudLook = {
  appear: number;    // 0..1 points arrive (rippling out from the map's centre)
  focus: number;     // 0..1 everyone outside Aino's tribe dims
  twinFocus?: number;  // 0..1 everyone but Aino's look-alikes dims
  lines?: number;    // 0..1 lines from Aino to her look-alikes, nearest first
  opacity?: number;
};

const N = DATA.n;
/** World coordinates of point i at a given lift. */
export const world = (i: number, lift: number): [number, number, number] =>
  [(DATA.x[i] - MX) * S, (DATA.z[i] - 0.5) * HS * lift, (DATA.y[i] - MY) * S];
export const GX0 = -0.6, GX1 = 0.55, GZ0 = -1.3, GZ1 = 1.2;   // floor grid
export const heightOf = (z01: number, lift: number) => (z01 - 0.5) * HS * lift;
/** Savings rate (%) → 0..1 on the axis scale. */
export const zOfRate = (r: number) => (r - DATA.zLo) / (DATA.zHi - DATA.zLo);

export function makeProjector(c: Cam) {
  const ca = Math.cos(c.az), sa = Math.sin(c.az), ce = Math.cos(c.el), se = Math.sin(c.el);
  const dist = DIST / c.zoom, cx = c.cx ?? W / 2, cy = c.cy ?? H / 2 + 30;
  const [tx, ty, tz] = c.target;
  return (x: number, y: number, z: number) => {
    const qx = x - tx, qy = y - ty, qz = z - tz;
    const x1 = qx * ca - qz * sa, z1 = qx * sa + qz * ca;
    const y2 = qy * ce + z1 * se, z2 = z1 * ce - qy * se;
    const d = dist + z2;
    const s = FOCAL / Math.max(0.2, d);
    return { sx: cx + x1 * s, sy: cy - y2 * s, depth: d, scale: s / (FOCAL / DIST), size: Math.sqrt(s / (FOCAL / DIST)) };
  };
}

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const TRGB = TRIBE_COLORS.map(rgb);
const GREY = [120, 150, 135];
const GROUP_RGB = [rgb(BUILT), rgb(HELD), rgb(SLIPPED)];
const isTwin = new Int16Array(N).fill(-1);
DATA.twinIdx.forEach((ix, k) => { isTwin[ix] = k; });
// arrival order: distance from the map centre (a ripple outwards), deterministic
const arrive = new Float32Array(N);
for (let i = 0; i < N; i++) arrive[i] = Math.min(1, Math.hypot(DATA.x[i] - 0.5, DATA.y[i] - 0.5) / 0.62);

export const Cloud: React.FC<{ cam: Cam; look: CloudLook }> = ({ cam, look }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const P = makeProjector(cam);
    const sx = new Float32Array(N), sy = new Float32Array(N), dp = new Float32Array(N), sc = new Float32Array(N);
    let dmin = 1e9, dmax = -1e9;
    for (let i = 0; i < N; i++) {
      const [x, y, z] = world(i, cam.lift);
      const r = P(x, y, z);
      sx[i] = r.sx; sy[i] = r.sy; dp[i] = r.depth; sc[i] = r.size;
      if (r.depth < dmin) dmin = r.depth; if (r.depth > dmax) dmax = r.depth;
    }
    const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => dp[b] - dp[a]);
    const aino = DATA.aino.index, at = DATA.aino.tribe;
    const focus = look.focus, tf = look.twinFocus ?? 0, op = look.opacity ?? 1;
    const span = Math.max(1e-3, dmax - dmin);
    ctx.globalAlpha = 1;

    // floor grid (recessive), at the bottom of the height axis
    const fy = heightOf(-0.04, cam.lift);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.07 * op * clamp(look.appear * 2)})`;
    for (let g = 0; g <= 4; g++) {
      const gx = GX0 + (GX1 - GX0) * g / 4, gz = GZ0 + (GZ1 - GZ0) * g / 4;
      const a = P(GX0, fy, gz), b = P(GX1, fy, gz), c = P(gx, fy, GZ0), d = P(gx, fy, GZ1);
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.moveTo(c.sx, c.sy); ctx.lineTo(d.sx, d.sy); ctx.stroke();
    }

    for (const i of order) {
      if (i === aino) continue;
      const k = clamp((look.appear * 1.6 - arrive[i] * 0.6) / 0.4);
      if (k <= 0) continue;
      const dn = (dp[i] - dmin) / span;                 // 0 near, 1 far
      const t = DATA.tribe[i];
      const inTribe = t === at;
      const twin = isTwin[i] >= 0;
      let dim = inTribe ? 0 : focus * 0.8;
      let c = TRGB[t];
      if (tf > 0) {
        dim = twin ? 0 : dim + (1 - dim) * tf * 0.8;
        if (twin) { const g = GROUP_RGB[DATA.twinGroup[isTwin[i]]]; c = c.map((v, j) => v + (g[j] - v) * tf); }
      }
      const cc = c.map((v, j) => Math.round(v + (GREY[j] - v) * dim * 0.7));
      const alpha = (0.92 - 0.55 * dn) * (1 - dim) * k * op;
      if (alpha < 0.01) continue;
      const rad = (1.6 + 1.7 * (1 - dn)) * sc[i] * (twin && tf > 0 ? 1 + 0.5 * tf : 1) * (inTribe ? 1 + 0.35 * focus * (1 - tf) : 1) * (0.4 + 0.6 * k);
      if (inTribe && focus > 0 && tf < 1) {   // her tribe lights up: a soft halo behind each point
        ctx.fillStyle = `rgba(${cc[0]},${cc[1]},${cc[2]},${(0.13 * focus * (1 - tf) * k * op).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(sx[i], sy[i], rad * 2.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgba(${cc[0]},${cc[1]},${cc[2]},${alpha.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(sx[i], sy[i], rad, 0, Math.PI * 2); ctx.fill();
    }

    // lines from Aino to her look-alikes, nearest first
    const L = look.lines ?? 0;
    if (L > 0) {
      const n = DATA.twinIdx.length;
      ctx.lineCap = "round";
      for (let k = 0; k < n; k++) {
        const kk = clamp((L * 1.5 - (k / n)) / 0.5);
        if (kk <= 0) continue;
        const j = DATA.twinIdx[k], g = GROUP_RGB[DATA.twinGroup[k]];
        const x2 = sx[aino] + (sx[j] - sx[aino]) * kk, y2 = sy[aino] + (sy[j] - sy[aino]) * kk;
        const grad = ctx.createLinearGradient(sx[aino], sy[aino], x2, y2);
        grad.addColorStop(0, `rgba(255,255,255,${0.55 * op})`);
        grad.addColorStop(1, `rgba(${g[0]},${g[1]},${g[2]},${0.75 * op})`);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sx[aino], sy[aino]); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
  });
  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />;
};

/** Aino's point: a white dot with a mint pulse and a label. Positioned by the same projection as the cloud. */
export const AinoMark: React.FC<{ cam: Cam; k: number; t: number; label?: React.ReactNode; labelK?: number; side?: 1 | -1 }> = ({ cam, k, t, label, labelK = 0, side = 1 }) => {
  if (k <= 0) return null;
  const P = makeProjector(cam);
  const [x, y, z] = world(DATA.aino.index, cam.lift);
  const r = P(x, y, z);
  const pulse = (t * 0.9) % 1;
  const R = 10 * r.scale;
  return <>
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      <circle cx={r.sx} cy={r.sy} r={R * (1.6 + 5 * pulse)} fill="none" stroke="#91fa9b" strokeWidth={2.5} opacity={k * (1 - pulse) * 0.9} />
      <circle cx={r.sx} cy={r.sy} r={R * 3.2} fill="rgba(145,250,155,.18)" opacity={k} />
      <circle cx={r.sx} cy={r.sy} r={R * (0.6 + 0.4 * k)} fill="#fff" stroke="#91fa9b" strokeWidth={3} opacity={k} />
      {labelK > 0 ? <line x1={r.sx + side * R * 1.4} y1={r.sy - R * 1.4} x2={r.sx + side * 110} y2={r.sy - 110} stroke="rgba(255,255,255,.7)" strokeWidth={2} opacity={labelK}
        strokeDasharray={`${190 * labelK} 400`} /> : null}
    </svg>
    {label && labelK > 0 ? <div style={{ position: "absolute", left: side > 0 ? r.sx + 120 : undefined, right: side < 0 ? W - r.sx + 120 : undefined, top: r.sy - 110 - 46,
      opacity: clamp(labelK * 1.5), textShadow: "0 2px 14px rgba(0,30,15,.9), 0 0 4px rgba(0,30,15,.8)", transform: `translateY(${(1 - labelK) * 16}px)`, textAlign: side > 0 ? "left" : "right" }}>{label}</div> : null}
  </>;
};
