import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

      // Update denormalized counts
      await Promise.all([
        supabase.rpc('increment_count', {
          row_id: followerId,
          column_name: 'following_count',
          amount: 1,
        }).then(({ error }) => {
          // Fallback if RPC doesn't exist: manual update
          if (error) {
            return supabase
              .from('profiles')
              .select('following_count')
              .eq('id', followerId)
              .single()
              .then(({ data }) =>
                supabase
                  .from('profiles')
                  .update({ following_count: (data?.following_count ?? 0) + 1 })
                  .eq('id', followerId),
              );
          }
        }),
        supabase.rpc('increment_count', {
          row_id: followingId,
          column_name: 'follower_count',
          amount: 1,
        }).then(({ error }) => {
          if (error) {
            return supabase
              .from('profiles')
              .select('follower_count')
              .eq('id', followingId)
              .single()
              .then(({ data }) =>
                supabase
                  .from('profiles')
                  .update({ follower_count: (data?.follower_count ?? 0) + 1 })
                  .eq('id', followingId),
              );
          }
        }),
      ]);
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
      qc.invalidateQueries({ queryKey: ['profileById'] });
    },
  });
}

/** Unfollow a user */
export function useUnfollowMutation() {
  const qc = useQueryClient();

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

      // Update denormalized counts
      await Promise.all([
        supabase.rpc('increment_count', {
          row_id: followerId,
          column_name: 'following_count',
          amount: -1,
        }).then(({ error }) => {
          if (error) {
            return supabase
              .from('profiles')
              .select('following_count')
              .eq('id', followerId)
              .single()
              .then(({ data }) =>
                supabase
                  .from('profiles')
                  .update({
                    following_count: Math.max(0, (data?.following_count ?? 0) - 1),
                  })
                  .eq('id', followerId),
              );
          }
        }),
        supabase.rpc('increment_count', {
          row_id: followingId,
          column_name: 'follower_count',
          amount: -1,
        }).then(({ error }) => {
          if (error) {
            return supabase
              .from('profiles')
              .select('follower_count')
              .eq('id', followingId)
              .single()
              .then(({ data }) =>
                supabase
                  .from('profiles')
                  .update({
                    follower_count: Math.max(0, (data?.follower_count ?? 0) - 1),
                  })
                  .eq('id', followingId),
              );
          }
        }),
      ]);
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
      qc.invalidateQueries({ queryKey: ['profileById'] });
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
