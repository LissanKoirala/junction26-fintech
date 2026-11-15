// The pay moment, laid out like a phone-wallet payment sheet, but with no real wallet brand, logo or sound:
// the screen dims and blurs, the sheet slides up (invented S-Pankki debit card, "Pay <shop>", the amount, where the
// money really goes), a "Double-click to pay" prompt with a side-button hint at the right edge of the phone. Then the
// ritual: a face-scan glyph (~0.9 s), "Processing" (~0.7 s), a blue circle with the tick drawn in and "Done", with the
// synthesised chime and a haptic pulse on the same frame. Everything here is part of the simulation.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PiggyBank, ScanFace, X } from "lucide-react";
import type { CraveShopHeader } from "@shared/crave";
import { t } from "@/lib/i18n";
import { money } from "@/lib/format";
import { STROKE } from "@/ui/kit";
import { accentOf, iconOf, NothingShipsPill } from "./look";
import { sfx } from "./sfx";

const CARD_LAST4 = "4821"; // invented, simulation only
const BLUE = "#0a7cff"; // a generic "done" blue
const SCAN_MS = 900;
const PROCESS_MS = 700;
const DONE_HOLD_MS = 1500;
type Phase = "confirm" | "scan" | "processing" | "done";

/** The hint that points at the phone's side button: a small pill that pulses outwards from the right edge. */
function SideButtonHint() {
  return (
    <div className="pointer-events-none absolute right-0 top-[18%] z-[2] flex items-center gap-2" aria-hidden>
      <motion.span className="text-right text-sm font-semibold leading-tight text-white drop-shadow" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
        {t("Double-click")}
        <br />
        {t("to pay")}
      </motion.span>
      <motion.span
        className="block h-16 w-[6px] rounded-l-pill bg-white"
        animate={{ x: [0, -7, 0, -7, 0], opacity: [0.75, 1, 0.75, 1, 0.75] }}
        transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
      />
    </div>
  );
}

function ScanGlyph() {
  return (
    <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden text-ink">
      <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: [0.8, 1, 0.96, 1], opacity: 1 }} transition={{ duration: 0.6 }}>
        <ScanFace size={64} strokeWidth={1.3} aria-hidden />
      </motion.span>
      <motion.span className="absolute inset-x-3 h-[2px] rounded-pill" style={{ background: BLUE, boxShadow: `0 0 8px ${BLUE}` }} initial={{ top: "18%" }} animate={{ top: ["18%", "80%", "18%"] }} transition={{ duration: SCAN_MS / 1000, ease: "easeInOut" }} />
    </span>
  );
}

export function PaySheet({ open, header, total, stash, onClose, onPaid }: { open: boolean; header: CraveShopHeader; total: number; stash: number; onClose: () => void; onPaid: () => void }) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const lastTap = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (open) setPhase("confirm");
    return () => timers.current.forEach(clearTimeout);
  }, [open]);
  const a = accentOf(header.accent);
  const Icon = iconOf(header.icon);

  const confirm = () => {
    if (phase !== "confirm") return;
    sfx.unlock(); // the chime plays ~1.6 s later; the audio context must be started from this tap
    sfx.click();
    setPhase("scan");
    timers.current = [
      setTimeout(() => setPhase("processing"), SCAN_MS),
      setTimeout(() => {
        setPhase("done");
        sfx.chime(); // sound and haptic on the frame the tick appears
      }, SCAN_MS + PROCESS_MS),
      setTimeout(onPaid, SCAN_MS + PROCESS_MS + DONE_HOLD_MS),
    ];
  };
  // a double tap / double click on the prompt confirms (like the side button); a single tap on "Pay" does too
  const onPromptTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 450) confirm();
    else lastTap.current = now;
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden">
          <motion.button
            type="button"
            aria-label={t("Cancel")}
            tabIndex={-1}
            className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => phase === "confirm" && onClose()}
          />
          {phase === "confirm" && <SideButtonHint />}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("Confirm payment")}
            className="relative rounded-t-[22px] bg-[#f2f2f4] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 text-ink shadow-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
          >
            <div className="flex items-center justify-between">
              <span className="flex min-w-0 flex-col items-start gap-1">
                <NothingShipsPill className="scale-90 origin-left" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t("Simulated wallet · demo")}</span>
              </span>
              {phase === "confirm" ? (
                <button type="button" aria-label={t("Cancel payment")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill bg-black/[0.07] text-ink-muted">
                  <X size={16} strokeWidth={2} aria-hidden />
                </button>
              ) : (
                <span className="h-8" />
              )}
            </div>

            {/* card */}
            <div className="mt-2 flex items-center gap-3 border-b border-black/10 pb-3">
              <div className="relative h-[46px] w-[72px] shrink-0 overflow-hidden rounded-[7px] bg-gradient-to-br from-[#0a8a4c] to-[#043d24] shadow-low">
                <span className="absolute left-1.5 top-1.5 block h-2.5 w-3.5 rounded-[2px] bg-amber-200/90" aria-hidden />
                <span className="absolute bottom-1 right-1.5 text-[8px] font-bold tracking-wider text-white/90">DEBIT</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">S-Pankki Debit •••• {CARD_LAST4}</p>
                <p className="truncate text-xs text-ink-muted">{t("Invented demo card")}</p>
              </div>
            </div>

            {/* pay row + amount */}
            <div className="border-b border-black/10 py-3">
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-white" style={{ background: a.main }}><Icon size={14} strokeWidth={STROKE} aria-hidden /></span>
                <span className="truncate">{t("Pay {shop}", { shop: header.shopName })}</span>
              </p>
              <p className="tnum mt-1 text-[34px] font-bold leading-tight tracking-tight">{money(total)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                <PiggyBank size={14} strokeWidth={STROKE} className="text-green-700" aria-hidden />
                {t("Goes to:")} <span className="font-semibold text-green-700">{t("Your Crave pot")}{stash !== total ? ` · ${money(stash)}` : ""}</span>
              </p>
            </div>

            {/* the ritual */}
            <div className="flex min-h-[176px] flex-col items-center justify-center pt-3">
              <AnimatePresence mode="wait">
                {phase === "confirm" && (
                  <motion.div key="c" exit={{ opacity: 0 }} className="flex w-full flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={onPromptTap}
                      onDoubleClick={confirm}
                      aria-label={t("Double-click to pay")}
                      className="flex w-full select-none flex-col items-center gap-1.5 rounded-[14px] py-2 active:bg-black/[0.04]"
                      style={{ touchAction: "manipulation" }}
                    >
                      <motion.span className="text-ink" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 1.6, repeat: Infinity }}>
                        <ScanFace size={40} strokeWidth={1.3} aria-hidden />
                      </motion.span>
                      <span className="text-[15px] font-semibold">{t("Double-click to pay")}</span>
                    </button>
                    <button type="button" onClick={confirm} className="min-h-11 w-full rounded-[12px] bg-ink text-base font-semibold text-white active:opacity-80">
                      {t("Pay")} {money(total)}
                    </button>
                  </motion.div>
                )}
                {phase === "scan" && (
                  <motion.div key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="flex flex-col items-center gap-2">
                    <ScanGlyph />
                    <span className="text-[15px] font-semibold">{t("Confirming…")}</span>
                  </motion.div>
                )}
                {phase === "processing" && (
                  <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="flex flex-col items-center gap-2">
                    <span className="flex h-20 w-20 items-center justify-center">
                      <motion.span className="block h-14 w-14 rounded-pill border-[3px] border-black/10" style={{ borderTopColor: BLUE }} animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                    </span>
                    <span className="text-[15px] font-semibold">{t("Processing")}</span>
                  </motion.div>
                )}
                {phase === "done" && (
                  <motion.div key="d" className="flex flex-col items-center gap-2">
                    <motion.span className="flex h-20 w-20 items-center justify-center rounded-pill" style={{ background: BLUE }} initial={{ scale: 0.7 }} animate={{ scale: [0.7, 1.06, 1] }} transition={{ duration: 0.35 }}>
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <motion.path d="M5.5 12.5l4.2 4.2L18.5 8" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: "easeOut" }} />
                      </svg>
                    </motion.span>
                    <span className="text-[15px] font-semibold">{t("Done")}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="mt-1 text-center text-[11px] text-ink-muted">{t("Simulation: no money is moved and no card is charged.")}</p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
