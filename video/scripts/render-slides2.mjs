// Slides v2 (video/SLIDES2.md): renders every slide in src/slides2 to its own numbered 1920×1080 30 fps MP4 (h264 + AAC,
// narration baked in), a PNG of its last frame and of a mid-build frame, then joins them into one MP4 and makes contact sheets.
//   node scripts/render-slides2.mjs [--only v07-built-live,v10-plot-twist] [--out ~/vidout/slides2] [--concurrency 24]
//   node scripts/render-slides2.mjs --stills [--at 0.45]       stills only (last frame + the frame at 45 % of each slide)
//   node scripts/render-slides2.mjs --join                     only re-join existing videos and rebuild the sheets
// Output: <out>/videos/NN-id.mp4, <out>/stills/NN-id-{mid,final}.png, <out>/vara-slides.mp4, <out>/sheet-{final,mid}.jpg,
// <out>/manifest.json. Never under ~/proj (bin/vm deletes it).
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes(k);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.resolve(arg("--out", path.join(os.homedir(), "vidout/slides2")));
if (out.startsWith(path.join(os.homedir(), "proj"))) throw new Error("output must not be under ~/proj");
const only = (arg("--only", "") ?? "").split(",").filter(Boolean);
const midAt = Number(arg("--at", "0.45"));
const concurrency = Number(arg("--concurrency", Math.max(1, Math.min(28, os.cpus().length - 2))));
const vids = path.join(out, "videos"), stills = path.join(out, "stills");
fs.mkdirSync(vids, { recursive: true }); fs.mkdirSync(stills, { recursive: true });

const ff = (...a) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...a], { stdio: "inherit" });
function join() {
  const files = fs.readdirSync(vids).filter(f => /^\d\d-.*\.mp4$/.test(f)).sort();
  fs.writeFileSync(path.join(out, "concat.txt"), files.map(f => `file '${path.join(vids, f)}'`).join("\n") + "\n");
  if (files.length && !has("--stills")) ff("-f", "concat", "-safe", "0", "-i", path.join(out, "concat.txt"), "-c", "copy", "-movflags", "+faststart", path.join(out, "vara-slides.mp4"));
  for (const kind of ["final", "mid"]) {
    const imgs = fs.readdirSync(stills).filter(f => f.endsWith(`-${kind}.png`)).sort();
    if (!imgs.length) continue;
    const inputs = imgs.flatMap(f => ["-i", path.join(stills, f)]);
    const n = imgs.length, cols = 3, rows = Math.ceil(n / cols);
    const lay = imgs.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join("|");
    const scaled = imgs.map((_, i) => `[${i}:v]scale=640:360,drawtext=text='${String(i + 1).padStart(2, "0")}':x=8:y=8:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6[s${i}]`).join(";");
    ff(...inputs, "-filter_complex", `${scaled};${imgs.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${n}:layout=${lay}:fill=black[o]`, "-map", "[o]", "-frames:v", "1", "-q:v", "4",
      path.join(out, `sheet-${kind}.jpg`));
    void rows;
  }
  console.log(`joined ${files.length} clips → vara-slides.mp4; sheets written`);
}
if (has("--join")) { join(); process.exit(0); }
if (has("--jpeg")) {   // the PowerPoint stills: last frame of every slide, clean, JPEG q85, to <dir>
  const dir = path.resolve(arg("--jpeg", path.join(os.homedir(), "vidout/slides/jpg")));
  fs.mkdirSync(dir, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(root, "src/slides2/index.tsx"), publicDir: path.join(root, "public") });
  const inputProps = { clean: true };
  const comps = (await getCompositions(serveUrl, { inputProps })).filter(c => /^v\d\d-/.test(c.id));
  await Promise.all(comps.map((composition, i) => renderStill({ composition, serveUrl, inputProps, frame: composition.durationInFrames - 1, imageFormat: "jpeg", jpegQuality: 85,
    output: path.join(dir, `${String(i + 1).padStart(2, "0")}-${composition.id}.jpg`) })));
  console.log(`${comps.length} JPEGs in ${dir}`); process.exit(0);
}

console.log("Bundling…");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/slides2/index.tsx"), publicDir: path.join(root, "public") });
const comps = await getCompositions(serveUrl);
const man = comps.find(c => c.id === "slides2-manifest");
const manifest = man?.defaultProps?.manifest ?? man?.props?.manifest;
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 1));
const slides = comps.filter(c => /^v\d\d-/.test(c.id));
let total = 0;
for (const [i, composition] of slides.entries()) {
  const stem = `${String(i + 1).padStart(2, "0")}-${composition.id}`;
  total += composition.durationInFrames / 30;
  if (only.length && !only.includes(composition.id)) continue;
  const last = composition.durationInFrames - 1, mid = Math.round(last * midAt);
  await renderStill({ composition, serveUrl, frame: last, output: path.join(stills, `${stem}-final.png`) });
  await renderStill({ composition, serveUrl, frame: mid, output: path.join(stills, `${stem}-mid.png`) });
  if (has("--stills")) { console.log(`${stem}: stills`); continue; }
  const t0 = Date.now();
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 17, pixelFormat: "yuv420p", audioCodec: "aac", audioBitrate: "192k", enforceAudioTrack: true,
    outputLocation: path.join(vids, `${stem}.mp4`), concurrency, imageFormat: "jpeg", jpegQuality: 93, x264Preset: "medium" });
  console.log(`${stem}.mp4  ${(composition.durationInFrames / 30).toFixed(2)} s  rendered in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log(`total ${total.toFixed(1)} s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")})`);
if (!has("--stills") && !only.length) join();
else if (has("--stills")) join();
