import { useQuery } from '@tanstack/react-query';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ProfileWithNiches, EventWithHost } from '../types';

export interface SearchResults {
  profiles: ProfileWithNiches[];
  events: EventWithHost[];
}

function normalizeProfileRow(row: any): ProfileWithNiches {
  return {
    ...row,
    niches: (row.profile_niches ?? [])
      .map((pn: any) => pn.niches)
      .filter(Boolean)
      .map((n: any) => ({ ...n, id: String(n.id) })),
    external_links: row.external_links ?? [],
  };
}

function sanitizeQuery(raw: string): string {
  return raw
    .trim()
    .slice(0, 80)
    .replace(/[%_\\]/g, '\\$&')  // escape ilike wildcards so they match literally
    .replace(/[(),]/g, '');       // strip PostgREST .or() filter metacharacters
}

async function searchProfiles(query: string): Promise<ProfileWithNiches[]> {
  const trimmed = sanitizeQuery(query);
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      profile_niches (
        niches (id, name, color)
      ),
      external_links (*)
    `)
    .or(`display_name.ilike.%${trimmed}%,bio.ilike.%${trimmed}%`)
    .order('follower_count', { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map(normalizeProfileRow) as ProfileWithNiches[];
}

async function searchEvents(query: string): Promise<EventWithHost[]> {
  const trimmed = sanitizeQuery(query);
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .eq('status', 'PUBLISHED')
    .gt('end_time', new Date().toISOString())
    .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%,address_name.ilike.%${trimmed}%`)
    .order('start_time', { ascending: true })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as EventWithHost[];
}

export function useSearchProfiles(query: string) {
  const posthog = usePostHog();
  const lastTracked = useRef('');

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length > 0 && trimmed !== lastTracked.current) {
      lastTracked.current = trimmed;
      posthog?.capture('search_query', { query: trimmed, type: 'profiles' });
    }
  }, [query, posthog]);

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
        niches (id, name, color)
      ),
      external_links (*)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map(normalizeProfileRow) as ProfileWithNiches[];
}

export function useDiscoveryProfiles() {
  return useQuery<ProfileWithNiches[]>({
    queryKey: ['discoveryProfiles'],
    queryFn: fetchDiscoveryProfiles,
    staleTime: 5 * 60 * 1000,
  });
}

async function fetchProfilesByNiche(nicheName: string): Promise<ProfileWithNiches[]> {
  const { data: nicheData, error: nicheError } = await supabase
    .from('niches')
    .select('id')
    .ilike('name', nicheName)
    .single();

  if (nicheError || !nicheData) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      profile_niches!inner (
        niches (id, name, color)
      ),
      external_links (*)
    `)
    .eq('profile_niches.niche_id', nicheData.id)
    .order('follower_count', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeProfileRow);
}

export function useProfilesByNiche(nicheName: string) {
  return useQuery<ProfileWithNiches[]>({
    queryKey: ['profilesByNiche', nicheName],
    queryFn: () => fetchProfilesByNiche(nicheName),
    enabled: nicheName.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

async function fetchEventsByNiche(nicheName: string): Promise<EventWithHost[]> {
  const { data: nicheData, error: nicheError } = await supabase
    .from('niches')
    .select('id')
    .ilike('name', nicheName)
    .single();

  if (nicheError || !nicheData) return [];

  const { data: linkData, error: linkError } = await supabase
    .from('event_niches')
    .select('event_id')
    .eq('niche_id', nicheData.id);

  if (linkError || !linkData?.length) return [];

  const eventIds = linkData.map((r: { event_id: string }) => r.event_id);

  const { data, error } = await supabase
    .from('events_with_host')
    .select('*')
    .in('id', eventIds)
    .eq('status', 'PUBLISHED')
    .gt('end_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []) as EventWithHost[];
}

export function useEventsByNiche(nicheName: string) {
  return useQuery<EventWithHost[]>({
    queryKey: ['eventsByNiche', nicheName],
    queryFn: () => fetchEventsByNiche(nicheName),
    enabled: nicheName.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}
