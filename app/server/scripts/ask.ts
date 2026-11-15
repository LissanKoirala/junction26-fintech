// Ask /api/chat one question and print a compact transcript. Default URL is the public one.
// Usage: npx tsx server/scripts/ask.ts CUST04754 "How much did I spend on taxis last month?"
export {};
const [id = "CUST04754", q = "Hi", url = "https://vara-junction26.swedencentral.cloudapp.azure.com/api/chat"] = process.argv.slice(2);
const t0 = Date.now();
const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId: id, messages: [{ role: "user", content: q }] }) });
if (!res.ok || !res.body) {
  console.log("HTTP", res.status, await res.text());
  process.exit(1);
}
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "";
let text = "";
const out: string[] = [];
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
    if (ev.type === "text_delta") text += ev.text;
    else if (ev.type === "card") {
      const k = ev.card;
      const v = k.kind === "stat" ? ` value=${k.value}${k.comparison ? ` cmp=${k.comparison.value}` : ""}${k.series ? ` series=${k.series.length}` : ""}` : k.kind === "safe_to_spend" ? ` perWeek=${k.data.safePerWeek}` : k.kind === "whatif" ? ` saved=${k.result.savedMonthly}` : k.kind === "breakdown" ? ` items=${k.items.length}` : "";
      out.push(`  [card ${k.kind}: ${k.title ?? ""}${v}]`);
    } else if (ev.type === "status") out.push(`  (status: ${ev.label})`);
    else if (ev.type === "suggestions") out.push(`  suggestions: ${ev.items.join(" | ")}`);
    else if (ev.type === "check") out.push(`  check: verified=${ev.verified}${ev.unverified.length ? ` unverified=${JSON.stringify(ev.unverified)}` : ""}`);
    else if (ev.type === "error") out.push(`  ERROR: ${ev.message}`);
  }
}
console.log(`\n### ${id}: ${q}  (${Date.now() - t0} ms)\n${text.trim()}\n${out.join("\n")}`);
