/* eslint-disable @typescript-eslint/no-require-imports -- This CommonJS harness loads a configurable Playwright installation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (error) {
  if (process.env.PLAYWRIGHT_MODULE) throw error;
  playwright = require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
}
const { chromium } = playwright;

const baseURL = (process.env.DEMO_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const baseOrigin = new URL(baseURL).origin;
const output = process.env.QA_OUTPUT_DIR || path.resolve(__dirname, '../work/qa');
fs.mkdirSync(output, { recursive: true });
const source = fs.readFileSync(path.resolve(__dirname, '../lib/catalogue.ts'), 'utf8');
const catalogue = JSON.parse(source.match(/export const catalogue: Product\[\] = (\[[\s\S]*?\n\]);/)[1]);
const catalogueVersion = source.match(/CATALOGUE_VERSION = '([^']+)'/)[1];
const results = [];

async function main() {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'msedge', headless: true });
  async function check(name, run) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    let mode = 'normal';
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== baseOrigin) return route.abort('blockedbyclient');
      if (url.pathname !== '/api/discover') return route.continue();
      if (mode === 'timeout') {
        await new Promise(resolve => setTimeout(resolve, 8000));
        return route.abort().catch(() => {});
      }
      const query = route.request().postDataJSON().query.toLowerCase();
      const store = /uber/.test(query) ? 'ubereats' : /stock/.test(query) ? 'stockx' : /zara/.test(query) ? 'zara' : 'generic';
      const products = catalogue.filter(product => (store === 'generic' || product.store === store) && (store !== 'generic' || !/dress/.test(query) || product.category === 'Dresses'));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        store, title: { ubereats: 'Uber Eats', stockx: 'StockX', zara: 'Zara', generic: 'Your discovery edit' }[store],
        productIds: products.map(product => product.id), mode: 'fallback', elapsedMs: 12,
        reason: 'not_configured', catalogueVersion,
      }) });
    });
    const started = Date.now();
    try {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await run(page, value => { mode = value; });
      assert.deepEqual(errors, [], 'No browser runtime errors');
      results.push({ name, status: 'passed', elapsedMs: Date.now() - started });
      console.log(`PASS ${name}`);
    } catch (error) {
      results.push({ name, status: 'failed', message: error.message, errors, elapsedMs: Date.now() - started });
      await page.screenshot({ path: path.join(output, `${name.replace(/[^a-z0-9]+/gi, '-')}-failure.png`), fullPage: true, animations: 'disabled' });
      console.log(`FAIL ${name}: ${error.message}`);
    } finally {
      await context.close();
    }
  }

  const money = amount => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(amount / 100);
  async function openProduct(page, product) {
    await page.locator(`[data-product-id="${product.id}"]`).getByRole('button', { name: `View ${product.name}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByTestId('add-to-basket').waitFor();
    return dialog;
  }
  async function addProduct(page, product, option = product.sizes[0]) {
    const dialog = await openProduct(page, product);
    if (option) await dialog.getByRole('button', { name: option, exact: true }).click();
    await dialog.getByTestId('add-to-basket').click();
    await dialog.waitFor({ state: 'hidden' });
  }
  await check('mobile landing', async page => {
    await page.getByTestId('store-ubereats').waitFor();
    for (const id of ['ubereats', 'stockx', 'zara']) assert.ok(await page.getByTestId(`store-${id}`).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(output, 'mobile-landing.png'), fullPage: true, animations: 'disabled' });
  });

  for (const store of ['ubereats', 'stockx', 'zara']) {
    await check(`${store} complete shopping flow`, async page => {
      const product = catalogue.find(item => item.store === store);
      await page.getByTestId(`store-${store}`).click();
      await page.getByTestId('product-card').first().waitFor();
      const cards = page.getByTestId('product-card');
      assert.equal(await cards.count(), catalogue.filter(item => item.store === store).length);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.screenshot({ path: path.join(output, `${store}-mobile-catalogue.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: product.category, exact: true }).click();
      assert.equal(await cards.count(), catalogue.filter(item => item.store === store && item.category === product.category).length);
      await page.getByRole('button', { name: 'All', exact: true }).click();
      await page.getByRole('textbox', { name: 'Search this storefront' }).fill('never-a-product-xyz');
      assert.equal(await cards.count(), 0);
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      assert.ok(await cards.count() > 0);
      const detail = await openProduct(page, product);
      await detail.getByTestId('add-to-basket').click();
      assert.match(await detail.getByRole('alert').innerText(), /Choose a size or option/);
      await detail.getByRole('button', { name: product.sizes[0], exact: true }).click();
      await detail.getByRole('button', { name: 'Increase quantity', exact: true }).click();
      await page.screenshot({ path: path.join(output, `${store}-mobile-detail.png`), fullPage: false, animations: 'disabled' });
      await detail.getByTestId('add-to-basket').click();
      await page.getByTestId('basket-button').click();
      let bag = page.getByRole('dialog');
      assert.match(await bag.innerText(), /Your bag \(2\)/i);
      await bag.getByRole('button', { name: `Increase ${product.name} quantity`, exact: true }).click();
      assert.match(await bag.innerText(), /Your bag \(3\)/i);
      await bag.getByRole('button', { name: `Decrease ${product.name} quantity`, exact: true }).click();
      assert.match(await bag.innerText(), /Your bag \(2\)/i);
      await bag.getByRole('button', { name: 'Remove', exact: true }).click();
      await bag.getByRole('heading', { name: 'A little room for something good.' }).waitFor();
      await bag.getByRole('button', { name: 'Keep exploring' }).click();
      await addProduct(page, product);
      await page.getByTestId('basket-button').click();
      await page.getByTestId('checkout-button').click();
      await page.getByRole('heading', { name: 'Delivery & contact' }).waitFor();
      await page.screenshot({ path: path.join(output, `${store}-mobile-checkout.png`), fullPage: false, animations: 'disabled' });
      // Two same-tick clicks must produce one receipt and one savings entry.
      await page.getByTestId('place-order').evaluate(button => { button.click(); button.click(); });
      await page.getByTestId('order-confirmation').waitFor();
      await page.screenshot({ path: path.join(output, `${store}-mobile-confirmation.png`), fullPage: false, animations: 'disabled' });
      await page.getByRole('button', { name: /Take a peek at your savings pot/ }).click();
      const expectedTotal = product.price + (store === 'ubereats' ? 299 : 490);
      assert.equal(await page.locator('.savings-hero h3').innerText(), money(expectedTotal));
      assert.match(await page.locator('.ledger-heading').innerText(), /1 demo order/);
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByTestId('savings-button').click();
      assert.equal(await page.locator('.savings-hero h3').innerText(), money(expectedTotal));
      assert.match(await page.locator('.ledger-heading').innerText(), /1 demo order/);
      await page.screenshot({ path: path.join(output, `${store}-mobile-savings.png`), fullPage: false, animations: 'disabled' });
      await page.getByRole('button', { name: 'Reset demo history', exact: true }).click();
      await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
      await page.getByTestId('store-ubereats').waitFor();
      await page.getByTestId('savings-button').click();
      assert.equal(await page.locator('.savings-hero h3').innerText(), money(0));
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page.getByTestId('basket-button').click();
      await page.getByRole('heading', { name: 'A little room for something good.' }).waitFor();
    });
  }

  await check('distinct variants survive reload', async page => {
    const product = catalogue.find(item => item.store === 'stockx');
    await page.getByTestId('store-stockx').click();
    await addProduct(page, product, product.sizes[0]);
    await addProduct(page, product, product.sizes[1]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('basket-button').click();
    assert.equal(await page.locator('.bag-line').count(), 2);
    for (const option of product.sizes.slice(0, 2)) await page.getByText(`Size / option: ${option}`, { exact: true }).waitFor();
  });

  await check('legacy saved bag survives the catalogue import upgrade', async page => {
    const product = catalogue.find(item => item.store === 'stockx');
    await page.evaluate(p => localStorage.setItem('vara-shopping-lab:v1', JSON.stringify({version:1,shop:'stockx',bag:[{productId:p.id,variant:p.sizes[0],quantity:2}],favorites:[p.id],entries:[]})), product);
    await page.reload({waitUntil:'networkidle'});
    await page.getByTestId('basket-button').click();
    assert.equal(await page.locator('.bag-line').count(),1);
    assert.match(await page.getByRole('dialog').innerText(), /Your bag \(2\)/i);
    await page.getByText(`Size / option: ${product.sizes[0]}`, {exact:true}).waitFor();
  });

  await check('API timeout leaves a usable catalogue under five seconds', async (page, setMode) => {
    setMode('timeout');
    const started = Date.now();
    await page.getByTestId('store-stockx').click();
    await page.getByTestId('product-card').first().waitFor();
    const product = catalogue.find(item => item.store === 'stockx');
    await addProduct(page, product);
    assert.ok(Date.now() - started < 5000, 'Catalogue and product configuration are usable within five seconds');
    await page.waitForTimeout(3400);
    assert.ok(await page.getByTestId('product-card').count() > 0);
    await page.locator('.demo-details summary').click();
    assert.match(await page.locator('.demo-details').innerText(), /Instant catalogue/);
  });

  await browser.close();
  fs.writeFileSync(path.join(output, 'e2e-results.json'), JSON.stringify(results, null, 2));
  if (results.some(result => result.status === 'failed')) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
