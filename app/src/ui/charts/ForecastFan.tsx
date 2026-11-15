// Balance fan to the next payday: p10-p90 and p25-p75 bands, median line, zero line, fixed-event markers
// (rent, payday, investing) with direct labels staggered so they never collide. Crosshair + tooltip on hover.
import { useState } from "react";
import { scaleLinear } from "d3-scale";
import { area as d3area, line as d3line, curveMonotoneX } from "d3-shape";
import { useWidth } from "./useWidth";

export interface FanPt { day: number; date: string; p10: number; p25: number; p50: number; p75: number; p90: number }
export interface FanEvent { day: number; label: string; amount: string }

const AXIS = "#666666", GRID = "#E6E6E6", INK = "#1F1F1F";
const ACCENT = "#007841", OUTER = "#00AA4624", INNER = "#00AA4645", ZERO = "#B70000";

function tick(v: number) {
  const a = Math.abs(v);
  const s = a >= 10000 ? `${Math.round(a / 1000)}k` : Math.round(a).toLocaleString("fi-FI");
  return (v < 0 ? "−" : "") + s;
}

export function ForecastFan({
  fan, events = [], format, dateLabel, height = 210,
}: { fan: FanPt[]; events?: FanEvent[]; format: (v: number) => string; dateLabel: (iso: string) => string; height?: number }) {
  const [w, ref] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  // event labels: up to two rows above the plot
  const rowH = 26;
  const padL = 40, padR = 10, padB = 22;
  const padT = events.length ? 8 + rowH * 2 : 12;
  if (fan.length < 2) return null;
  const last = fan[fan.length - 1];
  const x = scaleLinear().domain([0, last.day || 1]).range([padL, w - padR]);
  const lo = Math.min(0, ...fan.map((f) => f.p10)), hi = Math.max(...fan.map((f) => f.p90));
  const y = scaleLinear().domain([lo, hi]).nice(4).range([height - padB, padT]);
  const band = (a: "p10" | "p25", b: "p90" | "p75") => d3area<FanPt>().x((d) => x(d.day)).y0((d) => y(d[a])).y1((d) => y(d[b])).curve(curveMonotoneX)(fan) ?? "";
  const mid = d3line<FanPt>().x((d) => x(d.day)).y((d) => y(d.p50)).curve(curveMonotoneX)(fan) ?? "";
  const ticks = y.ticks(4);
  // stagger labels into rows
  const placed: (FanEvent & { row: number; x: number; anchor: "start" | "middle" | "end" })[] = [];
  for (const e of [...events].sort((a, b) => a.day - b.day)) {
    const ex = x(e.day);
    const anchor = ex < padL + 40 ? "start" : ex > w - padR - 50 ? "end" : "middle";
    const prev = placed.filter((p) => Math.abs(p.x - ex) < 96);
    const row = prev.some((p) => p.row === 0) ? 1 : 0;
    placed.push({ ...e, row, x: ex, anchor });
  }
  const h = hover != null ? fan[hover] : null;
  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        width={w}
        height={height}
        className="block touch-pan-y"
        role="img"
        aria-label={`Balance until ${dateLabel(last.date)}: middle path ends at ${format(last.p50)}; on a bad run (1 in 10) the lowest point is ${format(Math.min(...fan.map((f) => f.p10)))}.`}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect();
          const d = x.invert(e.clientX - r.left);
          let best = 0;
          fan.forEach((f, i) => Math.abs(f.day - d) < Math.abs(fan[best].day - d) && (best = i));
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "transparent" : GRID} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={t === 0 ? INK : AXIS} fontWeight={t === 0 ? 600 : 400} className="tnum">
              {tick(t)}
            </text>
          </g>
        ))}
        {placed.map((m) => (
          <g key={m.label + m.day}>
            <line x1={m.x} x2={m.x} y1={8 + m.row * rowH + 22} y2={height - padB} stroke={AXIS} strokeOpacity={0.45} strokeWidth={1} />
            <text x={m.x} y={8 + m.row * rowH + 8} fontSize={10.5} fill={AXIS} textAnchor={m.anchor}>{m.label}</text>
            <text x={m.x} y={8 + m.row * rowH + 20} fontSize={11} fontWeight={600} fill={INK} textAnchor={m.anchor} className="tnum">{m.amount}</text>
          </g>
        ))}
        <path d={band("p10", "p90")} fill={OUTER} />
        <path d={band("p25", "p75")} fill={INNER} />
        {lo < 0 && <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} stroke={ZERO} strokeOpacity={0.7} strokeWidth={1} />}
        <path d={mid} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" />
        <circle cx={x(0)} cy={y(fan[0].p50)} r={4.5} fill={INK} stroke="#fff" strokeWidth={2} />
        <circle cx={x(last.day)} cy={y(last.p50)} r={4.5} fill={ACCENT} stroke="#fff" strokeWidth={2} />
        <text x={padL} y={height - 6} fontSize={11} fill={AXIS}>Today</text>
        <text x={w - padR} y={height - 6} textAnchor="end" fontSize={11} fill={AXIS}>{dateLabel(last.date)}</text>
        {h && (
          <>
            <line x1={x(h.day)} x2={x(h.day)} y1={padT} y2={height - padB} stroke={INK} strokeOpacity={0.4} />
            <circle cx={x(h.day)} cy={y(h.p50)} r={4.5} fill={ACCENT} stroke="#fff" strokeWidth={2} />
          </>
        )}
      </svg>
      {h && (
        <div
          className="tnum pointer-events-none absolute rounded-md bg-ink px-2.5 py-1.5 text-xs text-white shadow-middle"
          style={{ top: padT, left: Math.min(Math.max(x(h.day) - 75, 0), Math.max(0, w - 160)) }}
        >
          <span className="font-semibold">{dateLabel(h.date)}</span> · likely {format(h.p50)}
          <br />
          <span className="opacity-80">8 in 10 between</span> {format(h.p10)} – {format(h.p90)}
        </div>
      )}
    </div>
  );
}
