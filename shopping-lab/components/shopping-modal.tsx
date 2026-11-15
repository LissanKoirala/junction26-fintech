"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";

export function ShoppingModal({ children, title, onClose, className = "", full = false }: { children: ReactNode; title: string; onClose: () => void; className?: string; full?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const titleId = useId();
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const elements = [...(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select,[tabindex="0"]') || [])].filter(el => el.getClientRects().length > 0);
      if (!elements.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className={`shopping-overlay ${full ? "shopping-overlay-full" : ""}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`shopping-modal ${full ? "shopping-full" : ""} ${className}`}>
      <header className="shopping-dialog-header">
        <button className="shopping-icon" aria-label="Close dialog" onClick={onClose}>{full ? <ArrowLeft size={23} /> : <X size={23} />}</button>
        <h2 id={titleId}>{title}</h2>
        <span className="shopping-dialog-demo">DEMO</span>
      </header>
      <div className="shopping-dialog-content">{children}</div>
    </div>
  </div>;
}
