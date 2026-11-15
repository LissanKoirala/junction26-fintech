// Loads CustomerData for the selected customer once and shares it; builds the engine options from prefs.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CustomerData } from "@shared/types";
import type { SafeToSpendOptions } from "@shared/engine";
import { fetchCustomer } from "@/lib/api";
import { usePrefs, useStore } from "./store";

type CustomerState =
  | { status: "loading"; id: string }
  | { status: "ready"; id: string; data: CustomerData }
  | { status: "error"; id: string; error: string };

let cur: CustomerState = { status: "loading", id: "" };
const listeners = new Set<() => void>();
function set(s: CustomerState) {
  cur = s;
  listeners.forEach((l) => l());
}
function ensure(id: string) {
  if (cur.id === id && cur.status !== "error") return;
  set({ status: "loading", id });
  fetchCustomer(id).then(
    (data) => cur.id === id && set({ status: "ready", id, data }),
    (e: Error) => cur.id === id && set({ status: "error", id, error: e.message }),
  );
}
export function retryCustomer() {
  const id = cur.id;
  cur = { status: "loading", id: "" };
  ensure(id);
}

export function useCustomerState(): CustomerState {
  const id = useStore((s) => s.customerId);
  useEffect(() => ensure(id), [id]);
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cur,
  );
  return s.id === id ? s : { status: "loading", id };
}

export function useCustomer(): CustomerData | null {
  const s = useCustomerState();
  return s.status === "ready" ? s.data : null;
}

/** Euros held in the Crave pot (saved, not released). Simulated money that is no longer free to spend. */
export function heldInCravePot(cravings: { status: string; amount: number }[] | undefined): number {
  const sum = (cravings ?? []).reduce((s, e) => s + (e.status === "saved" && e.amount > 0 ? e.amount : 0), 0);
  return Math.round(sum * 100) / 100;
}

/** Engine options for the current customer (basket overrides + savings goal + money held in the Crave pot). */
export function useEngineOpts(): SafeToSpendOptions {
  const p = usePrefs();
  const cravePot = heldInCravePot(p.cravings);
  return useMemo(() => ({ overrides: p.overrides, goal: p.goal, cravePot }), [p.overrides, p.goal, cravePot]);
}
