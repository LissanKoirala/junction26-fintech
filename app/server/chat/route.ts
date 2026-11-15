// POST /api/chat: Server-Sent Events, protocol in shared/chat.ts. The model calls deterministic tools scoped to the
// request's customer; cards are built server-side from tool results and streamed when the model places a
// [[card:ID]] marker. A number guard checks the prose at the end of the turn.
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { CardSpec, ChatEvent } from "../../shared/chat";
import type { CustomerData } from "../../shared/types";
import { isCustomerId, loadCustomer } from "../data";
import { EFFORT, MODEL, PROVIDER, clientIp, isRateLimitError, rateLimit, streamMessage, takeDailyBudget } from "../llm";
import { STATIC_SYSTEM, languageLine, snapshot } from "./prompt";
import { tr, type Lang } from "../../shared/i18n";
import { TOOL_PARAMS, runTool, toolStatus, type ToolCtx } from "./tools";
import { checkProse, userNumbers, verdictConflict } from "./guard";

const MAX_ROUNDS = 8;
const MAX_TOKENS = 4096;
const TURN_TIMEOUT_MS = 90_000;
const MAX_BODY = 200_000;

const BasketEnum = z.enum(["must_regular", "must_irregular", "everyday"]);
const ChatRequestSchema = z.object({
  customerId: z.string().refine(isCustomerId, "bad customer id"),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000), cards: z.array(z.any()).max(30).optional() }))
    .min(1)
    .max(40),
  locale: z.string().max(20).optional(),
  lang: z.enum(["en", "fi"]).optional(),
  overrides: z.object({ byTx: z.record(z.string(), BasketEnum).optional(), byRule: z.record(z.string(), BasketEnum).optional() }).optional(),
  goal: z.object({ name: z.string().max(80), targetAmount: z.number(), targetDate: z.string().max(10), monthlyContribution: z.number().min(0), createdAt: z.string().max(30) }).nullable().optional(),
  screen: z.string().max(40).optional(),
  cravePot: z.number().finite().optional(), // euros held in the Crave pot (simulated); clamped below
  crave: z
    .object({
      count: z.number(), savedTotal: z.number(), releasedCount: z.number(), releasedTotal: z.number(), windowShops: z.number(),
      byCategory: z.array(z.object({ category: z.string().max(40), count: z.number(), amount: z.number() })).max(12),
      byTimeOfDay: z.array(z.object({ slot: z.string().max(20), count: z.number() })).max(6),
      topWeekday: z.string().max(12).nullable(),
      recent: z.array(z.object({ craving: z.string().max(80), amount: z.number(), status: z.string().max(12) })).max(5),
    })
    .nullable()
    .optional(),
});

/** Splits streamed text into prose and [[...]] markers without ever emitting half a marker. */
class MarkerParser {
  private buf = "";
  constructor(private onText: (t: string) => void, private onMarker: (m: string) => void) {}
  push(t: string) {
    this.buf += t;
    this.drain(false);
  }
  end() {
    this.drain(true);
  }
  private drain(final: boolean) {
    for (;;) {
      const idx = this.buf.indexOf("[[");
      if (idx < 0) {
        if (!final && this.buf.endsWith("[")) {
          this.emit(this.buf.slice(0, -1));
          this.buf = "[";
        } else {
          this.emit(this.buf);
          this.buf = "";
        }
        return;
      }
      this.emit(this.buf.slice(0, idx));
      const rest = this.buf.slice(idx);
      const end = rest.indexOf("]]");
      if (end < 0) {
        if (final || rest.length > 400) {
          this.emit(rest);
          this.buf = "";
        } else this.buf = rest;
        return;
      }
      this.onMarker(rest.slice(2, end).trim());
      this.buf = rest.slice(end + 2);
    }
  }
  private emit(t: string) {
    if (t) this.onText(t);
  }
}

const summariseCard = (k: CardSpec) => `${k.kind}${k.title ? `: ${k.title}` : ""}`;

export function registerChatRoutes(app: Hono) {
  app.post("/api/chat", async (c) => {
    const raw = await c.req.text();
    if (raw.length > MAX_BODY) return c.json({ error: "request too large" }, 413);
    let req: z.infer<typeof ChatRequestSchema>;
    try {
      req = ChatRequestSchema.parse(JSON.parse(raw));
    } catch {
      return c.json({ error: "bad request" }, 400);
    }
    const ip = clientIp(c.req.raw.headers);
    const customer = await loadCustomer<CustomerData>(req.customerId);
    c.header("X-Accel-Buffering", "no");
    c.header("Cache-Control", "no-cache");

    return streamSSE(c, async (stream) => {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), TURN_TIMEOUT_MS);
      stream.onAbort(() => ac.abort());
      const send = async (ev: ChatEvent) => {
        if (!stream.aborted) await stream.writeSSE({ data: JSON.stringify(ev) });
      };
      const t0 = Date.now();
      let ttft = 0;
      const lang: Lang = req.lang ?? "en";
      const T = tr(lang);
      const log: Record<string, unknown> = { customer: req.customerId, provider: PROVIDER, model: MODEL, effort: EFFORT, lang };
      try {
        if (!customer) throw new UserError(T.t("I could not find that customer."));
        const limited = rateLimit(ip);
        if (limited) throw new UserError(T.t(limited));
        const last = req.messages[req.messages.length - 1];
        if (last.role !== "user" || !last.content.trim()) throw new UserError(T.t("Please type a question."));

        await send({ type: "status", label: T.t("Thinking…") });
        // money held in the Crave pot counts as no longer free (plain number from the app, clamped)
        const cravePot = Math.round(Math.min(1_000_000, Math.max(0, req.cravePot ?? 0)) * 100) / 100;
        const snap = snapshot(customer, lang, { overrides: req.overrides as never, goal: req.goal ?? null, cravePot });
        let cardSeq = 0;
        const ctx: ToolCtx = {
          c: customer,
          opts: { overrides: req.overrides as never, goal: req.goal ?? null, cravePot, lang },
          newCardId: () => `c${++cardSeq}`,
          crave: req.crave ?? null,
          lang,
          tr: T,
        };
        const cards = new Map<string, CardSpec>();
        const shown = new Set<string>();
        const primary: string[] = []; // first card of each tool call, for the fallback
        const fullResults: unknown[] = [snap.data];
        const suggestions: string[] = [];
        let prose = "";

        let nl = 0; // trailing newline run already sent (collapse blank lines left by markers)
        const parser = new MarkerParser(
          (t) => {
            let o = "";
            for (const ch of t) {
              if (ch === "\n") {
                if (++nl <= 2) o += ch;
              } else if (ch === " " && nl > 0) continue; // no leading spaces on a new line
              else {
                nl = 0;
                o += ch;
              }
            }
            if (!prose && !o.trim()) return;
            if (!o) return;
            prose += o;
            void send({ type: "text_delta", text: o });
          },
          (m) => {
            const card = /^card\s*:\s*([\w-]+)$/i.exec(m);
            if (card) {
              const k = cards.get(card[1]);
              if (k && !shown.has(k.id)) {
                shown.add(k.id);
                void send({ type: "card", card: k });
              }
              return;
            }
            const sug = /^suggest\s*:\s*(.*)$/is.exec(m);
            if (sug) for (const s of sug[1].split("|").map((x) => x.trim()).filter(Boolean).slice(0, 3)) suggestions.push(s.slice(0, 120));
          },
        );

        // conversation: last 12 messages, starting with a user turn; earlier cards summarised by kind and title
        let hist = req.messages.slice(-12);
        while (hist.length && hist[0].role !== "user") hist = hist.slice(1);
        const messages: Anthropic.MessageParam[] = hist.map((m) => ({
          role: m.role,
          content: m.role === "assistant" && m.cards?.length ? `${m.content}\n(Cards shown: ${(m.cards as CardSpec[]).map(summariseCard).join("; ")})` : m.content || "…",
        }));
        for (const m of hist) if (m.cards) fullResults.push(m.cards);
        const system: Anthropic.TextBlockParam[] = [
          { type: "text", text: STATIC_SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: `${snap.text}${req.screen ? `\nThe user opened the chat from the "${req.screen}" screen.` : ""}\n${languageLine(lang)}` },
        ];

        const toolsUsed: string[] = [];
        let rounds = 0;
        let nudged = false;
        let forceCrave = false;
        for (; rounds < MAX_ROUNDS; rounds++) {
          if (!takeDailyBudget()) throw new UserError(T.t("Vara has answered a lot of questions today and is resting. Please try again tomorrow."));
          const lastRound = rounds === MAX_ROUNDS - 1;
          if (prose && !/\s$/.test(prose)) parser.push("\n\n"); // text from an earlier round must not run into the next
          const ms = streamMessage(
            {
              model: MODEL,
              max_tokens: MAX_TOKENS,
              system,
              tools: TOOL_PARAMS,
              tool_choice: lastRound ? { type: "none" } : forceCrave ? { type: "tool", name: "offer_crave_mode" } : { type: "auto" },
              messages,
              output_config: { effort: EFFORT },
            },
            { signal: ac.signal },
          );
          forceCrave = false;
          // Hold back the first ~240 characters of each round: if a tool call follows, that text was only a
          // preamble ("let me check…") and is dropped; otherwise it streams as soon as it is long enough.
          let held = "";
          let live = false;
          for await (const ev of ms) {
            if (ev.type === "content_block_start" && ev.content_block.type === "tool_use" && !live) held = "";
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              if (!ttft) ttft = Date.now() - t0;
              if (live) parser.push(ev.delta.text);
              else {
                held += ev.delta.text;
                if (held.length > 240) {
                  live = true;
                  parser.push(held);
                  held = "";
                }
              }
            }
          }
          const msg = await ms.finalMessage();
          if (!live && held && msg.stop_reason !== "tool_use") parser.push(held);
          log[`usage${rounds}`] = { model: msg.model, in: msg.usage.input_tokens, out: msg.usage.output_tokens, cacheRead: msg.usage.cache_read_input_tokens, cacheWrite: msg.usage.cache_creation_input_tokens };
          const uses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
          if (msg.stop_reason === "refusal") {
            parser.push("\n" + T.t("Sorry, I can't help with that one. Ask me anything about your money."));
            break;
          }
          if (msg.stop_reason !== "tool_use" || !uses.length) {
            // rare: the model ends the turn with no visible text; ask once for the answer
            if (!prose.trim() && !nudged && rounds < MAX_ROUNDS - 1) {
              nudged = true;
              messages.push({ role: "user", content: "(Now write your short answer to the user, with card markers and the [[suggest: ...]] line.)" });
              continue;
            }
            // the answer talks about Crave mode but the tool was not called (no card to open it): ask once for the call
            if (!nudged && rounds < MAX_ROUNDS - 2 && !toolsUsed.includes("offer_crave_mode") && !toolsUsed.includes("get_crave_pot") && /crave (mode|pot)|mielitekotil|mielitekopot|simulated shop/i.test(prose)) {
              nudged = true;
              forceCrave = true; // this round must call the tool; the next one writes the marker
              log.craveNudge = true;
              messages.push({ role: "assistant", content: msg.content });
              messages.push({ role: "user", content: "(System: call offer_crave_mode for this craving now, then reply with only its [[card:...]] marker. Do not repeat your earlier text.)" });
              continue;
            }
            break;
          }
          if (msg.stop_reason === "tool_use" && msg.usage.output_tokens >= MAX_TOKENS) throw new Error("tool input truncated");
          messages.push({ role: "assistant", content: msg.content });
          const results = await Promise.all(
            uses.map(async (u) => {
              toolsUsed.push(u.name);
              await send({ type: "status", label: toolStatus(u.name, u.input, lang) });
              try {
                const out = await runTool(ctx, u.name, u.input);
                for (const k of out.cards) cards.set(k.id, k);
                if (out.cards[0]) primary.push(out.cards[0].id);
                fullResults.push(out.full, out.model);
                let content = JSON.stringify(out.model);
                if (content.length > 14_000) content = content.slice(0, 14_000) + "…(truncated)";
                return { type: "tool_result" as const, tool_use_id: u.id, content, is_error: !!out.error };
              } catch (err) {
                console.error(`[chat] tool ${u.name} failed`, err);
                return { type: "tool_result" as const, tool_use_id: u.id, content: JSON.stringify({ error: "This tool failed. Tell the user briefly and continue without it." }), is_error: true };
              }
            }),
          );
          messages.push({ role: "user", content: results });
        }
        parser.end();

        // verdict guard: if the prose contradicts the engine's affordability verdict, append the engine's sentence
        const conflict = verdictConflict(prose, fullResults);
        if (conflict) {
          const fix = `\n\n${conflict.say}`;
          prose += fix;
          await send({ type: "text_delta", text: fix });
          log.verdictFix = conflict.verdict;
        }

        // fallback: if the model referenced no card, show the main card of each tool call (max 2)
        if (!shown.size && primary.length) {
          for (const id of primary.filter((id) => !["concept", "action"].includes(cards.get(id)!.kind)).slice(0, 2)) {
            shown.add(id);
            await send({ type: "card", card: cards.get(id)! });
          }
        }
        const sugg = suggestions.length ? suggestions : ["What is safe to spend this week?", "Show my three baskets", "How could I save more?"].map((s) => T.t(s));
        await send({ type: "suggestions", items: sugg.slice(0, 3) });
        // the user's own amounts ("a 300 € trip") are valid sources too
        const check = checkProse(prose, [...fullResults, userNumbers(req.messages.filter((m) => m.role === "user").map((m) => m.content))]);
        await send({ type: "check", verified: check.verified, unverified: check.unverified });
        Object.assign(log, { rounds: rounds + 1, tools: toolsUsed, cards: [...shown].map((id) => cards.get(id)!.kind), ttftMs: ttft, totalMs: Date.now() - t0, check });
      } catch (err) {
        const msg =
          err instanceof UserError
            ? err.message
            : ac.signal.aborted
              ? T.t("That took too long. Please try again.")
              : isRateLimitError(err)
                ? T.t("Vara is very busy right now. Please try again in a moment.")
                : T.t("Something went wrong on my side. Please try again.");
        if (!(err instanceof UserError)) console.error("[chat] error", err);
        log.error = String((err as Error)?.message ?? err).slice(0, 300);
        await send({ type: "error", message: msg });
      } finally {
        clearTimeout(timer);
        await send({ type: "done" });
        console.log(`[chat] ${JSON.stringify(log)}`);
      }
    });
  });
}

class UserError extends Error {}
