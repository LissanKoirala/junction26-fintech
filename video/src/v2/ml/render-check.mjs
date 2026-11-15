// Check renders for the ML visuals (run on the VM from ~/proj/video): node src/v2/ml/render-check.mjs <id,...> [video]
// Stills at 0, 1/3, 2/3, end (plus extra fractions) into ~/vidout/viz/; with "video", an MP4 per visual too.
import path from "node:path";
import os from "node:os";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
const out = path.join(os.homedir(), "vidout/viz");
const [ids = "", mode = ""] = process.argv.slice(2);
const want = ids.split(",").filter(Boolean);
const serveUrl = await bundle({ entryPoint: path.resolve("src/v2/ml/preview.tsx"), publicDir: path.resolve("public") });
const comps = await getCompositions(serveUrl);
for (const c of comps) {
  if (want.length && !want.includes(c.id)) continue;
  const fr = [0, 0.15, 0.33, 0.5, 0.6, 0.67, 0.8, 1].map(x => Math.round(x * (c.durationInFrames - 1)));
  if (mode !== "videoonly") for (const f of fr) await renderStill({ composition: c, serveUrl, frame: f, output: path.join(out, `${c.id}-${String(f).padStart(3, "0")}.png`) });
  if (mode.startsWith("video")) await renderMedia({ composition: c, serveUrl, codec: "h264", crf: 20, outputLocation: path.join(out, `${c.id}.mp4`) });
  console.log("done", c.id);
}
