import { SupabaseClient } from '@supabase/supabase-js';
import { MOCK_PROFILE_ID_RANGE, MOCK_EVENT_ID_RANGE } from './ids';

export async function resetMockData(client: SupabaseClient): Promise<void> {
  const { min: pMin, max: pMax } = MOCK_PROFILE_ID_RANGE;
  const { min: eMin, max: eMax } = MOCK_EVENT_ID_RANGE;

  const { error: evError } = await client
    .from('events')
    .delete()
    .gte('id', eMin)
    .lte('id', eMax);
  if (evError) throw evError;

  const { error: profError } = await client
    .from('profiles')
    .delete()
    .gte('id', pMin)
    .lte('id', pMax);
  if (profError) throw profError;

  console.log('  Deleted mock events and profiles (cascades cleared related rows)');
}
