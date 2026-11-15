import { useCallback, useRef, useState } from "react";

/** Width of a container element, tracked with a ResizeObserver. */
export function useWidth(initial = 320): [number, (el: HTMLDivElement | null) => void] {
  const [w, setW] = useState(initial);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    ro.current?.disconnect();
    if (!el) return;
    const r = new ResizeObserver((es) => {
      const nw = Math.round(es[0].contentRect.width);
      if (nw > 0) setW((o) => (Math.abs(o - nw) > 1 ? nw : o));
    });
    r.observe(el);
    ro.current = r;
  }, []);
  return [w, ref];
}
