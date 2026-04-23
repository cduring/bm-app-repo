import { createClient } from 'jsr:@supabase/supabase-js@2';

interface NotificationRecord {
  id: string;
  recipient_id: number;
  type: string;
  actor_id: number | null;
  event_id: number | null;
  read_at: string | null;
  created_at: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: NotificationRecord;
  schema: string;
  old_record: NotificationRecord | null;
}

function buildPayload(
  type: string,
  actorName: string,
  eventTitle: string,
  record: NotificationRecord,
): object | null {
  switch (type) {
    case 'new_follower':
      return {
        title: 'New follower',
        body: `${actorName} started following you`,
        data: { type: 'new_follower', profileId: String(record.actor_id) },
      };
    case 'new_rsvp_going':
      return {
        title: 'New RSVP',
        body: `${actorName} is going to ${eventTitle}`,
        data: { type: 'new_rsvp_going', eventId: String(record.event_id) },
      };
    case 'new_rsvp_requested':
      return {
        title: 'New RSVP request',
        body: `${actorName} wants to attend ${eventTitle}`,
        data: { type: 'new_rsvp_requested', eventId: String(record.event_id) },
      };
    case 'rsvp_approved':
      return {
        title: 'RSVP approved',
        body: `You're going to ${eventTitle}!`,
        data: { type: 'rsvp_approved', eventId: String(record.event_id) },
      };
    case 'rsvp_declined':
      return {
        title: 'RSVP declined',
        body: `Your request to attend ${eventTitle} was not approved`,
        data: { type: 'rsvp_declined', eventId: String(record.event_id) },
      };
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return new Response('OK', { status: 200 });
    }

    const notification = payload.record;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: settings } = await supabase
      .from('profile_settings')
      .select('push_token, notifications_enabled')
      .eq('profile_id', notification.recipient_id)
      .single();

    if (!settings?.push_token || !settings?.notifications_enabled) {
      return new Response('No token or notifications disabled', { status: 200 });
    }

    let actorName = 'Someone';
    if (notification.actor_id) {
      const { data: actor } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', notification.actor_id)
        .single();
      if (actor) {
        actorName = actor.display_name || actor.username || 'Someone';
      }
    }

    let eventTitle = 'an event';
    if (notification.event_id) {
      const { data: event } = await supabase
        .from('events')
        .select('title')
        .eq('id', notification.event_id)
        .single();
      if (event?.title) {
        eventTitle = event.title;
      }
    }

    const content = buildPayload(notification.type, actorName, eventTitle, notification);
    if (!content) {
      return new Response('Unknown notification type', { status: 200 });
    }

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: settings.push_token, ...content }),
    });

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('push-notification error:', err);
    return new Response('Internal error', { status: 500 });
  }
});
