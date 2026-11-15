// Visual self-check: opens the app at 390x844 @2x, visits routes, saves PNGs to ~/shots, prints console errors.
// usage (on the VM): node scripts-ui/shots.mjs [--prefix=x] [--q=mock=1] name=#/route[@scroll|!click:selector-text] ...
// Steps for a shot are separated by "|": "chat=#/vara/chat|click:Can I afford|wait:4000|scroll:9999"
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import os from "node:os";

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")).map(([k, ...v]) => [k, v.join("=")]));
const shots = args.filter((a) => !a.startsWith("--"));
const out = `${os.homedir()}/shots`;
mkdirSync(out, { recursive: true });
const base = opt.base ?? "http://localhost:5173/";
const q = opt.q ? `?${opt.q}` : "";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
if (opt.customer) {
  await ctx.addInitScript((id) => {
    try {
      const s = JSON.parse(localStorage.getItem("vara.state.v1") || "{}");
      if (!sessionStorage.getItem("shots.init")) {
        localStorage.setItem("vara.state.v1", JSON.stringify({ ...s, customerId: id }));
        sessionStorage.setItem("shots.init", "1");
      }
    } catch {}
  }, opt.customer);
}
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    const t = m.text();
    if (!/WebSocket|\[vite\]|wss:\/\//.test(t)) errors.push(`[${m.type()}] ${t}`);
  }
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

for (const spec of shots) {
  const [name, ...rest] = spec.split("=");
  const steps = rest.join("=").split("|");
  const route = steps.shift();
  await page.goto(base + q + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  for (const st of steps) {
    const [k, ...v] = st.split(":");
    const val = v.join(":");
    try {
      if (k === "click") await page.getByText(val, { exact: false }).first().click({ timeout: 4000 });
      else if (k === "role") await page.getByRole("button", { name: val }).first().click({ timeout: 4000 });
      else if (k === "fill") { const [sel, text] = val.split("~"); await page.fill(sel, text); }
      else if (k === "press") await page.keyboard.press(val);
      else if (k === "wait") await page.waitForTimeout(Number(val));
      else if (k === "scroll")
        await page.evaluate((y) => document.querySelectorAll(".overflow-y-auto").forEach((el) => el.scrollTo(0, Number(y))), val);
      else if (k === "eval") await page.evaluate(val);
    } catch (e) {
      errors.push(`[step ${name}:${st}] ${e.message.split("\n")[0]}`);
    }
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(500);
  const file = `${out}/${opt.prefix ?? ""}${name}.png`;
  await page.screenshot({ path: file, fullPage: opt.full === "1" });
  console.log("saved", file);
}
console.log(errors.length ? "CONSOLE:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
