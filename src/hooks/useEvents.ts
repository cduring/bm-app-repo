import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { EventWithHost } from '../types';

const STALE_2MIN = 2 * 60 * 1000;

function normalizeEventRow(row: any): EventWithHost {
  return {
    ...row,
    niches: (row.niches ?? []).map((n: any) => ({ ...n, id: String(n.id) })),
  };
}

async function fetchEvents(): Promise<EventWithHost[]> {
  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .eq('status', 'PUBLISHED')
    .gt('end_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalizeEventRow) as EventWithHost[];
}

async function fetchEventById(id: string): Promise<EventWithHost> {
  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return normalizeEventRow(data);
}

async function fetchHostedEvents(profileId: string): Promise<EventWithHost[]> {
  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .eq('host_id', profileId)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalizeEventRow) as EventWithHost[];
}

export function useEvents() {
  return useQuery<EventWithHost[]>({
    queryKey: ['events'],
    queryFn: fetchEvents,
    staleTime: STALE_2MIN,
  });
}

export function useEventById(id: string | undefined) {
  return useQuery<EventWithHost>({
    queryKey: ['event', id],
    queryFn: () => fetchEventById(id!),
    enabled: !!id,
    staleTime: STALE_2MIN,
  });
}

async function fetchAttendingEvents(profileId: string): Promise<EventWithHost[]> {
  const { data: rsvpData, error: rsvpError } = await supabase
    .from('event_rsvps')
    .select('event_id')
    .eq('profile_id', profileId)
    .eq('status', 'GOING');

  if (rsvpError) throw rsvpError;
  if (!rsvpData || rsvpData.length === 0) return [];

  const eventIds = rsvpData.map((r: { event_id: string }) => r.event_id);

  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .in('id', eventIds)
    .eq('status', 'PUBLISHED')
    .eq('privacy', 'PUBLIC')
    .gt('end_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalizeEventRow) as EventWithHost[];
}

/** Returns PUBLIC PUBLISHED upcoming events the profile has RSVPed GOING to */
export function useAttendingEvents(profileId: string | undefined) {
  return useQuery<EventWithHost[]>({
    queryKey: ['attendingEvents', profileId],
    queryFn: () => fetchAttendingEvents(profileId!),
    enabled: !!profileId,
    staleTime: STALE_2MIN,
  });
}

/** Returns all events hosted by a profile including DRAFT and CANCELLED with RSVP counts */
export function useHostedEvents(profileId: string | undefined) {
  return useQuery<EventWithHost[]>({
    queryKey: ['hostedEvents', profileId],
    queryFn: () => fetchHostedEvents(profileId!),
    enabled: !!profileId,
    staleTime: STALE_2MIN,
  });
}