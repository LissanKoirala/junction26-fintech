// Sparkline: one series, 2px line, ~10% wash, end-dot with a surface ring, optional change-point marker,
// optional reference levels (before / after) as hairlines. Hover shows the value of the nearest point.
import { useId, useState } from "react";
import { scaleLinear } from "d3-scale";
import { area as d3area, line as d3line, curveMonotoneX } from "d3-shape";
import { useWidth } from "./useWidth";

const AXIS = "#666666";
const GRID = "#E6E6E6";

export function Sparkline({
  values, labels, color = "#007841", height = 56, markerIndex, markerLabel, format, levels, zero, ariaLabel, yMax,
}: {
  values: number[];
  labels?: string[]; // per point, for the hover line
  color?: string;
  height?: number;
  markerIndex?: number; // change point
  markerLabel?: string;
  format?: (v: number) => string;
  levels?: { from: number; to: number; value: number }[]; // flat level segments (index range)
  zero?: boolean; // force the y-domain to include 0
  ariaLabel: string;
  yMax?: number;
}) {
  const [w, ref] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();
  const n = values.length;
  const padT = markerLabel ? 16 : 6, padB = 4, padX = 5;
  if (!n) return null;
  const lo = Math.min(zero ? 0 : Infinity, ...values);
  const hi = Math.max(yMax ?? -Infinity, ...values, lo + 1e-9);
  const x = scaleLinear().domain([0, Math.max(1, n - 1)]).range([padX, w - padX]);
  const y = scaleLinear().domain([lo, hi]).range([height - padB, padT]);
  const ln = d3line<number>().x((_, i) => x(i)).y((v) => y(v)).curve(curveMonotoneX)(values) ?? "";
  const ar = d3area<number>().x((_, i) => x(i)).y0(height - padB).y1((v) => y(v)).curve(curveMonotoneX)(values) ?? "";
  const hi_i = hover ?? n - 1;
  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="block touch-pan-y"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect();
          setHover(Math.max(0, Math.min(n - 1, Math.round(x.invert(e.clientX - r.left)))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.16} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {zero && lo < 0 && <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={GRID} />}
        <path d={ar} fill={`url(#${gid})`} />
        {levels?.map((l, i) => (
          <line key={i} x1={x(l.from)} x2={x(l.to)} y1={y(l.value)} y2={y(l.value)} stroke={AXIS} strokeOpacity={0.55} strokeWidth={1} />
        ))}
        {markerIndex != null && markerIndex >= 0 && markerIndex < n && (
          <g>
            <line x1={x(markerIndex)} x2={x(markerIndex)} y1={padT - 2} y2={height - padB} stroke={AXIS} strokeWidth={1} />
            {markerLabel && (
              <text x={x(markerIndex)} y={11} fontSize={10.5} fill={AXIS} textAnchor={x(markerIndex) > w - 60 ? "end" : x(markerIndex) < 60 ? "start" : "middle"}>
                {markerLabel}
              </text>
            )}
          </g>
        )}
        <path d={ln} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={height - padB} stroke={GRID} />}
        <circle cx={x(hi_i)} cy={y(values[hi_i])} r={4} fill={color} stroke="#fff" strokeWidth={2} />
      </svg>
      {hover != null && format && (
        <div
          className="tnum pointer-events-none absolute -top-7 whitespace-nowrap rounded-sm bg-ink px-2 py-0.5 text-xs text-white shadow-low"
          style={{ left: Math.min(Math.max(x(hover) - 50, 0), Math.max(0, w - 110)) }}
        >
          {labels?.[hover] ? `${labels[hover]} · ` : ""}
          {format(values[hover])}
        </div>
      )}
    </div>
  );
}

/** Small bar strip (e.g. unusual weeks): equal-width columns, highlighted ones in the accent. */
export function BarStrip({
  items, height = 64, color = "#007841", muted = "#99D59F", format, ariaLabel,
}: { items: { key: string; label: string; value: number; highlight?: boolean; ref?: number }[]; height?: number; color?: string; muted?: string; format: (v: number) => string; ariaLabel: string }) {
  const [w, ref] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = items.length;
  if (!n) return null;
  const max = Math.max(1e-9, ...items.map((i) => Math.max(i.value, i.ref ?? 0)));
  const gap = 2;
  const bw = Math.min(24, (w - gap * (n - 1)) / n);
  const total = bw * n + gap * (n - 1);
  const x0 = (w - total) / 2;
  const y = scaleLinear().domain([0, max]).range([height - 2, 6]);
  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label={ariaLabel} className="block" onPointerLeave={() => setHover(null)}>
        <line x1={0} x2={w} y1={height - 1.5} y2={height - 1.5} stroke={GRID} />
        {items.map((it, i) => {
          const left = x0 + i * (bw + gap);
          const top = y(Math.max(0, it.value));
          const hh = height - 2 - top;
          const r = Math.min(4, hh, bw / 2);
          return (
            <g key={it.key} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={left - 1} y={0} width={bw + 2} height={height} fill="transparent" />
              {hh > 0 && (
                <path
                  d={`M${left},${height - 2} V${top + r} Q${left},${top} ${left + r},${top} H${left + bw - r} Q${left + bw},${top} ${left + bw},${top + r} V${height - 2} Z`}
                  fill={it.highlight ? color : muted}
                  opacity={hover == null || hover === i ? 1 : 0.6}
                />
              )}
              {it.ref != null && <line x1={left} x2={left + bw} y1={y(it.ref)} y2={y(it.ref)} stroke="#1F1F1F" strokeWidth={1.5} strokeOpacity={0.5} />}
            </g>
          );
        })}
      </svg>
      {hover != null && items[hover].label && (
        <div
          className="tnum pointer-events-none absolute -top-7 whitespace-nowrap rounded-sm bg-ink px-2 py-0.5 text-xs text-white shadow-low"
          style={{ left: Math.min(Math.max(x0 + hover * (bw + gap) - 80, 0), Math.max(0, w - 230)) }}
        >
          {items[hover].label} · {format(items[hover].value)}
        </div>
      )}
    </div>
  );
}
