import { createSeedClient } from './seed/supabase';
import { eventIdFromMock, mulberry32, hashString } from './seed/ids';
import { mockEvents } from '../src/mock/mockData';

type RsvpStatus = 'INTERESTED' | 'REQUESTED' | 'GOING' | 'DECLINED';

const TARGET_PER_EVENT = { min: 50, max: 80 };

async function main() {
  const client = createSeedClient();
  const url = process.env.SUPABASE_URL!;
  console.log(`→ Inflating RSVPs on ${new URL(url).host}`);

  // Fetch all profile IDs from the DB (mock + real staging users)
  const { data: profileRows, error: profileErr } = await client
    .from('profiles')
    .select('id');
  if (profileErr) throw profileErr;
  const allProfileIds: number[] = (profileRows ?? []).map((r: { id: number }) => r.id);
  console.log(`  ${allProfileIds.length} profiles available as attendees`);

  const eventIds = mockEvents.map((e) => eventIdFromMock(e.id));
  await client.from('event_rsvps').delete().in('event_id', eventIds);

  const rows: { event_id: number; profile_id: number; status: RsvpStatus }[] = [];

  for (const event of mockEvents) {
    const rand = mulberry32(hashString(`inflate-rsvp-${event.id}`));
    const dbEventId = eventIdFromMock(event.id);

    // Shuffle all profiles deterministically, then pick a target count
    const shuffled = [...allProfileIds].sort(() => rand() - 0.5);
    const target = TARGET_PER_EVENT.min + Math.floor(rand() * (TARGET_PER_EVENT.max - TARGET_PER_EVENT.min + 1));
    const picks = shuffled.slice(0, Math.min(target, shuffled.length));

    for (const profileId of picks) {
      const r = rand();
      let status: RsvpStatus;
      if (event.privacy === 'EXCLUSIVE') {
        if (r < 0.3) status = 'REQUESTED';
        else if (r < 0.85) status = 'GOING';
        else status = 'INTERESTED';
      } else {
        status = r < 0.6 ? 'GOING' : 'INTERESTED';
      }
      rows.push({ event_id: dbEventId, profile_id: profileId, status });
    }
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await client.from('event_rsvps').insert(chunk);
    if (error) throw error;
  }

  console.log(`  Inserted ${rows.length} RSVPs across ${mockEvents.length} events`);
  console.log('✓ Done');
}

main().catch((err) => {
  console.error('✗ Failed:', err);
  process.exit(1);
});
