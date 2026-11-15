// Shared engine-derived data for Vara screens. All numbers come from the engine; when a function is missing the
// caller gets a Res with ok=false and shows an "unavailable" state.
import { engine, type SafeToSpend } from "@shared/engine";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { useEngine, type Res } from "@/lib/safeEngine";
import { dateDM, dateShort, money } from "@/lib/format";

export function useSafeToSpend(): Res<SafeToSpend> | undefined {
  const c = useCustomer();
  const opts = useEngineOpts();
  return useEngine(c ? () => engine.getSafeToSpend(c, opts) : null, [c, opts]);
}

export function statusWording(s: SafeToSpend): { label: string; line: string; coach: string; tone: "success" | "info" | "warning" } {
  const left = money(Math.max(0, s.week.remaining), { whole: true });
  if (s.status === "over")
    return {
      label: "Over for now",
      tone: "warning",
      coach:
        s.freeUntilPayday < 0
          ? "Your musts before payday are bigger than your balance. Let's find the gap together."
          : "This week's safe amount is used. Pausing extras until payday keeps your musts covered.",
      line:
        s.freeUntilPayday < 0
          ? `Your reserved musts are ${money(-s.freeUntilPayday, { whole: true })} more than your balance before payday. Let's look at it together.`
          : "You've already used this week's safe amount. Holding off until payday keeps rent covered.",
    };
  if (s.status === "tight")
    return { label: "Tight", tone: "warning", coach: "Money is tight until payday. Small choices make a real difference now.", line: `${left} safe for the rest of this week. Small choices make a difference now.` };
  if (s.status === "a_bit_tight")
    return {
      label: "A bit tight",
      tone: "info",
      coach: "Your musts are covered, but this week's room is smaller than your usual week. Pick the extras that matter most.",
      line: `${left} safe for the rest of this week, a bit less than you usually spend.`,
    };
  if (s.wellCovered)
    return {
      label: "Well covered",
      tone: "success",
      coach: "Plenty of room: your musts are covered with lots to spare. Staying near your usual week lets your savings keep growing.",
      line: `Plenty of room: ${money(Math.max(0, s.freeUntilPayday), { whole: true })} is free ${s.nextPayday.estimated ? "for the next 30 days" : "until payday"}.`,
    };
  return { label: "Comfortable", tone: "success", coach: "Your musts until payday are covered. This amount is free to use.", line: `${left} safe for the rest of this week, after your musts are covered.` };
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
    ? (s.nextPayday.basis ?? "Your income is irregular, so Vara plans for the next 30 days.")
    : `Next payday ${dateShort(s.nextPayday.date)} · in ${s.nextPayday.daysAway} ${s.nextPayday.daysAway === 1 ? "day" : "days"}`;
  const horizon = est ? "for the next 30 days" : `until payday on ${dateDM(s.nextPayday.date)}`;
  const late = est ? undefined : s.nextPayday.lateNote;
  if (s.wellCovered) {
    return {
      mode: "well",
      title: est ? "Safe to spend in the next 30 days" : "Safe to spend until payday",
      figure: null,
      support: `${m(free)} free ${est ? "for the next 30 days" : "until payday"} after your musts`,
      payday,
      late,
      bar: { value: typical > 0 ? spent / typical : 0, label: "This week's spending compared with your usual week", left: `Spent ${m(spent)} since ${dateShort(s.week.from)}`, right: `Usual week ${m(typical)}` },
    };
  }
  const room = spent + remaining;
  const bar = {
    value: room > 0 ? remaining / room : 0,
    label: "Share of this week's room still free",
    left: `Spent ${m(spent)} since ${dateShort(s.week.from)}`,
    right: `Week's room ${m(room)}`,
  };
  if (daysLeft <= 0)
    return { mode: "next_week", title: "Safe to spend next week", figure: s.safePerWeek, support: `${m(s.safePerWeek)} a week ${horizon} · ${m(free)} in total`, payday, late, bar };
  return {
    mode: "week",
    title: paydayEndsWeek ? "Safe to spend until payday" : "Safe to spend until Sunday",
    figure: remaining,
    support: `${m(s.safePerWeek)} a week ${horizon} · ${m(free)} in total`,
    payday,
    late,
    bar,
  };
}

/** Last balance in the data (the account balance "today"). */
export function currentBalance(tx: { balance: number }[]): number | null {
  return tx.length ? tx[tx.length - 1].balance : null;
}
