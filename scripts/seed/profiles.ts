import { SupabaseClient } from '@supabase/supabase-js';
import { mockProfiles } from '../../src/mock/mockData';
import { profileIdFromMock } from './ids';
import { runWithConcurrency, stabilizeImage } from './images';

const AVATARS_BUCKET = 'avatars';

export async function seedProfiles(
  client: SupabaseClient,
  nicheMap: Map<string, number>,
): Promise<void> {
  console.log(`  Stabilizing ${mockProfiles.length} profile avatars...`);
  const stabilizedUrls = await runWithConcurrency(mockProfiles, 6, async (p) => {
    if (!p.profile_picture_url) return null;
    const dbId = profileIdFromMock(p.id);
    return stabilizeImage(
      client,
      p.profile_picture_url,
      AVATARS_BUCKET,
      `mock/${dbId}.jpg`,
    );
  });

  const profileRows = mockProfiles.map((p, i) => ({
    id: profileIdFromMock(p.id),
    user_id: null,
    display_name: p.display_name,
    bio: p.bio,
    profile_type: p.profile_type,
    years_in_business: p.years_in_business ?? null,
    profile_picture_url: stabilizedUrls[i] ?? null,
    banner_image_url: p.banner_image_url ?? null,
    location_name: p.location_name ?? null,
    location_fsa: p.location_fsa ?? null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    follower_count: 0,
    following_count: 0,
    created_at: p.created_at,
  }));

  const { error: profileError } = await client
    .from('profiles')
    .upsert(profileRows, { onConflict: 'id' });
  if (profileError) throw profileError;

  const profileNicheRows = mockProfiles.flatMap((p) =>
    p.niche_ids.map((nid) => ({
      profile_id: profileIdFromMock(p.id),
      niche_id: nicheMap.get(nid)!,
    })),
  );
  const { error: pnError } = await client
    .from('profile_niches')
    .upsert(profileNicheRows, { onConflict: 'profile_id,niche_id' });
  if (pnError) throw pnError;

  const profileIds = mockProfiles.map((p) => profileIdFromMock(p.id));
  await client.from('external_links').delete().in('profile_id', profileIds);

  const linkRows = mockProfiles.flatMap((p) =>
    p.external_links.map((l) => ({
      profile_id: profileIdFromMock(p.id),
      platform_name: l.platform_name,
      url: l.url,
    })),
  );
  if (linkRows.length) {
    const { error: linkError } = await client.from('external_links').insert(linkRows);
    if (linkError) throw linkError;
  }
}
