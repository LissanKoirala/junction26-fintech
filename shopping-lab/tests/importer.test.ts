import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cacheKey, type ImportDatabase } from '../lib/import-cache';
import { euroMinor, jsonLdProducts, shopifyProducts } from '../lib/import-parsers';
import { isPublicAddress, makeSafeFetcher, normalizeImportUrl, publicUrl } from '../lib/import-security';
import { groundedProducts, importImage, importShop, resolveGroundingSources, runWithImportEnv } from '../lib/shop-importer';
import { POST } from '../app/api/import/route';
import { GET as imageRoute } from '../app/api/import/image/route';

const resolveHost = async () => ['104.18.4.10'];
const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html' } });
const json = (value: unknown) => Response.json(value);
const product = { '@type': 'Product', name: 'Observed Coat', image: 'https://images.merchant.com/coat.webp', url: 'https://merchant.com/products/coat', brand: { name: 'Merchant' }, category: 'Coats', offers: { price: '49.95', priceCurrency: 'EUR' }, size: ['S', 'M'] };
const structured = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const feed = { products: [{ title: 'Actual Shirt', handle: 'actual-shirt', vendor: 'Merchant', product_type: 'Shirts', body_html: '<p>Actual cotton</p>', variants: [{ title: 'Small', price: '20.00', available: true }, { title: 'Large', price: '30.00', available: true }, { title: 'Medium', price: '20.00', available: false }], images: [{ src: 'https://images.merchant.com/shirt.webp' }] }] };

function database() {
  const records = new Map<string, { result_json: string; images_json: string; expires_at: number }>();
  let writes = 0;
  const db: ImportDatabase = { prepare: () => ({ bind: (...values: unknown[]) => ({
    first: async <T>() => (records.get(String(values[0])) ?? null) as T | null,
    run: async () => { writes++; records.set(String(values[0]), { result_json: String(values[1]), images_json: String(values[2]), expires_at: Number(values[3]) }); },
  }) }) };
  return { db, records, get writes() { return writes; } };
}
function directFetch(options: { currency?: string; blocked?: boolean; imageType?: string; calls?: string[] } = {}): typeof fetch {
  return (async (input, init) => {
    const url = new URL(String(input));
    options.calls?.push(url.href);
    if (url.hostname === 'images.merchant.com') return new Response(init?.method === 'HEAD' ? null : 'image fixture', { headers: { 'content-type': options.imageType || 'image/webp' } });
    if (options.blocked) return new Response('blocked', { status: 403 });
    if (url.pathname.endsWith('/cart.js')) return new Response(JSON.stringify({ currency: options.currency || 'EUR' }), { headers: { 'content-type': 'text/javascript' } });
    if (url.pathname.endsWith('/products.json')) return json(feed);
    return html('<title>Merchant</title>');
  }) as typeof fetch;
}

test('SSRF URL and IP validation rejects private, metadata, encoded and local targets', () => {
  for (const url of ['http://merchant.com', 'https://localhost/', 'https://127.1/', 'https://2130706433/', 'https://0x7f000001/', 'https://169.254.169.254/', 'https://[::1]/', 'https://10.0.0.1/', 'https://secret.internal/', 'https://merchant.com:8443/', 'https://user:password@merchant.com/']) assert.throws(() => publicUrl(url));
  for (const address of ['10.0.0.1', '100.64.1.1', '127.0.0.1', '169.254.1.1', '172.16.0.1', '192.168.1.1', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('104.18.4.10'), true);
  assert.equal(normalizeImportUrl('https://merchant.com/collections/coats?currency=EUR&utm_source=x#top'), 'https://merchant.com/collections/coats?currency=EUR');
});

test('DNS answers and each redirect are checked before merchant requests', async () => {
  let requests = 0;
  const privateDns = makeSafeFetcher({ signal: new AbortController().signal, resolveHost: async () => ['127.0.0.1'], fetch: (async () => { requests++; return html(''); }) as typeof fetch });
  await assert.rejects(privateDns('https://merchant.com'), /unsafe_address/);
  assert.equal(requests, 0);
  const redirect = makeSafeFetcher({ signal: new AbortController().signal, resolveHost, fetch: (async () => { requests++; return new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data/' } }); }) as typeof fetch });
  await assert.rejects(redirect('https://merchant.com'), /unsafe_url/);
  assert.equal(requests, 1);
});

test('Worker-compatible redirect modes are used and DNS redirects are rejected explicitly', async () => {
  const requests: string[] = [];
  const fetcher = (async (input, init) => {
    const url = String(input);
    requests.push(url);
    assert.ok(init?.redirect === 'manual' || init?.redirect === 'follow');
    if (url.startsWith('https://cloudflare-dns.com/')) {
      return json({ Status: 0, Answer: url.includes('type=AAAA') ? [] : [{ type: 1, data: '104.18.4.10' }] });
    }
    return html('Public merchant content');
  }) as typeof fetch;
  const safe = makeSafeFetcher({ signal: new AbortController().signal, fetch: fetcher });
  assert.equal((await safe('https://merchant.com/worker-redirect-test')).text, 'Public merchant content');
  assert.equal(requests.length, 3);
  const blockedRequests: string[] = [];
  const redirectedDns = makeSafeFetcher({ signal: new AbortController().signal, fetch: (async (input, init) => {
    blockedRequests.push(String(input));
    assert.equal(init?.redirect, 'manual');
    return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/' } });
  }) as typeof fetch });
  await assert.rejects(redirectedDns('https://merchant.com/blocked-dns-redirect'), /dns_unavailable/);
  assert.ok(blockedRequests.every(url => url.startsWith('https://cloudflare-dns.com/')));
});

test('bounded fetch rejects oversized streaming HTML and non-image media', async () => {
  const oversized = makeSafeFetcher({ signal: new AbortController().signal, resolveHost, fetch: (async () => html('x'.repeat(50))) as typeof fetch });
  await assert.rejects(oversized('https://merchant.com', { maxBytes: 20 }), /response_too_large/);
  const image = makeSafeFetcher({ signal: new AbortController().signal, resolveHost, fetch: (async () => html('<script>')) as typeof fetch });
  await assert.rejects(image('https://images.merchant.com/image', { image: true }), /unsupported_content_type/);
});

test('JSON-LD graph/ItemList parses observed EUR offers and excludes unsupported currencies', () => {
  const parsed = jsonLdProducts(structured({ '@graph': [{ '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', url: '/products/coat' }] }, product, { ...product, name: 'Dollar coat', offers: { price: '1', priceCurrency: 'USD' } }] }), 'https://merchant.com/collections/coats', 'https://merchant.com');
  assert.equal(parsed.products.length, 1);
  assert.equal(parsed.products[0].price, 4995);
  assert.deepEqual(parsed.products[0].sizes, ['S', 'M']);
  assert.ok(parsed.links.includes('https://merchant.com/products/coat'));
  assert.equal(euroMinor('1,95'), 195);
  assert.equal(euroMinor('19.95 pounds'), null);
  assert.equal(euroMinor('0'), null);
});

test('ProductGroup variants combine without invented sizes and preserve explicit currency context', () => {
  const group = { '@type': 'ProductGroup', name: 'Alvar Beanie', url: 'https://merchant.com/products/beanie', brand: { name: 'Merchant' }, hasVariant: [{ ...product, name: 'Alvar Beanie - One size', url: undefined, size: undefined, offers: { price: '43.82', priceCurrency: 'EUR' } }] };
  const parsed = jsonLdProducts(structured(group), 'https://merchant.com/products/beanie?currency=EUR', 'https://merchant.com');
  assert.equal(parsed.products.length, 1);
  assert.equal(parsed.products[0].name, 'Alvar Beanie');
  assert.equal(parsed.products[0].price, 4382);
  assert.deepEqual(parsed.products[0].sizes, ['One size']);
  assert.match(parsed.products[0].sourceUrl, /currency=EUR/);
});

test('Shopify requires independent EUR evidence and only exposes options at the recorded price', () => {
  assert.deepEqual(shopifyProducts(feed, 'https://merchant.com', 'GBP'), []);
  const products = shopifyProducts(feed, 'https://merchant.com', 'EUR');
  assert.equal(products[0].price, 2000);
  assert.deepEqual(products[0].sizes, ['Small']);
});

test('direct import keeps category feed scope, stores identifiers, and persists a cache hit', async () => {
  const state = database(), calls: string[] = [];
  const options = { env: { DB: state.db }, fetch: directFetch({ calls }), resolveHost };
  const first = await importShop('https://merchant.com/collections/coats?currency=EUR', options);
  assert.equal(first.status, 'ready');
  assert.equal(first.products.length, 1);
  assert.equal(first.products[0].store, 'generic');
  assert.equal(first.products[0].currency, 'EUR');
  assert.match(first.products[0].image, /^\/api\/import\/image\?key=[a-f0-9]+&id=import-/);
  assert.ok(calls.some(url => url.includes('/collections/coats/products.json?limit=12&currency=EUR')));
  assert.ok(first.products[0].sourceUrl.includes('currency=EUR'));
  assert.equal(state.writes, 2);
  const count = calls.length;
  const cached = await importShop('https://merchant.com/collections/coats?currency=EUR', options);
  assert.equal(cached.cached, true);
  assert.equal(calls.length, count);
  const image = await importImage(first.shop!.key, first.products[0].id, options);
  assert.equal(image.type, 'image/webp');
  await assert.rejects(importImage(first.shop!.key, 'https://127.0.0.1/', options), /not_found/);
});

test('different paths have separate caches; refresh failure preserves usable persisted data', async () => {
  const state = database();
  const first = await importShop('https://merchant.com/collections/first', { env: { DB: state.db }, fetch: directFetch(), resolveHost });
  const second = await importShop('https://merchant.com/collections/second', { env: { DB: state.db }, fetch: directFetch(), resolveHost });
  assert.notEqual(first.shop!.key, second.shop!.key);
  const writes = state.writes;
  const refreshed = await importShop('https://merchant.com/collections/first', { env: { DB: state.db }, fetch: directFetch({ blocked: true }), resolveHost, refresh: true });
  assert.equal(refreshed.status, 'ready');
  assert.equal(refreshed.cached, true);
  assert.match(refreshed.warnings.join(' '), /previously imported/);
  assert.equal(state.writes, writes);
});

test('GBP sources, bad images and unconfigured names never substitute seeded products', async () => {
  for (const options of [{ currency: 'GBP' }, { imageType: 'text/html' }]) {
    const result = await importShop(`https://merchant.com/${options.currency ? 'gbp-case' : 'bad-image-case'}`, { env: {}, fetch: directFetch(options), resolveHost });
    assert.equal(result.status, 'unsupported');
    assert.deepEqual(result.products, []);
  }
  const named = await importShop('An unknown merchant for unconfigured test', { env: {} });
  assert.equal(named.status, 'error');
  assert.deepEqual(named.products, []);
});

test('grounded extraction requires merchant attribution and evidenced EUR price', () => {
  const value = { products: [{ name: 'Observed Coat', price: '49.95', priceCurrency: 'EUR', image: product.image, sourceUrl: product.url, evidenceQuote: 'Observed Coat €49.95', options: ['S'] }] };
  const response = { value, text: JSON.stringify(value), sources: [], candidate: {} };
  assert.deepEqual(groundedProducts(response, 'https://merchant.com'), []);
  const verified = { ...response, candidate: { urlContextMetadata: { urlMetadata: [{ retrievedUrl: product.url, urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] } } };
  assert.equal(groundedProducts(verified, 'https://merchant.com').length, 1);
  assert.deepEqual(groundedProducts(verified, 'https://othermerchant.com'), []);
});

test('opaque Google citation redirects resolve to merchant proof without fetching its blocked page', async () => {
  let merchantRequests = 0;
  const value = { products: [{ name: product.name, price: '49.95', priceCurrency: 'EUR', image: product.image, sourceUrl: product.url, evidenceQuote: 'Observed Coat €49.95' }] };
  const response = { value, text: JSON.stringify(value), sources: [], candidate: { groundingMetadata: {
    groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/opaque', title: 'A beautiful coat' } }],
    groundingSupports: [{ segment: { text: JSON.stringify(value) }, groundingChunkIndices: [0] }],
  } } };
  const safe = makeSafeFetcher({ resolveHost, signal: new AbortController().signal, fetch: (async input => {
    if (String(input).startsWith('https://vertexaisearch.cloud.google.com/')) return new Response(null, { status: 302, headers: { location: product.url } });
    merchantRequests++;
    return new Response('blocked', { status: 403 });
  }) as typeof fetch });
  assert.deepEqual(groundedProducts(response, 'https://merchant.com'), []);
  await resolveGroundingSources(response, 'https://merchant.com', safe);
  assert.equal(merchantRequests, 0);
  assert.equal(groundedProducts(response, 'https://merchant.com').length, 1);
});

test('category URL Context evidence stays in the submitted category and rejects unrelated or homepage proof', () => {
  const category = 'https://merchant.com/collections/coats';
  const make = (evidenceUrl: string, retrievedUrl: string) => {
    const value = { products: [{ name: product.name, price: '49.95', priceCurrency: 'EUR', image: product.image, sourceUrl: product.url, evidenceUrl, evidenceQuote: 'Observed Coat €49.95', options: ['S'] }] };
    return { value, text: JSON.stringify(value), sources: [], candidate: { urlContextMetadata: { urlMetadata: [{ retrievedUrl, urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] } } };
  };
  assert.equal(groundedProducts(make(category, category), category).length, 1);
  assert.deepEqual(groundedProducts(make(category, category), category)[0].sizes, []);
  assert.deepEqual(groundedProducts(make('https://merchant.com/', 'https://merchant.com/'), category), []);
  assert.deepEqual(groundedProducts(make('https://merchant.com/collections/other', 'https://merchant.com/collections/other'), category), []);
  assert.deepEqual(groundedProducts(make('https://othermerchant.com/collections/coats', 'https://othermerchant.com/collections/coats'), category), []);
});

test('Google Search quota retry uses URL Context alone and keeps successful retrieved sources', async () => {
  const category = 'https://merchant.com/collections/context-only-case';
  const state = database();
  let providerCalls = 0;
  const fetcher = (async (input, init) => {
    if (String(input).includes('generativelanguage.googleapis.com')) {
      providerCalls++;
      const body = JSON.parse(String(init?.body));
      if (providerCalls === 1) {
        assert.deepEqual(body.tools, [{ google_search: {} }, { url_context: {} }]);
        return new Response('quota', { status: 429 });
      }
      assert.deepEqual(body.tools, [{ url_context: {} }]);
      assert.ok(body.generationConfig.responseFormat.text.schema.properties.products.items.required.includes('evidenceUrl'));
      const value = { merchantName: 'Merchant', products: [{ name: product.name, price: '49.95', priceCurrency: 'EUR', image: product.image, sourceUrl: product.url, evidenceUrl: category, evidenceQuote: 'Observed Coat €49.95' }] };
      return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] }, urlContextMetadata: { urlMetadata: [{ retrievedUrl: category, urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] } }] });
    }
    if (String(input).includes('images.merchant.com')) return new Response(null, { headers: { 'content-type': 'image/webp' } });
    return new Response('blocked', { status: 403 });
  }) as typeof fetch;
  const result = await importShop(category, { env: { DB: state.db, GEMINI_API_KEY: 'mock-test-key' }, fetch: fetcher, resolveHost });
  assert.equal(providerCalls, 2);
  assert.equal(result.status, 'ready');
  assert.ok(result.warnings.some(warning => warning.includes('Search quota')));
  assert.ok(result.provenance.sources.some(source => source.url === category));
  assert.equal(result.provenance.searchEntryPoint, undefined);
});

test('provider search fallback returns only tool-backed products with attribution', async () => {
  const state = database();
  let providerCalls = 0;
  const fetcher = (async (input, init) => {
    if (String(input).includes('generativelanguage.googleapis.com')) {
      providerCalls++;
      const body = JSON.parse(String(init?.body));
      assert.ok(body.tools.some((tool: { google_search?: object }) => tool.google_search));
      const value = { merchantName: 'Merchant', products: [{ name: product.name, price: '49.95', priceCurrency: 'EUR', image: product.image, sourceUrl: product.url, evidenceQuote: 'Observed Coat €49.95' }] };
      return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] }, urlContextMetadata: { urlMetadata: [{ retrievedUrl: product.url, urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: product.url, title: 'Merchant' } }], searchEntryPoint: { renderedContent: '<div>Search attribution</div>' } } }] });
    }
    if (String(input).includes('images.merchant.com')) return new Response(null, { headers: { 'content-type': 'image/webp' } });
    return new Response('blocked', { status: 403 });
  }) as typeof fetch;
  const result = await importShop('https://merchant.com/blocked-search-case', { env: { DB: state.db, GEMINI_API_KEY: 'mock-test-key' }, fetch: fetcher, resolveHost });
  assert.equal(providerCalls, 1);
  assert.equal(result.status, 'ready');
  assert.equal(result.provenance.method, 'search');
  assert.equal(result.provenance.searchEntryPoint, '<div>Search attribution</div>');
  assert.equal(result.products[0].price, 4995);
});

test('hard overall deadline bounds an unresponsive network operation', async () => {
  const start = performance.now();
  const result = await importShop('https://merchant.com/hung-request', { env: {}, timeoutMs: 15, resolveHost, fetch: (async () => new Promise<Response>(() => {})) as typeof fetch });
  assert.equal(result.status, 'error');
  assert.match(result.message!, /too long/);
  assert.ok(performance.now() - start < 500);
});

test('cancellation promptly terminates the importer even when a mocked network ignores abort', async () => {
  const controller = new AbortController();
  const promise = importShop('https://merchant.com/cancelled-request', { env: {}, signal: controller.signal, resolveHost, fetch: (async () => new Promise<Response>(() => {})) as typeof fetch });
  setTimeout(() => controller.abort(), 10);
  const result = await promise;
  assert.equal(result.status, 'error');
  assert.equal(result.message, 'Import cancelled.');
});

test('persistent cache never creates tables during request handling', async () => {
  assert.match(await cacheKey('merchant'), /^[a-f0-9]{32}$/);
  const broken: ImportDatabase = { prepare(sql) { assert.ok(!/CREATE\s+TABLE/i.test(sql)); throw new Error('migration_missing'); } };
  const result = await importShop('https://merchant.com/db-error', { env: { DB: broken }, resolveHost, fetch: directFetch() });
  assert.equal(result.status, 'error');
  assert.match(result.message!, /cache is unavailable/);
});

test('public import route rejects cross-origin, wrong content type and invalid queries', async () => {
  const request = (body: string, headers: Record<string, string> = {}) => new Request('https://demo.com/api/import', { method: 'POST', headers: { origin: 'https://demo.com', 'content-type': 'application/json', ...headers }, body });
  assert.equal((await POST(request('{"query":"shop"}', { origin: 'https://other.com' }))).status, 403);
  assert.equal((await POST(request('{"query":"shop"}', { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await POST(request('{"query":1}'))).status, 400);
  assert.equal((await POST(request(JSON.stringify({ query: 'x'.repeat(501) })))).status, 400);
});

test('image route uses URL strings with Worker cache and tolerates cache failures', async () => {
  const state = database();
  const imported = await importShop('https://merchant.com/image-route-worker-fixture', { env: { DB: state.db }, fetch: directFetch(), resolveHost });
  assert.equal(imported.status, 'ready');
  const wrappedRequest = { url: `https://demo.com${imported.products[0].image}`, signal: new AbortController().signal } as Request;
  const originalFetch = globalThis.fetch;
  const originalCache = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  const methods: string[] = [];
  globalThis.fetch = (async input => {
    const url = String(input);
    if (url.startsWith('https://cloudflare-dns.com/')) return json({ Status: 0, Answer: url.includes('type=AAAA') ? [] : [{ type: 1, data: '104.18.4.10' }] });
    assert.ok(url.startsWith('https://images.merchant.com/'));
    return new Response('image bytes', { headers: { 'content-type': 'image/webp' } });
  }) as typeof fetch;
  try {
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
      match: async (key: unknown) => { methods.push('match'); assert.equal(typeof key, 'string'); return undefined; },
      put: async (key: unknown) => { methods.push('put'); assert.equal(typeof key, 'string'); },
    } } });
    const response = await runWithImportEnv({ DB: state.db }, () => imageRoute(wrappedRequest));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal(await response.text(), 'image bytes');
    assert.deepEqual(methods, ['match', 'put']);
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
      match: async () => { throw new Error('optional cache unavailable'); },
      put: async () => { throw new Error('optional cache unavailable'); },
    } } });
    const uncached = await runWithImportEnv({ DB: state.db }, () => imageRoute(wrappedRequest));
    assert.equal(uncached.status, 200);
    assert.equal(await uncached.text(), 'image bytes');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCache) Object.defineProperty(globalThis, 'caches', originalCache);
    else delete (globalThis as { caches?: unknown }).caches;
  }
});
