import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ProfileWithNiches, EventWithHost } from '../types';

export interface SearchResults {
  profiles: ProfileWithNiches[];
  events: EventWithHost[];
}

async function searchProfiles(query: string): Promise<ProfileWithNiches[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      profile_niches (
        niches (id, name)
      ),
      external_links (*)
    `)
    .or(`display_name.ilike.%${trimmed}%,bio.ilike.%${trimmed}%`)
    .order('follower_count', { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    niches: (row.profile_niches ?? []).map((pn: any) => pn.niches).filter(Boolean),
    external_links: row.external_links ?? [],
  })) as ProfileWithNiches[];
}

async function searchEvents(query: string): Promise<EventWithHost[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .eq('status', 'PUBLISHED')
    .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%,address_name.ilike.%${trimmed}%`)
    .order('start_time', { ascending: true })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as EventWithHost[];
}

export function useSearchProfiles(query: string) {
  return useQuery<ProfileWithNiches[]>({
    queryKey: ['searchProfiles', query],
    queryFn: () => searchProfiles(query),
    enabled: query.trim().length > 0,
    staleTime: 30 * 1000,
  });
}

export function useSearchEvents(query: string) {
  return useQuery<EventWithHost[]>({
    queryKey: ['searchEvents', query],
    queryFn: () => searchEvents(query),
    enabled: query.trim().length > 0,
    staleTime: 30 * 1000,
  });
}

async function fetchDiscoveryProfiles(): Promise<ProfileWithNiches[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      profile_niches (
        niches (id, name)
      ),
      external_links (*)
    `)
    .order('follower_count', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    niches: (row.profile_niches ?? []).map((pn: any) => pn.niches).filter(Boolean),
    external_links: row.external_links ?? [],
  })) as ProfileWithNiches[];
}

export function useDiscoveryProfiles() {
  return useQuery<ProfileWithNiches[]>({
    queryKey: ['discoveryProfiles'],
    queryFn: fetchDiscoveryProfiles,
    staleTime: 5 * 60 * 1000,
  });
}
