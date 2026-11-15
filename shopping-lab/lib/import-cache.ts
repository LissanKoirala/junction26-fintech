import type { ImportResult } from './shop-contract';

export interface ImportCacheRecord { result: ImportResult; images: Record<string, string>; expiresAt: number }
export interface ImportDatabase {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}
const local = new Map<string, ImportCacheRecord>();

export async function cacheKey(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
export async function readImportCache(key: string, db?: ImportDatabase): Promise<ImportCacheRecord | undefined> {
  if (!db) return local.get(key);
  const row = await db.prepare('SELECT result_json, images_json, expires_at FROM imported_catalogues WHERE cache_key = ?').bind(key).first<{ result_json: string; images_json: string; expires_at: number }>();
  if (!row) return undefined;
  try {
    const record = { result: JSON.parse(row.result_json) as ImportResult, images: JSON.parse(row.images_json) as Record<string, string>, expiresAt: row.expires_at };
    return record.result.status === 'ready' && Array.isArray(record.result.products) ? record : undefined;
  } catch { return undefined; }
}
export async function writeImportCache(key: string, record: ImportCacheRecord, db?: ImportDatabase): Promise<void> {
  if (!db) {
    if (local.size >= 64) local.delete(local.keys().next().value!);
    local.set(key, record);
    return;
  }
  await db.prepare('INSERT INTO imported_catalogues (cache_key, result_json, images_json, expires_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET result_json = excluded.result_json, images_json = excluded.images_json, expires_at = excluded.expires_at, updated_at = excluded.updated_at')
    .bind(key, JSON.stringify(record.result), JSON.stringify(record.images), record.expiresAt, Date.now()).run();
}
