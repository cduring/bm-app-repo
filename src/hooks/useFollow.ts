import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePostHog } from 'posthog-react-native';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

/** Check if currentProfileId follows targetProfileId */
export function useIsFollowing(
  currentProfileId: string | undefined,
  targetProfileId: string | undefined,
) {
  return useQuery<boolean>({
    queryKey: ['isFollowing', currentProfileId, targetProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentProfileId!)
        .eq('following_id', targetProfileId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!currentProfileId && !!targetProfileId && currentProfileId !== targetProfileId,
  });
}

/** Follow a user */
export function useFollowMutation() {
  const qc = useQueryClient();
  const posthog = usePostHog();

  return useMutation({
    mutationFn: async ({
      followerId,
      followingId,
    }: {
      followerId: string;
      followingId: string;
    }) => {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: followerId, following_id: followingId });
      if (error) throw error;
      posthog?.capture('follow', { follower_id: followerId, following_id: followingId });
    },
    onMutate: async ({ followerId, followingId }) => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: ['isFollowing', followerId, followingId] });
      await qc.cancelQueries({ queryKey: ['profileById', followingId] });

      // Snapshot previous values
      const prevIsFollowing = qc.getQueryData(['isFollowing', followerId, followingId]);
      const prevProfile = qc.getQueryData(['profileById', followingId]);

      // Optimistically update
      qc.setQueryData(['isFollowing', followerId, followingId], true);
      qc.setQueryData(['profileById', followingId], (old: any) => {
        if (!old?.profile) return old;
        return {
          ...old,
          profile: { ...old.profile, follower_count: (old.profile.follower_count ?? 0) + 1 },
        };
      });

      return { prevIsFollowing, prevProfile };
    },
    onError: (_err, { followerId, followingId }, context) => {
      // Rollback on error
      if (context) {
        qc.setQueryData(['isFollowing', followerId, followingId], context.prevIsFollowing);
        qc.setQueryData(['profileById', followingId], context.prevProfile);
      }
    },
    onSettled: (_, __, { followerId, followingId }) => {
      qc.invalidateQueries({ queryKey: ['isFollowing', followerId, followingId] });
      qc.invalidateQueries({ queryKey: ['followers', followingId] });
      qc.invalidateQueries({ queryKey: ['following', followerId] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['profileById', followingId] });
      qc.invalidateQueries({ queryKey: ['profileById', followerId] });
    },
  });
}

/** Unfollow a user */
export function useUnfollowMutation() {
  const qc = useQueryClient();
  const posthog = usePostHog();

  return useMutation({
    mutationFn: async ({
      followerId,
      followingId,
    }: {
      followerId: string;
      followingId: string;
    }) => {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);
      if (error) throw error;
      posthog?.capture('unfollow', { follower_id: followerId, following_id: followingId });
    },
    onMutate: async ({ followerId, followingId }) => {
      await qc.cancelQueries({ queryKey: ['isFollowing', followerId, followingId] });
      await qc.cancelQueries({ queryKey: ['profileById', followingId] });

      const prevIsFollowing = qc.getQueryData(['isFollowing', followerId, followingId]);
      const prevProfile = qc.getQueryData(['profileById', followingId]);

      qc.setQueryData(['isFollowing', followerId, followingId], false);
      qc.setQueryData(['profileById', followingId], (old: any) => {
        if (!old?.profile) return old;
        return {
          ...old,
          profile: { ...old.profile, follower_count: Math.max(0, (old.profile.follower_count ?? 0) - 1) },
        };
      });

      return { prevIsFollowing, prevProfile };
    },
    onError: (_err, { followerId, followingId }, context) => {
      if (context) {
        qc.setQueryData(['isFollowing', followerId, followingId], context.prevIsFollowing);
        qc.setQueryData(['profileById', followingId], context.prevProfile);
      }
    },
    onSettled: (_, __, { followerId, followingId }) => {
      qc.invalidateQueries({ queryKey: ['isFollowing', followerId, followingId] });
      qc.invalidateQueries({ queryKey: ['followers', followingId] });
      qc.invalidateQueries({ queryKey: ['following', followerId] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['profileById', followingId] });
      qc.invalidateQueries({ queryKey: ['profileById', followerId] });
    },
  });
}

/** Fetch followers of a profile (people who follow them) */
export function useFollowers(profileId: string | undefined) {
  return useQuery<Profile[]>({
    queryKey: ['followers', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('follower:profiles!follower_id(*)')
        .eq('following_id', profileId!);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.follower as Profile);
    },
    enabled: !!profileId,
  });
}

/** Fetch profiles that a user is following */
export function useFollowing(profileId: string | undefined) {
  return useQuery<Profile[]>({
    queryKey: ['following', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('following:profiles!following_id(*)')
        .eq('follower_id', profileId!);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.following as Profile);
    },
    enabled: !!profileId,
  });
}
