export type ImportFetch = typeof fetch;
export type ResolveHost = (hostname: string, signal: AbortSignal) => Promise<string[]>;
const forbiddenSuffix = /\.(?:localhost|local|internal|lan|home|test|invalid|example|onion|arpa)$/i;

export function isPublicAddress(input: string): boolean {
  const host = input.toLowerCase().replace(/^\[|\]$/g, '');
  if (host.includes(':')) {
    if (host.startsWith('::ffff:')) return isPublicAddress(host.slice(7));
    // Public global-unicast IPv6 only, excluding documentation space.
    return /^[23][0-9a-f]{0,3}:/.test(host) && !host.startsWith('2001:db8:') && !host.startsWith('2001:0:') && !host.startsWith('2002:');
  }
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b, c] = parts.map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 0 && c === 2))) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0 && c === 113));
}

export function publicUrl(input: string, base?: string): URL {
  let url: URL;
  try { url = new URL(input, base); } catch { throw new Error('unsafe_url'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password ||
    host === 'localhost' || !host.includes('.') || forbiddenSuffix.test(host) || host.endsWith('.') ||
    (/^[\d.]+$/.test(host) || host.includes(':')) && !isPublicAddress(host)) throw new Error('unsafe_url');
  return url;
}

export function merchantHost(input: string): string {
  return publicUrl(input).hostname.replace(/^www\./, '');
}
export function sameMerchant(input: string, merchant: string): boolean {
  try {
    const host = merchantHost(input);
    const domain = merchantHost(merchant);
    const family = (value: string) => {
      // Keep tenant-controlled hosting domains separate. The small compound
      // suffix set covers supported retail locales conservatively.
      if (/\.(?:myshopify\.com|github\.io|pages\.dev|vercel\.app|netlify\.app|cloudfront\.net|amazonaws\.com)$/.test(value)) return value;
      const count = /\.(?:co\.uk|org\.uk|com\.au|co\.nz|co\.jp|com\.br|com\.mx|co\.za|com\.sg|com\.hk|com\.es)$/.test(value) ? 3 : 2;
      return value.split('.').slice(-count).join('.');
    };
    return host === domain || family(host) === family(domain);
  } catch { return false; }
}

export function normalizeImportUrl(input: string): string {
  const url = publicUrl(input);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href;
}

export async function readBounded(response: Response, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length') || 0) > maxBytes) throw new Error('response_too_large');
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (signal?.aborted) throw new Error('cancelled');
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('response_too_large'); }
      chunks.push(part.value);
    }
  } finally { signal?.removeEventListener('abort', abort); reader.releaseLock(); }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export function makeSafeFetcher(options: { fetch?: ImportFetch; signal: AbortSignal; resolveHost?: ResolveHost; maxRequests?: number }) {
  const request = options.fetch ?? fetch;
  let requests = 0;
  const checked = new Map<string, Promise<void>>();
  const resolveHost: ResolveHost = options.resolveHost ?? (async (hostname, signal) => {
    const answers = await Promise.all(['A', 'AAAA'].map(async type => {
      if (++requests > (options.maxRequests ?? 40)) throw new Error('request_limit');
      const response = await request(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, {
        signal, headers: { Accept: 'application/dns-json' }, redirect: 'manual',
      });
      if (!response.ok) throw new Error('dns_unavailable');
      const data = JSON.parse(new TextDecoder().decode(await readBounded(response, 32_768, signal))) as { Status?: number; Answer?: Array<{ type: number; data: string }> };
      if (data.Status !== 0 && data.Status !== 3) throw new Error('dns_unavailable');
      return data.Answer?.filter(answer => answer.type === 1 || answer.type === 28).map(answer => answer.data) ?? [];
    }));
    return answers.flat();
  });
  async function validate(url: URL) {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isPublicAddress(host)) return;
    if (!checked.has(host)) checked.set(host, (async () => {
      const addresses = await resolveHost(host, options.signal);
      if (!addresses.length || !addresses.every(isPublicAddress)) throw new Error('unsafe_address');
    })());
    await checked.get(host);
  }
  return async function safeFetch(input: string, config: { method?: 'GET' | 'HEAD'; maxBytes?: number; image?: boolean; onRedirect?: (url: string) => void } = {}) {
    let url = publicUrl(input);
    let retried = false;
    for (let redirects = 0; redirects <= 4; redirects++) {
      if (options.signal.aborted) throw new Error('cancelled');
      await validate(url);
      if (++requests > (options.maxRequests ?? 40)) throw new Error('request_limit');
      const response = await request(url.href, {
        method: config.method ?? 'GET', signal: options.signal, redirect: 'manual',
        headers: { Accept: config.image ? 'image/avif,image/webp,image/png,image/jpeg,image/gif' : 'text/html,application/json,application/ld+json;q=0.9', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
      });
      if (response.status === 429 && !retried) {
        const retry = response.headers.get('retry-after');
        const wait = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : Number.NaN;
        if (Number.isFinite(wait) && wait >= 0 && wait <= 2000) {
          retried = true;
          await response.body?.cancel();
          await new Promise<void>((resolve, reject) => {
            const abort = () => { clearTimeout(timer); reject(new Error('cancelled')); };
            const timer = setTimeout(() => { options.signal.removeEventListener('abort', abort); resolve(); }, wait);
            options.signal.addEventListener('abort', abort, { once: true });
          });
          redirects--;
          continue;
        }
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = response.headers.get('location');
        await response.body?.cancel();
        if (!next || redirects === 4) throw new Error('redirect_limit');
        url = publicUrl(next, url.href);
        config.onRedirect?.(url.href);
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`${response.status === 403 || response.status === 429 ? 'source_blocked' : 'source_unavailable'}_${response.status}`); }
      const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (config.image ? !/^image\/(?:jpeg|png|webp|gif|avif)$/.test(type) : !/^(?:text\/(?:html|plain|javascript)|application\/(?:json|ld\+json|javascript))$/.test(type)) {
        await response.body?.cancel(); throw new Error('unsupported_content_type');
      }
      const maxBytes = config.maxBytes ?? (config.image ? 5_000_000 : 1_500_000);
      if (Number(response.headers.get('content-length') || 0) > maxBytes) { await response.body?.cancel(); throw new Error('response_too_large'); }
      const bytes = config.method === 'HEAD' ? new Uint8Array() : await readBounded(response, maxBytes, options.signal);
      return { url: url.href, type, bytes, text: new TextDecoder().decode(bytes) };
    }
    throw new Error('redirect_limit');
  };
}

export type SafeFetcher = ReturnType<typeof makeSafeFetcher>;
