// Money Map: thousands of customers as dots on a canvas (one draw per size / highlight change, no per-frame work),
// coloured by tribe, with a pulsing "You are here" marker in HTML on top.
import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";
import { useWidth } from "./useWidth";

export function MoneyMapCanvas({
  xs, ys, groups, colorOf, you, highlight, height = 300, ariaLabel, youLabel, onTap,
}: {
  xs: number[];
  ys: number[];
  groups: number[];
  colorOf: (g: number) => string;
  you?: { x: number; y: number; color: string } | null;
  highlight: number | null;
  height?: number;
  ariaLabel: string;
  youLabel?: string;
  onTap?: () => void;
}) {
  const [w, ref] = useWidth();
  const cv = useRef<HTMLCanvasElement>(null);
  const pad = 10;
  const px = (v: number) => pad + v * (w - pad * 2);
  const py = (v: number) => pad + (1 - v) * (height - pad * 2);

  useEffect(() => {
    const c = cv.current;
    if (!c || !w) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    const r = w < 360 ? 1.5 : 1.7;
    // batch by colour: one path per (group, emphasis)
    const ids = [...new Set(groups)];
    const draw = (g: number, alpha: number, rad: number) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colorOf(g);
      ctx.beginPath();
      for (let i = 0; i < xs.length; i++) {
        if (groups[i] !== g) continue;
        const X = px(xs[i]), Y = py(ys[i]);
        ctx.moveTo(X + rad, Y);
        ctx.arc(X, Y, rad, 0, Math.PI * 2);
      }
      ctx.fill();
    };
    if (highlight == null) ids.forEach((g) => draw(g, 0.62, r));
    else {
      ids.filter((g) => g !== highlight).forEach((g) => draw(g, 0.1, r));
      draw(highlight, 0.85, r + 0.2);
    }
    ctx.globalAlpha = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, height, xs, ys, groups, highlight, colorOf]);

  const yx = you ? px(you.x) : 0, yy = you ? py(you.y) : 0;
  const labelLeft = yx > w - 110;
  const labelBelow = yy < 40;
  return (
    // no overflow-hidden on the wrapper: the pulsing "You are here" marker must not be clipped when the customer sits at the map edge
    <div ref={ref} className="relative w-full" style={{ height }} onClick={onTap}>
      <canvas ref={cv} role="img" aria-label={ariaLabel} className="rounded-md bg-green-50" style={{ width: w, height, display: "block" }} />
      {you && (
        <>
          <span className="pointer-events-none absolute" style={{ left: yx - 14, top: yy - 14, width: 28, height: 28 }} aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-pill opacity-60" style={{ background: you.color }} />
            <span className="absolute inset-[7px] rounded-pill border-[3px] border-white shadow-middle" style={{ background: "#1F1F1F" }} />
          </span>
          <span
            className="pointer-events-none absolute whitespace-nowrap rounded-pill bg-ink px-2.5 py-1 text-xs font-semibold text-white shadow-middle"
            style={{
              left: labelLeft ? undefined : yx + 14,
              right: labelLeft ? w - yx + 14 : undefined,
              top: labelBelow ? yy + 10 : yy - 32,
            }}
          >
            {youLabel ?? t("You are here")}
          </span>
        </>
      )}
    </div>
  );
}
