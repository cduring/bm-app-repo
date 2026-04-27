import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { uploadPortfolioImages } from '../lib/portfolioUpload';
import type { PortfolioImage } from '../types';

/** Fetch portfolio images for a profile, ordered by display_order */
export function usePortfolio(profileId: string | undefined) {
  return useQuery<PortfolioImage[]>({
    queryKey: ['portfolio', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_images')
        .select('*')
        .eq('profile_id', profileId!)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PortfolioImage[];
    },
    enabled: !!profileId,
  });
}

/** Add a portfolio image */
export function useAddPortfolioImage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      imageUri,
    }: {
      profileId: string;
      imageUri: string;
    }) => {
      await uploadPortfolioImages(profileId, [imageUri]);
    },
    onSuccess: (_, { profileId }) => {
      qc.invalidateQueries({ queryKey: ['portfolio', profileId] });
    },
  });
}

/** Add multiple portfolio images at once */
export function useAddPortfolioImages() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      imageUris,
    }: {
      profileId: string;
      imageUris: string[];
    }) => {
      await uploadPortfolioImages(profileId, imageUris);
    },
    onSuccess: (_, { profileId }) => {
      qc.invalidateQueries({ queryKey: ['portfolio', profileId] });
    },
  });
}

/** Remove a portfolio image */
export function useRemovePortfolioImage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      imageId,
      profileId,
    }: {
      imageId: string;
      profileId: string;
    }) => {
      const { error } = await supabase
        .from('portfolio_images')
        .delete()
        .eq('id', imageId);
      if (error) throw error;
    },
    onSuccess: (_, { profileId }) => {
      qc.invalidateQueries({ queryKey: ['portfolio', profileId] });
    },
  });
}
