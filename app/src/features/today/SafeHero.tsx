// The hero of Today: what is safe for the rest of this week (headline), the weekly rate and total until payday
// (supporting line), this week's room, late-pay and irregular-income notes, and the "Why this number?" sheet.
import { useState } from "react";
import { CalendarClock, Calculator, PiggyBank } from "lucide-react";
import type { SafeToSpend } from "@shared/engine";
import { dateShort, money, moneyParts } from "@/lib/format";
import { HeroCard, heroInverse, heroMuted, heroTitle, VaraAvatar } from "@/ui/hero";
import { Badge, Button, cx, HeroFigure, Progress, STROKE } from "@/ui/kit";
import { Sheet } from "@/ui/Sheet";
import { safeView, statusWording } from "@/features/vara/useVaraData";
import { t } from "@/lib/i18n";

export function SafeHero({ s }: { s: SafeToSpend }) {
  const [open, setOpen] = useState(false);
  const w = statusWording(s);
  const v = safeView(s);
  const inv = heroInverse();
  const muted = heroMuted();
  const strong = inv ? "text-white" : "text-ink";
  return (
    <>
      <HeroCard label={v.title}>
        <div className="flex items-center justify-between gap-2">
          <p className={cx("flex items-center gap-2 text-base font-semibold", heroTitle())}>
            <VaraAvatar size={24} inverse={inv} />
            {v.title}
          </p>
          <span className="shrink-0 whitespace-nowrap"><Badge tone={w.tone}>{w.label}</Badge></span>
        </div>
        {v.figure != null ? (
          <div className="mt-1">
            <HeroFigure value={moneyParts(v.figure).num} ink={inv ? "inverse" : "default"} />
          </div>
        ) : (
          <p className={cx("mt-2 text-3xl font-bold tracking-tight", inv ? "text-hero-num" : "text-ink")}>{t("Plenty of room")}</p>
        )}
        <p className={cx("tnum text-sm", muted)}>{v.support}</p>
        {s.cravePot ? <p className={cx("tnum mt-0.5 flex items-center gap-1.5 text-sm", muted)}><PiggyBank size={14} strokeWidth={STROKE} className="shrink-0" aria-hidden />{t("After the {amount} held in your Crave pot.", { amount: money(s.cravePot) })}</p> : null}

        <div className="mt-4">
          <Progress value={v.bar.value} label={v.bar.label} tone={inv ? "inverse" : s.status === "tight" || s.status === "over" ? "warning" : "accent"} />
          <div className={cx("tnum mt-1.5 flex justify-between gap-2 text-sm", muted)}>
            <span>{v.bar.left}</span>
            <span className={cx("font-semibold", strong)}>{v.bar.right}</span>
          </div>
        </div>

        <p className={cx("mt-3 text-base", strong)}>{w.coach}</p>

        <div className={cx("mt-3 flex items-start gap-2 text-sm", muted)}>
          <CalendarClock size={16} strokeWidth={STROKE} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {v.payday}
            {v.late && <span className="mt-1 block">{v.late}</span>}
          </span>
        </div>
        <div className="mt-3">
          <Button variant={inv ? "soft" : "tonal"} size="sm" icon={Calculator} onClick={() => setOpen(true)}>
            {t("Why this number?")}
          </Button>
        </div>
      </HeroCard>
      <StepsSheet s={s} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const SIGN: Record<string, string> = { "+": "", "-": "", "=": "=", "/": "÷" };

export function StepsSheet({ s, open, onClose }: { s: SafeToSpend; open: boolean; onClose: () => void }) {
  const basisFor = (label: string) => s.upcoming.find((u) => u.label === label || label.includes(u.label))?.basis;
  return (
    <Sheet open={open} onClose={onClose} title={t("Why this number?")}>
      <p className="text-sm text-ink-strong">
        {t("Your balance is not your budget. Vara first sets aside what must be paid before your next payday, then shares the rest across the weeks until then.")}
      </p>
      <ol className="mt-4 flex flex-col">
        {s.steps.map((st, i) => {
          const isTotal = st.sign === "=" || st.sign === "/";
          const isFinal = i === s.steps.length - 1;
          const basis = st.sign === "-" ? basisFor(st.label) : undefined;
          const amount = st.sign === "/" ? t("{n} weeks", { n: st.amount.toLocaleString("fi-FI", { maximumFractionDigits: 1 }) }) : money(st.amount);
          return (
            <li key={i} className={cx("flex items-start gap-3 py-2.5", isFinal ? "border-t-2 border-green-700" : isTotal ? "border-t border-ink/20" : i > 0 && "border-t border-line")}>
              <span className="tnum w-4 shrink-0 pt-0.5 text-center font-semibold text-ink-muted" aria-hidden>{SIGN[st.sign]}</span>
              <span className="min-w-0 flex-1">
                <span className={cx("block", isFinal ? "font-bold text-title" : isTotal ? "font-semibold text-ink" : "text-ink")}>{st.label}</span>
                {basis && <span className="block text-sm text-ink-muted">{basis}</span>}
              </span>
              <span className={cx("tnum shrink-0 text-right", isFinal ? "font-bold text-title" : isTotal ? "font-semibold" : "")}>
                {st.sign === "-" ? "−" : ""}
                {amount}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-ink-muted">
        {t("Calculated from your own transactions as of {date}. Everyday extras you've spent this week count against the weekly amount.", { date: dateShort(s.asOf) })}
      </p>
    </Sheet>
  );
}
