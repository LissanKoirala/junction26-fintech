import { importImage } from '../../../../lib/shop-importer';

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    let edgeCache: Cache | undefined;
    try {
      edgeCache = typeof caches !== 'undefined' ? (caches as CacheStorage & { default?: Cache }).default : undefined;
      // Vinext requests can be wrappers rather than native Worker Requests.
      const cached = await edgeCache?.match(url.href);
      if (cached) return cached;
    } catch { /* Edge caching is optional; continue to the validated source. */ }
    const image = await importImage(url.searchParams.get('key') || '', url.searchParams.get('id') || '', { signal: request.signal });
    const response = new Response(Uint8Array.from(image.bytes).buffer, { headers: { 'Content-Type': image.type, 'Cache-Control': 'public, max-age=21600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
    try { await edgeCache?.put(url.href, response.clone()); }
    catch { /* A cache failure must not hide an otherwise valid image. */ }
    return response;
  } catch {
    return new Response('Image unavailable', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
}
