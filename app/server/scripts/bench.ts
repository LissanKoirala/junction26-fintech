// Latency benchmark for /api/chat through the real route code (in-process). Model from VARA_GEMINI_MODEL (or, with
// LLM_PROVIDER=anthropic, VARA_MODEL).
// Usage: VARA_GEMINI_MODEL=gemini-3.5-flash-lite npx tsx server/scripts/bench.ts 3
import { Hono } from "hono";
import { registerChatRoutes } from "../chat/route";
import { MODEL } from "../llm";

const app = new Hono();
registerChatRoutes(app);
const n = Number(process.argv[2] ?? 3);
const q = process.argv[3] ?? "How much did I spend on eating out in September compared to August, and what is safe for me to spend this week?";
const rows: { ttft: number; firstCard: number; total: number; tools: number }[] = [];
for (let k = 0; k < n; k++) {
  const t0 = Date.now();
  const res = await app.request("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `bench-${k}` },
    body: JSON.stringify({ customerId: "CUST04754", messages: [{ role: "user", content: q }] }),
  });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let ttft = 0;
  let firstCard = 0;
  let tools = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i).replace(/^data: /, "");
      buf = buf.slice(i + 2);
      if (!line.trim()) continue;
      const ev = JSON.parse(line);
      if (ev.type === "text_delta") {
        if (!ttft) ttft = Date.now() - t0;
        text += ev.text;
      }
      if (ev.type === "card" && !firstCard) firstCard = Date.now() - t0;
      if (ev.type === "status") tools++;
      if (ev.type === "error") console.log("ERROR", ev.message);
    }
  }
  rows.push({ ttft, firstCard, total: Date.now() - t0, tools: tools - 1 });
  console.log(JSON.stringify(rows[rows.length - 1]), "|", text.replace(/\s+/g, " ").slice(0, 160));
}
const med = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1];
console.log(`${MODEL} effort=${process.env.VARA_EFFORT ?? "low"}: median first text ${med(rows.map((r) => r.ttft))} ms, first card ${med(rows.map((r) => r.firstCard))} ms, total ${med(rows.map((r) => r.total))} ms`);
