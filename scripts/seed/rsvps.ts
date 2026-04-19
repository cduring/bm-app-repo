import { SupabaseClient } from '@supabase/supabase-js';
import { mockProfiles, mockEvents } from '../../src/mock/mockData';
import { profileIdFromMock, eventIdFromMock, mulberry32, hashString } from './ids';

type RsvpStatus = 'INTERESTED' | 'REQUESTED' | 'GOING' | 'DECLINED';

export async function seedRsvps(client: SupabaseClient): Promise<void> {
  const eventIds = mockEvents.map((e) => eventIdFromMock(e.id));
  await client.from('event_rsvps').delete().in('event_id', eventIds);

  const rows: { event_id: number; profile_id: number; status: RsvpStatus }[] = [];

  for (const event of mockEvents) {
    const rand = mulberry32(hashString(`rsvp-${event.id}`));
    const eventNiches = new Set(event.niche_ids);
    const hostId = event.host_id;

    const scored = mockProfiles
      .filter((p) => p.id !== hostId)
      .map((p) => {
        const overlap = p.niche_ids.filter((n) => eventNiches.has(n)).length;
        const jitter = rand();
        return { profile: p, score: overlap * 2 + jitter };
      })
      .sort((a, b) => b.score - a.score);

    const count = 5 + Math.floor(rand() * 8);
    const picks = scored.slice(0, count);

    for (const { profile } of picks) {
      const r = rand();
      let status: RsvpStatus;
      if (event.privacy === 'EXCLUSIVE') {
        if (r < 0.3) status = 'REQUESTED';
        else if (r < 0.85) status = 'GOING';
        else status = 'INTERESTED';
      } else {
        status = r < 0.6 ? 'GOING' : 'INTERESTED';
      }
      rows.push({
        event_id: eventIdFromMock(event.id),
        profile_id: profileIdFromMock(profile.id),
        status,
      });
    }
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await client.from('event_rsvps').insert(chunk);
    if (error) throw error;
  }

  console.log(`  Inserted ${rows.length} RSVPs`);
}
