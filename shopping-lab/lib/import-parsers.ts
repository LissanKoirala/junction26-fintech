import { publicUrl, sameMerchant } from './import-security';

export interface ObservedProduct {
  name: string; brand: string; category: string; price: number; image: string;
  sourceUrl: string; description: string; sizes: string[]; colors?: string[];
}
type Data = Record<string, unknown>;
const object = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : value ? [value] : [];
export function cleanText(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
export function euroMinor(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
  const minor = Math.round(Number(text.replace(',', '.')) * 100);
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 100_000_000 ? minor : null;
}
function absolute(value: unknown, page: string): string {
  try { return publicUrl(cleanText(value, 2000), page).href; } catch { return ''; }
}
function types(value: Data): string[] { return array(value['@type']).filter(item => typeof item === 'string') as string[]; }
function flatten(value: unknown, output: Data[], depth = 0) {
  if (depth > 12 || output.length > 3000) return;
  if (Array.isArray(value)) { for (const item of value) flatten(item, output, depth + 1); return; }
  if (!value || typeof value !== 'object') return;
  const data = value as Data;
  output.push(data);
  for (const key of ['@graph', 'itemListElement', 'item', 'mainEntity', 'hasVariant']) if (data[key]) flatten(data[key], output, depth + 1);
}
export function jsonLdProducts(html: string, page: string, merchant: string): { products: ObservedProduct[]; links: string[]; merchantName?: string } {
  const nodes: Data[] = [];
  for (const match of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { flatten(JSON.parse(match[1].replace(/^\s*<!--|-->\s*$/g, '')), nodes); } catch { /* Skip malformed merchant snippets. */ }
  }
  const products: ObservedProduct[] = [];
  const links = new Set<string>();
  const groupedVariants = new Set(nodes.filter(node => types(node).includes('ProductGroup')).flatMap(node => array(node.hasVariant)));
  for (const original of nodes) {
    if (groupedVariants.has(original)) continue;
    let node = original;
    if (types(node).includes('ProductGroup')) {
      const variants = array(node.hasVariant).map(object);
      const first = variants.find(variant => array(variant.offers).some(offer => object(offer).priceCurrency === 'EUR'));
      if (first) {
        const firstPrice = object(array(first.offers)[0]).price;
        node = { ...node, '@type': 'Product', image: node.image ?? first.image,
          offers: variants.flatMap(variant => array(variant.offers)),
          size: variants.filter(variant => array(variant.offers).some(offer => object(offer).priceCurrency === 'EUR' && object(offer).price === firstPrice)).map(variant => variant.size ?? (typeof variant.name === 'string' && typeof node.name === 'string' && variant.name.startsWith(`${node.name} - `) ? variant.name.slice(node.name.length + 3) : '')).filter(Boolean),
        };
      }
    }
    if (types(node).some(type => ['ListItem', 'Product', 'ProductGroup'].includes(type))) {
      const url = absolute(node.url ?? object(node.item).url, page);
      if (url && sameMerchant(url, merchant)) links.add(url);
    }
    if (!types(node).includes('Product')) continue;
    const offers = array(node.offers).flatMap(offer => types(object(offer)).includes('AggregateOffer') ? array(object(offer).offers) : [offer]);
    const offer = offers.map(object).find(item => String(item.priceCurrency ?? object(item.priceSpecification).priceCurrency).toUpperCase() === 'EUR' && euroMinor(item.price ?? object(item.priceSpecification).price) !== null);
    if (!offer) continue;
    const price = euroMinor(offer.price ?? object(offer.priceSpecification).price);
    const name = cleanText(node.name);
    let sourceUrl = absolute(node.url ?? offer.url ?? page, page);
    if (sourceUrl) {
      const source = new URL(sourceUrl), context = new URL(page);
      for (const key of ['currency', 'country', 'locale', 'language']) if (context.searchParams.has(key)) source.searchParams.set(key, context.searchParams.get(key)!);
      sourceUrl = source.href;
    }
    const imageValue = array(node.image)[0];
    const image = absolute(typeof imageValue === 'object' ? object(imageValue).url ?? object(imageValue).contentUrl : imageValue, page);
    if (!name || !price || !image || !sourceUrl || !sameMerchant(sourceUrl, merchant)) continue;
    const sizes = [...new Set(array(node.size).map(size => cleanText(typeof size === 'object' ? object(size).name : size, 60)).filter(Boolean))];
    products.push({ name, brand: cleanText(typeof node.brand === 'object' ? object(node.brand).name : node.brand) || '', category: cleanText(node.category, 80) || 'Products', price, image, sourceUrl, description: cleanText(node.description, 700), sizes,
      ...(node.color ? { colors: array(node.color).map(color => cleanText(color, 80)).filter(Boolean) } : {}),
    });
  }
  const merchantName = nodes.find(node => types(node).some(type => ['Organization', 'Store', 'OnlineStore'].includes(type)) && cleanText(node.name))?.name;
  return { products, links: [...links], ...(merchantName ? { merchantName: cleanText(merchantName, 100) } : {}) };
}

export function htmlProductLinks(html: string, page: string, merchant: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const url = absolute(match[1].replace(/&amp;/g, '&'), page);
    if (url && sameMerchant(url, merchant) && /\/(?:products?|p|pd)\//i.test(new URL(url).pathname)) links.add(url);
    if (links.size >= 20) break;
  }
  return [...links];
}
export function merchantTitle(html: string): string {
  const site = html.match(/<meta\b(?=[^>]*(?:property|name)=["']og:site_name["'])[^>]*content=["']([^"']+)["']/i)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return cleanText(site || title || '', 100);
}
export function shopifyProducts(data: unknown, origin: string, currency: string): ObservedProduct[] {
  if (currency !== 'EUR') return [];
  return array(object(data).products).flatMap(item => {
    const product = object(item);
    const variants = array(product.variants).map(object).filter(variant => variant.available !== false && euroMinor(variant.price) !== null);
    const first = variants[0];
    const name = cleanText(product.title);
    const image = absolute(object(array(product.images)[0]).src ?? object(product.image).src, origin);
    const handle = cleanText(product.handle);
    if (!first || !name || !image || !/^[a-z0-9_-]+$/i.test(handle)) return [];
    const sizes = [...new Set(variants.filter(variant => euroMinor(variant.price) === euroMinor(first.price)).map(variant => cleanText(variant.title, 60)).filter(value => value && value !== 'Default Title'))];
    return [{ name, brand: cleanText(product.vendor, 100), category: cleanText(product.product_type, 80) || 'Products', price: euroMinor(first.price)!, image,
      sourceUrl: new URL(`/products/${handle}`, origin).href, description: cleanText(product.body_html, 700), sizes,
    }];
  });
}
