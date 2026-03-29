import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ProfileWithNiches, EventWithHost, Niche } from '../types';

// ─── Map Profiles ─────────────────────────────────────────────────────────────

export function useMapProfiles() {
  return useQuery<ProfileWithNiches[]>({
    queryKey: ['mapProfiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          profile_niches(niches(*))
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;

      return (data ?? []).map((row: any) => {
        const niches: Niche[] = (row.profile_niches ?? [])
          .map((pn: any) => pn.niches)
          .filter(Boolean);
        return {
          ...row,
          niches,
          external_links: [],
          profile_niches: undefined,
        } as ProfileWithNiches;
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Map Events ───────────────────────────────────────────────────────────────

export function useMapEvents() {
  return useQuery<EventWithHost[]>({
    queryKey: ['mapEvents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events_with_host')
        .select('*')
        .eq('status', 'PUBLISHED')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data ?? []) as EventWithHost[];
    },
    staleTime: 2 * 60 * 1000,
  });
}
