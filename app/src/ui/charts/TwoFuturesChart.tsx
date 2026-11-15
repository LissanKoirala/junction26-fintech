// Two Futures: the customer's past month-end balances (solid ink line) up to "Now", then one median path per group
// of money twins with its interquartile band, direct-labelled at the right edge. Crosshair + tooltip on hover.
import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { area as d3area, line as d3line, curveMonotoneX } from "d3-shape";
import { t } from "@/lib/i18n";
import { useWidth } from "./useWidth";

export interface FuturePath {
  key: string;
  label: string;
  color: string;
  path: { month: number; p25: number; p50: number; p75: number }[]; // absolute balances
}

const INK = "#1F1F1F", AXIS = "#666666", GRID = "#E6E6E6";

function tick(v: number) {
  const a = Math.abs(v);
  const s = a >= 10000 ? `${Math.round(a / 1000)}k` : Math.round(a).toLocaleString("fi-FI");
  return (v < 0 ? "−" : "") + s;
}

export function TwoFuturesChart({
  past, futures, format, monthLabel, height = 250, compact, highlight,
}: {
  past: { month: number; balance: number }[];
  futures: FuturePath[];
  format: (v: number) => string;
  monthLabel: (m: number) => string;
  height?: number;
  compact?: boolean;
  highlight?: string | null;
}) {
  const [w, ref] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 42, padR = compact ? 82 : 100, padT = 14, padB = 22;
  const minM = Math.min(...past.map((p) => p.month), 0);
  const maxM = Math.max(...futures.flatMap((f) => f.path.map((p) => p.month)), 1);
  const now = past.length ? past[past.length - 1].balance : futures[0]?.path[0]?.p50 ?? 0;
  const vals = [...past.map((p) => p.balance), ...futures.flatMap((f) => f.path.flatMap((p) => [p.p25, p.p75, p.p50])), 0];
  const x = scaleLinear().domain([minM, maxM]).range([padL, w - padR]);
  const y = scaleLinear().domain([Math.min(...vals), Math.max(...vals)]).nice(4).range([height - padB, padT]);
  const ticks = y.ticks(4);

  const pastPath = d3line<{ month: number; balance: number }>().x((d) => x(d.month)).y((d) => y(d.balance)).curve(curveMonotoneX)(past) ?? "";
  type P = FuturePath["path"][number];
  const band = d3area<P>().x((d) => x(d.month)).y0((d) => y(d.p25)).y1((d) => y(d.p75)).curve(curveMonotoneX);
  const mid = d3line<P>().x((d) => x(d.month)).y((d) => y(d.p50)).curve(curveMonotoneX);

  // direct labels at the right edge, spread apart so they never overlap; a leader line joins label and line end
  const labels = useMemo(() => {
    const L = futures.map((f) => {
      const end = f.path[f.path.length - 1];
      return { key: f.key, label: f.label, color: f.color, value: end.p50, y0: y(end.p50), y: y(end.p50) };
    });
    L.sort((a, b) => a.y0 - b.y0);
    const gap = compact ? 28 : 32;
    const top = padT + 10, bottom = height - padB - 14;
    for (let i = 0; i < L.length; i++) L[i].y = Math.max(L[i].y0, i ? L[i - 1].y + gap : top);
    const over = L.length ? L[L.length - 1].y - bottom : 0;
    if (over > 0) for (let i = L.length - 1; i >= 0; i--) L[i].y = Math.min(L[i].y, (i < L.length - 1 ? L[i + 1].y - gap : bottom));
    return L;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [futures, w, height, compact]);

  const hoverRows = hover == null ? null : hover <= 0
    ? [{ key: "you", label: t("You"), color: INK, value: past.find((p) => p.month === hover)?.balance }]
    : futures.map((f) => ({ key: f.key, label: f.label, color: f.color, value: f.path.find((p) => p.month === hover)?.p50 }));

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        width={w}
        height={height}
        className="block touch-pan-y"
        role="img"
        aria-label={[
          t("Your balance over the last 12 months, now {v}.", { v: format(now) }),
          ...futures.map((f) => t("{label}: ends near {v}.", { label: f.label, v: format(f.path[f.path.length - 1].p50) })),
        ].join(" ")}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect();
          const m = Math.round(x.invert(e.clientX - r.left));
          setHover(Math.max(minM, Math.min(maxM, m)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#949494" : GRID} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={AXIS} className="tnum">
              {tick(t)}
            </text>
          </g>
        ))}
        {/* future side wash so "Now" reads as a boundary */}
        <rect x={x(0)} y={padT - 6} width={Math.max(0, w - padR - x(0))} height={height - padB - padT + 6} fill="#EBF7EC" opacity={0.55} />
        <line x1={x(0)} x2={x(0)} y1={padT - 6} y2={height - padB} stroke={AXIS} strokeWidth={1} />
        {futures.map((f) => (
          <path key={f.key + "b"} d={band(f.path) ?? ""} fill={f.color} opacity={highlight && highlight !== f.key ? 0.04 : 0.13} />
        ))}
        {futures.map((f) => (
          <path
            key={f.key + "l"}
            d={mid(f.path) ?? ""}
            fill="none"
            stroke={f.color}
            strokeWidth={highlight === f.key ? 3 : 2}
            opacity={highlight && highlight !== f.key ? 0.35 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <path d={pastPath} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {futures.map((f) => {
          const e = f.path[f.path.length - 1];
          return <circle key={f.key + "d"} cx={x(e.month)} cy={y(e.p50)} r={4} fill={f.color} stroke="#fff" strokeWidth={2} />;
        })}
        <circle cx={x(0)} cy={y(now)} r={5} fill={INK} stroke="#fff" strokeWidth={2} />
        {/* x axis labels */}
        <text x={padL} y={height - 6} fontSize={11} fill={AXIS}>{monthLabel(minM)}</text>
        <text x={x(0)} y={height - 6} fontSize={11} fill={INK} fontWeight={600} textAnchor="middle">{t("Now")}</text>
        <text x={w - padR} y={height - 6} fontSize={11} fill={AXIS} textAnchor="end">{monthLabel(maxM)}</text>
        {/* direct labels */}
        {labels.map((l) => {
          const lx = w - padR + 10;
          return (
            <g key={l.key}>
              {Math.abs(l.y - l.y0) > 2 && <path d={`M${w - padR + 2},${l.y0} L${lx - 3},${l.y}`} stroke={l.color} strokeWidth={1} fill="none" />}
              <text x={lx} y={l.y - 3} fontSize={compact ? 10.5 : 11} fill={AXIS}>{l.label}</text>
              <text x={lx} y={l.y + 11} fontSize={compact ? 12 : 13} fontWeight={700} fill={INK} className="tnum">{format(l.value)}</text>
            </g>
          );
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT - 6} y2={height - padB} stroke={INK} strokeOpacity={0.35} />}
      </svg>
      {hover != null && hoverRows && (
        <div
          className="pointer-events-none absolute top-0 rounded-md bg-ink px-2.5 py-1.5 text-xs text-white shadow-middle"
          style={{ left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, w - 160)) }}
        >
          <p className="font-semibold">{hover === 0 ? t("Now") : monthLabel(hover)}</p>
          {hoverRows.map((r) => (
            <p key={r.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-pill" style={{ background: r.color === INK ? "#fff" : r.color }} />
              <span className="opacity-80">{r.label}</span>
              <span className="tnum ml-auto pl-2 font-semibold">{r.value != null ? format(r.value) : "–"}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
