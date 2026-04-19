import { SupabaseClient } from '@supabase/supabase-js';
import { mockProfiles } from '../../src/mock/mockData';
import { profileIdFromMock, mulberry32, hashString } from './ids';

export async function seedFollows(client: SupabaseClient): Promise<void> {
  const profileIds = mockProfiles.map((p) => profileIdFromMock(p.id));

  await client.from('follows').delete().in('follower_id', profileIds);

  const rows: { follower_id: number; following_id: number }[] = [];

  for (const follower of mockProfiles) {
    const rand = mulberry32(hashString(`follows-${follower.id}`));
    const followerNiches = new Set(follower.niche_ids);

    const scored = mockProfiles
      .filter((p) => p.id !== follower.id)
      .map((p) => {
        const overlap = p.niche_ids.filter((n) => followerNiches.has(n)).length;
        const jitter = rand();
        return { target: p, score: overlap * 2 + jitter };
      })
      .sort((a, b) => b.score - a.score);

    const count = 6 + Math.floor(rand() * 9);
    const picks = scored.slice(0, count);

    for (const { target } of picks) {
      rows.push({
        follower_id: profileIdFromMock(follower.id),
        following_id: profileIdFromMock(target.id),
      });
    }
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await client.from('follows').insert(chunk);
    if (error) throw error;
  }

  console.log(`  Inserted ${rows.length} follow edges`);
}
