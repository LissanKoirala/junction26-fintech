"use client";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Clock3, Globe2, RotateCcw, ShieldCheck, X } from "lucide-react";
import type { ImportResult, ImportedShop, Product } from "@/lib/shop-contract";

export type ImportSnapshot = Omit<ImportResult, "status" | "products" | "message"> & { shop: ImportedShop; productIds: string[] };
export type ImportProgress = { phase: "loading" | "error"; query: string; startedAt: number; elapsed: number; message?: string };
export function safeUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4000) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
const text = (value: unknown, cap = 300) => typeof value === "string" && value.length > 0 && value.length <= cap;
export function validImportedProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const p = value as Product;
  return p.store === "generic" && text(p.id, 200) && text(p.name, 400) && text(p.merchantName, 200) && typeof p.brand === "string" && p.brand.length < 300 && text(p.category, 200) && typeof p.description === "string" && p.description.length <= 5000 && Number.isInteger(p.price) && p.price > 0 && p.price < 100000000 && (!p.currency || p.currency === "EUR") && safeUrl(p.sourceUrl) && typeof p.image === "string" && p.image.length <= 4000 && ((p.image.startsWith("/") && !p.image.startsWith("//") && !p.image.includes("\\")) || safeUrl(p.image)) && Number.isFinite(Date.parse(p.fetchedAt)) && ["snapshot", "from", "estimate"].includes(p.priceKind) && Array.isArray(p.sizes) && p.sizes.length <= 50 && p.sizes.every(v => text(v, 100)) && (!p.colors || (Array.isArray(p.colors) && p.colors.length <= 50 && p.colors.every(v => text(v, 100)))) && (!p.priceNote || (typeof p.priceNote === "string" && p.priceNote.length <= 1000));
}
export function validSnapshot(value: unknown): value is ImportSnapshot {
  if (!value || typeof value !== "object") return false;
  const x = value as ImportSnapshot;
  return !!x.shop && text(x.shop.key, 300) && text(x.shop.name, 200) && text(x.shop.domain, 300) && safeUrl(x.shop.url) && Number.isFinite(Date.parse(x.shop.fetchedAt)) && Number.isFinite(Date.parse(x.shop.expiresAt)) && Array.isArray(x.productIds) && x.productIds.length > 0 && x.productIds.length <= 24 && x.productIds.every(id => text(id, 200)) && typeof x.cached === "boolean" && Number.isFinite(x.elapsedMs) && Array.isArray(x.warnings) && x.warnings.length <= 30 && x.warnings.every(w => text(w, 2000)) && !!x.provenance && ["direct", "search", "mixed"].includes(x.provenance.method) && Array.isArray(x.provenance.sources) && x.provenance.sources.length <= 50 && x.provenance.sources.every(s => text(s.title, 500) && safeUrl(s.url)) && (!x.provenance.searchEntryPoint || (typeof x.provenance.searchEntryPoint === "string" && x.provenance.searchEntryPoint.length <= 200000));
}

export function ImportStatus({ progress, onCancel, onRetry, onKeep }: { progress: ImportProgress; onCancel: () => void; onRetry: () => void; onKeep?: () => void }) {
  const loading = progress.phase === "loading";
  return <main className="import-status-main" data-testid={loading ? "import-loading" : "import-error"}>
    <button className="import-back" onClick={onCancel}><ArrowLeft size={15}/> Back to exploring</button>
    <section className="import-status-card" aria-live="polite" aria-busy={loading}>
      <span className={`import-orbit ${loading ? "is-loading" : ""}`}><Globe2 size={35}/>{loading && <i/>}</span>
      <span className="eyebrow">{loading ? "FOLLOWING YOUR CURIOSITY" : "A LITTLE ROADBLOCK"}</span>
      <h1>{loading ? "A new shop,\na fresh little world." : "We couldn’t bring\nthis shop in yet."}</h1>
      <p className="import-query">{progress.query}</p>
      <p className="import-status-copy">{loading ? "We’re checking the shop for real products, images and EUR prices. A first visit can take a little longer." : progress.message || "The shop may block access, or we couldn’t verify enough product information. No products have been substituted."}</p>
      {loading ? <><div className="import-timer"><Clock3 size={14}/><span>{progress.elapsed}s elapsed</span><span>Up to 105 seconds</span></div><div className="import-progress-track"><span style={{width:`${Math.min(95, 7 + progress.elapsed / 105 * 88)}%`}}/></div><ul className="import-checks"><li><Check size={13}/> Original merchant sources</li><li><Check size={13}/> Source-backed prices</li><li><ShieldCheck size={13}/> Demo checkout only</li></ul><button className="secondary-button" onClick={onCancel}><X size={14}/> Cancel and go back</button></> : <><div className="import-error-actions"><button className="primary-button" onClick={onRetry}>Try this shop again <RotateCcw size={15}/></button><button className="secondary-button" onClick={onCancel}>Explore other shops <ArrowRight size={15}/></button>{onKeep && <button className="text-button" onClick={onKeep}>Keep the previous catalogue</button>}</div><p className="quiet-note">Some shops limit automated access. Your bag and saved items are safe.</p></>}
    </section>
  </main>;
}

export function ImportProvenance({ snapshot, count, onRefresh }: { snapshot: ImportSnapshot; count: number; onRefresh: () => void }) {
  const p = snapshot.provenance;
  return <section className="import-provenance" data-testid="import-provenance">
    <div className="import-source-strip"><span><Globe2 size={13}/><a href={snapshot.shop.url} target="_blank" rel="noreferrer">{snapshot.shop.domain}<ArrowUpRight size={11}/></a></span><span>{count} real {count === 1 ? "product" : "products"}</span><span>{snapshot.cached ? "Cached catalogue" : "Freshly imported"}</span><button data-testid="import-refresh" onClick={onRefresh}><RotateCcw size={12}/> Refresh catalogue</button></div>
    <details><summary>About this catalogue <span>{new Date(snapshot.shop.fetchedAt).toLocaleString("en-GB", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span></summary><div className="import-source-details"><p>Retrieved {new Date(snapshot.shop.fetchedAt).toLocaleString("en-GB")}. {snapshot.cached ? "Loaded from a saved merchant catalogue." : "Products checked during this visit."} {snapshot.productIds.length < 12 ? `We verified ${snapshot.productIds.length} products; smaller catalogues are shown without filling the gaps.` : ""} Availability and prices can change. Options appear only when observed at the source.</p><p>Method: {p.method === "direct" ? "Public merchant data" : p.method === "search" ? "Gemini web grounding" : "Public merchant data and Gemini web grounding"} · {(snapshot.elapsedMs/1000).toFixed(1)}s</p>{snapshot.warnings.length > 0 && <ul>{snapshot.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}{p.sources.length > 0 && <div className="import-citations"><strong>Sources</strong>{p.sources.map((s,i)=><a key={`${s.url}-${i}`} href={s.url} target="_blank" rel="noreferrer">{s.title}<ArrowUpRight size={11}/></a>)}</div>}</div></details>
    {p.searchEntryPoint && <div className="search-attribution"><iframe title="Google Search attribution and related searches" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https:; font-src https:; base-uri 'none'; form-action 'none'"><base target="_blank"><style>body{margin:8px;background:#fff;font-family:Arial,sans-serif;font-size:12px}a{color:#007841}</style></head><body>${p.searchEntryPoint}</body></html>`}/></div>}
  </section>;
}
