import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ProfileSettings } from '../types';

export function useProfileSettings(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile_settings', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_settings')
        .select('*')
        .eq('profile_id', profileId!)
        .single();
      if (error) throw error;
      return data as ProfileSettings;
    },
    enabled: !!profileId,
  });
}

export function useUpdateProfileSettings(profileId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Pick<ProfileSettings, 'push_token' | 'notifications_enabled'>>) => {
      const { error } = await supabase
        .from('profile_settings')
        .update(updates)
        .eq('profile_id', profileId!);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_settings', profileId] });
    },
  });
}
