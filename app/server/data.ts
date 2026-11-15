// File-backed data access. All data lives under DATA_DIR on the VM (see ml/common.py for the layout).
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const DATA_DIR = process.env.DATA_DIR ?? path.join(os.homedir(), "data");
export const AS_OF = process.env.AS_OF ?? "2026-09-30";

const cache = new Map<string, { at: number; value: unknown }>();
const MAX_CACHE = 400;

async function readJson<T>(file: string, ttlMs = 15_000): Promise<T | null> {
  const hit = cache.get(file);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as T;
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
    cache.set(file, { at: Date.now(), value });
    return value;
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export const isCustomerId = (s: string) => /^CUST\d{5}$/.test(s);
export const isSlug = (s: string) => /^[a-z0-9][a-z0-9_-]{0,40}$/.test(s);

export const loadCustomer = <T = unknown>(id: string) => readJson<T>(path.join(DATA_DIR, "customers", `${id}.json`), 60_000);
export const loadCustomerIndex = <T = unknown>() => readJson<T>(path.join(DATA_DIR, "customers", "index.json"), 60_000);
/** Per-customer model output, e.g. kind = "twins" | "forecast" | "risk" ... Returns null if not produced yet. */
export const loadMl = <T = unknown>(kind: string, id: string) => readJson<T>(path.join(DATA_DIR, "ml", kind, `${id}.json`));
/** Dataset-wide output, e.g. name = "map" | "tribes" | "benchmarks" | "modelcard-forecast". Null if missing. */
export const loadGlobal = <T = unknown>(name: string) => readJson<T>(path.join(DATA_DIR, "global", `${name}.json`));
