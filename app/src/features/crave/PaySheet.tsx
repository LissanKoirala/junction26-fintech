// Generic phone-wallet style pay sheet (no real wallet brand): an invented S-Pankki debit card, labelled as part
// of the simulation, "Confirm with a tap", a processing moment, then the tick, the chime, a haptic and confetti.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Fingerprint, PiggyBank, X } from "lucide-react";
import type { CraveShopHeader } from "@shared/crave";
import { money } from "@/lib/format";
import { STROKE } from "@/ui/kit";
import { accentOf, Confetti, iconOf } from "./look";
import { sfx } from "./sfx";

const CARD_LAST4 = "4821"; // invented, simulation only

export function PaySheet({ open, header, total, stash, onClose, onPaid }: { open: boolean; header: CraveShopHeader; total: number; stash: number; onClose: () => void; onPaid: () => void }) {
  const [phase, setPhase] = useState<"confirm" | "processing" | "done">("confirm");
  useEffect(() => {
    if (open) setPhase("confirm");
  }, [open]);
  const a = accentOf(header.accent);
  const Icon = iconOf(header.icon);
  const confirm = () => {
    if (phase !== "confirm") return;
    sfx.click();
    setPhase("processing");
    setTimeout(() => {
      setPhase("done");
      sfx.chime();
    }, 1300);
    setTimeout(onPaid, 2900);
  };
  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <motion.button type="button" aria-label="Cancel" tabIndex={-1} className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => phase === "confirm" && onClose()} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm payment"
            className="relative rounded-t-[28px] bg-[#f6f6f4] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto h-1 w-10 rounded-pill bg-black/15" aria-hidden />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Simulated wallet · demo</p>
              {phase === "confirm" && (
                <button type="button" aria-label="Cancel payment" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-pill bg-black/5">
                  <X size={18} strokeWidth={STROKE} aria-hidden />
                </button>
              )}
            </div>

            {/* card */}
            <div className="mt-3 flex items-center gap-3 rounded-[16px] bg-white p-3 shadow-low">
              <div className="relative h-12 w-[76px] shrink-0 overflow-hidden rounded-[8px] bg-gradient-to-br from-green-700 to-green-900 p-1.5 text-white">
                <span className="block h-2.5 w-3.5 rounded-[2px] bg-amber-200/90" aria-hidden />
                <span className="absolute bottom-1 right-1.5 text-[9px] font-semibold tracking-wider">DEBIT</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">S-Pankki Debit •••• {CARD_LAST4}</p>
                <p className="text-xs text-ink-muted">Invented demo card · part of the simulation</p>
              </div>
            </div>

            <div className="mt-3 divide-y divide-black/5 rounded-[16px] bg-white px-3 shadow-low">
              <p className="flex min-h-12 items-center justify-between gap-2 text-sm">
                <span className="text-ink-muted">Pay to</span>
                <span className="flex items-center gap-1.5 font-semibold text-ink"><span className="flex h-6 w-6 items-center justify-center rounded-[6px] text-white" style={{ background: a.main }}><Icon size={14} strokeWidth={STROKE} aria-hidden /></span>{header.shopName}</span>
              </p>
              <p className="flex min-h-12 items-center justify-between gap-2 text-sm">
                <span className="text-ink-muted">Actually goes to</span>
                <span className="flex items-center gap-1.5 font-semibold text-green-700"><PiggyBank size={16} strokeWidth={STROKE} aria-hidden /> Your Crave pot · {money(stash)}</span>
              </p>
              <p className="flex min-h-14 items-center justify-between gap-2">
                <span className="text-ink-muted">Total</span>
                <span className="tnum text-2xl font-bold text-ink">{money(total)}</span>
              </p>
            </div>

            <div className="relative mt-5 flex flex-col items-center gap-2 pb-2">
              <AnimatePresence mode="wait">
                {phase === "confirm" && (
                  <motion.button
                    key="c"
                    type="button"
                    onClick={confirm}
                    whileTap={{ scale: 0.94 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center gap-2"
                    aria-label={`Confirm with a tap, ${money(total)}`}
                  >
                    <motion.span
                      className="flex h-20 w-20 items-center justify-center rounded-pill border-2 border-green-700 bg-white text-green-700"
                      animate={{ boxShadow: ["0 0 0 0 rgba(0,120,65,0.35)", "0 0 0 14px rgba(0,120,65,0)"] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    >
                      <Fingerprint size={40} strokeWidth={STROKE} aria-hidden />
                    </motion.span>
                    <span className="text-base font-semibold text-ink">Confirm with a tap</span>
                  </motion.button>
                )}
                {phase === "processing" && (
                  <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                    <motion.span className="block h-20 w-20 rounded-pill border-4 border-green-150 border-t-green-700" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                    <span className="text-base font-semibold text-ink">Processing…</span>
                  </motion.div>
                )}
                {phase === "done" && (
                  <motion.div key="d" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 12, stiffness: 260 }} className="flex flex-col items-center gap-2">
                    <span className="flex h-20 w-20 items-center justify-center rounded-pill bg-green-700">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <motion.path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.1 }} />
                      </svg>
                    </span>
                    <span className="text-base font-semibold text-green-700">Done</span>
                    <Confetti accent={a.main} />
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="text-center text-xs text-ink-muted">Simulation: no money is moved and no card is charged.</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
