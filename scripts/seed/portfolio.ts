import { SupabaseClient } from '@supabase/supabase-js';
import { mockProfiles } from '../../src/mock/mockData';
import { profileIdFromMock, mulberry32, hashString } from './ids';
import { runWithConcurrency, stabilizeImage } from './images';

const PORTFOLIO_BUCKET = 'post-media';

export async function seedPortfolio(client: SupabaseClient): Promise<void> {
  const profileIds = mockProfiles.map((p) => profileIdFromMock(p.id));
  await client.from('portfolio_images').delete().in('profile_id', profileIds);

  type Task = { dbProfileId: number; mockId: string; order: number };
  const tasks: Task[] = [];
  for (const p of mockProfiles) {
    const rand = mulberry32(hashString(`portfolio-${p.id}`));
    const count = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      tasks.push({ dbProfileId: profileIdFromMock(p.id), mockId: p.id, order: i });
    }
  }

  console.log(`  Stabilizing ${tasks.length} portfolio images...`);
  const urls = await runWithConcurrency(tasks, 8, async (t) => {
    const sourceUrl = `https://picsum.photos/seed/portfolio-${t.mockId}-${t.order}/800/800`;
    const objectPath = `portfolio/mock/${t.dbProfileId}-${t.order}.jpg`;
    return stabilizeImage(client, sourceUrl, PORTFOLIO_BUCKET, objectPath);
  });

  const rows = tasks.map((t, i) => ({
    profile_id: t.dbProfileId,
    image_url: urls[i],
    display_order: t.order,
  }));

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await client.from('portfolio_images').insert(rows.slice(i, i + BATCH));
    if (error) throw error;
  }

  console.log(`  Inserted ${rows.length} portfolio images`);
}
