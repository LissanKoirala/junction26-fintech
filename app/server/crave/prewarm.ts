// Pre-generate and cache the demo shops, or benchmark models.
//   npx tsx server/crave/prewarm.ts                       -> caches the demo cravings (skips ones already cached)
//   npx tsx server/crave/prewarm.ts --force sushi         -> regenerates one
//   npx tsx server/crave/prewarm.ts --lang=fi             -> caches the Finnish demo cravings
//   npx tsx server/crave/prewarm.ts --bench=gemini-3.5-flash-lite,gemini-3.6-flash "sushi" "over-ear headphones"
//   (model ids of the active provider, LLM_PROVIDER; a Gemini id may be a comma-separated fallback chain)
import { generateShop } from "./generate";
import { buildShop, loadCachedShop } from "./route";

import type { Lang } from "../../shared/i18n";

export const DEMO_CRAVINGS: Record<Lang, string[]> = { en: ["sushi", "over-ear headphones", "new sneakers"], fi: ["sushi", "sankakuulokkeet", "uudet lenkkarit"] };

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")).map(([k, v]) => [k, v ?? "1"]));
const list = args.filter((a) => !a.startsWith("--"));
const lang: Lang = flags.lang === "fi" ? "fi" : "en";

if (flags.bench) {
  for (const model of flags.bench.split(",")) {
    for (const craving of list.length ? list : DEMO_CRAVINGS[lang]) {
      const t0 = Date.now();
      let header = 0, first = 0, n = 0;
      try {
        const r = await generateShop(craving, { onHeader: () => (header ||= Date.now() - t0), onProduct: () => { n++; first ||= Date.now() - t0; } }, new AbortController().signal, model, lang);
        console.log(JSON.stringify({ model, craving, ttft: r.ttftMs, headerMs: header, firstProductMs: first, totalMs: Date.now() - t0, products: n, refused: r.refused, usage: r.usage, shop: r.header?.shopName, kind: r.header?.kind, sample: r.products.slice(0, 3).map((p) => `${p.brand} ${p.name} ${p.price}`) }));
      } catch (e) {
        console.log(JSON.stringify({ model, craving, error: (e as Error).message.slice(0, 300) }));
      }
    }
  }
} else {
  for (const craving of list.length ? list : DEMO_CRAVINGS[lang]) {
    if (!flags.force && (await loadCachedShop(craving, lang))) {
      console.log(`cached already: ${craving}`);
      continue;
    }
    const { shop, log } = await buildShop(craving, () => {}, new AbortController().signal, undefined, lang);
    console.log(JSON.stringify({ lang, craving, ok: !!shop, shop: shop?.shopName, kind: shop?.kind, imagesOk: shop?.products.filter((p) => p.image).length, ...log }));
  }
}
