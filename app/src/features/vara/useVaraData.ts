// Shared engine-derived data for Vara screens. All numbers come from the engine; when a function is missing the
// caller gets a Res with ok=false and shows an "unavailable" state.
import { engine, type SafeToSpend } from "@shared/engine";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { useEngine, type Res } from "@/lib/safeEngine";
import { dateDM, dateShort, money } from "@/lib/format";
import { t, tn } from "@/lib/i18n";

export function useSafeToSpend(): Res<SafeToSpend> | undefined {
  const c = useCustomer();
  const opts = useEngineOpts();
  return useEngine(c ? () => engine.getSafeToSpend(c, opts) : null, [c, opts]);
}

export function statusWording(s: SafeToSpend): { label: string; line: string; coach: string; tone: "success" | "info" | "warning" } {
  const left = money(Math.max(0, s.week.remaining), { whole: true });
  if (s.status === "over")
    return {
      label: t("Over for now"),
      tone: "warning",
      coach:
        s.freeUntilPayday < 0
          ? t("Your musts before payday are bigger than your balance. Let's find the gap together.")
          : t("This week's safe amount is used. Pausing extras until payday keeps your musts covered."),
      line:
        s.freeUntilPayday < 0
          ? t("Your reserved musts are {amount} more than your balance before payday. Let's look at it together.", { amount: money(-s.freeUntilPayday, { whole: true }) })
          : t("You've already used this week's safe amount. Holding off until payday keeps rent covered."),
    };
  if (s.status === "tight")
    return {
      label: t("Tight"),
      tone: "warning",
      coach: t("Money is tight until payday. Small choices make a real difference now."),
      line: t("{amount} safe for the rest of this week. Small choices make a difference now.", { amount: left }),
    };
  if (s.status === "a_bit_tight")
    return {
      label: t("A bit tight"),
      tone: "info",
      coach: t("Your musts are covered, but this week's room is smaller than your usual week of everyday extras. Pick the extras that matter most."),
      line: t("{amount} safe for the rest of this week, a bit less than your usual week of everyday extras.", { amount: left }),
    };
  if (s.wellCovered)
    return {
      label: t("Well covered"),
      tone: "success",
      coach: t("Plenty of room: your musts are covered with lots to spare. Staying near your usual week of everyday extras lets your savings keep growing."),
      line: s.nextPayday.estimated
        ? t("Plenty of room: {amount} is free for the next 30 days.", { amount: money(Math.max(0, s.freeUntilPayday), { whole: true }) })
        : t("Plenty of room: {amount} is free until payday.", { amount: money(Math.max(0, s.freeUntilPayday), { whole: true }) }),
    };
  return {
    label: t("Comfortable"),
    tone: "success",
    coach: t("Your musts until payday are covered. This amount is free to use."),
    line: t("{amount} safe for the rest of this week, after your musts are covered.", { amount: left }),
  };
}

/** What the safe-to-spend hero and card show: one headline figure with an unmistakable label, and supporting lines. */
export interface SafeView {
  mode: "week" | "next_week" | "well";
  title: string; // "Safe to spend until Sunday"
  figure: number | null; // the big number (null in the "well covered" state)
  support: string; // "64 € a week until payday on 15 Oct · 137 € in total"
  payday: string; // "Next payday Thu 15 Oct · in 15 days" or the irregular-income sentence
  late?: string; // late-pay sentence from the engine
  bar: { value: number; label: string; left: string; right: string };
}
export function safeView(s: SafeToSpend): SafeView {
  const m = (v: number) => money(v, { whole: true });
  const est = !!s.nextPayday.estimated;
  const free = Math.max(0, s.freeUntilPayday);
  const daysLeft = s.week.daysLeft ?? 0;
  const typical = s.week.typicalSpend ?? 0;
  const spent = s.week.spentSoFar;
  const remaining = Math.max(0, s.week.remaining);
  const paydayEndsWeek = !est && s.nextPayday.daysAway <= daysLeft;
  const payday = est
    ? (s.nextPayday.basis ?? t("Your income is irregular, so Vara plans for the next 30 days."))
    : tn("Next payday {date} · in {n} day", "Next payday {date} · in {n} days", s.nextPayday.daysAway, { date: dateShort(s.nextPayday.date) });
  const late = est ? undefined : s.nextPayday.lateNote;
  const spentLeft = t("Spent {amount} since {date}", { amount: m(spent), date: dateShort(s.week.from) });
  if (s.wellCovered) {
    return {
      mode: "well",
      title: est ? t("Safe to spend in the next 30 days") : t("Safe to spend until payday"),
      figure: null,
      support: est ? t("{amount} free for the next 30 days after your musts", { amount: m(free) }) : t("{amount} free until payday after your musts", { amount: m(free) }),
      payday,
      late,
      bar: { value: typical > 0 ? spent / typical : 0, label: t("This week's everyday extras compared with your usual week of everyday extras"), left: spentLeft, right: t("Usual week of everyday extras {amount}", { amount: m(typical) }) },
    };
  }
  const room = spent + remaining;
  const bar = { value: room > 0 ? remaining / room : 0, label: t("Share of this week's room still free"), left: spentLeft, right: t("Week's room {amount}", { amount: m(room) }) };
  const support = est
    ? t("{week} a week for the next 30 days · {total} in total", { week: m(s.safePerWeek), total: m(free) })
    : t("{week} a week until payday on {date} · {total} in total", { week: m(s.safePerWeek), date: dateDM(s.nextPayday.date), total: m(free) });
  if (daysLeft <= 0) return { mode: "next_week", title: t("Safe to spend next week"), figure: s.safePerWeek, support, payday, late, bar };
  return { mode: "week", title: paydayEndsWeek ? t("Safe to spend until payday") : t("Safe to spend until Sunday"), figure: remaining, support, payday, late, bar };
}

/** Last balance in the data (the account balance "today"). */
export function currentBalance(tx: { balance: number }[]): number | null {
  return tx.length ? tx[tx.length - 1].balance : null;
}
