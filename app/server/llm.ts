// Claude via Runware's Anthropic-compatible endpoint, plus the key-protection guards (per-IP rate limit, global
// daily cap). The key never leaves the server.
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./data";

export const MODEL = process.env.VARA_MODEL ?? "anthropic:claude@opus-5.5";
export const EFFORT = (process.env.VARA_EFFORT ?? "low") as "low" | "medium" | "high";

let client: Anthropic | null = null;
export function llm(): Anthropic {
  if (!process.env.RUNWARE_API_KEY) throw new Error("The language model is not configured on this server.");
  client ??= new Anthropic({
    authToken: process.env.RUNWARE_API_KEY,
    apiKey: null,
    baseURL: process.env.VARA_LLM_BASE_URL ?? "https://api.runware.ai",
    timeout: 60_000,
    maxRetries: 1,
  });
  return client;
}

// ---------------------------------------------------------------- guards
const PER_IP_WINDOW_MS = 5 * 60_000;
const PER_IP_MAX = Number(process.env.VARA_RATE_PER_5MIN ?? 30);
const DAILY_CAP = Number(process.env.VARA_DAILY_CAP ?? 2000);
const hits = new Map<string, number[]>();

export function clientIp(headers: Headers, fallback = "local"): string {
  const xff = headers.get("x-forwarded-for");
  return (xff?.split(",")[0].trim() || headers.get("x-real-ip") || fallback).slice(0, 64);
}

/** Returns an error message if this IP is over its budget, else records the hit. */
export function rateLimit(ip: string): string | null {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < PER_IP_WINDOW_MS);
  if (arr.length >= PER_IP_MAX) return "Too many questions in a short time. Please wait a few minutes.";
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < PER_IP_WINDOW_MS)) hits.delete(k);
  return null;
}

const usageFile = path.join(DATA_DIR, "cache", "llm-usage.json");
let usage: { day: string; calls: number } | null = null;
function loadUsage() {
  if (usage) return usage;
  try {
    usage = JSON.parse(readFileSync(usageFile, "utf8"));
  } catch {
    usage = { day: "", calls: 0 };
  }
  return usage!;
}
/** Counts one LLM API call against the global daily cap. Returns false when the cap is reached. */
export function takeDailyBudget(n = 1): boolean {
  const u = loadUsage();
  const day = new Date().toISOString().slice(0, 10); // real clock on purpose: this is an operational budget
  if (u.day !== day) {
    u.day = day;
    u.calls = 0;
  }
  if (u.calls + n > DAILY_CAP) return false;
  u.calls += n;
  try {
    mkdirSync(path.dirname(usageFile), { recursive: true });
    writeFileSync(usageFile, JSON.stringify(u));
  } catch {
    /* best effort */
  }
  return true;
}
export const dailyUsage = () => ({ ...loadUsage(), cap: DAILY_CAP });
