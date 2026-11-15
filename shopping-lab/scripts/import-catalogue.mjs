import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const project = new URL('../', import.meta.url);
const research = JSON.parse(await readFile(new URL('../data/catalogue-research.json', import.meta.url), 'utf8'));
const images = new URL('public/products/', project);
await mkdir(images, { recursive: true });
const results = [];
const useLocal = process.argv.includes('--local');
// Official public StockX locale snapshots retrieved 2026-11-15. No currency conversion.
const priceUpdates = {
  'stockx-samba': { amount: 36, currency: 'EUR', includingMarketplaceFee: 43, sourceUrl: 'https://stockx.com/fr-fr/adidas-samba-og-cloud-white-core-black', locale: 'France' },
  'stockx-campus': { amount: 25, currency: 'EUR', includingMarketplaceFee: 31, sourceUrl: 'https://stockx.com/fr-fr/adidas-campus-00s-core-black', locale: 'France' },
  'stockx-nb550': { amount: 50, currency: 'EUR', includingMarketplaceFee: 57, sourceUrl: 'https://stockx.com/es-es/new-balance-550-white-green', locale: 'Spain' },
};

async function download(record) {
  let bytes;
  if (useLocal) {
    for (const ext of ['png', 'jpg', 'webp']) {
      try { bytes = await readFile(new URL(`${record.id}.${ext}`, images)); break; } catch {}
    }
    if (!bytes) throw new Error(`No local original for ${record.id}`);
  } else {
    const response = await fetch(record.image.url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: record.storefront === 'StockX' ? 'image/jpeg,image/png' : 'image/webp,image/png,image/jpeg,*/*;q=0.8' },
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`${record.id}: image HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/') || bytes.length < 1000) throw new Error(`${record.id}: invalid image ${type}, ${bytes.length} bytes`);
  }
  const thumbnail = await sharp(bytes).rotate().resize({ width: 600, height: 900, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
  const filename = `${record.id}.webp`;
  await writeFile(new URL(filename, images), thumbnail);
  console.log(`${record.id}: WebP ${thumbnail.length} bytes`);
  return `/products/${filename}`;
}

function titleCase(name) {
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bMidi\b/g, 'Midi');
}

function makeProduct(record, image) {
  if (priceUpdates[record.id]) record = { ...record, sourcePrice: priceUpdates[record.id], fetchedAt: '2026-11-15T02:00:33Z' };
  const store = record.storefront === 'Uber Eats' ? 'ubereats' : record.storefront.toLowerCase();
  const food = store === 'ubereats';
  const sneaker = store === 'stockx';
  const estimate = !record.sourcePrice;
  const price = Math.round((record.sourcePrice?.amount ?? record.demoPrice.amount) * 100);
  const colors = record.options.filter((o) => ['color', 'colorway'].includes(o.type)).map((o) => o.value);
  const brand = food ? "Supermac’s" : sneaker ? (/^adidas/.test(record.name) ? 'adidas' : /^New Balance/.test(record.name) ? 'New Balance' : /^ASICS/.test(record.name) ? 'ASICS' : /^Jordan/.test(record.name) ? 'Jordan' : 'Nike') : 'Zara';
  const category = food ? (/Fries/.test(record.name) ? 'Sides' : /Milkshake/.test(record.name) ? 'Drinks' : /Pizza/.test(record.name) ? 'Pizza' : 'Burgers') : sneaker ? (/Jordan 4/.test(record.name) ? 'Basketball' : 'Lifestyle') : (/PLAYSUIT/.test(record.name) ? 'Playsuits' : 'Dresses');
  const priceKind = estimate ? 'estimate' : food ? 'from' : 'snapshot';
  const description = food
    ? "Real item from Supermac’s Headford Road, Galway collection menu. Regular is a simulated selection. No live stock or delivery quote is checked."
    : sneaker
      ? `Real StockX listing${record.style ? ` · ${record.style}` : ''}. EU size choices are simulated. ${estimate ? 'The price is a demo estimate.' : 'The price is a cached all-size starting ask.'} No live stock is checked.`
      : `Real Zara Ireland product${colors[0] ? ` in ${colors[0].toLowerCase()}` : ''}. Size choices are simulated. No live size availability is checked.`;
  return {
    id: record.id,
    store,
    name: titleCase(record.name),
    brand,
    category,
    price,
    image,
    sourceUrl: record.sourcePrice?.sourceUrl ?? record.sourceUrl,
    description,
    sizes: food ? ['Regular'] : sneaker ? ['EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43', 'EU 44'] : ['XS', 'S', 'M', 'L', 'XL'],
    ...(colors.length ? { colors } : {}),
    priceNote: estimate ? 'Demo price' : food ? 'Galway collection menu · from price' : sneaker ? `Cached ${record.sourcePrice.locale ?? 'Germany'} ask · all sizes · fees may apply` : 'Cached Ireland price',
    priceKind,
    fetchedAt: record.fetchedAt,
  };
}

for (let offset = 0; offset < research.products.length; offset += 4) {
  const batch = await Promise.allSettled(research.products.slice(offset, offset + 4).map(async (record) => makeProduct(record, await download(record))));
  for (const result of batch) {
    if (result.status === 'fulfilled') results.push(result.value);
    else throw result.reason;
  }
}

const source = `import type { Product, ShopId } from './shop-contract';\n\n// Real product facts cached from official public pages. Sizes are explicitly simulated.\n// FetchedAt records research retrieval time; source pages may be older cached crawls.\nexport const CATALOGUE_VERSION = '2026-11-15.2';\n\nexport const catalogue: Product[] = ${JSON.stringify(results, null, 2)};\n\nexport function getProducts(store: ShopId): Product[] {\n  return store === 'generic' ? catalogue : catalogue.filter((product) => product.store === store);\n}\n`;
await writeFile(new URL('lib/catalogue.ts', project), source);
console.log(`Imported ${results.length} real products into ${fileURLToPath(project)}`);
