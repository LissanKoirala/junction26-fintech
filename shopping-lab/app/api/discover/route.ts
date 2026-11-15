import { allowDiscoveryRequest, discover } from '../../../lib/discovery';

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return json({ error: 'Use this endpoint from the shop page.' }, 403);
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'Expected application/json.' }, 415);
  }
  if (!allowDiscoveryRequest(request.headers.get('cf-connecting-ip') || 'local')) {
    return json({ error: 'Please wait a moment before discovering another shop.' }, 429);
  }
  if (Number(request.headers.get('content-length') || 0) > 2048) return json({ error: 'Request is too large.' }, 413);
  let data: unknown;
  // Read with a byte ceiling, including requests sent without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'Enter a shop name or link.' }, 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); return json({ error: 'Request is too large.' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!data || typeof data !== 'object' || !('query' in data) || typeof data.query !== 'string' || !data.query.trim() || data.query.length > 256) {
    return json({ error: 'Enter a shop name or link, up to 256 characters.' }, 400);
  }
  return json(await discover(data.query));
}
