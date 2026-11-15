// The hero of Today: safe to spend this week, week progress, status wording, "Why this number?" sheet.
import { useState } from "react";
import { CalendarClock, Calculator } from "lucide-react";
import type { SafeToSpend } from "@shared/engine";
import { dateShort, money, moneyParts } from "@/lib/format";
import { HeroCard, heroInverse, heroMuted, heroTitle, VaraAvatar } from "@/ui/hero";
import { Badge, Button, cx, HeroFigure, Progress, STROKE } from "@/ui/kit";
import { Sheet } from "@/ui/Sheet";
import { statusWording } from "@/features/vara/useVaraData";

export function SafeHero({ s }: { s: SafeToSpend }) {
  const [open, setOpen] = useState(false);
  const w = statusWording(s);
  const inv = heroInverse();
  const muted = heroMuted();
  // remaining = what is safe for the rest of this week; the bar shows how much of this week's room is used
  const room = s.week.spentSoFar + Math.max(0, s.week.remaining);
  const used = room > 0 ? s.week.spentSoFar / room : s.week.spentSoFar > 0 ? 1 : 0;
  return (
    <>
      <HeroCard label="Safe to spend this week">
        <div className="flex items-center justify-between gap-2">
          <p className={cx("flex items-center gap-2 text-base font-semibold", heroTitle())}>
            <VaraAvatar size={24} inverse={inv} />
            Safe to spend this week
          </p>
          <Badge tone={s.status === "comfortable" ? "success" : "warning"}>{w.label}</Badge>
        </div>
        <div className="mt-1">
          <HeroFigure value={moneyParts(s.safePerWeek).num} ink={inv ? "inverse" : "default"} />
        </div>
        <p className={cx("text-sm", muted)}>
          about {money(s.safePerDay, { whole: true })} a day until payday
        </p>

        <div className="mt-4">
          <Progress value={used} label="Share of this week's safe amount already spent" tone={inv ? "inverse" : s.status === "comfortable" ? "accent" : "warning"} />
          <div className={cx("tnum mt-1.5 flex justify-between text-sm", muted)}>
            <span>Spent {money(s.week.spentSoFar, { whole: true })} since {dateShort(s.week.from)}</span>
            <span className={cx("font-semibold", inv ? "text-white" : "text-ink")}>{money(Math.max(0, s.week.remaining), { whole: true })} left</span>
          </div>
        </div>

        <p className={cx("mt-3 text-base", inv ? "text-white" : "text-ink")}>{w.coach}</p>

        <div className={cx("mt-3 flex items-center gap-2 text-sm", muted)}>
          <CalendarClock size={16} strokeWidth={STROKE} aria-hidden />
          <span>
            Next payday {dateShort(s.nextPayday.date)} · in {s.nextPayday.daysAway} {s.nextPayday.daysAway === 1 ? "day" : "days"}
          </span>
        </div>
        <div className="mt-3">
          <Button variant={inv ? "soft" : "tonal"} size="sm" icon={Calculator} onClick={() => setOpen(true)}>
            Why this number?
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
    <Sheet open={open} onClose={onClose} title="Why this number?">
      <p className="text-sm text-ink-strong">
        Your balance is not your budget. Vara first sets aside what must be paid before your next payday, then shares the
        rest across the weeks until then.
      </p>
      <ol className="mt-4 flex flex-col">
        {s.steps.map((st, i) => {
          const isTotal = st.sign === "=" || st.sign === "/";
          const isFinal = i === s.steps.length - 1;
          const basis = st.sign === "-" ? basisFor(st.label) : undefined;
          const amount = st.sign === "/" ? st.amount.toLocaleString("fi-FI", { maximumFractionDigits: 1 }) + " weeks" : money(st.amount);
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
        Calculated from your own transactions as of {dateShort(s.asOf)}. Everyday extras you've spent this week count against
        the weekly amount.
      </p>
    </Sheet>
  );
}
