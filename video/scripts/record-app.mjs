// Records the live Vara app for the pitch video: phone clips (390x844 @2x -> 780x1688), the desktop insights clip,
// stills, the app's own sounds (rendered offline from app/src/features/crave/sfx.ts) and the timing file.
//
// Method: frames grabbed through a CDP session with Page.captureScreenshot (lossless PNG, clip scale 2 = device pixels,
// two requests in flight, ~50-60 fps), each saved with its capture time; Page.startScreencast was tried first but in
// headless Chromium it only delivers 390x844 frames at deviceScaleFactor 2. ffmpeg assembles a constant 30 fps H.264 file by repeating the
// latest frame at every 1/30 s tick, so real time is kept (optionally minus cut AI wait time).
//
// Run on the VM (outputs go to ~/vidrec, outside ~/proj, because the sync deletes unknown files in ~/proj):
//   cd ~/proj/app && node ../video/scripts/record-app.mjs [--only today,chat,...] [--base URL]
// Clips: today chat whatif checkin finnish crave models more insights   Extras: stills wallet sounds timeline
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(process.cwd() + "/");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith("--")) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "1";
const BASE = (opt.base ?? "https://vara-junction26.swedencentral.cloudapp.azure.com/").replace(/\/?$/, "/");
const OUT = opt.out ?? path.join(os.homedir(), "vidrec");
const CHAT_Q = opt.q ?? "Can I afford new sneakers this month?";
const FPS = 30;
const CAP = opt.cap ?? "png"; // capture format (png: lossless source, smallest final files)
const CAPQ = Number(opt.capq ?? 92);
const PRESET = opt.preset ?? "veryslow";
for (const d of ["live", "shots", "audio", "timeline", "frames", "check", "logs"]) mkdirSync(path.join(OUT, d), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const rnd = (a, b) => a + Math.random() * (b - a);
const pause = (a = 400, b = 900) => sleep(rnd(a, b));

// ------------------------------------------------------------------------------------------------ page setup
// Touch overlay: a soft dark-green ripple (44 px, 400 ms) where a pointer goes down; a small dot follows a drag.
function touchOverlay() {
  const install = () => {
    if (document.getElementById("__touch_css")) return;
    const st = document.createElement("style");
    st.id = "__touch_css";
    st.textContent = `.__tap{position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;z-index:2147483647;
      background:radial-gradient(circle,rgba(0,70,40,.42) 0%,rgba(0,70,40,.30) 55%,rgba(0,70,40,0) 72%);animation:__tapk 400ms ease-out forwards}
      @keyframes __tapk{0%{transform:scale(.55);opacity:1}100%{transform:scale(1.35);opacity:0}}
      .__drag{position:fixed;left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;pointer-events:none;z-index:2147483647;
      background:radial-gradient(circle,rgba(0,70,40,.34) 0%,rgba(0,70,40,.22) 60%,rgba(0,70,40,0) 72%);transition:opacity 250ms}`;
    document.documentElement.appendChild(st);
  };
  let drag = null;
  let down = null;
  window.addEventListener("pointerdown", (e) => {
    install();
    const d = document.createElement("div");
    d.className = "__tap";
    d.style.left = e.clientX + "px";
    d.style.top = e.clientY + "px";
    document.documentElement.appendChild(d);
    setTimeout(() => d.remove(), 450);
    down = { x: e.clientX, y: e.clientY };
  }, true);
  window.addEventListener("pointermove", (e) => {
    if (!down) return;
    if (!drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
      drag = document.createElement("div");
      drag.className = "__drag";
      document.documentElement.appendChild(drag);
    }
    if (drag) {
      drag.style.left = e.clientX + "px";
      drag.style.top = e.clientY + "px";
    }
  }, true);
  window.addEventListener("pointerup", () => {
    down = null;
    if (drag) {
      const d = drag;
      drag = null;
      d.style.opacity = "0";
      setTimeout(() => d.remove(), 300);
    }
  }, true);
}

let browser;
async function newPhone({ wallet = "off", dsf = 2, width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, locale: "en-US", timezoneId: "Europe/Helsinki" });
  await ctx.addInitScript(touchOverlay);
  const page = await ctx.newPage();
  if (wallet === "off") await page.route("**/api/crave/wallet", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"enabled":false}' }));
  const errors = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message.slice(0, 200)}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`[net ${r.status()}] ${r.url().slice(0, 120)}`));
  page.on("dialog", (d) => d.accept());
  page.errors = errors;
  return { ctx, page };
}

async function settle(page, ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 5000); }))));
  await sleep(ms);
}

// ------------------------------------------------------------------------------------------------ interactions
async function boxOf(loc) {
  await loc.waitFor({ state: "visible", timeout: 15000 });
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box for " + loc);
  return b;
}
let mousePos = { x: 195, y: 600 };
/** A human tap: glide to the target, press ~90 ms, release. Returns the epoch ms of the release (when the click fires). */
async function tap(page, loc, { dx = 0.5, dy = 0.5, hold = 90 } = {}) {
  const b = await boxOf(loc);
  const vp = page.viewportSize();
  const x = b.x + b.width * dx, y = b.y + b.height * dy;
  if (y < 0 || y > vp.height || x < 0 || x > vp.width) throw new Error(`tap target off screen (${Math.round(x)},${Math.round(y)})`);
  await page.mouse.move(x, y, { steps: 6 });
  mousePos = { x, y };
  await page.mouse.down();
  await sleep(hold);
  await page.mouse.up();
  return Date.now();
}
async function tapXY(page, x, y, hold = 90) {
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.down();
  await sleep(hold);
  await page.mouse.up();
  return Date.now();
}
/** Animated scroll of a scroll container (or the window) with easeInOutCubic. `to` absolute px, or {by}, or {el: selector, offset}. */
async function scroll(page, sel, to, ms = 900) {
  return page.evaluate(
    ([sel, to, ms]) =>
      new Promise((res) => {
        const pick = () => {
          if (sel === "window") return document.scrollingElement;
          if (sel) return document.querySelector(sel);
          const all = [...document.querySelectorAll(".overflow-y-auto")].filter((e) => e.scrollHeight > e.clientHeight + 2 && e.getBoundingClientRect().height > 100);
          return all.sort((a, b) => b.clientHeight - a.clientHeight)[0];
        };
        const el = pick();
        if (!el) return res({ err: "no scroller" });
        el.style.scrollBehavior = "auto";
        const max = el.scrollHeight - el.clientHeight;
        const from = el.scrollTop;
        let target = typeof to === "number" ? to : to.by != null ? from + to.by : to === "bottom" ? max : 0;
        if (to && (to.el || to.text)) {
          const t = (to.el && document.querySelector(to.el)) || [...document.querySelectorAll(to.tag ?? "*")].find((n) => n.textContent.trim().startsWith(to.text));
          const top = sel === "window" ? 0 : el.getBoundingClientRect().top;
          target = t ? from + t.getBoundingClientRect().top - top - (to.offset ?? 0) : from;
        }
        target = Math.max(0, Math.min(max, target));
        const t0 = performance.now();
        const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
        const step = (now) => {
          const p = Math.min(1, (now - t0) / ms);
          el.scrollTop = from + (target - from) * ease(p);
          if (p < 1) requestAnimationFrame(step);
          else res({ from, target, max });
        };
        requestAnimationFrame(step);
      }),
    [sel ?? null, to, ms],
  );
}
/** Wait until fn() (in the page) is truthy; returns the in-page epoch ms of that animation frame. */
async function when(page, fn, arg, timeout = 30000) {
  const h = await page.waitForFunction(
    ([src, arg]) => {
      const f = new Function("arg", `return (${src})(arg)`);
      return f(arg) ? Date.now() : false;
    },
    [fn.toString(), arg ?? null],
    { polling: "raf", timeout },
  );
  return h.jsonValue();
}
const textOn = (s) => [...document.querySelectorAll("body *")].some((e) => e.childElementCount === 0 && e.textContent.trim() === s && e.getClientRects().length);

// ------------------------------------------------------------------------------------------------ recorder
class Recorder {
  constructor(page, name, { width, height }) {
    Object.assign(this, { page, name, width, height, frames: [], events: [], cuts: [] });
    this.dir = path.join(OUT, "frames", name);
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
  }
  async start() {
    // Chrome's own screencast (Page.startScreencast) only delivers frames at CSS-pixel size (390x844) even at
    // deviceScaleFactor 2, so frames are grabbed with Page.captureScreenshot at clip scale 2 instead: two requests in
    // flight keep it near the display rate (~50-60 fps); each frame is stamped with the midpoint of its request.
    this.cdp = await this.page.context().newCDPSession(this.page);
    const vp = this.page.viewportSize();
    const scale = this.width / vp.width;
    // (the clip is in document coordinates, so it is only used for the phone app, whose window never scrolls;
    // the 1x desktop page scrolls the window and is captured without a clip)
    const params = { format: CAP, ...(CAP === "jpeg" ? { quality: CAPQ } : {}), optimizeForSpeed: true, ...(scale !== 1 ? { clip: { x: 0, y: 0, width: vp.width, height: vp.height, scale } } : {}) };
    let n = 0;
    const worker = async () => {
      while (!this.stopped) {
        const t1 = Date.now();
        let r;
        try {
          r = await this.cdp.send("Page.captureScreenshot", params);
        } catch {
          if (this.stopped) break;
          await sleep(10);
          continue;
        }
        const t2 = Date.now();
        if (this.stopped && t1 > this.tEnd) break;
        const file = path.join(this.dir, `f${String(n++).padStart(6, "0")}.${CAP === "png" ? "png" : "jpg"}`);
        writeFileSync(file, Buffer.from(r.data, "base64"));
        this.frames.push({ ts: (t1 + t2) / 2, file });
      }
    };
    this.workers = [worker(), worker()];
    const t = Date.now();
    while (!this.frames.length && Date.now() - t < 5000) await sleep(10);
    this.t0 = Math.min(...this.frames.map((f) => f.ts));
    log(this.name, "recording (captureScreenshot x2)");
  }
  mark(label, t = Date.now()) {
    this.events.push({ label, t });
    log(this.name, "event", label, ((t - this.t0) / 1000).toFixed(2));
  }
  /** Remove [from, to) epoch ms from the final file (dead AI wait). */
  cut(from, to, where) {
    if (to - from > 50) this.cuts.push({ from, to, where });
  }
  async stop(holdMs = 1500) {
    await sleep(holdMs);
    this.tEnd = Date.now();
    this.stopped = true;
    await Promise.all(this.workers);
  }
  /** source epoch ms -> seconds in the final file */
  outT(t) {
    let removed = 0;
    for (const c of this.cuts) {
      if (t >= c.to) removed += c.to - c.from;
      else if (t > c.from) removed += t - c.from;
    }
    return (t - this.t0 - removed) / 1000;
  }
  assemble() {
    const frames = this.frames.slice().sort((a, b) => a.ts - b.ts);
    const cuts = this.cuts.slice().sort((a, b) => a.from - b.from);
    const total = this.outT(this.tEnd);
    const N = Math.round(total * FPS);
    const seq = path.join(this.dir, "seq");
    rmSync(seq, { recursive: true, force: true });
    mkdirSync(seq);
    let j = 0;
    for (let k = 0; k < N; k++) {
      // output time -> source time, skipping the cuts
      let s = this.t0 + (k / FPS) * 1000;
      for (const c of cuts) if (s >= c.from) s += c.to - c.from;
      while (j + 1 < frames.length && frames[j + 1].ts <= s) j++;
      linkSync(frames[j].file, path.join(seq, `s${String(k).padStart(6, "0")}.${CAP === "png" ? "png" : "jpg"}`));
    }
    const out = encode(seq, this.name, this.width, this.height);
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,nb_read_frames,r_frame_rate", "-of", "json", out]).toString()).streams[0];
    const tl = {
      file: `${this.name}.mp4`,
      width: probe.width,
      height: probe.height,
      fps: FPS,
      frames: Number(probe.nb_read_frames),
      seconds: Math.round((Number(probe.nb_read_frames) / FPS) * 1000) / 1000,
      cut: cuts.map((c) => ({ at: Math.round(this.outT(c.from) * 100) / 100, removed: Math.round((c.to - c.from) / 10) / 100, where: c.where })),
      events: this.events.map((e) => ({ t: Math.round(this.outT(e.t) * 100) / 100, label: e.label })),
    };
    writeFileSync(path.join(OUT, "timeline", `${this.name}.json`), JSON.stringify(tl, null, 2));
    const fdur = frames.length ? (frames.at(-1).ts - frames[0].ts) / 1000 : 0;
    if (Math.abs(frames.at(-1).ts - this.tEnd) > 200) log(this.name, "WARNING last frame", frames.at(-1).ts - this.tEnd, "ms from the end");
    log(this.name, `assembled ${tl.frames} frames, ${tl.seconds}s (${frames.length} captured frames over ${fdur.toFixed(1)}s, ~${(frames.length / Math.max(1, fdur)).toFixed(1)} fps captured)`);
    // check frames: every 2 s and at every event, half size
    const chk = path.join(OUT, "check", this.name);
    rmSync(chk, { recursive: true, force: true });
    mkdirSync(chk, { recursive: true });
    const times = [];
    for (let s = 0; s < tl.seconds; s += 2) times.push([s, `t${String(s).padStart(2, "0")}`]);
    for (const e of tl.events) times.push([e.t, `e-${e.label}`], [e.t + 0.1, `e-${e.label}+0.1`]);
    times.push([tl.seconds - 0.05, "zz-end"]);
    for (const [s, nm] of times)
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", Math.max(0, s).toFixed(3), "-i", out, "-frames:v", "1", "-vf", `scale=${Math.round(this.width / 2)}:-1`, "-q:v", "4", path.join(chk, `${nm}.jpg`)]);
    return tl;
  }
}

/** H.264, constant 30 fps, crf 18, yuv420p, GOP 15, no audio, faststart. aq-mode 3 / no-psy / ipratio 1.0 / no
 *  scenecut keyframes keep the nine clips under the 45 MB budget at crf 18 (I-frames every 0.5 s dominate the size). */
function encode(seq, name, width, height) {
  const out = path.join(OUT, "live", `${name}.mp4`);
  const ext = existsSync(path.join(seq, "s000000.png")) ? "png" : "jpg";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(seq, `s%06d.${ext}`),
    "-vf", `scale=${width}:${height}:flags=lanczos,setsar=1`, "-c:v", "libx264", "-preset", PRESET, "-x264-params", "aq-mode=3:no-psy=1:ipratio=1.0:scenecut=0", "-crf", "18", "-pix_fmt", "yuv420p",
    "-g", "15", "-keyint_min", "1", "-r", String(FPS), "-an", "-movflags", "+faststart", out]);
  return out;
}

async function finish(rec, page, hold = 1500) {
  await rec.stop(hold);
  const tl = rec.assemble();
  if (page.errors.length) log(rec.name, "page messages:\n  " + [...new Set(page.errors)].join("\n  "));
  if (!opt.keep) rmSync(path.join(rec.dir), { recursive: true, force: true });
  return tl;
}

// ------------------------------------------------------------------------------------------------ clips
const PHONE = { width: 780, height: 1688 };
const tab = (page, i) => page.locator('[role="tablist"] [role="tab"]').nth(i);

const CLIPS = {
  async today() {
    const { ctx, page } = await newPhone();
    await page.goto(BASE + "#/", { waitUntil: "networkidle" });
    await when(page, () => document.body.innerText.includes("Safe to spend"));
    await settle(page, 1500);
    const rec = new Recorder(page, "today", PHONE);
    await rec.start();
    await sleep(1600);
    await tap(page, page.getByRole("button", { name: "Open Vara, your personal economic trainer" }), { dy: 0.55 });
    rec.mark("vara-open", await when(page, () => document.querySelector("#vara-scroll") && document.body.innerText.includes("Why this number?")));
    await sleep(1800);
    await scroll(page, "#vara-scroll", 640, 1200);
    await pause(700, 900);
    await scroll(page, "#vara-scroll", 1280, 1200);
    await pause(700, 900);
    await scroll(page, "#vara-scroll", "bottom", 1200);
    await pause(900, 1100);
    await scroll(page, "#vara-scroll", 0, 1400);
    const tl = await finish(rec, page, 1500);
    await ctx.close();
    return tl;
  },

  async chat() {
    const { ctx, page } = await newPhone();
    await page.goto(BASE + "#/vara/chat", { waitUntil: "networkidle" });
    await when(page, () => document.body.innerText.includes("Ask me anything about your money"));
    await settle(page, 1200);
    const rec = new Recorder(page, "chat", PHONE);
    await rec.start();
    await sleep(1300);
    await tap(page, page.locator("#vara-input"));
    await pause(350, 450);
    rec.mark("typing-start");
    await page.keyboard.type(CHAT_Q, { delay: 50 });
    await pause(500, 650);
    const sent = await tap(page, page.getByRole("button", { name: "Send", exact: true }));
    rec.mark("sent", sent);
    const scroller = "[aria-live=polite]";
    const lastTurn = () => {
      const turns = [...document.querySelectorAll("[aria-live=polite] .flex.items-start.gap-2")];
      return turns.at(-1);
    };
    // first visible answer content (text or a card) and the first card
    const firstContent = await when(page, () => {
      const t = [...document.querySelectorAll("[aria-live=polite] .flex.items-start.gap-2")].at(-1);
      return t && (t.querySelector("section") || t.querySelector(".whitespace-pre-wrap")?.textContent.trim().length > 2);
    }, null, 120000);
    const firstCard = await when(page, () => [...document.querySelectorAll("[aria-live=polite] .flex.items-start.gap-2")].at(-1)?.querySelector("section"), null, 120000);
    const complete = await when(page, () => !document.querySelector('button[aria-label="Stop"]') && [...document.querySelectorAll("button")].some((b) => b.textContent.includes("New conversation")), null, 180000);
    const err = await page.evaluate(() => document.body.innerText.includes("Something went wrong") || document.body.innerText.includes("couldn't answer"));
    const offline = await page.evaluate(() => document.body.innerText.includes("offline demo"));
    log("chat: wait to first content", ((firstContent - sent) / 1000).toFixed(1), "s; to first card", ((firstCard - sent) / 1000).toFixed(1), "s; to complete", ((complete - sent) / 1000).toFixed(1), "s; error", err, "offline", offline);
    // keep about 1.5 s of the dead wait
    if (firstContent - sent > 2500) rec.cut(sent + 900, firstContent - 600, "waiting for the first words of the answer");
    rec.mark("answer-first-card", firstCard);
    rec.mark("answer-complete", complete);
    await sleep(1600);
    const info = await page.evaluate(() => {
      const sc = document.querySelector("[aria-live=polite]");
      const t = [...document.querySelectorAll("[aria-live=polite] .flex.items-start.gap-2")].at(-1);
      return {
        scroll: sc.scrollTop, max: sc.scrollHeight - sc.clientHeight, text: t?.innerText.slice(0, 1500),
        cards: [...(t?.querySelectorAll("section") ?? [])].map((s) => ({ title: s.querySelector("h3")?.textContent, top: s.getBoundingClientRect().top + sc.scrollTop - sc.getBoundingClientRect().top, how: !!s.querySelector("[aria-expanded]") })),
      };
    });
    log("chat answer", JSON.stringify(info));
    writeFileSync(path.join(OUT, "logs", "chat-answer.json"), JSON.stringify({ q: CHAT_Q, ...info, err, offline }, null, 2));
    // read down through the answer
    const steps = Math.min(3, Math.ceil((info.max - info.scroll) / 420));
    for (let i = 1; i <= steps; i++) {
      await scroll(page, scroller, info.scroll + ((info.max - info.scroll) * i) / steps, 1100);
      await pause(900, 1100);
    }
    // open "How I got this" on the first card that has it
    const how = page.locator("[aria-live=polite] section").getByRole("button", { name: "How I got this" }).first();
    if (await how.count()) {
      const cardTop = await how.evaluate((b) => {
        const sc = document.querySelector("[aria-live=polite]");
        return b.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      });
      await scroll(page, scroller, cardTop - 330, 1000);
      await pause(500, 700);
      rec.mark("how-open", await tap(page, how));
      await sleep(400);
      await scroll(page, scroller, { by: 140 }, 700);
      await sleep(1500);
    }
    const tl = await finish(rec, page, 1500);
    // still: the answer from the top of the question
    await scroll(page, scroller, 0, 10);
    await page.evaluate(() => {
      const sc = document.querySelector("[aria-live=polite]");
      const u = [...sc.querySelectorAll("[id^=msg-]")].at(-1);
      sc.scrollTop = u.offsetTop - 8;
    });
    await sleep(600);
    await page.screenshot({ path: path.join(OUT, "shots", "chat-answer.png") });
    await ctx.close();
    return tl;
  },

  async whatif() {
    const { ctx, page } = await newPhone();
    await page.goto(BASE + "#/vara/whatif", { waitUntil: "networkidle" });
    await when(page, () => document.body.innerText.includes("Save extra per month") && document.body.innerText.includes("500 possible paths"));
    await settle(page, 1200);
    const rec = new Recorder(page, "whatif", PHONE);
    await rec.start();
    await sleep(1100);
    await scroll(page, "#vara-scroll", { el: null, text: "Save extra per month", tag: "label", offset: 250 }, 1100);
    await pause(700, 800);
    const sl = page.getByLabel("Save extra per month");
    const b = await boxOf(sl);
    // the thumb sits at the left end (0 €); drag it to ~150 € in small steps
    const y = b.y + b.height / 2, x0 = b.x + 12, x1 = b.x + 12 + (b.width - 24) * 0.3;
    await page.mouse.move(x0, y, { steps: 5 });
    await page.mouse.down();
    const t0 = Date.now();
    rec.mark("changed", t0 + 60);
    for (let i = 1; i <= 40; i++) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / 40, y);
      await sleep(30);
    }
    await sleep(250);
    await page.mouse.up();
    await sleep(1100);
    await scroll(page, "#vara-scroll", { el: null, text: "Freed up every month", tag: "p", offset: 330 }, 1100);
    await sleep(1000);
    // a second change: save a little more and watch the figures move again
    const b2 = await boxOf(sl);
    const y2 = b2.y + b2.height / 2, xa = b2.x + 12 + (b2.width - 24) * 0.3, xb = b2.x + 12 + (b2.width - 24) * 0.5;
    await page.mouse.move(xa, y2, { steps: 5 });
    await page.mouse.down();
    rec.mark("changed-2", Date.now() + 60);
    for (let i = 1; i <= 30; i++) {
      await page.mouse.move(xa + ((xb - xa) * i) / 30, y2);
      await sleep(30);
    }
    await sleep(250);
    await page.mouse.up();
    await sleep(1200);
    // (no further scroll)
    await sleep(0);
    const tl = await finish(rec, page, 1500);
    await scroll(page, "#vara-scroll", { el: null, text: "Save extra per month", tag: "label", offset: 250 }, 10);
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, "shots", "whatif.png") });
    await ctx.close();
    return tl;
  },

  async checkin() {
    const { ctx, page } = await newPhone();
    await page.goto(BASE + "#/flow/checkin", { waitUntil: "networkidle" });
    await when(page, () => document.querySelector("[role=progressbar], [aria-label^='Slide']") && !document.querySelector("[aria-busy=true]"), null, 60000);
    await settle(page, 1200);
    const n = await page.evaluate(() => document.querySelector("[aria-label^='Slide']")?.getAttribute("aria-label"));
    log("checkin slides", n);
    const total = Number(/of (\d+)/.exec(n ?? "")?.[1] ?? 6);
    const rec = new Recorder(page, "checkin", PHONE);
    await rec.start();
    await sleep(1900);
    for (let i = 1; i < total; i++) {
      rec.mark(`slide-${i + 1}`, await tapXY(page, rnd(285, 330), rnd(300, 380)));
      await sleep(i === total - 1 ? 2200 : rnd(1750, 1950));
    }
    const tl = await finish(rec, page, 1000);
    await ctx.close();
    return tl;
  },

  async finnish() {
    const { ctx, page } = await newPhone();
    await page.goto(BASE + "#/vara/chat", { waitUntil: "networkidle" });
    await when(page, () => document.querySelector("#vara-input"));
    await page.evaluate(() => { location.hash = "#/vara/today"; });
    await when(page, () => document.body.innerText.includes("Why this number?"));
    await settle(page, 1200);
    const rec = new Recorder(page, "finnish", PHONE);
    await rec.start();
    await sleep(2000);
    await tap(page, page.locator('[role=radiogroup] button[lang="fi"]'));
    rec.mark("switched", await when(page, () => document.documentElement.lang === "fi" || !document.body.innerText.includes("Why this number?")));
    await sleep(2600);
    rec.mark("chat-tab", await tap(page, tab(page, 1)));
    await when(page, () => document.querySelector("#vara-input"));
    await sleep(2400);
    const tl = await finish(rec, page, 1200);
    await ctx.close();
    return tl;
  },

  async models() {
    const { ctx, page } = await newPhone();
    await page.goto(BASE + "#/vara/you?view=models", { waitUntil: "networkidle" });
    await when(page, () => document.querySelectorAll("section[id^=model-]").length >= 4, null, 20000);
    await page.evaluate(() => { location.hash = "#/vara/you"; });
    await settle(page, 600);
    await page.evaluate(() => { location.hash = "#/vara/today"; });
    await when(page, () => document.body.innerText.includes("Why this number?"));
    await settle(page, 1000);
    const rec = new Recorder(page, "models", PHONE);
    await rec.start();
    await sleep(900);
    await tap(page, tab(page, 3));
    await when(page, () => document.body.innerText.includes("how they were tested"));
    await sleep(1100);
    rec.mark("models-open", await tap(page, page.getByRole("button", { name: /how they were tested/ }).first()));
    await when(page, () => document.querySelectorAll("section[id^=model-]").length >= 4, null, 20000);
    await sleep(1200);
    const cards = await page.evaluate(() => {
      const sc = document.querySelector("#vara-scroll");
      return [...document.querySelectorAll("section[id^=model-]")].map((s) => ({
        id: s.id, top: s.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop, h: s.offsetHeight,
        badge: s.querySelector("h2")?.parentElement?.parentElement?.querySelector("span.shrink-0")?.innerText ?? "",
      }));
    });
    log("model cards", JSON.stringify(cards));
    const ship = cards.find((c) => /ship/i.test(c.badge)) ?? cards[1];
    // glide past the first cards, pausing on headers so the verdict badges can be read
    await scroll(page, "#vara-scroll", cards[0].top - 12, 1100);
    await pause(700, 800);
    for (const c of cards.slice(1).filter((c) => c.top <= ship.top)) {
      await scroll(page, "#vara-scroll", c.top - 12, 1100);
      await pause(700, 850);
    }
    const btn = page.locator(`#${ship.id}`).getByRole("button", { name: "Method and data" });
    const bt = await btn.evaluate((b) => b.getBoundingClientRect().top);
    if (bt > 600) {
      await scroll(page, "#vara-scroll", { by: bt - 420 }, 1600);
      await pause(500, 600);
    }
    rec.mark("card-open", await tap(page, btn));
    await sleep(500);
    await scroll(page, "#vara-scroll", { by: 240 }, 900);
    await sleep(900);
    const tl = await finish(rec, page, 1000);
    await scroll(page, "#vara-scroll", 0, 10);
    await sleep(400);
    await scroll(page, "#vara-scroll", cards[0].top - 260, 10);
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, "shots", "models.png") });
    await ctx.close();
    return { ...tl, ship };
  },

  async more() {
    const { ctx, page } = await newPhone();
    for (const r of ["#/flow/goal", "#/flow/connect"]) {
      await page.goto(BASE + r, { waitUntil: "networkidle" });
      await sleep(600);
    }
    await page.goto(BASE + "#/flow/baskets", { waitUntil: "networkidle" });
    await when(page, () => document.body.innerText.includes("Fixed musts"));
    await settle(page, 1200);
    const rec = new Recorder(page, "more", PHONE);
    await rec.start();
    rec.mark("baskets", rec.t0);
    await sleep(900);
    await scroll(page, null, 520, 900);
    await pause(450, 550);
    await scroll(page, null, 0, 800);
    await pause(400, 500);
    rec.mark("last-month", await tap(page, tab(page, 1)));
    await sleep(1000);
    // goal
    await page.evaluate(() => { location.hash = "#/flow/goal"; });
    rec.mark("goal", await when(page, () => document.body.innerText.includes("What are you saving for?")));
    await sleep(700);
    await tap(page, page.getByRole("button", { name: "Trip", exact: true }));
    await pause(450, 550);
    await tap(page, page.getByRole("button", { name: "Continue" }));
    await pause(500, 600);
    await tap(page, page.getByRole("button", { name: /^1\s?000\s?€$/ }));
    await pause(450, 550);
    await tap(page, page.getByRole("button", { name: "Continue" }));
    await pause(500, 600);
    await tap(page, page.getByRole("button", { name: "Continue" }));
    await sleep(700);
    await tap(page, page.getByRole("button", { name: "Save goal" }));
    await sleep(1100);
    rec.mark("saastaja", await tap(page, page.getByRole("button", { name: "Open Säästäjä (simulated)" })));
    await sleep(1100);
    // connect
    await page.evaluate(() => { location.hash = "#/flow/connect"; });
    rec.mark("connect", await when(page, () => document.body.innerText.includes("See all your money in one place")));
    await sleep(800);
    await tap(page, page.getByRole("button", { name: "Choose a bank" }));
    await sleep(800);
    await tap(page, page.locator("main, body").getByRole("button").filter({ hasText: /bank|pankki|Nordea|OP|Danske/i }).nth(0));
    await sleep(900);
    await tap(page, page.getByRole("button", { name: "Give consent (simulated)" }));
    await when(page, () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Back to Today")), null, 20000);
    await sleep(900);
    const tl = await finish(rec, page, 1000);
    await ctx.close();
    return tl;
  },

  async crave() {
    const { ctx, page } = await newPhone({ wallet: "off" });
    await page.goto(BASE + "#/crave/pot", { waitUntil: "networkidle" }); // loads the Crave chunk (no skeleton later)
    await sleep(800);
    await page.goto(BASE + "#/vara/today", { waitUntil: "networkidle" });
    await when(page, () => document.body.innerText.includes("Got a craving?"));
    await settle(page, 1200);
    const rec = new Recorder(page, "crave", PHONE);
    await rec.start();
    await sleep(1000);
    await scroll(page, "#vara-scroll", { el: null, text: "Got a craving?", tag: "p", offset: 300 }, 1100);
    await pause(700, 800);
    rec.mark("craving", await tap(page, page.getByRole("button", { name: "new sneakers", exact: true })));
    await when(page, () => document.body.innerText.includes("I'm in, open the shop"));
    await sleep(1000);
    await scroll(page, null, "bottom", 1100);
    await pause(600, 700);
    rec.mark("open-shop", await tap(page, page.getByRole("button", { name: "I'm in, open the shop" })));
    // the shop fades in: mark the frame where it is fully opaque
    rec.mark("shop-visible", await when(page, () => {
      let e = document.querySelector('input[aria-label="Search this shop"]');
      if (!e) return false;
      for (; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.98) return false;
      return true;
    }, null, 90000));
    await when(page, () => !document.body.innerText.includes("Stocking the shelves") && !document.querySelector(".skeleton"), null, 90000);
    await settle(page, 1200);
    const sc = ".no-scrollbar.flex-1.overflow-y-auto.pb-28";
    await scroll(page, sc, 560, 1200);
    await pause(700, 900);
    // (one leg down, then back up)
    await pause(0, 1);
    await scroll(page, sc, 330, 1100);
    await pause(600, 700);
    // open a product from the grid: the first card whose image is fully in view
    const cardBox = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll(".grid img, .grid [role=img], .grid button")].map((e) => e.getBoundingClientRect()).filter((r) => r.top > 120 && r.bottom < 700 && r.width > 100);
      return imgs[0] ? { x: imgs[0].x + imgs[0].width / 2, y: imgs[0].y + imgs[0].height / 2 } : null;
    });
    if (!cardBox) throw new Error("no product card in view");
    rec.mark("product-open", await tapXY(page, cardBox.x, cardBox.y));
    await when(page, () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Add to basket") && b.getBoundingClientRect().top < innerHeight));
    await sleep(1200);
    rec.mark("added", await tap(page, page.getByRole("button", { name: /Add to basket/ }).last()));
    await when(page, () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("View basket")));
    await sleep(1400);
    rec.mark("basket", await tap(page, page.getByRole("button", { name: /View basket/ })));
    await sleep(1500);
    rec.mark("checkout", await tap(page, page.getByRole("button", { name: /^Checkout/ })));
    await sleep(1300);
    await scroll(page, sc, "bottom", 1200);
    await pause(900, 1000);
    await tap(page, page.getByRole("button", { name: /^Pay / }).last());
    rec.mark("sheet-open", await when(page, () => {
      const d = document.querySelector('[role=dialog][aria-label="Confirm payment"]');
      return d && Math.abs(d.getBoundingClientRect().bottom - innerHeight) < 2;
    }));
    await sleep(2400);
    const prompt = page.getByRole("button", { name: "Double-click to pay" });
    const pb = await boxOf(prompt);
    await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 6 });
    await page.mouse.down(); await sleep(70); await page.mouse.up();
    await sleep(110);
    await page.mouse.down(); await sleep(70); await page.mouse.up();
    rec.mark("pay-tap", Date.now()); // the second click of the double-click confirms
    rec.mark("scan", await when(page, (s) => [...document.querySelectorAll("[role=dialog] span")].some((e) => e.textContent === "Confirming…")));
    rec.mark("tick", await when(page, () => [...document.querySelectorAll("[role=dialog] span")].some((e) => e.textContent === "Done")));
    rec.mark("reveal", await when(page, () => document.body.innerText.includes("Order confirmed!"), null, 10000));
    rec.mark("twist", await when(page, () => document.body.innerText.includes("Nothing is on its way."), null, 10000));
    await sleep(1300);
    rec.mark("coins", Date.now());
    await sleep(2600);
    // the Inbox button on the twist screen
    const inboxBtn = page.getByRole("button", { name: /^Inbox/ });
    const ib = await boxOf(inboxBtn);
    if (ib.y + ib.height > 830) {
      await scroll(page, null, "bottom", 1000);
      await pause(500, 600);
    }
    // the inbox's back arrow then behaves as after a deep link (to the pot) instead of returning to the shop route
    await page.evaluate(() => history.replaceState({ varaDepth: -1 }, "", location.href));
    rec.mark("inbox", await tap(page, inboxBtn));
    await when(page, () => document.body.innerText.includes("Order emails from Crave mode land here"));
    await sleep(3800); // the second order email lands in the list while it is on screen
    rec.mark("pot", await tap(page, page.getByRole("button", { name: "Back" }).first()));
    await when(page, () => document.body.textContent.includes("Crave pot · savings"));
    await sleep(1500);
    await scroll(page, null, 420, 1000);
    await sleep(900);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem("vara.state.v1") || "{}"));
    const cid = st.customerId;
    log("crave entries", JSON.stringify((st.byCustomer?.[cid]?.cravings ?? []).map((c) => [c.shopName, c.basketTotal, c.amount])));
    const tl = await finish(rec, page, 1100);
    await ctx.close();
    return tl;
  },

  async insights() {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.errors = [];
    await page.goto(BASE + "insights/", { waitUntil: "networkidle" });
    await settle(page, 1500);
    const marks = await page.evaluate(() => {
      const r = (e) => e && Math.round(e.getBoundingClientRect().top + scrollY);
      return { h: document.scrollingElement.scrollHeight, h2: [...document.querySelectorAll("h2,h3")].slice(0, 30).map((e) => [e.textContent.trim().slice(0, 60), r(e)]), table: r(document.querySelector("table")), svgs: [...document.querySelectorAll("svg,canvas,img")].slice(0, 12).map(r) };
    });
    log("insights layout", JSON.stringify(marks));
    await page.screenshot({ path: path.join(OUT, "shots", "insights-top.png") });
    const rec = new Recorder(page, "insights", { width: 1600, height: 900 });
    await rec.start();
    await sleep(1800);
    // the findings and the first charts, slowly
    const stops = [900, 2000, 3150];
    rec.mark("findings", Date.now());
    for (const y of stops) {
      await scroll(page, "window", y, 1500);
      if (y === 3150) rec.mark("charts", Date.now());
      await sleep(1000);
    }
    // then a tap on the sidebar link to the models section; instead of the browser's near-instant anchor jump the
    // page glides there (eased, continuous) so the video never cuts
    const link = page.locator('a[href="#models"]').first();
    await link.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault(), { once: true }));
    rec.mark("models-link", await tap(page, link));
    const top = await page.evaluate(() => document.querySelector("#models").getBoundingClientRect().top + scrollY - 24);
    await scroll(page, "window", top, 2200);
    rec.mark("model-table", Date.now());
    await page.evaluate(() => history.replaceState(null, "", "#models"));
    await sleep(1200);
    await scroll(page, "window", { by: 240 }, 1200);
    const tl = await finish(rec, page, 1500);
    await ctx.close();
    return tl;
  },

  // ---------------------------------------------------------------------------------------- stills
  async stills() {
    {
      const { ctx, page } = await newPhone();
      await page.goto(BASE + "#/vara/today", { waitUntil: "networkidle" });
      await when(page, () => document.body.innerText.includes("Why this number?"));
      await settle(page, 1200);
      await page.screenshot({ path: path.join(OUT, "shots", "today.png") });
      await page.locator('[role=radiogroup] button[lang="fi"]').click();
      await settle(page, 1500);
      await page.screenshot({ path: path.join(OUT, "shots", "today-fi.png") });
      await ctx.close();
    }
    const { ctx, page } = await newPhone({ wallet: "off" });
    const shot = (n) => page.screenshot({ path: path.join(OUT, "shots", n + ".png") });
    await page.goto(BASE + "#/crave?q=new%20sneakers", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "I'm in, open the shop" }).click();
    await when(page, () => document.querySelector('input[aria-label="Search this shop"]') && !document.querySelector(".skeleton") && !document.body.innerText.includes("Stocking the shelves"), null, 90000);
    await settle(page, 1500);
    await shot("crave-shop");
    await page.locator(".grid > *").filter({ hasText: "Court Low Leather" }).locator("img").first().click(); // the product the clip opens
    await sleep(1500);
    await page.getByRole("button", { name: /Add to basket/ }).last().click();
    await sleep(900);
    await page.getByRole("button", { name: /View basket/ }).click();
    await settle(page, 1200);
    await shot("crave-basket");
    await page.getByRole("button", { name: /^Checkout/ }).click();
    await sleep(900);
    await page.getByRole("button", { name: /^Pay / }).last().click();
    await sleep(1600);
    await shot("pay-sim");
    await page.getByRole("button", { name: /^Pay / }).last().click();
    await when(page, () => [...document.querySelectorAll("[role=dialog] span")].some((e) => e.textContent === "Done"));
    await sleep(500);
    await shot("pay-tick");
    await when(page, () => document.body.innerText.includes("Nothing is on its way."), null, 10000);
    await sleep(2600);
    await shot("reveal");
    await page.evaluate(() => history.replaceState({ varaDepth: -1 }, "", location.href));
    await sleep(6000); // two of the three order emails have arrived by now, as in the clip
    await page.getByRole("button", { name: /^Inbox/ }).click();
    await sleep(2500);
    await shot("inbox");
    await page.getByRole("button", { name: "Back" }).first().click();
    await sleep(2000);
    await shot("pot");
    await ctx.close();
  },

  async wallet() {
    // the real Stripe (test mode) wallet button: 1x, because third-party iframes render clipped in 2x headless shots
    const { ctx, page } = await newPhone({ wallet: "real", dsf: 1 });
    await page.goto(BASE + "#/crave?q=new%20sneakers", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "I'm in, open the shop" }).click();
    await when(page, () => document.querySelector('input[aria-label="Search this shop"]') && !document.querySelector(".skeleton"), null, 90000);
    await settle(page, 1000);
    await page.locator(".grid > *").filter({ hasText: "Court Low Leather" }).locator("img").first().click(); // the product the clip opens
    await sleep(1200);
    await page.getByRole("button", { name: /Add to basket/ }).last().click();
    await sleep(800);
    await page.getByRole("button", { name: /View basket/ }).click();
    await sleep(900);
    await page.getByRole("button", { name: /^Checkout/ }).click();
    await sleep(900);
    await page.getByRole("button", { name: /^Pay / }).last().click();
    const real = await when(page, () => document.body.textContent.includes("Test payment · your card is not charged"), null, 15000).catch(() => null);
    await sleep(3000);
    log("wallet: real button", !!real, "frames", page.frames().map((f) => f.url().slice(0, 60)).join(" | "));
    await page.screenshot({ path: path.join(OUT, "shots", "pay-wallet.png") });
    if (page.errors.length) log("wallet page messages:\n  " + [...new Set(page.errors)].join("\n  "));
    await ctx.close();
  },

  // ---------------------------------------------------------------------------------------- sounds
  async sounds() {
    // bundle the app's own sfx.ts unchanged and run it against an OfflineAudioContext (48 kHz mono) in a page
    const esbuild = require("esbuild");
    const src = path.resolve(process.cwd(), "src/features/crave/sfx.ts");
    const bundle = esbuild.buildSync({ entryPoints: [src], bundle: true, write: false, format: "iife", globalName: "SFX", target: "es2020" }).outputFiles[0].text;
    const ctx = await browser.newContext();
    const list = [
      { file: "chime.wav", call: "chime", arg: "a", seconds: 0.75, what: "pay chime (variant a, 'Bright double ding'): plays on the frame the tick appears on the pay sheet" },
      { file: "pop.wav", call: "pop", seconds: 0.2, what: "added to basket" },
      { file: "coins.wav", call: "coin", seconds: 0.35, what: "coins: the money lands in the Crave pot (reveal screen, 1.3 s after the twist)" },
    ];
    const res = [];
    for (const s of list) {
      const page = await ctx.newPage();
      await page.setContent("<html><body></body></html>");
      const pcm = await page.evaluate(async ({ bundle, s }) => {
        const off = new OfflineAudioContext({ numberOfChannels: 1, length: Math.round(48000 * s.seconds), sampleRate: 48000 });
        window.AudioContext = function () { return off; };
        (0, eval)(bundle + ";window.SFX = SFX;");
        window.SFX.sfx[s.call](s.arg);
        const buf = await off.startRendering();
        return Array.from(buf.getChannelData(0));
      }, { bundle, s });
      await page.close();
      const n = pcm.length;
      const peak = pcm.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      const b = Buffer.alloc(44 + n * 2);
      b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
      b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(96000, 28);
      b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
      for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), 44 + i * 2);
      writeFileSync(path.join(OUT, "audio", s.file), b);
      log("sound", s.file, n / 48000, "s, peak", peak.toFixed(3));
      res.push({ file: s.file, seconds: Math.round((n / 48000) * 1000) / 1000, what: s.what, peak: Math.round(peak * 1000) / 1000 });
    }
    writeFileSync(path.join(OUT, "timeline", "_sounds.json"), JSON.stringify(res, null, 2));
    await ctx.close();
  },
};

const ORDER = ["today", "chat", "whatif", "checkin", "finnish", "crave", "models", "more", "insights"];
function writeTimeline() {
  const clips = ORDER.filter((c) => existsSync(path.join(OUT, "timeline", c + ".json"))).map((c) => JSON.parse(readFileSync(path.join(OUT, "timeline", c + ".json"), "utf8")));
  const sounds = existsSync(path.join(OUT, "timeline", "_sounds.json")) ? JSON.parse(readFileSync(path.join(OUT, "timeline", "_sounds.json"), "utf8")).map(({ peak, ...s }) => s) : [];
  writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify({ clips, sounds }, null, 2) + "\n");
  log("timeline.json:", clips.map((c) => `${c.file} ${c.seconds}s`).join(", "));
}

// --reencode chat,...: encode again from frames kept by an earlier --keep run (no new recording, no API calls)
if (opt.reencode) {
  for (const name of opt.reencode.split(",")) {
    const tl = JSON.parse(readFileSync(path.join(OUT, "timeline", name + ".json"), "utf8"));
    encode(path.join(OUT, "frames", name, "seq"), name, tl.width, tl.height);
    log("re-encoded", name);
  }
  writeTimeline();
  process.exit(0);
}

const only = (opt.only ?? [...ORDER, "stills", "wallet", "sounds"].join(",")).split(",").filter(Boolean);
browser = await chromium.launch();
let failed = 0;
for (const name of only) {
  if (name === "timeline") continue;
  const fn = CLIPS[name];
  if (!fn) throw new Error("unknown clip " + name);
  log("=== " + name);
  try {
    const r = await fn();
    if (r) log(name, "done", JSON.stringify({ seconds: r.seconds, events: r.events, cut: r.cut }));
  } catch (e) {
    failed++;
    log(name, "FAILED", e.stack?.split("\n").slice(0, 4).join("\n"));
  }
}
await browser.close();
writeTimeline();
process.exit(failed ? 1 : 0);
