// Shared engine-derived data for Vara screens. All numbers come from the engine; when a function is missing the
// caller gets a Res with ok=false and shows an "unavailable" state.
import { engine, type SafeToSpend } from "@shared/engine";
import { useCustomer, useEngineOpts } from "@/state/customer";
import { useEngine, type Res } from "@/lib/safeEngine";
import { money } from "@/lib/format";

export function useSafeToSpend(): Res<SafeToSpend> | undefined {
  const c = useCustomer();
  const opts = useEngineOpts();
  return useEngine(c ? () => engine.getSafeToSpend(c, opts) : null, [c, opts]);
}

export function statusWording(s: SafeToSpend): { label: string; line: string; coach: string } {
  const left = s.week.remaining;
  if (s.status === "over")
    return {
      label: "Over for now",
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
    return { label: "Tight", coach: "Money is tight until payday. Small choices make a real difference now.", line: `${money(Math.max(0, left), { whole: true })} left this week. Small choices make a difference now.` };
  return { label: "Comfortable", coach: "Your musts until payday are covered. This amount is free to use.", line: `${money(Math.max(0, left), { whole: true })} left this week after your musts are covered.` };
}

/** Last balance in the data (the account balance "today"). */
export function currentBalance(tx: { balance: number }[]): number | null {
  return tx.length ? tx[tx.length - 1].balance : null;
}
