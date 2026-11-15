// Version 2 footage: live Crave-mode takes of shops built on the spot (not from cache), with exact event times.
// Phone 390x844 CSS px at deviceScaleFactor 2 -> 780x1688 frames, grabbed over CDP (Page.captureScreenshot, two in
// flight) and assembled into a constant 30 fps H.264 file in real time: nothing is cut or sped up.
//
// Before each take the craving's cached shop file (DATA_DIR/cache/crave/shop-<hash>.json) is moved into
// DATA_DIR/cache/crave-retired/ (never deleted), so the server really builds the shop during the take; the
// server keeps no in-memory shop cache (app/server/crave/route.ts reads the file each time). The take also
// records the server's own "done" event and fails the cache check if it says cached:true.
//
// Run on the VM (outputs in ~/vidrec2, outside ~/proj):
//   cd ~/proj/app && node ~/vidrec2/record-v2.mjs --only hero,sushi,headphones,coat [--noretire] [--keep]
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(process.cwd() + "/");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith("--")) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "1";
const BASE = (opt.base ?? "https://vara-junction26.swedencentral.cloudapp.azure.com/").replace(/\/?$/, "/");
const OUT = opt.out ?? path.join(os.homedir(), "vidrec2");
const DATA = process.env.DATA_DIR ?? path.join(os.homedir(), "data");
const CRAVE_DIR = path.join(DATA, "cache", "crave");
const RETIRED = path.join(DATA, "cache", "crave-retired");
const FPS = 30;
const PRICE_CAP = Number(opt.cap ?? 137);
const TAG = opt.tag ?? "";
const CAP = opt.cap2 ?? "jpeg";
const EXT = CAP === "png" ? "png" : "jpg";
const WORKERS = Number(opt.workers ?? 3); // suffix for output names (retakes)
for (const d of ["live", "timeline", "frames", "check", "logs"]) mkdirSync(path.join(OUT, d), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const rnd = (a, b) => a + Math.random() * (b - a);
const pause = (a = 400, b = 900) => sleep(rnd(a, b));

// ------------------------------------------------------------------------------------------------ cache
const normaliseCraving = (s) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
const shopFile = (craving) => path.join(CRAVE_DIR, `shop-${createHash("sha1").update(`1|${normaliseCraving(craving)}`).digest("hex").slice(0, 16)}.json`);
const moved = [];
function retire(craving) {
  const f = shopFile(craving);
  if (!existsSync(f)) {
    log("cache: no file for", JSON.stringify(craving), "(" + path.basename(f) + ")");
    return null;
  }
  mkdirSync(RETIRED, { recursive: true });
  const to = path.join(RETIRED, path.basename(f, ".json") + "." + new Date().toISOString().replace(/[:.]/g, "-") + ".json");
  renameSync(f, to);
  moved.push({ craving, from: f, to });
  log("cache: retired", f, "->", to);
  return to;
}

// ------------------------------------------------------------------------------------------------ brand scan
// Real shops, brands and retailers that a generated shop or the app could name; any hit in the viewport is logged.
const BRANDS = ["StockX", "Zara", "Uber Eats", "Real shops", "Shopping Lab", "Nike", "Adidas", "Puma", "Reebok", "New Balance", "Asics", "Converse", "Vans", "Jordan", "Yeezy", "Skechers", "Fila", "Under Armour", "Salomon", "Hoka", "On Running", "Timberland", "Dr. Martens", "UGG", "Crocs", "Birkenstock", "Veja", "Onitsuka", "Mizuno", "Saucony", "Brooks",
  "Sony", "Bose", "Apple", "AirPods", "Beats", "Sennheiser", "JBL", "Samsung", "Jabra", "Marshall", "Audio-Technica", "Shure", "AKG", "Bang & Olufsen", "B&O", "Philips", "Panasonic", "Xiaomi", "Huawei", "Google", "Pixel", "Anker", "Soundcore", "Skullcandy", "Nothing Ear", "Sonos", "Bowers",
  "North Face", "Patagonia", "Moncler", "Canada Goose", "Columbia", "Arc'teryx", "Arcteryx", "Burberry", "Gucci", "Prada", "Louis Vuitton", "Levi", "Uniqlo", "H&M", "Mango", "Gap", "Lululemon", "Marimekko", "Halti", "Luhta", "Icepeak", "Fjällräven", "Fjallraven", "Didriksons", "Napapijri", "Barbour", "Max Mara", "Hugo Boss", "Tommy Hilfiger", "Ralph Lauren", "Calvin Klein", "Superdry", "Helly Hansen", "Peak Performance", "Mammut", "Haglöfs", "Jack Wolfskin", "Woolrich", "Parajumpers",
  "Amazon", "Zalando", "IKEA", "Prisma", "Citymarket", "K-Market", "S-market", "Alepa", "Lidl", "Verkkokauppa", "Gigantti", "Wolt", "Foodora", "Stockmann", "Sokos", "Intersport", "XXL", "Footlocker", "Foot Locker", "JD Sports", "eBay", "Etsy", "Temu", "Shein", "AliExpress", "Walmart", "Best Buy",
  "Cloudfoam", "Ultraboost", "Air Max", "Air Force", "Air Jordan", "Fresh Foam", "CloudTec", "Gore-Tex", "GORE-TEX", "Vibram", "Flyknit", "Primeknit", "Dri-FIT", "Gel-Kayano", "Gel-Nimbus", "Chuck Taylor", "All Star", "Stan Smith", "Superstar", "Samba", "Old Skool", "Yeezy", "Thinsulate", "Polartec", "PrimaLoft", "AirPods", "QuietComfort", "WH-1000", "Galaxy Buds", "Sushibar", "Itsudemo", "Sticks'n'Sushi", "Kotipizza", "McDonald", "Hesburger", "Kikkoman", "Apple Pay", "Google Pay", "Klarna", "Visa", "Mastercard"];
const BRAND_RE_SRC = "\\b(" + BRANDS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b";
function scanText(s) {
  const re = new RegExp(BRAND_RE_SRC, "g");
  return [...new Set([...s.matchAll(re)].map((m) => m[0]))];
}
const brandCheck = (page) =>
  page.evaluate((src) => {
    const re = new RegExp(src);
    const hits = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      if (!re.test(n.textContent)) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const b of r.getClientRects()) if (b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth && b.width > 0) { hits.push(n.textContent.slice(0, 60)); break; }
    }
    for (const img of document.images) if (re.test(img.alt) && img.getBoundingClientRect().bottom > 0 && img.getBoundingClientRect().top < innerHeight) hits.push("[alt] " + img.alt.slice(0, 60));
    return hits;
  }, BRAND_RE_SRC);

// ------------------------------------------------------------------------------------------------ page setup
function touchOverlay() {
  const install = () => {
    if (document.getElementById("__touch_css")) return;
    const st = document.createElement("style");
    st.id = "__touch_css";
    st.textContent = `.__tap{position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;z-index:2147483647;
      background:radial-gradient(circle,rgba(0,70,40,.42) 0%,rgba(0,70,40,.30) 55%,rgba(0,70,40,0) 72%);animation:__tapk 400ms ease-out forwards}
      @keyframes __tapk{0%{transform:scale(.55);opacity:1}100%{transform:scale(1.35);opacity:0}}`;
    document.documentElement.appendChild(st);
  };
  window.addEventListener("pointerdown", (e) => {
    install();
    const d = document.createElement("div");
    d.className = "__tap";
    d.style.left = e.clientX + "px";
    d.style.top = e.clientY + "px";
    document.documentElement.appendChild(d);
    setTimeout(() => d.remove(), 450);
  }, true);
}

let browser;
async function newPhone({ wallet = "off" } = {}) {
  // a fresh profile per take: empty Crave pot, no consent yet, no session memory
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "en-US", timezoneId: "Europe/Helsinki" });
  await ctx.addInitScript(touchOverlay);
  const page = await ctx.newPage();
  // the simulated pay sheet (no Stripe wallet button): the app's own "wallet not configured" answer
  if (wallet === "off") await page.route("**/api/crave/wallet", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"enabled":false}' }));
  const errors = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message.slice(0, 200)}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`[net ${r.status()}] ${r.url().slice(0, 120)}`));
  page.errors = errors;
  // keep the shop stream so the take's facts come from the server's own events
  page.sse = new Promise((res) => {
    page.on("response", async (r) => {
      if (!r.url().includes("/api/crave/shop")) return;
      try {
        const body = await r.text();
        const evs = body.split("\n\n").map((b) => b.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n")).filter(Boolean).map((d) => { try { return JSON.parse(d); } catch { return null; } }).filter(Boolean);
        res(evs);
      } catch (e) {
        res([{ type: "error", message: "could not read stream: " + e.message }]);
      }
    });
  });
  return { ctx, page };
}

async function settle(page, ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await sleep(ms);
}

// ------------------------------------------------------------------------------------------------ interactions
async function boxOf(loc) {
  await loc.waitFor({ state: "visible", timeout: 15000 });
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box for " + loc);
  return b;
}
async function tap(page, loc, { dx = 0.5, dy = 0.5, hold = 90 } = {}) {
  const b = await boxOf(loc);
  const x = b.x + b.width * dx, y = b.y + b.height * dy;
  if (y < 0 || y > 844 || x < 0 || x > 390) throw new Error(`tap target off screen (${Math.round(x)},${Math.round(y)})`);
  return tapXY(page, x, y, hold);
}
async function tapXY(page, x, y, hold = 90) {
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.down();
  await sleep(hold);
  await page.mouse.up();
  return Date.now();
}
async function scroll(page, sel, to, ms = 900) {
  return page.evaluate(
    ([sel, to, ms]) =>
      new Promise((res) => {
        const el = sel === "window" ? document.scrollingElement : sel ? document.querySelector(sel) : [...document.querySelectorAll(".overflow-y-auto")].filter((e) => e.scrollHeight > e.clientHeight + 2 && e.getBoundingClientRect().height > 100).sort((a, b) => b.clientHeight - a.clientHeight)[0];
        if (!el) return res({ err: "no scroller" });
        el.style.scrollBehavior = "auto";
        const max = el.scrollHeight - el.clientHeight;
        const from = el.scrollTop;
        let target = typeof to === "number" ? to : to.by != null ? from + to.by : to === "bottom" ? max : 0;
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

// ------------------------------------------------------------------------------------------------ recorder
class Recorder {
  constructor(page, name) {
    Object.assign(this, { page, name, width: 780, height: 1688, frames: [], events: [] });
    this.dir = path.join(OUT, "frames", name);
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
  }
  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    const params = { format: CAP, ...(CAP === "jpeg" ? { quality: 92 } : {}), optimizeForSpeed: true, clip: { x: 0, y: 0, width: 390, height: 844, scale: 2 } };
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
        const file = path.join(this.dir, `f${String(n++).padStart(6, "0")}.${EXT}`);
        writeFileSync(file, Buffer.from(r.data, "base64"));
        this.frames.push({ ts: (t1 + t2) / 2, file });
      }
    };
    this.workers = Array.from({ length: WORKERS }, worker);
    const t = Date.now();
    while (!this.frames.length && Date.now() - t < 5000) await sleep(10);
    this.t0 = Math.min(...this.frames.map((f) => f.ts));
    log(this.name, "recording");
  }
  mark(label, t = Date.now()) {
    this.events.push({ label, t });
    log(this.name, "event", label, ((t - this.t0) / 1000).toFixed(2));
    return t;
  }
  async stop(holdMs = 1200) {
    await sleep(holdMs);
    this.tEnd = Date.now();
    this.stopped = true;
    await Promise.all(this.workers);
  }
  /** Assemble [from, tEnd] (epoch ms; default the whole take) into name.mp4 at a constant 30 fps, real time. */
  assemble(name = this.name, from = this.t0) {
    const frames = this.frames.slice().sort((a, b) => a.ts - b.ts);
    const N = Math.round(((this.tEnd - from) / 1000) * FPS);
    const seq = path.join(this.dir, "seq-" + name);
    rmSync(seq, { recursive: true, force: true });
    mkdirSync(seq);
    let j = 0;
    const gaps = [];
    for (let k = 0; k < N; k++) {
      const s = from + (k / FPS) * 1000;
      while (j + 1 < frames.length && frames[j + 1].ts <= s) j++;
      if (s - frames[j].ts > 120) gaps.push(Math.round((s - from) / 100) / 10);
      linkSync(frames[j].file, path.join(seq, `s${String(k).padStart(6, "0")}.${EXT}`));
    }
    const out = path.join(OUT, "live", `${name}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(seq, `s%06d.${EXT}`),
      "-vf", "scale=780:1688:flags=lanczos,setsar=1", "-c:v", "libx264", "-preset", "slow", "-x264-params", "aq-mode=3:no-psy=1:ipratio=1.0:scenecut=0", "-crf", "18", "-pix_fmt", "yuv420p",
      "-g", "15", "-keyint_min", "1", "-r", String(FPS), "-an", "-movflags", "+faststart", out]);
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,nb_read_frames", "-of", "json", out]).toString()).streams[0];
    const fdur = (frames.at(-1).ts - frames[0].ts) / 1000;
    const tl = {
      file: `v2/live/${name}.mp4`,
      seconds: Math.round((Number(probe.nb_read_frames) / FPS) * 1000) / 1000,
      width: probe.width,
      height: probe.height,
      fps: FPS,
      frames: Number(probe.nb_read_frames),
      capture_fps: Math.round((frames.filter((f) => f.ts >= from).length / Math.max(1, (this.tEnd - from) / 1000)) * 10) / 10,
      events: this.events.filter((e) => e.t >= from - 1).map((e) => ({ t: Math.round(((e.t - from) / 1000) * 1000) / 1000, label: e.label })),
    };
    if (gaps.length) tl.frame_gaps_over_120ms = gaps.slice(0, 40);
    log(name, `assembled ${tl.frames} frames, ${tl.seconds}s (captured ~${(frames.length / Math.max(1, fdur)).toFixed(1)} fps; gaps>120ms: ${gaps.length})`);
    // check frames: every second and at each event (and +0.1 s), a third size
    const chk = path.join(OUT, "check", name);
    rmSync(chk, { recursive: true, force: true });
    mkdirSync(chk, { recursive: true });
    const times = [];
    for (let s = 0; s < tl.seconds; s += 1) times.push([s, `t${String(s).padStart(3, "0")}`]);
    for (const e of tl.events) times.push([e.t, `e-${e.label}`], [e.t + 0.1, `e-${e.label}+0.1`]);
    for (const [s, nm] of times)
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", Math.max(0, Math.min(tl.seconds - 0.04, s)).toFixed(3), "-i", out, "-frames:v", "1", "-vf", "scale=260:-1", "-q:v", "5", path.join(chk, `${nm}.jpg`)]);
    return tl;
  }
  cleanup() {
    if (!opt.keep) rmSync(this.dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------------------------------------ shared steps
const SHOP_SC = ".no-scrollbar.flex-1.overflow-y-auto.pb-28";

/** Opens the Crave intro (fresh profile) scrolled to the craving form, so the intro's Shopping Lab card is off screen. */
async function openIntro(page) {
  await page.goto(BASE + "#/crave/pot", { waitUntil: "networkidle" }); // loads the Crave chunk first
  await sleep(600);
  await page.goto(BASE + "#/crave", { waitUntil: "networkidle" });
  await when(page, () => document.body.innerText.includes("I'm in, open the shop"));
  await page.evaluate(() => {
    for (const e of [document.scrollingElement, ...document.querySelectorAll("*")]) if (e && e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight;
  });
  await settle(page, 1200);
  const hits = await brandCheck(page);
  if (hits.length) throw new Error("brand text on screen before the take: " + JSON.stringify(hits));
  const inView = await page.evaluate(() => { const r = document.querySelector("#crave-q").getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; });
  if (!inView) throw new Error("craving input not in view");
}

/** Types the craving and opens the shop; records the build. Returns times and the shop facts. */
async function buildTake(page, rec, craving, { typeDelay = 85, browse = false } = {}) {
  await tap(page, page.locator("#crave-q"));
  await pause(250, 350);
  rec.mark("typing-start");
  await page.keyboard.type(craving, { delay: typeDelay });
  rec.mark("craving-typed");
  await pause(380, 480);
  const jSince = Math.floor(Date.now() / 1000) - 1;
  const submitted = rec.mark("submitted", await tap(page, page.getByRole("button", { name: "I'm in, open the shop" })));
  // the hunting screen names the shop as soon as its header has streamed in (after the app's 1.5 s minimum)
  const pFound = when(page, () => [...document.querySelectorAll("p")].some((p) => p.textContent === "Found a shop" && p.getClientRects().length), null, 90000).catch(() => null);
  // the shop screen itself (header + first products), fully faded in
  const pShop = when(page, () => {
    let e = document.querySelector('input[aria-label="Search this shop"]');
    if (!e) return false;
    for (; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.98) return false;
    return true;
  }, null, 90000);
  const shopOpen = await pShop;
  const found = await Promise.race([pFound, sleep(10).then(() => null)]);
  const firstPaint = found && found < shopOpen ? found : shopOpen;
  rec.mark("build-first-paint", firstPaint);
  if (found && found < shopOpen) rec.mark("found-shop", found);
  rec.mark("shop-open", shopOpen);
  // a person watching the shop fill in: slow scrolls down the grid while products are still streaming
  let building = true;
  const browsing = browse ? (async () => {
    await sleep(1800);
    while (building) {
      const st = await page.evaluate((sc) => { const e = document.querySelector(sc); return e ? { top: e.scrollTop, max: e.scrollHeight - e.clientHeight } : null; }, SHOP_SC).catch(() => null);
      if (!building || !st) break;
      if (st.max - st.top > 40) {
        rec.mark("browse-scroll");
        await scroll(page, SHOP_SC, { by: Math.min(300, st.max - st.top) }, 2000);
      }
      await sleep(1300);
    }
  })() : null;
  const firstPhoto = when(page, () => [...document.querySelectorAll(".no-scrollbar img")].some((i) => i.complete && i.naturalWidth > 0 && Number(getComputedStyle(i).opacity) > 0.98), null, 90000).catch(() => null);
  // complete: the stream has ended (no "Stocking the shelves", no skeleton rows) and every photo in view has loaded and faded in
  const complete = await when(page, () => {
    if (document.body.innerText.includes("Stocking the shelves")) return false;
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
    if ([...document.querySelectorAll(".skeleton")].some(vis)) return false;
    const imgs = [...document.querySelectorAll(".no-scrollbar img")].filter(vis);
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0 && Number(getComputedStyle(i).opacity) > 0.98);
  }, null, 120000);
  building = false;
  if (browsing) await browsing;
  const fp = await firstPhoto;
  if (fp) rec.mark("first-photo", fp);
  rec.mark("shop-visible", complete);
  const evs = await Promise.race([page.sse, sleep(20000).then(() => [])]);
  const done = evs.find((e) => e.type === "done");
  const err = evs.find((e) => e.type === "error" || e.type === "refused");
  const toast = await page.evaluate(() => document.body.innerText.match(/couldn't|could not|didn't open|try again|Too many/i)?.[0] ?? null);
  const info = {
    craving,
    build_seconds: Math.round((complete - submitted) / 100) / 10,
    first_paint_seconds: Math.round((firstPaint - submitted) / 100) / 10,
    shop_open_seconds: Math.round((shopOpen - submitted) / 100) / 10,
    server: done?.meta ?? null,
    error: err ?? null,
    toast,
  };
  if (!done) throw new Error("no done event: " + JSON.stringify(err ?? evs.slice(-2)));
  if (done.meta.cached && !opt.allowcache) throw new Error("the shop came from the cache: not a real build");
  info.shop = done.shop;
  // which model really answered: the server logs "[gemini] answered by <model>" only when the chain fell back
  await sleep(1500);
  try {
    const j = execFileSync("sudo", ["journalctl", "-u", "vara-prod", "--since", `@${jSince}`, "--no-pager", "-o", "cat"]).toString().split("\n").filter((l) => /\[gemini\]|\[crave\] \{/.test(l));
    const crave = j.filter((l) => l.startsWith("[crave] {")).map((l) => { try { return JSON.parse(l.slice(8)); } catch { return null; } }).filter((x) => x && x.chars === craving.length);
    const answered = j.filter((l) => l.includes("answered by")).map((l) => /answered by (\S+)/.exec(l)[1]);
    info.server_log = { lines: j.slice(0, 12), crave_log: crave.at(-1) ?? null };
    info.answered_by = answered.length ? answered : [String(crave.at(-1)?.model ?? done.meta.model).split(",")[0]];
    info.fallback = answered.length > 0 || j.some((l) => /HTTP \d{3}/.test(l));
  } catch (e) {
    info.server_log = { error: String(e.message).slice(0, 200) };
  }
  log(rec.name, "build", JSON.stringify({ ...info, shop: undefined }));
  return info;
}

function shopFacts(shop) {
  const products = shop.products ?? [];
  return {
    name: shop.shopName,
    tagline: shop.tagline,
    kind: shop.kind,
    brands: [...new Set(products.map((p) => p.brand))],
    products: products.length,
    photos: products.filter((p) => p.image).length,
    with_reviews: products.filter((p) => (p.reviews ?? []).length).length,
    review_count_example: products[0]?.reviewCount ?? null,
    rating: shop.rating,
    delivery_fee: shop.deliveryFee,
    free_delivery_from: shop.freeDeliveryFrom,
    brand_words_in_shop_json: scanText(JSON.stringify(shop)),
  };
}

// ------------------------------------------------------------------------------------------------ takes
const TAKES = {
  async hero() {
    const craving = "new sneakers";
    if (!opt.noretire) retire(craving);
    const { ctx, page } = await newPhone({ wallet: opt.nowallet ? "off" : "real" });
    await openIntro(page);
    const name = "crave-run" + TAG;
    const rec = new Recorder(page, name);
    await rec.start();
    let brandPoll = true;
    const brandHits = [];
    const poll = (async () => { while (brandPoll) { try { brandHits.push(...(await brandCheck(page))); } catch {} await sleep(120); } })();
    await sleep(900);
    const info = await buildTake(page, rec, craving, { browse: !opt.nobrowse });
    const shop = info.shop;
    if (!opt.nobrowse) {
      await sleep(700);
      rec.mark("back-to-top");
      await scroll(page, SHOP_SC, 0, 1500);
    }
    const fee = (sub) => (shop.freeDeliveryFrom > 0 && sub >= shop.freeDeliveryFrom ? 0 : shop.deliveryFee ?? 0);
    // the finished shop: a slow read down the grid
    await sleep(900);
    rec.mark("scroll-start");
    await scroll(page, SHOP_SC, { by: 470 }, 2200);
    await pause(900, 1000);
    await scroll(page, SHOP_SC, { by: 470 }, 2200);
    await pause(900, 1000);
    // pick the product: a card fully in view whose price plus delivery fits under the cap; else scroll back for one
    const pick = async () => page.evaluate(() => [...document.querySelectorAll(".grid > div")].map((d) => {
      const r = d.getBoundingClientRect();
      return { name: d.querySelector("p.line-clamp-2")?.textContent, top: r.top, bottom: r.bottom, x: r.x + r.width / 2, y: r.y + r.width * 0.45 };
    }));
    const ok = (p) => p.price + fee(p.price) <= PRICE_CAP && p.image && p.price >= 25;
    const okNames = new Set(shop.products.filter(ok).map((p) => p.name));
    if (!okNames.size) throw new Error("nothing affordable in the shop");
    let cards = (await pick()).filter((c) => okNames.has(c.name));
    const priceOf = (c) => shop.products.find((p) => p.name === c.name)?.price ?? 0;
    cards.sort((a, b) => priceOf(b) - priceOf(a));
    let card = cards.find((c) => c.top > 110 && c.bottom < 760);
    if (!card) {
      const any = cards[0];
      await scroll(page, SHOP_SC, { by: any.top - 200 }, 1400);
      await pause(500, 600);
      card = (await pick()).filter((c) => okNames.has(c.name)).sort((a, b) => priceOf(b) - priceOf(a)).find((c) => c.top > 110 && c.bottom < 760);
      if (!card) throw new Error("no affordable card in view");
    }
    const product = shop.products.find((p) => p.name === card.name);
    rec.mark("scroll-end");
    rec.mark("product-open", await tapXY(page, card.x, card.y));
    await when(page, () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Add to basket") && b.getBoundingClientRect().top < innerHeight));
    await sleep(1300);
    // read on: variants and the invented reviews
    const dlg = `[role=dialog][aria-label="${product.name.replace(/"/g, '\\"')}"] .no-scrollbar`;
    const rev = await page.evaluate((sel) => {
      const sc = document.querySelector(sel);
      const h = [...(sc?.querySelectorAll("p") ?? [])].find((p) => p.textContent.startsWith("Reviews"));
      return sc && h ? h.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 120 : null;
    }, dlg);
    if (rev != null) {
      await scroll(page, dlg, rev, 1500);
      rec.mark("product-reviews");
      await pause(1300, 1400);
    }
    rec.mark("added", await tap(page, page.getByRole("button", { name: /Add to basket/ }).last()));
    await when(page, () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("View basket")));
    await sleep(1100);
    rec.mark("basket", await tap(page, page.getByRole("button", { name: /View basket/ })));
    await sleep(1400);
    rec.mark("checkout", await tap(page, page.getByRole("button", { name: /^Checkout/ })));
    await sleep(1000);
    // down to the guard ("free until payday ... so this fits") and the Pay button
    const g = await page.evaluate((sc) => {
      const el = document.querySelector(sc);
      const p = [...el.querySelectorAll("p")].find((x) => x.textContent.includes("free until payday"));
      return p ? p.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 330 : "bottom";
    }, SHOP_SC);
    await scroll(page, SHOP_SC, g, 1400);
    const fits = await page.evaluate(() => [...document.querySelectorAll("p")].find((p) => p.textContent.includes("so this fits"))?.textContent ?? null);
    const over = await page.evaluate(() => document.body.innerText.includes("more than is free until payday"));
    const total = await page.evaluate(() => [...document.querySelectorAll("p")].find((p) => p.textContent.startsWith("Total"))?.textContent ?? null);
    rec.mark("payday-check");
    log("checkout", JSON.stringify({ fits, over, total }));
    if (!fits || over) throw new Error("the free-until-payday check did not pass: " + JSON.stringify({ fits, over, total }));
    await pause(1500, 1600);
    await tap(page, page.getByRole("button", { name: /^Pay / }).last());
    rec.mark("sheet-open", await when(page, () => {
      const d = document.querySelector('[role=dialog][aria-label="Confirm payment"]');
      return d && Math.abs(d.getBoundingClientRect().bottom - innerHeight) < 2;
    }));
    // the real wallet button (Stripe, test mode) if it renders: let it be read, never press it, then the simulated pay
    const wv = await when(page, () => {
      const d = document.querySelector('[role=dialog][aria-label="Confirm payment"]');
      const f = d?.querySelector("iframe");
      if (!(d && d.textContent.includes("Test payment · your card is not charged") && f && f.getBoundingClientRect().height >= 40)) { window.__wv = null; return false; }
      const top = Math.round(d.getBoundingClientRect().top);
      if (!window.__wv || window.__wv.top !== top) { window.__wv = { top, n: 0 }; return false; }
      return ++window.__wv.n >= 4; // the sheet has settled with the button in place
    }, null, 9000).catch(() => null);
    let walletShown = false;
    let walletBox = null;
    if (wv) {
      walletShown = true;
      walletBox = await page.evaluate(() => { const r = document.querySelector('[role=dialog][aria-label="Confirm payment"] iframe').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      rec.mark("wallet-ready-dom", wv);
      await sleep(1700);
      rec.mark("simulated-pay-link", await tap(page, page.getByRole("button", { name: "Or use the simulated pay" })));
      rec.mark("sim-sheet", await when(page, () => [...document.querySelectorAll("[role=dialog] button")].some((b) => b.getAttribute("aria-label") === "Double-click to pay" && Number(getComputedStyle(b.parentElement).opacity) > 0.98)));
      await sleep(1500);
    } else {
      log("no wallet button rendered");
      await sleep(1900);
    }
    const pb = await boxOf(page.getByRole("button", { name: "Double-click to pay" }));
    await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 6 });
    await page.mouse.down(); await sleep(70); await page.mouse.up();
    rec.mark("pay-tap-1");
    await sleep(110);
    await page.mouse.down(); await sleep(70); await page.mouse.up();
    rec.mark("pay-tap", Date.now()); // the second click confirms
    rec.mark("scan", await when(page, () => [...document.querySelectorAll("[role=dialog] span")].some((e) => e.textContent === "Confirming…")));
    rec.mark("processing", await when(page, () => [...document.querySelectorAll("[role=dialog] span")].some((e) => e.textContent === "Processing")));
    rec.mark("tick", await when(page, () => [...document.querySelectorAll("[role=dialog] span")].some((e) => e.textContent === "Done")));
    rec.mark("reveal", await when(page, () => document.body.innerText.includes("Order confirmed!"), null, 10000));
    const twist = rec.mark("twist", await when(page, () => document.body.innerText.includes("Nothing is on its way."), null, 10000));
    rec.mark("coins", twist + 1300); // Reveal.tsx: the pot lands and sfx.coin() plays 1.3 s after the twist
    await sleep(4200);
    const inboxBtn = page.getByRole("button", { name: /^Inbox/ });
    const ib = await boxOf(inboxBtn);
    if (ib.y + ib.height > 830) {
      await scroll(page, null, "bottom", 1000);
      await pause(400, 500);
    }
    await page.evaluate(() => history.replaceState({ varaDepth: -1 }, "", location.href));
    rec.mark("inbox", await tap(page, inboxBtn));
    await when(page, () => document.body.innerText.includes("Order emails from Crave mode land here"));
    await sleep(3300);
    rec.mark("pot", await tap(page, page.getByRole("button", { name: "Back" }).first()));
    await when(page, () => document.body.textContent.includes("Crave pot · savings"));
    await sleep(1600);
    await scroll(page, null, 420, 1100);
    await sleep(1100);
    brandPoll = false;
    await poll;
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem("vara.state.v1") || "{}"));
    const entries = (st.byCustomer?.[st.customerId]?.cravings ?? []).map((c) => ({ shop: c.shopName, total: c.basketTotal, amount: c.amount, items: c.items }));
    await rec.stop(1000);
    const tl = rec.assemble();
    if (walletBox) {
      // the first frame in which the wallet button is actually painted (it is a dark button): mean luma of its box
      const ev = (l) => tl.events.find((e) => e.label === l)?.t;
      const a = ev("sheet-open"), b = ev("simulated-pay-link");
      const crop = `crop=${Math.round(walletBox.w * 2 * 0.6)}:${Math.round(walletBox.h * 2 * 0.5)}:${Math.round((walletBox.x + walletBox.w * 0.2) * 2)}:${Math.round((walletBox.y + walletBox.h * 0.25) * 2)}`;
      const r = spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(OUT, "live", `${name}.mp4`), "-vf", `trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},${crop},signalstats,metadata=print:key=lavfi.signalstats.YAVG`, "-f", "null", "-"], { encoding: "utf8" });
      const pts = [...r.stderr.matchAll(/pts_time:([\d.]+)[\s\S]*?YAVG=([\d.]+)/g)].map((m) => ({ t: Number(m[1]), y: Number(m[2]) }));
      const hit = pts.find((p) => p.y < 60);
      log("wallet luma", JSON.stringify(pts.filter((_, i) => i % 3 === 0).map((p) => [p.t.toFixed(2), Math.round(p.y)])));
      if (hit) tl.events.push({ t: Math.round(hit.t * 1000) / 1000, label: "wallet-visible" });
      tl.events.sort((x, y) => x.t - y.t);
    }
    rec.cleanup();
    const res = {
      ...tl,
      craving,
      build: { ...info, shop: undefined },
      shop: { ...shopFacts(shop), product: product.name, product_brand: product.brand, price: product.price, checkout_total: total, payday_check: fits, wallet_button_shown: walletShown },
      pot_entries: entries,
      brand_hits_in_viewport: [...new Set(brandHits)],
      page_messages: [...new Set(page.errors)],
    };
    writeFileSync(path.join(OUT, "logs", `${name}.shop.json`), JSON.stringify(shop, null, 2));
    writeFileSync(path.join(OUT, "timeline", `${name}.json`), JSON.stringify(res, null, 2));
    log(name, "done", JSON.stringify({ seconds: res.seconds, shop: res.shop, brand: res.brand_hits_in_viewport, msgs: res.page_messages }));
    await ctx.close();
    return res;
  },
};

// montage: a fresh shop built and its front page scrolled slowly
for (const [key, craving] of [["sushi", "sushi tonight"], ["headphones", opt.hpq ?? "wireless headphones"], ["coat", "a winter coat"]]) {
  TAKES[key] = async () => {
    if (!opt.noretire) retire(craving);
    const { ctx, page } = await newPhone();
    await openIntro(page);
    const name = "shop-" + key + TAG;
    const rec = new Recorder(page, name);
    await rec.start();
    let brandPoll = true;
    const brandHits = [];
    const poll = (async () => { while (brandPoll) { try { brandHits.push(...(await brandCheck(page))); } catch {} await sleep(120); } })();
    await sleep(700);
    const info = await buildTake(page, rec, craving, { typeDelay: 70 });
    await sleep(500);
    rec.mark("scroll-start");
    await scroll(page, SHOP_SC, { by: 640 }, 3600);
    rec.mark("scroll-end");
    brandPoll = false;
    await poll;
    await rec.stop(700);
    const full = rec.assemble(name + "-full");
    // the montage clip itself: from 0.3 s before the first paint of the shop to the end of the scroll
    const fp = rec.events.find((e) => e.label === "build-first-paint").t;
    const tl = rec.assemble(name, fp - 300);
    rec.cleanup();
    const res = { ...tl, craving, full: { file: full.file, seconds: full.seconds, events: full.events }, build: { ...info, shop: undefined }, shop: shopFacts(info.shop), brand_hits_in_viewport: [...new Set(brandHits)], page_messages: [...new Set(page.errors)] };
    writeFileSync(path.join(OUT, "logs", `${name}.shop.json`), JSON.stringify(info.shop, null, 2));
    writeFileSync(path.join(OUT, "timeline", `${name}.json`), JSON.stringify(res, null, 2));
    log(name, "done", JSON.stringify({ seconds: res.seconds, build: res.build, shop: res.shop, brand: res.brand_hits_in_viewport, msgs: res.page_messages }));
    await ctx.close();
    return res;
  };
}

const only = (opt.only ?? "hero,sushi,headphones,coat").split(",").filter(Boolean);
browser = await chromium.launch({ args: opt.isolate ? [] : ["--disable-features=IsolateOrigins,site-per-process", "--disable-site-isolation-trials"] });
let failed = 0;
for (const name of only) {
  const fn = TAKES[name];
  if (!fn) throw new Error("unknown take " + name);
  if (name !== only[0] && opt.gap) await sleep(Number(opt.gap) * 1000); // space builds out (shared model quota)
  log("=== " + name);
  try {
    await fn();
  } catch (e) {
    failed++;
    log(name, "FAILED", e.stack?.split("\n").slice(0, 4).join("\n"));
  }
}
await browser.close();
if (moved.length) writeFileSync(path.join(OUT, "logs", `retired-${Date.now()}.json`), JSON.stringify(moved, null, 2));
process.exit(failed ? 1 : 0);
