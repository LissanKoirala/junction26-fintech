// Tiny hash router: deep links like #/vara/today, browser back button works, no library.
import { useSyncExternalStore } from "react";

export interface Route {
  path: string; // "/vara/today"
  segments: string[]; // ["vara", "today"]
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/koti";
  const [p, q = ""] = raw.split("?");
  const path = p.startsWith("/") ? p : "/" + p;
  return { path, segments: path.split("/").filter(Boolean), query: new URLSearchParams(q) };
}

let current = parse();
const listeners = new Set<() => void>();
function emit() {
  current = parse();
  listeners.forEach((l) => l());
}
window.addEventListener("popstate", emit);
window.addEventListener("hashchange", emit);

function depth(): number {
  const s = window.history.state as { varaDepth?: number } | null;
  return s?.varaDepth ?? 0;
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const url = window.location.pathname + window.location.search + "#" + path;
  if (("#" + path) === window.location.hash) return;
  if (opts.replace) window.history.replaceState({ varaDepth: depth() }, "", url);
  else window.history.pushState({ varaDepth: depth() + 1 }, "", url);
  emit();
}

/** Go back within the app; if the page was opened by deep link, go to `fallback` instead of leaving. */
export function goBack(fallback = "/koti") {
  if (depth() > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
