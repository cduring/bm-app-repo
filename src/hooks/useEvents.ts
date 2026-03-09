import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { EventWithHost } from '../types';

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

export function useEvents() {
  return useQuery<EventWithHost[]>({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });
}

export function useEventById(id: string | undefined) {
  return useQuery<EventWithHost>({
    queryKey: ['event', id],
    queryFn: () => fetchEventById(id!),
    enabled: !!id,
  });
}