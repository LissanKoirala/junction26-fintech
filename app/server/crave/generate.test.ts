// Crave shop generator: a cut-off or stalled stream is retried (never a header-only shop), and real brands and
// product lines never reach a product. The model is replaced by scripted streams.
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.VARA_CRAVE_STALL_MS = "300";

const scripts: { text: string; hang?: boolean }[] = [];
const calls: string[] = [];
vi.mock("../llm", () => ({
  CRAVE_DEFAULT_MODEL: "gemini-a,gemini-b",
  streamMessage: (params: { model: string }, opts: { signal: AbortSignal }) => {
    calls.push(params.model);
    const s = scripts.shift() ?? { text: "" };
    async function* run() {
      // stream in small pieces, like the API
      for (let i = 0; i < s.text.length; i += 40) yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: s.text.slice(i, i + 40) } };
      if (s.hang) await new Promise((_, rej) => opts.signal.addEventListener("abort", () => rej(new Error("aborted")), { once: true }));
    }
    const it = run();
    return { [Symbol.asyncIterator]: () => it, finalMessage: async () => ({ stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) };
  },
}));

const { generateShop, scrubProduct, MIN_PRODUCTS } = await import("./generate");

const header = { refused: false, refusalMessage: "", kind: "store", category: "Fashion", shopName: "Lumo Steps", tagline: "Light shoes", accent: "teal", icon: "bag" };
const product = (i: number, name = `Kivi Runner ${i}`, brand = "Lumo") => ({ id: `p${i}`, section: "Sneakers", brand, name, pitch: "Light and soft", price: 89, compareAtPrice: null, rating: 4.5, reviewCount: 120, badge: "", stockLeft: null, tags: ["Light"], imagePrompt: "white sneaker" });
const shopJson = (n: number, mk = product) => JSON.stringify({ ...header, products: Array.from({ length: n }, (_, i) => mk(i + 1)), alsoBought: [], deliveryPromise: "Free delivery tomorrow", etaMinutes: 0, rating: 4.6, reviewCount: 900, deliveryFee: 4.9, freeDeliveryFrom: 49 });
const headerOnly = JSON.stringify({ ...header, products: [] }).replace(/\]\}$/, "]");

async function build() {
  const got: { header: number; products: string[] } = { header: 0, products: [] };
  const res = await generateShop("new sneakers", { onHeader: () => got.header++, onProduct: (p) => got.products.push(p.name) }, new AbortController().signal);
  return { res, got };
}

describe("generateShop", () => {
  beforeEach(() => {
    scripts.length = 0;
    calls.length = 0;
  });

  it("retries a header-only stream and keeps the header shown once", async () => {
    scripts.push({ text: headerOnly }, { text: shopJson(10) });
    const { res, got } = await build();
    expect(calls).toEqual(["gemini-a,gemini-b", "gemini-a,gemini-b"]);
    expect(got.header).toBe(1);
    expect(res.products.length).toBe(10);
    expect(res.header?.shopName).toBe("Lumo Steps");
  });

  it("retries a stream that stalls after the header, then moves down the chain", async () => {
    scripts.push({ text: headerOnly, hang: true }, { text: headerOnly, hang: true }, { text: shopJson(10) });
    const { res } = await build();
    expect(calls).toEqual(["gemini-a,gemini-b", "gemini-a,gemini-b", "gemini-b"]);
    expect(res.products.length).toBe(10);
  });

  it("returns fewer than MIN_PRODUCTS when every attempt is cut off (the route then shows an error)", async () => {
    scripts.push({ text: headerOnly }, { text: headerOnly }, { text: headerOnly });
    const { res } = await build();
    expect(res.products.length).toBeLessThan(MIN_PRODUCTS);
  });

  it("never sends a real brand or product line", async () => {
    scripts.push({ text: shopJson(10, (i) => product(i, i === 1 ? "Cloudfoam Strider" : i === 2 ? "Air Max" : `Kivi ${i}`, i === 3 ? "Adidas" : "Lumo")) });
    const { res, got } = await build();
    const all = JSON.stringify(res.products) + got.products.join(" ");
    expect(all).not.toMatch(/Cloudfoam|Air Max|Adidas/i);
    expect(got.products).toContain("Strider");
    expect(res.products.length).toBe(9); // "Air Max" alone leaves no name: dropped
  });

  it("scrubProduct keeps clean products as they are", () => {
    const p = { ...product(1), id: "p1", variants: [], addOns: [], reviews: [] } as never;
    expect(scrubProduct(p, "Lumo Steps")).toBe(p);
  });
});
