// Model outputs for the ML UI: GET /api/ml/<kind>/<id> and /api/global/<name>.
// Ready results are cached per URL; "missing" (404, model still training) is cached for a minute only, so files that
// appear while the app is open show up on the next visit without a reload.
import { useEffect, useState } from "react";
import type { MlAnomalies, MlHabits, MlHome, MlProfile, MlTwins, ModelCard, MoneyMap, Tribe } from "@shared/ml/typesA";
import type { MlForecast, MlRisk, MlTxGpt } from "@shared/ml/typesB";

export interface MlKinds {
  profile: MlProfile;
  twins: MlTwins;
  anomalies: MlAnomalies;
  habits: MlHabits;
  home: MlHome;
  forecast: MlForecast;
  risk: MlRisk;
  txgpt: MlTxGpt;
}
export type MlKind = keyof MlKinds;
export const MODEL_KEYS = ["tribes", "twins", "forecast", "risk", "anomalies", "habits", "home", "txgpt"] as const;
export type ModelKey = (typeof MODEL_KEYS)[number];

export type Loaded<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "missing" } | { status: "error"; error: string };

const cache = new Map<string, { at: number; p: Promise<Loaded<unknown>> }>();
const MISSING_TTL = 60_000;

function load<T>(url: string): Promise<Loaded<T>> {
  const hit = cache.get(url);
  if (hit) return hit.p as Promise<Loaded<T>>;
  const p = fetch(url)
    .then(async (r): Promise<Loaded<T>> => {
      if (r.status === 404) return { status: "missing" };
      if (!r.ok) return { status: "error", error: `HTTP ${r.status}` };
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("json")) return { status: "missing" };
      return { status: "ready", data: (await r.json()) as T };
    })
    .catch((e: Error): Loaded<T> => ({ status: "error", error: e.message }));
  const entry = { at: Date.now(), p: p as Promise<Loaded<unknown>> };
  cache.set(url, entry);
  p.then((res) => {
    if (res.status !== "ready") setTimeout(() => cache.get(url) === entry && cache.delete(url), res.status === "missing" ? MISSING_TTL : 5000);
  });
  return p;
}

function peek<T>(url: string | null): Loaded<T> {
  return { status: "loading" } as Loaded<T>;
}

function useLoaded<T>(url: string | null): Loaded<T> {
  const [st, setSt] = useState<{ url: string | null; v: Loaded<T> }>({ url, v: peek<T>(url) });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    load<T>(url).then((v) => alive && setSt({ url, v }));
    return () => {
      alive = false;
    };
  }, [url]);
  return st.url === url ? st.v : { status: "loading" };
}

export const mlUrl = (kind: MlKind, id: string) => `/api/ml/${kind}/${encodeURIComponent(id.toUpperCase())}`;

export function useMl<K extends MlKind>(kind: K, id: string | null | undefined): Loaded<MlKinds[K]> {
  return useLoaded<MlKinds[K]>(id ? mlUrl(kind, id) : null);
}

export function useGlobal<T>(name: string): Loaded<T> {
  return useLoaded<T>(`/api/global/${name}`);
}

export const useTribes = () => useGlobal<Tribe[] | { tribes: Tribe[] }>("tribes");
export const useMoneyMap = () => useGlobal<MoneyMap>("map");
export const useModelCard = (key: ModelKey) => useGlobal<ModelCard>(`modelcard-${key}`);

export function tribesOf(l: Loaded<Tribe[] | { tribes: Tribe[] }>): Tribe[] | null {
  if (l.status !== "ready") return null;
  return Array.isArray(l.data) ? l.data : l.data.tribes ?? null;
}

export const isReady = <T,>(l: Loaded<T>): l is { status: "ready"; data: T } => l.status === "ready";
