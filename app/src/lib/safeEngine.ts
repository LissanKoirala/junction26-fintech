// Engine calls can throw (functions still being implemented, odd tail customers). Wrap them so a screen
// shows a tidy "unavailable" state instead of crashing.
import { useMemo } from "react";

export type Res<T> = { ok: true; value: T } | { ok: false; error: string; notImplemented: boolean };

export function safe<T>(fn: () => T): Res<T> {
  try {
    const value = fn();
    return { ok: true, value };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (import.meta.env.DEV && !/not implemented/.test(msg)) console.warn("[engine]", msg);
    return { ok: false, error: msg, notImplemented: /not implemented/.test(msg) };
  }
}

/** Memoised engine call. Returns undefined while there is no customer. */
export function useEngine<T>(fn: (() => T) | null, deps: unknown[]): Res<T> | undefined {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (fn ? safe(fn) : undefined), deps);
}

export function valueOr<T>(r: Res<T> | undefined, fallback: T): T {
  return r && r.ok ? r.value : fallback;
}
