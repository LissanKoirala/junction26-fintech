// Render every slide (or --only s05-chat,s08-crave-live) to its own numbered 1920×1080 30 fps MP4, plus a PNG of its last frame.
// Also renders the demo-only extras (src/deck.ts `extras`, e.g. d04-meet) to un-numbered files.
//   node scripts/render-all.mjs [--only id,id] [--out <dir>] [--concurrency 16]
//   node scripts/render-all.mjs --only s05-chat --frames 30,120,899     (PNG stills of those frames only: quick layout checks;
//                                                                         a negative number counts from the end, -1 = last frame)
// Output goes to <out>/videos and <out>/stills. Default <out> is ~/vidout, outside the synced working copy.
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const only = arg("--only", "")?.split(",").filter(Boolean) ?? [];
const frames = arg("--frames", "")?.split(",").filter(Boolean).map(Number) ?? [];
const concurrency = Number(arg("--concurrency", Math.max(1, Math.min(16, os.cpus().length - 2))));
const out = path.resolve(arg("--out", path.join(os.homedir(), "vidout")));
const outDir = path.join(out, "videos"), stillDir = path.join(out, "stills");
fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(stillDir, { recursive: true });

console.log("Bundling…");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
// Compositions are registered in presentation order (src/deck.ts); the number comes from that order.
// The 14 slides have ids "sNN-…" and get a number (01-s01-opening.mp4); extras such as the demo's "d04-meet"
// are rendered under their id alone (d04-meet.mp4), so they never join the numbered 14.
const comps = await getCompositions(serveUrl);
const numbered = comps.filter(c => /^s\d\d-/.test(c.id));
for (const composition of comps) {
  const s = { id: composition.id, n: numbered.indexOf(composition) + 1 };
  if (only.length && !only.includes(s.id)) continue;
  const stem = s.n > 0 ? `${String(s.n).padStart(2, "0")}-${s.id}` : s.id;
  if (frames.length) {
    for (const f of frames) {
      const frame = f < 0 ? composition.durationInFrames + f : Math.min(f, composition.durationInFrames - 1);
      await renderStill({ composition, serveUrl, output: path.join(stillDir, `${stem}-f${String(frame).padStart(4, "0")}.png`), frame });
    }
    console.log(`${stem}: stills at ${frames.join(", ")}`);
    continue;
  }
  const file = path.join(outDir, `${stem}.mp4`);
  const t0 = Date.now(); let last = 0;
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 17, pixelFormat: "yuv420p", audioCodec: "aac", audioBitrate: "192k", enforceAudioTrack: true, outputLocation: file, concurrency, imageFormat: "jpeg", jpegQuality: 95, x264Preset: "slow",
    onProgress: ({ progress }) => { const p = Math.floor(progress * 4); if (p > last) { last = p; process.stdout.write(`${s.id} ${p * 25}%\n`); } } });
  await renderStill({ composition, serveUrl, output: path.join(stillDir, `${stem}-final.png`), frame: composition.durationInFrames - 1 });
  console.log(`${path.basename(file)}  ${composition.durationInFrames} frames  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
