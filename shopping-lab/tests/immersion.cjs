/* eslint-disable @typescript-eslint/no-require-imports -- configurable browser-test runtime. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (error) {
  if (process.env.PLAYWRIGHT_MODULE) throw error;
  playwright = require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
}
const base = process.env.DEMO_BASE_URL || 'http://127.0.0.1:5174';
const output = process.env.QA_OUTPUT_DIR || path.resolve(__dirname, '../work/immersion-qa');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await playwright.chromium.launch({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'msedge', headless: true });
  const results = [];
  async function test(name, run, viewport = { width: 390, height: 844 }) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await run(page);
      assert.deepEqual(errors, []);
      results.push({ name, status: 'passed' });
      console.log(`PASS ${name}`);
    } catch (error) {
      results.push({ name, status: 'failed', error: error.message });
      await page.screenshot({ path: path.join(output, `${name.replace(/[^a-z0-9]+/gi, '-')}-failure.png`), fullPage: true });
      console.log(`FAIL ${name}: ${error.message}`);
    } finally { await context.close(); }
  }
  for (const shop of ['ubereats', 'stockx', 'zara']) {
    await test(`${shop} branded mobile shell and product`, async page => {
      await page.goto(`${base}/?shop=${shop}&embed=1`, { waitUntil: 'networkidle' });
      await page.locator(`.sf-${shop}`).waitFor();
      assert.equal(await page.locator('.lab-header').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await page.getByTestId('basket-button').count(), 1);
      const bar = await page.locator('.sf-bottom-bar').boundingBox();
      assert.ok(bar.y + bar.height <= 845 && bar.y > 700);
      await page.screenshot({ path: path.join(output, `${shop}-first-screen.png`), animations: 'disabled' });
      await page.getByTestId('product-card').first().getByRole('button', { name: /^View / }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByTestId('add-to-basket').waitFor();
      const add = await dialog.getByTestId('add-to-basket').boundingBox();
      assert.ok(add.y > 600 && add.y + add.height <= 844, 'Product action stays in the mobile viewport');
      await page.screenshot({ path: path.join(output, `${shop}-product-screen.png`), animations: 'disabled' });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
    });
  }
  await test('StockX buy now and editable demo checkout', async page => {
    await page.goto(`${base}/?shop=stockx`, { waitUntil: 'networkidle' });
    const card = page.getByTestId('product-card').first();
    await card.getByRole('button', { name: /^Save / }).click();
    await page.getByRole('button', { name: 'View saved products', exact: true }).click();
    assert.equal(await page.getByTestId('product-card').count(), 1);
    assert.ok(await page.locator('.sf-stockx').isVisible());
    await page.getByRole('button', { name: 'Show all products', exact: true }).click();
    await page.getByRole('button', { name: 'Open product filters', exact: true }).click();
    await page.getByRole('combobox', { name: 'Sort products' }).selectOption('low');
    const prices = await page.locator('.sf-product-price>span').allTextContents();
    const values = prices.map(text => Number(text.replace(/[^0-9,]/g, '').replace(',', '.')));
    assert.deepEqual(values, [...values].sort((a,b) => a-b));
    await page.getByTestId('product-card').first().getByRole('button', { name: /^View / }).click();
    await page.locator('.purchase-option-grid button').first().click();
    await page.getByRole('button', { name: /^Buy now/ }).click();
    await page.getByRole('heading', { name: 'Delivery & contact', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await page.getByRole('textbox', { name: 'First name', exact: true }).fill('Taylor');
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await page.getByText('Taylor Demo', { exact: true }).waitFor();
    await page.getByRole('radio', { name: /Demo mobile wallet/ }).check();
    await page.screenshot({ path: path.join(output, 'stockx-checkout-screen.png'), animations: 'disabled' });
    await page.getByTestId('place-order').click();
    await page.getByTestId('order-confirmation').waitFor();
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('vara-shopping-lab:v1')));
    assert.equal(state.entries.length, 1);
    assert.equal(state.bag.length, 0);
  });
  await test('Zara editorial compact and scoped collection', async page => {
    await page.goto(`${base}/?shop=zara`, { waitUntil: 'networkidle' });
    const count = await page.getByTestId('product-card').count();
    await page.getByRole('button', { name: 'Switch to compact grid', exact: true }).click();
    assert.ok(await page.locator('.sf-compact').isVisible());
    assert.equal(await page.getByTestId('product-card').count(), count);
    await page.screenshot({ path: path.join(output, 'zara-compact-screen.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'MAN', exact: true }).click();
    assert.equal(await page.getByTestId('product-card').count(), 0);
    await page.getByRole('button', { name: 'EXPLORE WOMAN', exact: true }).click();
    assert.equal(await page.getByTestId('product-card').count(), count);
  });
  for (const width of [320, 430, 1024]) await test(`responsive storefront at ${width}px`, async page => {
    for (const shop of ['ubereats', 'stockx', 'zara']) {
      await page.goto(`${base}/?shop=${shop}`, { waitUntil: 'networkidle' });
      await page.locator(`.sf-${shop}`).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
  }, { width, height: 844 });
  await browser.close();
  fs.writeFileSync(path.join(output, 'immersion-results.json'), JSON.stringify(results, null, 2));
  if (results.some(result => result.status === 'failed')) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
