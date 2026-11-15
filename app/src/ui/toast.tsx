// One-line toast for static mock actions ("not part of this concept").
import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { t, tData } from "@/lib/i18n";

let msg: { text: string; id: number } | null = null;
const ls = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string) {
  msg = { text, id: Date.now() };
  ls.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(() => {
    msg = null;
    ls.forEach((l) => l());
  }, 2600);
}
export const notInDemo = (what: string) => toast(t("{what} is part of the real S-mobiili, not this concept demo.", { what: tData(what) }));

export function ToastHost() {
  const m = useSyncExternalStore(
    (cb) => {
      ls.add(cb);
      return () => ls.delete(cb);
    },
    () => msg,
  );
  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-24 z-[60] flex justify-center px-6">
      <AnimatePresence>
        {m && (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="rounded-md bg-ink px-4 py-2.5 text-center text-sm text-white shadow-middle"
          >
            {m.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
