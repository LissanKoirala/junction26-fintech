// Small custom SVG charts (d3-scale / d3-shape). Thin marks, hairline recessive axes, one axis, direct labels
// used sparingly; text always in ink tokens, colour only on marks. Colours come from the bank theme tokens.
import { useId, useMemo, useState, type ReactNode } from "react";
import { scaleLinear, scaleBand } from "d3-scale";
import { arc as d3arc, area as d3area, line as d3line, pie as d3pie, curveMonotoneX } from "d3-shape";
import { motion } from "motion/react";
import { cx } from "../kit";

/** Categorical series colours, in fixed order (bank theme tokens). */
export const SERIES = ["#007841", "#00A1C5", "#CF8300", "#00AA46", "#004628", "#99D59F", "#006E87", "#949494"];
export const C = {
  grid: "#E6E6E6",
  axisText: "#666666",
  ink: "#1F1F1F",
  surface: "#FFFFFF",
  accent: "#007841",
  accentWash: "#00784118",
  fanOuter: "#00AA4626",
  fanInner: "#00AA4640",
  zero: "#B70000",
};

export interface Part {
  key: string;
  label: string;
  value: number;
  color: string;
}

function useWidth(initial = 340): [number, (el: HTMLDivElement | null) => void] {
  const [w, setW] = useState(initial);
  const ref = (el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver((es) => {
      const nw = Math.round(es[0].contentRect.width);
      if (nw > 0) setW((o) => (Math.abs(o - nw) > 1 ? nw : o));
    });
    ro.observe(el);
    (el as unknown as { _ro?: ResizeObserver })._ro?.disconnect();
    (el as unknown as { _ro?: ResizeObserver })._ro = ro;
  };
  return [w, ref];
}

// ------------------------------------------------------------------ segmented (stacked) bar
export function StackedBar({ parts, size = "thin", label, format }: { parts: Part[]; size?: "thin" | "tall"; label: string; format?: (v: number) => string }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  const h = size === "tall" ? 28 : 10;
  const visible = parts.filter((p) => p.value > 0);
  return (
    <div role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${format ? format(p.value) : p.value}`).join(", ")}`} className="flex w-full gap-[2px]" style={{ height: h }}>
      {total <= 0 ? (
        <div className="h-full w-full rounded-pill bg-track" />
      ) : (
        visible.map((p, i) => {
          const share = p.value / total;
          return (
            <motion.div
              key={p.key}
              title={`${p.label}: ${format ? format(p.value) : p.value} (${Math.round(share * 100)} %)`}
              className={cx("flex h-full items-center overflow-hidden", size === "thin" ? "" : "px-2")}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: share }}
              transition={{ duration: 0.3, ease: [0, 0, 0.3, 1] }}
              style={{
                flexBasis: 0,
                minWidth: 3,
                background: p.color,
                borderTopLeftRadius: i === 0 ? (size === "thin" ? 999 : 4) : 2,
                borderBottomLeftRadius: i === 0 ? (size === "thin" ? 999 : 4) : 2,
                borderTopRightRadius: i === visible.length - 1 ? (size === "thin" ? 999 : 4) : 2,
                borderBottomRightRadius: i === visible.length - 1 ? (size === "thin" ? 999 : 4) : 2,
              }}
            >
              {size === "tall" && share > 0.14 && <span className="text-xs font-semibold text-white">{Math.round(share * 100)} %</span>}
            </motion.div>
          );
        })
      )}
    </div>
  );
}

// ------------------------------------------------------------------ horizontal bars (ranked)
export function HBars({ items, format, color = C.accent, highlightKey }: { items: { key: string; label: string; value: number }[]; format: (v: number) => string; color?: string; highlightKey?: string }) {
  const max = Math.max(1e-9, ...items.map((i) => Math.abs(i.value)));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((it) => (
        <li key={it.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-ink">{it.label}</span>
            <span className="tnum shrink-0 font-semibold text-ink">{format(it.value)}</span>
          </div>
          <div className="h-2 w-full">
            <motion.div
              className="h-full rounded-r-[4px]"
              style={{ background: highlightKey && highlightKey !== it.key ? "#99D59F" : color }}
              initial={{ width: 0 }}
              animate={{ width: `${(Math.abs(it.value) / max) * 100}%` }}
              transition={{ duration: 0.3, ease: [0, 0, 0.3, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ vertical columns (time series)
export function Columns({ items, format, height = 140, color = C.accent, highlightLast }: { items: { key: string; label: string; value: number }[]; format: (v: number) => string; height?: number; color?: string; highlightLast?: boolean }) {
  const [w, ref] = useWidth();
  const padB = 20, padT = 18;
  const x = scaleBand<string>().domain(items.map((i) => i.key)).range([0, w]).paddingInner(0.3).paddingOuter(0.1);
  const max = Math.max(1e-9, ...items.map((i) => i.value));
  const y = scaleLinear().domain([0, max]).nice(3).range([height - padB, padT]);
  const bw = Math.min(24, x.bandwidth());
  const maxIdx = items.findIndex((i) => i.value === max);
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={height} role="img" aria-label={items.map((i) => `${i.label} ${format(i.value)}`).join(", ")}>
        <line x1={0} x2={w} y1={height - padB} y2={height - padB} stroke={C.grid} />
        {items.map((it, i) => {
          const cxp = (x(it.key) ?? 0) + x.bandwidth() / 2;
          const top = y(Math.max(0, it.value));
          const hh = height - padB - top;
          const r = Math.min(4, hh);
          const emph = highlightLast ? i === items.length - 1 : true;
          return (
            <g key={it.key}>
              <title>{`${it.label}: ${format(it.value)}`}</title>
              {hh > 0 && (
                <path
                  d={`M${cxp - bw / 2},${height - padB} V${top + r} Q${cxp - bw / 2},${top} ${cxp - bw / 2 + r},${top} H${cxp + bw / 2 - r} Q${cxp + bw / 2},${top} ${cxp + bw / 2},${top + r} V${height - padB} Z`}
                  fill={emph ? color : "#99D59F"}
                />
              )}
              <text x={cxp} y={height - 5} textAnchor="middle" fontSize={11} fill={C.axisText}>
                {it.label}
              </text>
              {(i === maxIdx || i === items.length - 1) && (
                <text x={i === 0 ? Math.max(0, cxp - bw / 2) : i === items.length - 1 ? Math.min(w, cxp + bw / 2) : cxp} y={top - 5} textAnchor={i === 0 ? "start" : i === items.length - 1 ? "end" : "middle"} fontSize={11} fontWeight={600} fill={C.ink} className="tnum">
                  {format(it.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ donut
export function Donut({ parts, format, center, size = 148 }: { parts: Part[]; format: (v: number) => string; center?: ReactNode; size?: number }) {
  const arcs = useMemo(() => d3pie<Part>().value((p) => Math.max(0, p.value)).sort(null).padAngle(0.02)(parts), [parts]);
  const r = size / 2;
  const a = d3arc<(typeof arcs)[number]>().innerRadius(r * 0.68).outerRadius(r).cornerRadius(2);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={parts.map((p) => `${p.label} ${format(p.value)}`).join(", ")}>
        <g transform={`translate(${r},${r})`}>
          {arcs.map((d) => (
            <path key={d.data.key} d={a(d) ?? ""} fill={d.data.color}>
              <title>{`${d.data.label}: ${format(d.data.value)}`}</title>
            </path>
          ))}
        </g>
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ trend line
export function TrendLine({ points, format, height = 140, color = C.accent }: { points: { key: string; label: string; value: number }[]; format: (v: number) => string; height?: number; color?: string }) {
  const [w, ref] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();
  const padL = 4, padR = 8, padT = 20, padB = 20;
  const vals = points.map((p) => p.value);
  const lo = Math.min(0, ...vals), hi = Math.max(1e-9, ...vals);
  const x = scaleLinear().domain([0, Math.max(1, points.length - 1)]).range([padL + 4, w - padR - 4]);
  const y = scaleLinear().domain([lo, hi]).nice(3).range([height - padB, padT]);
  const path = d3line<number>().x((_, i) => x(i)).y((v) => y(v)).curve(curveMonotoneX)(vals) ?? "";
  const ar = d3area<number>().x((_, i) => x(i)).y0(y(Math.max(lo, 0))).y1((v) => y(v)).curve(curveMonotoneX)(vals) ?? "";
  const last = points.length - 1;
  const step = Math.ceil(points.length / 6);
  const hi_i = hover ?? last;
  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={points.map((p) => `${p.label} ${format(p.value)}`).join(", ")}
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
          const i = Math.round(x.invert(e.clientX - rect.left));
          setHover(Math.max(0, Math.min(last, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={C.grid} />
        <path d={ar} fill={color} opacity={0.1} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          (i % step === 0 && last - i >= step) || i === last ? (
            <text key={p.key} x={x(i)} y={height - 5} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} fontSize={11} fill={C.axisText}>
              {p.label}
            </text>
          ) : null,
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT - 6} y2={height - padB} stroke={C.grid} />}
        {points.length > 0 && <circle cx={x(hi_i)} cy={y(vals[hi_i])} r={4.5} fill={color} stroke={C.surface} strokeWidth={2} />}
        {points.length > 0 && (
          <text
            x={Math.min(Math.max(x(hi_i), 30), w - 30)}
            y={Math.max(12, y(vals[hi_i]) - 9)}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill={C.ink}
            className="tnum"
          >
            {format(vals[hi_i])}
          </text>
        )}
        <defs><linearGradient id={gid} /></defs>
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ fan chart (balance forecast)
export interface FanPt { day: number; date: string; p10: number; p25: number; p50: number; p75: number; p90: number }
export function FanChart({ fan, format, height = 170, markers = [], dateLabel }: { fan: FanPt[]; format: (v: number) => string; height?: number; markers?: { day: number; label: string }[]; dateLabel: (iso: string) => string }) {
  const [w, ref] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44, padR = 8, padT = 12, padB = 22;
  if (!fan.length) return null;
  const lo = Math.min(0, ...fan.map((f) => f.p10)), hi = Math.max(...fan.map((f) => f.p90));
  const x = scaleLinear().domain([0, fan[fan.length - 1].day || 1]).range([padL, w - padR]);
  const y = scaleLinear().domain([lo, hi]).nice(4).range([height - padB, padT]);
  const band = (a: keyof FanPt, b: keyof FanPt) =>
    d3area<FanPt>().x((d) => x(d.day)).y0((d) => y(d[a] as number)).y1((d) => y(d[b] as number)).curve(curveMonotoneX)(fan) ?? "";
  const mid = d3line<FanPt>().x((d) => x(d.day)).y((d) => y(d.p50)).curve(curveMonotoneX)(fan) ?? "";
  const ticks = y.ticks(4);
  const h = hover != null ? fan[hover] : null;
  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={`Balance forecast to ${dateLabel(fan[fan.length - 1].date)}: middle path ends at ${format(fan[fan.length - 1].p50)}, 1 in 10 paths below ${format(Math.min(...fan.map((f) => f.p10)))}`}
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
          const d = x.invert(e.clientX - rect.left);
          let best = 0;
          fan.forEach((f, i) => Math.abs(f.day - d) < Math.abs(fan[best].day - d) && (best = i));
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#B7000066" : C.grid} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={C.axisText} className="tnum">
              {Math.abs(t) >= 10000 ? `${Math.round(t / 1000)}k` : Math.round(t).toLocaleString("fi-FI")}
            </text>
          </g>
        ))}
        <path d={band("p10", "p90")} fill={C.fanOuter} />
        <path d={band("p25", "p75")} fill={C.fanInner} />
        <path d={mid} fill="none" stroke={C.accent} strokeWidth={2} strokeLinecap="round" />
        {markers.map((m) => (
          <g key={m.label + m.day}>
            <line x1={x(m.day)} x2={x(m.day)} y1={padT} y2={height - padB} stroke={C.grid} />
            <text x={Math.min(x(m.day), w - padR)} y={padT + 2} textAnchor="end" dx={-3} fontSize={11} fill={C.axisText}>{m.label}</text>
          </g>
        ))}
        <text x={padL} y={height - 5} fontSize={11} fill={C.axisText}>{dateLabel(fan[0].date)}</text>
        <text x={w - padR} y={height - 5} textAnchor="end" fontSize={11} fill={C.axisText}>{dateLabel(fan[fan.length - 1].date)}</text>
        {h && (
          <>
            <line x1={x(h.day)} x2={x(h.day)} y1={padT} y2={height - padB} stroke={C.axisText} strokeWidth={1} />
            <circle cx={x(h.day)} cy={y(h.p50)} r={4.5} fill={C.accent} stroke={C.surface} strokeWidth={2} />
          </>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-sm bg-ink px-2 py-1 text-xs text-white shadow-low" style={{ left: Math.min(Math.max(x(h.day) - 70, 0), w - 150) }}>
          <span className="font-semibold">{dateLabel(h.date)}</span> · likely {format(h.p50)}
          <br />
          range {format(h.p10)} – {format(h.p90)}
        </div>
      )}
    </div>
  );
}
