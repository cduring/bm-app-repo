import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
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
      // Upload to storage
      const rawExt = imageUri.split('.').pop()?.split('?')[0] || 'jpg';
      const ext = rawExt.toLowerCase();
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const fileName = `${profileId}/${Date.now()}.${ext}`;
      const arrayBuffer = await new File(imageUri).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(`portfolio/${fileName}`, arrayBuffer, { contentType: mimeType });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('post-media')
        .getPublicUrl(`portfolio/${fileName}`);

      // Get current max display_order
      const { data: existing } = await supabase
        .from('portfolio_images')
        .select('display_order')
        .eq('profile_id', profileId)
        .order('display_order', { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

      // Insert record
      const { data, error } = await supabase
        .from('portfolio_images')
        .insert({
          profile_id: profileId,
          image_url: urlData.publicUrl,
          display_order: nextOrder,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
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
