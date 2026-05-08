import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { BlockedUserEntry } from '../types';

const STALE_5MIN = 5 * 60 * 1000;

export function useBlockedIds(myProfileId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ['blockedIds', myProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', myProfileId!);
      if (error) throw error;
      return (data ?? []).map((r) => String(r.blocked_id));
    },
    enabled: !!myProfileId,
    staleTime: STALE_5MIN,
  });
}

export function useBlockedProfiles(myProfileId: string | undefined) {
  return useQuery<BlockedUserEntry[]>({
    queryKey: ['blockedProfiles', myProfileId],
    queryFn: async () => {
      const { data: blockData, error: blockError } = await supabase
        .from('blocked_users')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', myProfileId!);
      if (blockError) throw blockError;
      if (!blockData || blockData.length === 0) return [];

      const blockedIds = blockData.map((b) => b.blocked_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, profile_picture_url')
        .in('id', blockedIds);
      if (profileError) throw profileError;

      const profileMap = new Map(
        (profileData ?? []).map((p) => [String(p.id), p]),
      );

      return blockData.map((b) => ({
        id: String(b.id),
        blocked_id: String(b.blocked_id),
        created_at: b.created_at,
        blocked_profile: profileMap.get(String(b.blocked_id)) ?? {
          id: String(b.blocked_id),
          display_name: 'Unknown User',
          profile_picture_url: null,
        },
      }));
    },
    enabled: !!myProfileId,
    staleTime: STALE_5MIN,
  });
}

export function useBlockerIds(myProfileId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ['blockerIds', myProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocked_id', myProfileId!);
      if (error) throw error;
      return (data ?? []).map((r) => String(r.blocker_id));
    },
    enabled: !!myProfileId,
    staleTime: STALE_5MIN,
  });
}

export function useExcludedIds(myProfileId: string | undefined): string[] {
  const { data: blockedIds = [] } = useBlockedIds(myProfileId);
  const { data: blockerIds = [] } = useBlockerIds(myProfileId);
  return useMemo(
    () =>
      blockedIds.length === 0 && blockerIds.length === 0
        ? []
        : [...new Set([...blockedIds, ...blockerIds])],
    [blockedIds, blockerIds],
  );
}

export function useIsBlockedBy(
  viewedProfileId: string | undefined,
  myProfileId: string | undefined,
) {
  return useQuery<boolean>({
    queryKey: ['isBlockedBy', viewedProfileId, myProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', viewedProfileId!)
        .eq('blocked_id', myProfileId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!viewedProfileId && !!myProfileId && viewedProfileId !== myProfileId,
    staleTime: STALE_5MIN,
  });
}

interface BlockUserVars {
  myProfileId: string;
  myDisplayName: string;
  myEmail: string;
  blockedId: string;
  blockedDisplayName: string;
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      myProfileId,
      myDisplayName,
      myEmail,
      blockedId,
      blockedDisplayName,
    }: BlockUserVars) => {
      const { error } = await supabase
        .from('blocked_users')
        .insert({ blocker_id: myProfileId, blocked_id: blockedId });
      if (error) throw error;

      const { error: cleanupError } = await supabase.rpc('block_user_cleanup', {
        p_blocker_id: Number(myProfileId),
        p_blocked_id: Number(blockedId),
      });
      if (cleanupError) throw cleanupError;

      await supabase.functions.invoke('send-email', {
        body: {
          type: 'block_user',
          fromUser: { email: myEmail, displayName: myDisplayName },
          payload: {
            blockedUserId: blockedId,
            blockedDisplayName,
            reason: 'User initiated block',
          },
        },
      });
    },
    onSuccess: (_data, { myProfileId, blockedId }) => {
      queryClient.invalidateQueries({ queryKey: ['blockedIds', myProfileId] });
      queryClient.invalidateQueries({ queryKey: ['blockedProfiles', myProfileId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['discoveryProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['mapProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['mapEvents'] });
      // Follows cleanup
      queryClient.invalidateQueries({ queryKey: ['isFollowing', myProfileId, blockedId] });
      queryClient.invalidateQueries({ queryKey: ['isFollowing', blockedId, myProfileId] });
      queryClient.invalidateQueries({ queryKey: ['followers', myProfileId] });
      queryClient.invalidateQueries({ queryKey: ['following', myProfileId] });
      queryClient.invalidateQueries({ queryKey: ['followers', blockedId] });
      queryClient.invalidateQueries({ queryKey: ['following', blockedId] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profileById', myProfileId] });
      queryClient.invalidateQueries({ queryKey: ['profileById', blockedId] });
      // RSVP cleanup
      queryClient.invalidateQueries({ queryKey: ['myRSVPs'] });
      queryClient.invalidateQueries({ queryKey: ['eventAttendees'] });
    },
  });
}

interface UnblockUserVars {
  myProfileId: string;
  blockedId: string;
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ myProfileId, blockedId }: UnblockUserVars) => {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', myProfileId)
        .eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: (_data, { myProfileId }) => {
      queryClient.invalidateQueries({ queryKey: ['blockedIds', myProfileId] });
      queryClient.invalidateQueries({ queryKey: ['blockedProfiles', myProfileId] });
    },
  });
}
