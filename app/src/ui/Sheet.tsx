// Bottom sheet, rendered into the phone frame's overlay layer (so it stays inside the phone column on desktop).
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { X } from "lucide-react";
import { t as tr } from "@/lib/i18n";
import { IconButton } from "./kit";

export function overlayRoot(): HTMLElement {
  return document.getElementById("overlay-root") ?? document.body;
}

export function Sheet({
  open, onClose, title, children, footer,
}: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col justify-end">
          <motion.button
            type="button"
            aria-label={tr("Close")}
            tabIndex={-1}
            className="absolute inset-0 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            tabIndex={-1}
            className="relative flex max-h-[88%] flex-col rounded-t-sheet bg-card shadow-sheet outline-none"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.33, 0, 0.34, 1] }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="touch-none" onPointerDown={(e) => controls.start(e)}>
            <div className="mx-auto mt-2 h-1 w-10 rounded-pill bg-line" aria-hidden />
            <div className="flex items-center justify-between gap-2 pl-5 pr-2 pt-1">
              <h2 id={id} className="text-xl font-bold text-title">{title}</h2>
              <IconButton icon={X} label={tr("Close")} onClick={onClose} />
            </div>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    overlayRoot(),
  );
}
