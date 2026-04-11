import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AppNotification } from '../types';

const NOTIFICATIONS_QUERY_KEY = (profileId: string) => ['notifications', profileId];
const UNREAD_COUNT_QUERY_KEY = (profileId: string) => ['notifications-unread', profileId];

export function useNotificationsData(profileId: string | undefined) {
  return useQuery<AppNotification[]>({
    queryKey: profileId ? NOTIFICATIONS_QUERY_KEY(profileId) : [],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey (
            id, display_name, profile_picture_url
          ),
          event:events!notifications_event_id_fkey (
            id, title, cover_image_url
          )
        `)
        .eq('recipient_id', profileId!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
    enabled: !!profileId,
    staleTime: 30_000,
  });
}

export function useUnreadCount(profileId: string | undefined) {
  return useQuery<number>({
    queryKey: profileId ? UNREAD_COUNT_QUERY_KEY(profileId) : [],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', profileId!)
        .is('read_at', null);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!profileId,
    staleTime: 15_000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ notificationId, profileId }: { notificationId: string; profileId: string }) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .is('read_at', null);
      if (error) throw error;
      return profileId;
    },
    onSuccess: (profileId) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY(profileId) });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY(profileId) });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', profileId)
        .is('read_at', null);
      if (error) throw error;
      return profileId;
    },
    onSuccess: (profileId) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY(profileId) });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY(profileId) });
    },
  });
}
