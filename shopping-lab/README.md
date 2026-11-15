# Vara Shopping Lab

A mobile-first, public hackathon demo embedded in the bank app at `#/crave/lab`. Known stores use prebuilt presentations; Gemini selects real product IDs from a cached catalogue. Checkout simulates an order and records its total in a browser-local savings ledger. No merchant order or payment is submitted.

## Place in this repository

This folder is a standalone Crave-mode technology demo alongside the existing `app/`. The bank app keeps its current frontend, Hono API and wallet flow. This module owns its own `/api/*` routes, Gemini secret and Cloudflare D1 catalogue cache, so run it on a separate origin or port. See [docs/INTEGRATION.md](docs/INTEGRATION.md) for the iframe/WebView bridge and source layout.

Live demo: [Vara Shopping Lab](https://vara-shopping-lab.lissanartist.chatgpt.site/).

Follow the repository's VM workflow from `docs/CONTRACTS.md` when running on the team's development setup. For example, `bin/vm 'cd shopping-lab && npm ci && npm run build'` builds this module on the VM. The commands below are executed from this folder on the execution host.

## First-time setup

Requires Node.js 22.13 or newer.

```sh
npm ci
# Optional: copy .dev.vars.example to .dev.vars and fill in the Gemini key.
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_purple_rawhide_kid.sql
npm run dev -- --host 0.0.0.0 --port 5174
```

Apply that schema migration once per new local database. On later runs, start the dev server directly. Port 5174 avoids the main app's existing port 5173.

The demo remains usable without Google API access. For local Gemini requests, create an untracked `.dev.vars` file containing `GEMINI_API_KEY` and optionally `GEMINI_MODEL`. Never expose these values in the client or commit them. Production values are configured as native Sites backend secrets.

```sh
npm run build
```

The supplied Sites build helper handles publication packaging. `.openai/hosting.json` identifies the existing hosted project and logical `DB` binding; it contains no credentials. Preserve that identity when updating the same Site. Pushing this repository does not automatically redeploy the hosted demo or mount it inside the Hono app.

## Architecture

- `app/page.tsx` and `app/globals.css`: discovery, retailer storefronts, product selection, basket, checkout, receipts and savings history.
- `lib/catalogue.ts`: product snapshots and provenance. All money uses integer euro cents.
- `public/products/`: cached real source imagery.
- `lib/discovery.ts`: normalized queries, deterministic ranking, Gemini call, semantic validation, request-scoped secrets and selection cache.
- `app/api/discover/route.ts`: bounded same-origin discovery API.
- `app/api/health/route.ts`: safe configuration and provider diagnostics.
- `worker/index.ts`: hosting entrypoint with request-scoped environment.
- `tests/discovery.test.ts`: provider success, cache, deadlines, malformed responses and API boundary checks.

The cached-store provider is `gemini-3.5-flash-lite` with minimal thinking and a 2,800 ms deadline. Unknown shops use a separate importer and wait for real merchant products; no generated code or generated product imagery is used.

## Import an uncached shop

Enter a public HTTPS product/category URL in the homepage prompt, or use the new-shop buttons. Verified acceptance sources include `https://eu.karhu.com/collections/all-products`, `https://makia.com/?currency=EUR` and `https://flyingtiger.com/collections/advent-decorations`. Source access and throttling vary. A single product URL may yield fewer than 12 products. Failed imports never substitute the bundled catalogue.

The backend prefers public Product/Offer JSON-LD and scoped Shopify feeds. It verifies EUR currency evidence and images, then persists the import in D1 for six hours. A fresh import can take longer than five seconds; successful cache hits are fast. Refresh preserves the prior catalogue if the merchant cannot be retrieved. Product images are proxied by stored identifiers and cached; the proxy does not accept arbitrary external URLs.

`GEMINI_IMPORT_MODEL` defaults to `gemini-4-hydrogen` for official-domain resolution, Google Search grounding and URL Context fallback, using the same server-only credential. Search requires available provider quota; URL Context can read supplied merchant URLs separately when search quota is unavailable. Merchant blocking, unsupported currencies and provider failures are shown explicitly. The route has an approximately 90-second ceiling; the client can cancel and has a 105-second timeout. Imported product records persist with browser-local basket and favourites so reloads preserve checkout functionality.

`app/api/import/route.ts`, `lib/shop-importer.ts` and `lib/import-*.ts` implement ingestion, validation and caching. `drizzle/0000_purple_rawhide_kid.sql` creates the cache table; the existing Sites workflow applies production migrations. Apply the migration separately to a local preview database before testing persistent imports.

Tests: `tests/importer.test.ts` covers parser/security/cache/provider boundaries. `tests/import-ui.cjs` covers wait, cancellation, retry, import routing and checkout persistence. `tests/e2e.cjs` covers the original shopping journey and legacy-state migration. Set `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_BROWSER_CHANNEL`, `DEMO_BASE_URL` and `QA_OUTPUT_DIR` when using an external browser-test runtime.

## Data and demo limits

The catalogue is a small research snapshot, not live stock or a live delivery quote. Product source links and price context are retained. Sizes are simulated checkout choices. Displayed estimates, when present, are explicitly identified. Food records come from the Supermac’s Galway collection menu; they are presented in a food-delivery-style storefront rather than asserted to be current Helsinki Uber Eats listings.

State is local to the browser. A public demo reset affects only the current browser. No personal contact or actual card data is needed for checkout. The production integration should replace the demo ledger with an authorised savings service and separately establish its consent and money-movement flow.

## Embedding

The public HTTPS URL can be used as a mobile WebView source. Query links can select a storefront: `?shop=ubereats`, `?shop=stockx`, or `?shop=zara`. `embed=1` selects the compact embedded presentation. The integration must preserve the demo indication until real savings handling exists.

On simulated checkout, the client dispatches a `vara:checkout` custom event with order ID, amount in minor units, EUR currency and `simulated: true`. A cross-frame message is sent only for an explicitly allowed parent origin. The host must check the message origin, type and payload; a message is a UI integration event, not proof that money moved.
