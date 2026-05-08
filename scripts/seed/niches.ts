import { SupabaseClient } from '@supabase/supabase-js';
import { mockNiches } from '../../src/mock/mockData';

export async function seedNiches(client: SupabaseClient): Promise<Map<string, number>> {
  const rows = mockNiches.map((n) => ({ name: n.name, color: n.color, category: n.category }));
  const { data, error } = await client
    .from('niches')
    .upsert(rows, { onConflict: 'name' })
    .select('id, name');
  if (error) throw error;

  const nameToId = new Map<string, number>();
  for (const row of data ?? []) nameToId.set(row.name, row.id);

  const mockIdToDbId = new Map<string, number>();
  for (const n of mockNiches) {
    const dbId = nameToId.get(n.name);
    if (!dbId) throw new Error(`Missing niche DB id for "${n.name}"`);
    mockIdToDbId.set(n.id, dbId);
  }
  return mockIdToDbId;
}
