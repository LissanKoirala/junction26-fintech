// Gemini provider behind the same call shapes the app already uses (Anthropic Messages params in, Anthropic-style
// stream events and final message out), so prompts, tool definitions, card markers and the number guard are
// untouched. Plain fetch against the Gemini API REST endpoints (generateContent / streamGenerateContent?alt=sse):
//   - tools        -> function calling (functionDeclarations with parametersJsonSchema; functionCallingConfig AUTO/NONE)
//   - output format -> structured output (responseMimeType application/json + responseJsonSchema)
//   - effort        -> thinkingConfig.thinkingLevel
// The model's own parts (including thoughtSignature on function calls) are kept and echoed back verbatim on the
// next round, as the API requires. The key (GEMINI_API_KEY) stays on the server.
// Capacity: a "model" may be a comma-separated chain ("a,b,c"). Quotas are per model, so on 429/5xx (after one
// short retry) or no response within FIRST_BYTE_MS, the call falls through to the next Gemini model in the chain.
// A chat turn stays on the model that started it while that model answers; if it has to move mid-turn, the earlier
// model's signatures are replaced with the documented "skip_thought_signature_validator" value.
import type Anthropic from "@anthropic-ai/sdk";

const BASE = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const REQUEST_TIMEOUT_MS = 60_000; // until response headers, on the last model of the chain
const FIRST_BYTE_MS = 12_000; // until the first streamed chunk (or the response), when another model is left to try
const RETRY_WAIT_MS = 600; // one short retry on the same model before moving on

export class GeminiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Part = Record<string, unknown> & { text?: string; thought?: boolean; thoughtSignature?: string; functionCall?: { id?: string; name: string; args?: Record<string, unknown> } };
type GContent = { role: "user" | "model"; parts: Part[] };
type GResponse = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number };
  modelVersion?: string;
};

/** The model turn exactly as Gemini returned it (and which model wrote it), keyed by the content array handed back. */
const rawParts = new WeakMap<object, { model: string; parts: Part[] }>();
const SKIP_SIGNATURE = "skip_thought_signature_validator"; // documented for history written by a different model

export const modelChain = (model: string) => model.split(",").map((m) => m.trim()).filter(Boolean);

/** The model that wrote the latest model step of the current turn (after the last user text), if any. */
function turnModel(messages: Anthropic.MessageParam[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (typeof m.content === "string") {
      if (m.role === "user") return null;
      continue;
    }
    const raw = rawParts.get(m.content);
    if (raw) return raw.model;
    if (m.role === "user" && m.content.some((b) => b.type === "text")) return null;
  }
  return null;
}
const GEN_ID = "gen_"; // ids we made up when Gemini returned a functionCall without one (not echoed to the API)

const REFUSAL = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY", "LANGUAGE"]);

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("The language model is not configured on this server.");
  return k;
}

function systemText(system: Anthropic.MessageCreateParams["system"]): string {
  if (!system) return "";
  return typeof system === "string" ? system : system.map((b) => b.text).join("\n\n");
}

function toResponseObject(content: unknown, isError: boolean): Record<string, unknown> {
  let v: unknown = content;
  if (Array.isArray(content)) v = content.map((b) => (b && typeof b === "object" && "text" in b ? (b as { text: string }).text : "")).join("");
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      /* plain text (or truncated JSON) stays a string */
    }
  }
  return isError ? { error: v } : { result: v };
}

function toContents(messages: Anthropic.MessageParam[], target: string): GContent[] {
  const names = new Map<string, string>(); // tool_use id -> function name
  const out: GContent[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") {
      out.push({ role, parts: [{ text: m.content }] });
      continue;
    }
    for (const b of m.content) if (b.type === "tool_use") names.set(b.id, b.name);
    const raw = rawParts.get(m.content);
    if (raw) {
      const parts =
        raw.model === target
          ? raw.parts
          : raw.parts.map((p) => {
              if (!p.thoughtSignature) return p;
              const { thoughtSignature: _sig, ...rest } = p;
              return p.functionCall ? { ...rest, thoughtSignature: SKIP_SIGNATURE } : rest;
            });
      out.push({ role, parts });
      continue;
    }
    const parts: Part[] = [];
    for (const b of m.content) {
      if (b.type === "text") parts.push({ text: b.text });
      else if (b.type === "tool_use") parts.push({ functionCall: { ...(b.id.startsWith(GEN_ID) ? {} : { id: b.id }), name: b.name, args: (b.input ?? {}) as Record<string, unknown> } });
      else if (b.type === "tool_result")
        parts.push({ functionResponse: { ...(b.tool_use_id.startsWith(GEN_ID) ? {} : { id: b.tool_use_id }), name: names.get(b.tool_use_id) ?? "tool", response: toResponseObject(b.content, !!b.is_error) } });
    }
    if (parts.length) out.push({ role, parts });
  }
  return out;
}

const THINKING = new Set(["minimal", "low", "medium", "high"]);

function toRequest(p: Anthropic.MessageCreateParams, model: string): Record<string, unknown> {
  const anyP = p as unknown as { output_config?: { effort?: string; format?: { type?: string; schema?: unknown } }; thinking?: { type?: string } };
  const gen: Record<string, unknown> = { maxOutputTokens: p.max_tokens };
  const level = anyP.thinking?.type === "disabled" ? (process.env.GEMINI_FAST_THINKING ?? "minimal") : anyP.output_config?.effort;
  if (level && THINKING.has(level)) gen.thinkingConfig = { thinkingLevel: level };
  const fmt = anyP.output_config?.format;
  if (fmt?.type === "json_schema" && fmt.schema) {
    gen.responseMimeType = "application/json";
    gen.responseJsonSchema = fmt.schema;
  }
  const body: Record<string, unknown> = { contents: toContents(p.messages, model), generationConfig: gen };
  const sys = systemText(p.system);
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  if (p.tools?.length) {
    body.tools = [
      {
        functionDeclarations: (p.tools as Anthropic.Tool[]).map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.input_schema })),
      },
    ];
    body.toolConfig = { functionCallingConfig: { mode: p.tool_choice?.type === "none" ? "NONE" : "AUTO" } };
  }
  return body;
}

const sleep = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason ?? new Error("aborted"))), { once: true });
  });

/** POST to the first model of the chain that answers. 429/5xx/no headers in time: one short retry, then the next
 *  model. A daily quota is not retried. Throws GeminiError (the last failure) when no model answered. */
/** Models whose daily quota ran out, skipped until the quotas reset (midnight Pacific; 08:00 UTC in winter). */
const exhausted = new Map<string, number>();
const nextReset = () => {
  const d = new Date();
  d.setUTCHours(8, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
};

type Posted = { res: Response; model: string; reader?: ReadableStreamDefaultReader<Uint8Array>; first?: ReadableStreamReadResult<Uint8Array> };
async function post(models: string[], method: string, body: (model: string) => unknown, signal?: AbortSignal | null): Promise<Posted> {
  const streaming = method.includes("alt=sse");
  let last: GeminiError | null = null;
  let saw429 = false;
  const live = models.filter((m) => !((exhausted.get(m) ?? 0) > Date.now()));
  if (!live.length) live.push(...models); // all marked: try anyway, the API decides
  for (let mi = 0; mi < live.length; mi++) {
    const model = live[mi];
    const lastModel = mi === live.length - 1;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw signal.reason ?? new Error("aborted");
      const ac = new AbortController();
      const onAbort = () => ac.abort(signal?.reason);
      signal?.addEventListener("abort", onAbort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => ((timedOut = true), ac.abort(new Error("Gemini request timed out"))), lastModel ? REQUEST_TIMEOUT_MS : FIRST_BYTE_MS);
      let res: Response | null = null;
      let got: Posted | null = null;
      try {
        res = await fetch(`${BASE}/models/${model}:${method}`, { method: "POST", headers: { "x-goog-api-key": key(), "Content-Type": "application/json" }, body: JSON.stringify(body(model)), signal: ac.signal });
        if (res.ok && streaming) {
          // wait for the first chunk under the same timer, so a model that accepts but stalls counts as no answer
          const reader = res.body!.getReader();
          got = { res, model, reader, first: await reader.read() };
        } else if (res.ok) got = { res, model };
      } catch (err) {
        if (!timedOut || signal?.aborted) throw err;
        res = null;
      } finally {
        clearTimeout(timer);
      }
      if (got) {
        // the caller's abort keeps cancelling the body read through ac
        if (mi > 0 || attempt > 0) console.warn(`[gemini] answered by ${model} (chain ${models.join(",")})`);
        return got;
      }
      signal?.removeEventListener("abort", onAbort);
      const status = res?.status ?? 504;
      const text = res ? await res.text().catch(() => "") : "no response in time";
      let msg = text;
      try {
        msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
      } catch {
        /* not JSON */
      }
      if (status === 429) saw429 = true;
      last = new GeminiError(`Gemini ${model} HTTP ${status}: ${msg.slice(0, 300)}`, saw429 ? 429 : status);
      const retryable = status === 429 || status >= 500;
      if (!retryable) throw last; // 400 and friends: a bug, not capacity; do not hide it behind another model
      const daily = status === 429 && /per day|PerDay/i.test(text);
      console.warn(`[gemini] ${model} HTTP ${status}${daily ? " (daily quota)" : ""}${attempt === 0 && !daily ? ", one retry" : lastModel ? "" : ", next model"}`);
      if (daily) exhausted.set(model, nextReset());
      if (daily || attempt === 1) break;
      await sleep(RETRY_WAIT_MS + Math.random() * 300, signal);
    }
  }
  throw last ?? new GeminiError("Gemini: no model configured", 500);
}

async function* sse(reader: ReadableStreamDefaultReader<Uint8Array>, first?: ReadableStreamReadResult<Uint8Array>): AsyncGenerator<GResponse> {
  const dec = new TextDecoder();
  let buf = "";
  for (let pending = first; ; pending = undefined) {
    const { done, value } = pending ?? (await reader.read());
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i).replace(/^\r?\n\r?\n/, "");
      const data = chunk
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) yield JSON.parse(data) as GResponse;
    }
  }
  const rest = buf.trim();
  if (rest.startsWith("data:")) yield JSON.parse(rest.slice(5).trimStart()) as GResponse;
}

/** Collects streamed (or one-shot) Gemini chunks into one model turn and an Anthropic-shaped message. */
class Turn {
  parts: Part[] = []; // model parts, adjacent text merged, signatures kept
  finish = "";
  blocked = "";
  usage: NonNullable<GResponse["usageMetadata"]> = {};
  modelVersion = "";
  add(r: GResponse, onText?: (t: string) => void, onCall?: (fc: Part["functionCall"] & object, id: string) => void) {
    if (r.promptFeedback?.blockReason) this.blocked = r.promptFeedback.blockReason;
    if (r.usageMetadata) this.usage = r.usageMetadata;
    if (r.modelVersion) this.modelVersion = r.modelVersion;
    const c = r.candidates?.[0];
    if (c?.finishReason) this.finish = c.finishReason;
    for (const p of c?.content?.parts ?? []) {
      if (p.thought) continue; // thought summaries are not requested; never shown
      if (p.functionCall) {
        const part = { ...p, functionCall: { ...p.functionCall } };
        this.parts.push(part);
        onCall?.(part.functionCall, part.functionCall.id ?? `${GEN_ID}${this.parts.length}`);
      } else if (typeof p.text === "string") {
        const last = this.parts[this.parts.length - 1];
        if (last && typeof last.text === "string" && !last.functionCall) {
          last.text += p.text;
          if (p.thoughtSignature) last.thoughtSignature = p.thoughtSignature;
        } else this.parts.push({ ...p });
        if (p.text) onText?.(p.text);
      } else if (p.thoughtSignature) {
        // a bare signature part: keep it with the previous part
        const last = this.parts[this.parts.length - 1];
        if (last && !last.thoughtSignature) last.thoughtSignature = p.thoughtSignature;
        else this.parts.push({ ...p });
      }
    }
  }
  message(model: string): Anthropic.Message {
    // model: the id we called (kept with the parts so the next round knows which model wrote them)
    const content: Anthropic.ContentBlock[] = [];
    let n = 0;
    for (const p of this.parts) {
      n++;
      if (p.functionCall) content.push({ type: "tool_use", id: p.functionCall.id ?? `${GEN_ID}${n}`, name: p.functionCall.name, input: p.functionCall.args ?? {} } as Anthropic.ToolUseBlock);
      else if (typeof p.text === "string" && p.text) content.push({ type: "text", text: p.text, citations: null } as Anthropic.TextBlock);
    }
    rawParts.set(content, { model, parts: this.parts });
    const hasCall = this.parts.some((p) => p.functionCall);
    const stop_reason = this.blocked || REFUSAL.has(this.finish) ? "refusal" : hasCall ? "tool_use" : this.finish === "MAX_TOKENS" ? "max_tokens" : "end_turn";
    if (this.finish && !["STOP", "MAX_TOKENS"].includes(this.finish)) console.warn(`[gemini] finishReason ${this.finish}${this.blocked ? `, blocked ${this.blocked}` : ""}`);
    return {
      id: `gemini-${Date.now()}`,
      type: "message",
      role: "assistant",
      model,
      content,
      stop_reason: stop_reason as Anthropic.Message["stop_reason"],
      stop_sequence: null,
      usage: {
        input_tokens: this.usage.promptTokenCount ?? 0,
        output_tokens: this.usage.candidatesTokenCount ?? 0,
        cache_read_input_tokens: this.usage.cachedContentTokenCount ?? 0,
        cache_creation_input_tokens: 0,
        thinking_tokens: this.usage.thoughtsTokenCount ?? 0,
      } as unknown as Anthropic.Usage,
    } as Anthropic.Message;
  }
}

export interface StreamLike extends AsyncIterable<Anthropic.MessageStreamEvent> {
  finalMessage(): Promise<Anthropic.Message>;
}

/** Streaming generate (streamGenerateContent, SSE), yielding the Anthropic stream events the call sites read. */
export function geminiStream(params: Anthropic.MessageCreateParams, opts?: { signal?: AbortSignal | null }): StreamLike {
  const turn = new Turn();
  let usedModel = params.model;
  let finished: Promise<Anthropic.Message> | null = null;
  let resolveFinal!: (m: Anthropic.Message) => void;
  let rejectFinal!: (e: unknown) => void;
  finished = new Promise((res, rej) => ((resolveFinal = res), (rejectFinal = rej)));
  finished.catch(() => {});
  async function* run(): AsyncGenerator<Anthropic.MessageStreamEvent> {
    try {
      const chain = modelChain(params.model);
      const pinned = turnModel(params.messages);
      const models = pinned && chain.includes(pinned) ? [pinned, ...chain.filter((m) => m !== pinned)] : chain;
      const { res, model, reader, first } = await post(models, "streamGenerateContent?alt=sse", (m) => toRequest(params, m), opts?.signal);
      usedModel = model;
      const queue: Anthropic.MessageStreamEvent[] = [];
      for await (const chunk of sse(reader ?? res.body!.getReader(), first)) {
        turn.add(
          chunk,
          (text) => queue.push({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } } as Anthropic.MessageStreamEvent),
          (fc, id) => queue.push({ type: "content_block_start", index: 0, content_block: { type: "tool_use", id, name: fc.name, input: fc.args ?? {} } } as unknown as Anthropic.MessageStreamEvent),
        );
        while (queue.length) yield queue.shift()!;
      }
      resolveFinal(turn.message(usedModel));
    } catch (err) {
      rejectFinal(err);
      throw err;
    }
  }
  const it = run();
  return {
    [Symbol.asyncIterator]: () => it,
    finalMessage: async () => {
      // if the caller never iterated, drain the stream here
      // (iterating an exhausted generator is a no-op)
      for await (const _ of it) void _;
      return finished!;
    },
  };
}

/** One-shot generate (generateContent) with structured output parsed by the format's own zod parser. */
export async function geminiParse<T = unknown>(params: Anthropic.MessageCreateParams, opts?: { signal?: AbortSignal | null }): Promise<Anthropic.Message & { parsed_output: T | null }> {
  const { res, model } = await post(modelChain(params.model), "generateContent", (m) => toRequest(params, m), opts?.signal);
  const turn = new Turn();
  turn.add((await res.json()) as GResponse);
  const msg = turn.message(model);
  const fmt = (params as unknown as { output_config?: { format?: { parse?: (s: string) => T } } }).output_config?.format;
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const parsed_output = msg.stop_reason === "refusal" || !text ? null : fmt?.parse ? fmt.parse(text) : (JSON.parse(text) as T);
  return { ...msg, parsed_output };
}
