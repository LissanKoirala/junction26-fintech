// Product photos for Crave shops via Runware's image inference API (REST). Each image is downloaded once and
// cached on disk under DATA_DIR/cache/crave/img/<hash>.jpg, then served by /api/crave/img/:file, so repeats
// are instant and the demo works offline from cache. Only the generic product prompt is sent out.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "../data";
import type { ShopKind } from "../../shared/crave";

export const IMAGE_MODEL = process.env.CRAVE_IMAGE_MODEL ?? "bfl:flux@3-image-klein";
export const CRAVE_DIR = path.join(DATA_DIR, "cache", "crave");
export const IMG_DIR = path.join(CRAVE_DIR, "img");
const IMAGE_TIMEOUT_MS = 15_000;
const DAILY_IMAGE_CAP = Number(process.env.CRAVE_IMAGE_DAILY_CAP ?? 4000);

let usage = { day: "", images: 0, cost: 0 };
const usageFile = path.join(CRAVE_DIR, "image-usage.json");
let loaded = false;
async function takeImageBudget(): Promise<boolean> {
  if (!loaded) {
    loaded = true;
    try {
      usage = JSON.parse(await readFile(usageFile, "utf8"));
    } catch {
      /* first run */
    }
  }
  const day = new Date().toISOString().slice(0, 10); // operational budget: real clock on purpose
  if (usage.day !== day) usage = { day, images: 0, cost: 0 };
  if (usage.images >= DAILY_IMAGE_CAP) return false;
  usage.images++;
  return true;
}
async function saveUsage() {
  try {
    await mkdir(CRAVE_DIR, { recursive: true });
    await writeFile(usageFile, JSON.stringify(usage));
  } catch {
    /* best effort */
  }
}
export const imageUsage = () => ({ ...usage, cap: DAILY_IMAGE_CAP });

export function fullPrompt(kind: ShopKind, p: string): string {
  const subject = p.replace(/[^\p{L}\p{N}\s,.'-]/gu, " ").slice(0, 220);
  return kind === "food"
    ? `Appetising food photography of ${subject}, served on a simple ceramic plate on a light wooden table, soft natural daylight, shallow depth of field, close-up, fresh and delicious. No text, no logos, no packaging labels, no people, no hands.`
    : `Clean studio product photo of ${subject}, a plain unbranded generic design with blank unmarked surfaces, centered on a seamless soft pastel background, soft shadow, premium e-commerce catalogue shot, high detail. No text, no lettering, no logos, no emblems, no brand stripes or side markings, no people, no hands.`;
}

const imgHash = (prompt: string) => createHash("sha1").update(IMAGE_MODEL + "|" + prompt).digest("hex").slice(0, 20);

/** Returns a local URL for the product image, generating it if needed; null if it failed or timed out. */
export async function productImage(kind: ShopKind, imagePrompt: string): Promise<{ url: string | null; cost: number; ms: number; cached: boolean }> {
  const t0 = Date.now();
  const prompt = fullPrompt(kind, imagePrompt);
  const h = imgHash(prompt);
  const file = path.join(IMG_DIR, `${h}.jpg`);
  try {
    await stat(file);
    return { url: `/api/crave/img/${h}.jpg`, cost: 0, ms: Date.now() - t0, cached: true };
  } catch {
    /* not cached */
  }
  const key = process.env.RUNWARE_API_KEY;
  if (!key || !(await takeImageBudget())) return { url: null, cost: 0, ms: 0, cached: false };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), IMAGE_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        { taskType: "imageInference", taskUUID: randomUUID(), model: IMAGE_MODEL, positivePrompt: prompt, width: 512, height: 512, outputType: "URL", outputFormat: "JPG", numberResults: 1, includeCost: true },
      ]),
      signal: ac.signal,
    });
    if (!res.ok) {
      console.warn(`[crave] image HTTP ${res.status}`);
      return { url: null, cost: 0, ms: Date.now() - t0, cached: false };
    }
    const j = (await res.json()) as { data?: { imageURL?: string; cost?: number }[]; errors?: unknown[] };
    const d = j.data?.[0];
    if (!d?.imageURL) {
      console.warn("[crave] image: no URL in response");
      return { url: null, cost: 0, ms: Date.now() - t0, cached: false };
    }
    const img = await fetch(d.imageURL, { signal: ac.signal });
    if (!img.ok) return { url: null, cost: d.cost ?? 0, ms: Date.now() - t0, cached: false };
    await mkdir(IMG_DIR, { recursive: true });
    await writeFile(file, Buffer.from(await img.arrayBuffer()));
    usage.cost = Math.round((usage.cost + (d.cost ?? 0)) * 10000) / 10000;
    void saveUsage();
    return { url: `/api/crave/img/${h}.jpg`, cost: d.cost ?? 0, ms: Date.now() - t0, cached: false };
  } catch (err) {
    console.warn(`[crave] image failed: ${(err as Error).name}`);
    return { url: null, cost: 0, ms: Date.now() - t0, cached: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function readImage(file: string): Promise<Buffer | null> {
  if (!/^[0-9a-f]{20}\.jpg$/.test(file)) return null;
  try {
    return await readFile(path.join(IMG_DIR, file));
  } catch {
    return null;
  }
}
