const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch { playwright = require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright'); }
const base = process.env.DEMO_BASE_URL || 'http://127.0.0.1:5173';
const out = process.env.QA_OUTPUT_DIR || path.resolve(__dirname,'../work/import-qa');
fs.mkdirSync(out,{recursive:true});
const source = fs.readFileSync(path.resolve(__dirname,'../lib/catalogue.ts'),'utf8');
const image = JSON.parse(source.match(/export const catalogue: Product\[\] = (\[[\s\S]*?\n\]);/)[1])[0].image;
function fixture(cached=false) {
 const now = new Date();
 return {status:'ready',cached,elapsedMs:920,shop:{key:'fixture-shop-category',name:'Fixture Atelier',domain:'fixture-atelier.example',url:'https://fixture-atelier.example/collections/linen',fetchedAt:now.toISOString(),expiresAt:new Date(+now+21600000).toISOString()},products:[{id:'import-fixture-shirt',store:'generic',merchantName:'Fixture Atelier',currency:'EUR',name:'Source-backed linen shirt',brand:'Fixture Atelier',category:'Shirts',price:7990,image,sourceUrl:'https://fixture-atelier.example/products/linen-shirt',description:'A test fixture for a dynamically imported product.',sizes:[],priceKind:'snapshot',priceNote:'Source price snapshot',fetchedAt:now.toISOString()}],warnings:[],provenance:{method:'direct',sources:[{title:'Original merchant product',url:'https://fixture-atelier.example/products/linen-shirt'}]}};
}
(async()=>{
 const browser=await playwright.chromium.launch({channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL||'msedge',headless:true});
 const results=[];
 async function test(name,fn) {
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto(base,{waitUntil:'networkidle'});await fn(page);assert.deepEqual(errors,[]);results.push({name,status:'passed'});console.log('PASS '+name);}
  catch(e){results.push({name,status:'failed',message:e.message,errors});await page.screenshot({path:path.join(out,name.replace(/[^a-z0-9]+/gi,'-')+'.png'),animations:'disabled',fullPage:true});console.log('FAIL '+name+': '+e.message);}
  finally{await context.close();}
 }
 async function submit(page,query='https://fixture-atelier.example/collections/linen') {await page.getByRole('textbox',{name:'Enter a shop, link or craving'}).fill(query);await page.getByRole('button',{name:'Find my shop',exact:true}).click();}
 await test('waits for real imported product and preserves checkout after reload',async page=>{
  let calls=0;await page.route('**/api/import',async route=>{calls++;await new Promise(r=>setTimeout(r,700));await route.fulfill({json:fixture(calls>1)});});
  await submit(page);await page.getByTestId('import-loading').waitFor();assert.equal(await page.getByTestId('product-card').count(),0);
  await page.getByTestId('product-card').waitFor();assert.equal(await page.getByTestId('product-card').count(),1);assert.equal(await page.getByTestId('product-card').getAttribute('data-product-id'),'import-fixture-shirt');
  await page.getByTestId('import-provenance').waitFor();await page.getByRole('button',{name:'View Source-backed linen shirt',exact:true}).click();await page.getByTestId('add-to-basket').click();
  await page.reload({waitUntil:'networkidle'});await page.getByTestId('basket-button').click();assert.match(await page.getByRole('dialog').innerText(),/Source-backed linen shirt/);
  await page.getByTestId('checkout-button').click();await page.getByTestId('place-order').click();await page.getByTestId('order-confirmation').waitFor();
  await page.getByRole('button',{name:/Take a peek at your savings pot/}).click();assert.match(await page.locator('.savings-hero h3').innerText(),/84[.,]80/);await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByTestId('import-refresh').click();await page.getByTestId('import-loading').waitFor();await page.getByTestId('product-card').waitFor();assert.equal(calls,2);
  await page.screenshot({path:path.join(out,'imported-mobile-catalogue.png'),fullPage:true,animations:'disabled'});
 });
 await test('unsupported imports do not substitute cached merchant products',async page=>{
  let attempt=0;await page.route('**/api/import',async route=>{attempt++;await route.fulfill({json:attempt===1?{status:'unsupported',products:[],cached:false,elapsedMs:25,message:'This merchant blocks product retrieval.',warnings:[],provenance:{method:'direct',sources:[]}}:fixture()});});
  await submit(page);await page.getByTestId('import-error').waitFor();assert.equal(await page.getByTestId('product-card').count(),0);await page.getByRole('button',{name:/Try this shop again/}).click();await page.getByTestId('product-card').waitFor();assert.equal(attempt,2);
 });
 await test('cancelling import ignores a late success response',async page=>{
  await page.route('**/api/import',async route=>{await new Promise(r=>setTimeout(r,1800));await route.fulfill({json:fixture()}).catch(()=>{});});await submit(page);await page.getByTestId('import-loading').waitFor();await page.getByRole('button',{name:/Cancel and go back/}).click();await page.getByTestId('store-stockx').waitFor();await page.waitForTimeout(2000);assert.equal(await page.getByTestId('product-card').count(),0);
 });
 await test('unrecognised sneaker merchant URLs use import rather than StockX cache',async page=>{
  let imported=false;await page.route('**/api/import',async route=>{imported=true;assert.match(route.request().postDataJSON().query,/nike\.com/);await route.fulfill({json:fixture()});});await submit(page,'https://www.nike.com/fi/w/shoes');await page.getByTestId('product-card').waitFor();assert.equal(imported,true);assert.equal(await page.getByTestId('product-card').getAttribute('data-product-id'),'import-fixture-shirt');
 });
 await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));if(results.some(r=>r.status==='failed'))process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exit(1)});
