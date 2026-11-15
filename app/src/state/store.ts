// App state: selected customer, basket overrides, savings goal, accepted challenge, simulated second bank.
// Persisted per customer in localStorage. Tiny external store + useSyncExternalStore, no library.
import { useSyncExternalStore } from "react";
import type { Challenge } from "@shared/checkin";
import type { Basket, BasketOverrides, Goal } from "@shared/types";
import { DEFAULT_PERSONA } from "@shared/personas";

export interface AcceptedChallenge extends Challenge {
  acceptedAt: string; // asOf at the time
}
export interface ConnectedBank {
  bankName: string;
  connectedAt: string;
  validUntil: string;
}
export interface LearnedNote {
  text: string;
  at: number;
}
export interface CustomerPrefs {
  overrides: BasketOverrides;
  goal: Goal | null;
  challenge: AcceptedChallenge | null;
  bank: ConnectedBank | null;
  learned: LearnedNote[];
  goalHandedOff?: boolean;
  dismissedConnectPrompt?: boolean;
}
export interface AppState {
  customerId: string;
  voiceLang: "en-US" | "fi-FI";
  byCustomer: Record<string, CustomerPrefs>;
  /** Question to send when the chat opens (set by suggestion chips elsewhere). Not persisted. */
  pendingQuestion: { text: string; screen?: string } | null;
}

const KEY = "vara.state.v1";
const emptyPrefs = (): CustomerPrefs => ({ overrides: {}, goal: null, challenge: null, bank: null, learned: [] });

function load(): AppState {
  const base: AppState = { customerId: DEFAULT_PERSONA.id, voiceLang: "en-US", byCustomer: {}, pendingQuestion: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...base, ...JSON.parse(raw), pendingQuestion: null };
  } catch {
    /* private mode */
  }
  return base;
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    const { pendingQuestion: _p, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* ignore */
  }
}

export function getState() {
  return state;
}
export function setState(fn: (s: AppState) => AppState) {
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}
export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => sel(state),
  );
}

const EMPTY = emptyPrefs();
export function usePrefs(): CustomerPrefs {
  return useStore((s) => s.byCustomer[s.customerId] ?? EMPTY);
}
export function updatePrefs(fn: (p: CustomerPrefs) => CustomerPrefs) {
  setState((s) => ({ ...s, byCustomer: { ...s.byCustomer, [s.customerId]: fn(s.byCustomer[s.customerId] ?? emptyPrefs()) } }));
}

export const actions = {
  selectCustomer(id: string) {
    setState((s) => ({ ...s, customerId: id.toUpperCase() }));
  },
  setVoiceLang(l: AppState["voiceLang"]) {
    setState((s) => ({ ...s, voiceLang: l }));
  },
  ask(text: string, screen?: string) {
    setState((s) => ({ ...s, pendingQuestion: { text, screen } }));
  },
  takePendingQuestion() {
    const q = state.pendingQuestion;
    if (q) setState((s) => ({ ...s, pendingQuestion: null }));
    return q;
  },
  overrideTx(txIndex: number, basket: Basket, note: string) {
    updatePrefs((p) => ({
      ...p,
      overrides: { ...p.overrides, byTx: { ...(p.overrides.byTx ?? {}), [txIndex]: basket } },
      learned: [{ text: note, at: Date.now() }, ...p.learned].slice(0, 20),
    }));
  },
  overrideRule(rule: string, basket: Basket, note: string) {
    updatePrefs((p) => ({
      ...p,
      overrides: { ...p.overrides, byRule: { ...(p.overrides.byRule ?? {}), [rule]: basket } },
      learned: [{ text: note, at: Date.now() }, ...p.learned].slice(0, 20),
    }));
  },
  resetOverrides() {
    updatePrefs((p) => ({ ...p, overrides: {}, learned: [] }));
  },
  setGoal(goal: Goal | null) {
    updatePrefs((p) => ({ ...p, goal, goalHandedOff: goal ? p.goalHandedOff : false }));
  },
  markGoalHandedOff() {
    updatePrefs((p) => ({ ...p, goalHandedOff: true }));
  },
  acceptChallenge(c: Challenge, asOf: string) {
    updatePrefs((p) => ({ ...p, challenge: { ...c, acceptedAt: asOf } }));
  },
  dropChallenge() {
    updatePrefs((p) => ({ ...p, challenge: null }));
  },
  connectBank(bank: ConnectedBank | null) {
    updatePrefs((p) => ({ ...p, bank }));
  },
  dismissConnectPrompt() {
    updatePrefs((p) => ({ ...p, dismissedConnectPrompt: true }));
  },
};
