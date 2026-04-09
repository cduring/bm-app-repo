import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile, Niche, ExternalLink } from '../types';

export interface ProfileData {
  profile: Profile;
  niches: Niche[];
  externalLinks: ExternalLink[];
}

async function fetchProfileData(
  column: 'user_id' | 'id',
  value: string,
): Promise<ProfileData> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq(column, value)
    .single();

  if (profileError) throw profileError;

  const [nicheResult, linkResult, followerResult, followingResult] = await Promise.all([
    supabase
      .from('profile_niches')
      .select('niche_id, niches(id, name, color)')
      .eq('profile_id', profile.id),
    supabase
      .from('external_links')
      .select('*')
      .eq('profile_id', profile.id),
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', profile.id),
    supabase
      .from('follows')
      .select('following_id', { count: 'exact', head: true })
      .eq('follower_id', profile.id),
  ]);

  const niches: Niche[] = (nicheResult.data ?? [])
    .map((row: any) => row.niches)
    .filter(Boolean);

  return {
    profile: {
      ...profile,
      follower_count: followerResult.count ?? profile.follower_count ?? 0,
      following_count: followingResult.count ?? profile.following_count ?? 0,
    } as Profile,
    niches,
    externalLinks: (linkResult.data ?? []) as ExternalLink[],
  };
}

/** Fetch the current user's profile by their auth user_id */
export function useProfile(userId: string | undefined) {
  return useQuery<ProfileData>({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfileData('user_id', userId!),
    enabled: !!userId,
  });
}

/** Fetch another user's profile by their profiles.id */
export function useProfileById(profileId: string | undefined) {
  return useQuery<ProfileData>({
    queryKey: ['profileById', profileId],
    queryFn: () => fetchProfileData('id', profileId!),
    enabled: !!profileId,
  });
}
