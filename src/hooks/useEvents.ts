import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { EventWithHost } from '../types';

const STALE_2MIN = 2 * 60 * 1000;

async function fetchEvents(): Promise<EventWithHost[]> {
  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .eq('status', 'PUBLISHED')
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data as EventWithHost[];
}

async function fetchEventById(id: string): Promise<EventWithHost> {
  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as EventWithHost;
}

async function fetchHostedEvents(profileId: string): Promise<EventWithHost[]> {
  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .eq('host_id', profileId)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data as EventWithHost[];
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

/** Returns all events hosted by a profile including DRAFT and CANCELLED with RSVP counts */
export function useHostedEvents(profileId: string | undefined) {
  return useQuery<EventWithHost[]>({
    queryKey: ['hostedEvents', profileId],
    queryFn: () => fetchHostedEvents(profileId!),
    enabled: !!profileId,
    staleTime: STALE_2MIN,
  });
}