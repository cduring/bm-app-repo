import { SupabaseClient } from '@supabase/supabase-js';
import { mockEvents } from '../../src/mock/mockData';
import { eventIdFromMock, profileIdFromMock } from './ids';
import { runWithConcurrency, stabilizeImage } from './images';

const EVENT_COVERS_BUCKET = 'event-covers';

function normalizeRecurrenceRule(rule: string | null): string | null {
  if (!rule) return null;
  const freqMatch = /FREQ=([A-Z]+)/.exec(rule);
  const freq = freqMatch?.[1];
  if (freq === 'WEEKLY') return 'WEEKLY';
  if (freq === 'MONTHLY') return 'MONTHLY';
  if (freq === 'BIWEEKLY') return 'BIWEEKLY';
  if (rule === 'WEEKLY' || rule === 'MONTHLY' || rule === 'BIWEEKLY') return rule;
  return null;
}

export async function seedEvents(
  client: SupabaseClient,
  nicheMap: Map<string, number>,
): Promise<void> {
  console.log(`  Stabilizing ${mockEvents.length} event covers...`);
  const stabilizedCovers = await runWithConcurrency(mockEvents, 6, async (e) => {
    if (!e.cover_image_url) return null;
    const dbId = eventIdFromMock(e.id);
    return stabilizeImage(
      client,
      e.cover_image_url,
      EVENT_COVERS_BUCKET,
      `mock/${dbId}.jpg`,
    );
  });

  const eventRows = mockEvents.map((e, i) => ({
    id: eventIdFromMock(e.id),
    host_id: profileIdFromMock(e.host_id),
    title: e.title,
    description: e.description,
    event_type: e.event_type,
    privacy: e.privacy,
    start_time: e.start_time,
    end_time: e.end_time,
    latitude: e.latitude,
    longitude: e.longitude,
    address_name: e.address_name,
    cover_image_url: stabilizedCovers[i],
    status: e.status,
    is_recurring: e.is_recurring,
    recurrence_rule: normalizeRecurrenceRule(e.recurrence_rule),
    recurrence_end_date: e.recurrence_end_date,
    parent_event_id: e.parent_event_id ? eventIdFromMock(e.parent_event_id) : null,
    created_at: e.created_at,
  }));

  const { error: evError } = await client
    .from('events')
    .upsert(eventRows, { onConflict: 'id' });
  if (evError) throw evError;

  const eventNicheRows = mockEvents.flatMap((e) =>
    e.niche_ids.map((nid) => ({
      event_id: eventIdFromMock(e.id),
      niche_id: nicheMap.get(nid)!,
    })),
  );
  const { error: enError } = await client
    .from('event_niches')
    .upsert(eventNicheRows, { onConflict: 'event_id,niche_id' });
  if (enError) throw enError;
}
