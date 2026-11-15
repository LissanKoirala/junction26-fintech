import { importShop } from '../../../lib/shop-importer';
import { readBounded } from '../../../lib/import-security';

const windows = new Map<string, { count: number; expiresAt: number }>();
let active = 0;
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Use this endpoint from the shopping page.' }, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'Expected application/json.' }, 415);
  if (Number(request.headers.get('content-length') || 0) > 2048) return json({ error: 'Request too large.' }, 413);
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(await readBounded(new Response(request.body), 2048, AbortSignal.any([request.signal, AbortSignal.timeout(2500)])))); }
  catch { return json({ error: 'Invalid or oversized JSON.' }, 400); }
  if (!body || typeof body !== 'object' || !('query' in body) || typeof body.query !== 'string' || !body.query.trim() || body.query.length > 500 || ('refresh' in body && typeof body.refresh !== 'boolean')) return json({ error: 'Enter a shop name or HTTPS URL, up to 500 characters.' }, 400);
  const now = Date.now(), client = request.headers.get('cf-connecting-ip') || 'local';
  for (const [key, window] of windows) if (window.expiresAt < now) windows.delete(key);
  if (windows.size >= 256 && !windows.has(client)) return json({ error: 'Import is busy. Retry shortly.' }, 429);
  const window = windows.get(client) || { count: 0, expiresAt: now + 60_000 };
  if (++window.count > 6 || active >= 4) return json({ error: 'Please wait before importing another shop.' }, 429);
  windows.set(client, window);
  active++;
  try { return json(await importShop(body.query, { refresh: 'refresh' in body && body.refresh === true, signal: request.signal, timeoutMs: 87_000 })); }
  finally { active--; }
}
