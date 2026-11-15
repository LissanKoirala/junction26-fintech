// Version 2: renders the continuous compositions demo-v2 and pitch-v2 (src/v2, video/V2.md).
//   node scripts/render-v2.mjs [--only demo-v2,pitch-v2] [--out ~/vidout/v2] [--concurrency 24]
//   node scripts/render-v2.mjs --only demo-v2 --frames 30,240,-1        PNG stills of those frames (quick checks)
//   node scripts/render-v2.mjs --only demo-v2 --at 1.5,12.25            PNG stills at those seconds
// Every run also writes <out>/<id>-plan.json: scene starts and lengths, sentence times in video seconds, the beats.
//   node scripts/render-v2.mjs --only demo-v2 --stem vo                   audio only, one stem (vo | music | sfx) to <out>/raw/<id>-<stem>.wav
// Videos go to <out>/raw/<id>.mp4 (then scripts/finish-v2.sh <out>), stills to <out>/stills. Never write under ~/proj.
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const only = (arg("--only", "demo-v2,pitch-v2") ?? "").split(",").filter(Boolean);
const frames = (arg("--frames", "") ?? "").split(",").filter(Boolean).map(Number);
const ats = (arg("--at", "") ?? "").split(",").filter(Boolean).map(Number);
const stem = arg("--stem", "");
const inputProps = stem ? { stem } : {};
const concurrency = Number(arg("--concurrency", Math.max(1, Math.min(28, os.cpus().length - 2))));
const out = path.resolve(arg("--out", path.join(os.homedir(), "vidout/v2")));
if (out.startsWith(path.join(os.homedir(), "proj"))) throw new Error("render output must not be under ~/proj (bin/vm deletes it)");
const rawDir = path.join(out, "raw"), stillDir = path.join(out, "stills");
fs.mkdirSync(rawDir, { recursive: true }); fs.mkdirSync(stillDir, { recursive: true });

console.log("Bundling…");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const comps = await getCompositions(serveUrl, { inputProps });
for (const id of only) {
  const composition = comps.find(c => c.id === id);
  if (!composition) throw new Error(`no composition ${id}`);
  fs.writeFileSync(path.join(out, `${id}-plan.json`), JSON.stringify(composition.props.plan ?? composition.defaultProps?.plan, null, 1));
  const list = [...frames.map(f => f < 0 ? composition.durationInFrames + f : f), ...ats.map(s => Math.round(s * 30))];
  if (list.length) {
    await Promise.all(list.map(async frame => {
      frame = Math.max(0, Math.min(frame, composition.durationInFrames - 1));
      await renderStill({ composition, serveUrl, output: path.join(stillDir, `${id}-f${String(frame).padStart(5, "0")}.png`), frame });
    }));
    console.log(`${id}: stills at ${list.join(", ")}`);
    continue;
  }
  if (stem) {
    const wav = path.join(rawDir, `${id}-${stem}.wav`);
    await renderMedia({ composition, serveUrl, codec: "wav", inputProps, outputLocation: wav, concurrency });
    console.log(path.basename(wav)); continue;
  }
  const file = path.join(rawDir, `${id}.mp4`);
  const t0 = Date.now(); let last = 0;
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 18, pixelFormat: "yuv420p", audioCodec: "aac", audioBitrate: "256k", enforceAudioTrack: true,
    outputLocation: file, concurrency, imageFormat: "jpeg", jpegQuality: 92, x264Preset: "medium",
    onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p > last) { last = p; process.stdout.write(`${id} ${p * 10}%\n`); } } });
  console.log(`${path.basename(file)}  ${composition.durationInFrames} frames (${(composition.durationInFrames / 30).toFixed(2)} s)  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
