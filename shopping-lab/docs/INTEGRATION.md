# Integrating Shopping Lab

Shopping Lab is imported as a self-contained module in `shopping-lab/`. Its API and runtime are independent of the main `app/` Hono server. The existing Crave flow and Stripe test-mode wallet remain in `app/`.

## Main app page

The bank app lazy-loads `app/src/features/crave/ShoppingLabFlow.tsx` at `#/crave/lab` (alias: `#/shopping-lab`). The Crave introduction has an **Open Shopping Lab** button. The page uses the existing phone frame, back navigation, Finnish translations and concept notice, with a sandboxed iframe, loading/retry UI and a new-tab fallback. The embedded storefront itself currently uses English.

The frame receives only the parent origin. Customer identity, transactions and wallet credentials are never passed in. The app does not consume checkout messages or credit its existing Crave pot: the demo keeps its own browser-local simulated savings. Existing Crave generation and Stripe test-mode checkout are unchanged. Deploying the main app activates this new route; pushing the repository alone does not deploy the Azure VM.

## Embed the hosted demo

Use the public HTTPS origin as a WebView source or an iframe. For the current Vara Azure origin:

```html
<iframe
  title="Vara Shopping Lab"
  src="https://vara-shopping-lab.lissanartist.chatgpt.site/?embed=1&parentOrigin=https%3A%2F%2Fvara-junction26.swedencentral.cloudapp.azure.com"
  style="width:100%;height:100%;border:0"
></iframe>
```

Add `shop=stockx`, `shop=zara` or `shop=ubereats` to open an existing storefront immediately. Unknown merchants can be entered through the demo's shop/URL input. The parent-origin allowlist currently includes the Azure origin above and the demo's own origin. Add another trusted origin explicitly in `app/page.tsx` if the main app is deployed elsewhere.

## Checkout event

The embedded demo posts the following message after a simulated order completes:

```ts
{
  type: 'vara:checkout',
  detail: {
    orderId: 'VAR-...',
    amountMinor: 17490,
    currency: 'EUR',
    simulated: true
  }
}
```

The parent must validate `event.origin`, `event.source` against the iframe window, the message type, a positive integer `amountMinor`, `currency === 'EUR'`, and `simulated === true`. Deduplicate using `orderId`. This message describes a UI event; it does not prove a payment or savings transfer occurred. Any future wallet integration should use an explicit server-side handoff and its own amount validation.

In a top-level WebView, the same payload is exposed as the detail of the `vara:checkout` DOM custom event. Install a native bridge listener if needed; no native bridge is currently exposed to retailer content.

## API and state

- `POST /api/discover`: fast Gemini selection from the bundled catalogue.
- `POST /api/import`: source-backed product import for a public merchant URL or name, with a persistent six-hour D1 cache.
- `GET /api/import/image`: validated image lookup by stored cache/product identifiers.
- `GET /api/health`: safe provider configuration diagnostics.

POST endpoints require the demo's own origin. Importing these handlers directly into the main app requires adapting the runtime and routing. Serving the built UI under an arbitrary subpath also requires a base-path/API-prefix change; the current browser client uses root-relative `/api/*` URLs.

Gemini uses server-only `GEMINI_API_KEY`; the bank app's `RUNWARE_API_KEY` is a separate configuration. No API key is stored in this repository. Imported catalogues are shared source snapshots in D1; bag, favourites and simulated savings are local to the demo's browser origin. The main app's synthetic-data clock does not govern real merchant retrieval timestamps.

## Verification at import

The source passed 32 backend tests, seven existing mobile shopping scenarios, four import UI scenarios, TypeScript and a production build. Live hosted checks imported 12 Karhu products, 12 Makia products and nine Flying Tiger products; loaded all 12 Karhu images; and completed imported-product checkout after a reload. Counts and merchant availability can change. Google Search grounding is currently subject to the provided credential's quota; direct merchant URLs are the reliable demo entry point.

The main-app integration passed TypeScript and a production build in an isolated validation copy. Browser checks at 390 × 844 covered the Crave entry, live hosted StockX frame, back navigation, direct links, route alias, Finnish labels and separation from bank state. The app's guard/Stripe-key suites passed (13 tests). Its engine suite could not run because the challenge `DATA_DIR` dataset is absent from this checkout; no replacement financial data was fabricated.
