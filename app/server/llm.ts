// The language model behind Vara: Google Gemini by default (Gemini API, key GEMINI_API_KEY, see gemini.ts), or
// the previous Claude path via Runware's Anthropic-compatible endpoint (RUNWARE_API_KEY) with LLM_PROVIDER=anthropic.
// One switch, no automatic fallback between providers. Plus the key-protection guards (per-IP rate limit, global
// daily cap). Keys never leave the server.
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./data";
import { GeminiError, geminiParse, geminiStream, type StreamLike } from "./gemini";

/** LLM_PROVIDER=gemini (default) | anthropic (rollback to the Claude path). */
export const PROVIDER: "gemini" | "anthropic" = process.env.LLM_PROVIDER?.trim().toLowerCase() === "anthropic" ? "anthropic" : "gemini";
// Gemini model settings are chains (comma-separated, first choice first): quotas are per model, so on a 429 the call
// moves to the next one (gemini.ts). One model id works too.
export const MODEL = PROVIDER === "gemini" ? (process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.1-flash-lite") : (process.env.VARA_MODEL ?? "anthropic:claude@opus-5.5");
/** Default model for the Crave shop generator (fast, time to first product matters most). */
export const CRAVE_DEFAULT_MODEL = PROVIDER === "gemini" ? (process.env.GEMINI_CRAVE_MODEL ?? "gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.1-flash-lite") : (process.env.CRAVE_MODEL ?? "anthropic:claude@haiku-5.5");
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

/** Streaming call for the active provider; the same event and message shapes either way. */
export function streamMessage(params: Anthropic.MessageCreateParamsNonStreaming, opts?: { signal?: AbortSignal }): StreamLike {
  return PROVIDER === "gemini" ? geminiStream(params, opts) : llm().messages.stream(params, opts);
}

/** Structured-output call (output_config.format from zodOutputFormat) for the active provider. */
export async function parseMessage<T>(params: Anthropic.MessageCreateParamsNonStreaming & { output_config: { format: { parse: (s: string) => T } } }, opts?: { signal?: AbortSignal }): Promise<{ parsed_output: T | null; model: string }> {
  if (PROVIDER === "gemini") return geminiParse<T>(params, opts);
  const res = (await llm().messages.parse(params as never, opts)) as unknown as { parsed_output: T | null };
  return { parsed_output: res.parsed_output, model: params.model };
}

export const isRateLimitError = (err: unknown) => err instanceof Anthropic.RateLimitError || (err instanceof GeminiError && err.status === 429);

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
