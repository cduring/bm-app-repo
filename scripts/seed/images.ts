import { SupabaseClient } from '@supabase/supabase-js';

const folderCache = new Map<string, Set<string>>();

async function listFolder(client: SupabaseClient, bucket: string, folder: string): Promise<Set<string>> {
  const cacheKey = `${bucket}:${folder}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;
  const { data, error } = await client.storage.from(bucket).list(folder, { limit: 1000 });
  if (error) throw error;
  const set = new Set((data ?? []).map((f) => f.name));
  folderCache.set(cacheKey, set);
  return set;
}

export async function stabilizeImage(
  client: SupabaseClient,
  sourceUrl: string,
  bucket: string,
  objectPath: string,
): Promise<string> {
  const parts = objectPath.split('/');
  const folder = parts.slice(0, -1).join('/');
  const name = parts[parts.length - 1];

  const existing = await listFolder(client, bucket, folder);
  if (!existing.has(name)) {
    const res = await fetch(sourceUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Fetch ${sourceUrl} failed: ${res.status}`);
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buf = await res.arrayBuffer();
    const { error } = await client.storage.from(bucket).upload(objectPath, buf, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    existing.add(name);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
