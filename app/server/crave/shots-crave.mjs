// Crave mode visual check (run on the VM from app/): one continuous browser session per flow, a PNG per step.
// Same conventions as scripts-ui/shots.mjs (390x844 @2x, ~/shots, console errors printed).
// usage: node server/crave/shots-crave.mjs --prefix=store- "goto:#/crave?q=new sneakers" "shot:intro" "click:I'm in" ...
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import os from "node:os";

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")).map(([k, ...v]) => [k, v.join("=")]));
const steps = args.filter((a) => !a.startsWith("--"));
const out = `${os.homedir()}/shots`;
mkdirSync(out, { recursive: true });
const base = opt.base ?? "http://localhost:5173/";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    const t = m.text();
    if (!/WebSocket|\[vite\]|wss:\/\//.test(t)) errors.push(`[${m.type()}] ${t}`);
  }
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
page.on("dialog", (d) => d.accept());

for (const st of steps) {
  const [k, ...v] = st.split(":");
  const val = v.join(":");
  try {
    if (k === "goto") {
      await page.goto(base + val, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
    } else if (k === "shot") {
      await page.screenshot({ path: `${out}/${opt.prefix ?? ""}${val}.png` });
      console.log("saved", val);
    } else if (k === "click") await page.getByText(val, { exact: false }).first().click({ timeout: 6000 });
    else if (k === "role") await page.getByRole("button", { name: val }).first().click({ timeout: 6000 });
    else if (k === "fill") { const [sel, text] = val.split("~"); await page.fill(sel, text); }
    else if (k === "press") await page.keyboard.press(val);
    else if (k === "wait") await page.waitForTimeout(Number(val));
    else if (k === "scroll") await page.evaluate((y) => document.querySelectorAll(".overflow-y-auto").forEach((el) => el.scrollTo(0, Number(y))), val);
    else if (k === "eval") await page.evaluate(val);
    else if (k === "print") console.log("PRINT", JSON.stringify(await page.evaluate(val)));
  } catch (e) {
    errors.push(`[step ${st}] ${e.message.split("\n")[0]}`);
  }
  if (k !== "wait" && k !== "shot") await page.waitForTimeout(350);
}
console.log(errors.length ? "CONSOLE:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
