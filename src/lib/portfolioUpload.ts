import { File } from 'expo-file-system';
import { supabase } from './supabase';

/**
 * Uploads an array of local image URIs to the portfolio storage bucket and
 * inserts corresponding rows into the portfolio_images table.
 *
 * Throws on the first failure — callers should wrap in try/catch.
 */
export async function uploadPortfolioImages(
  profileId: string,
  imageUris: string[],
): Promise<void> {
  if (imageUris.length === 0) return;

  const { data: existing } = await supabase
    .from('portfolio_images')
    .select('display_order')
    .eq('profile_id', profileId)
    .order('display_order', { ascending: false })
    .limit(1);
  let nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  for (const imageUri of imageUris) {
    const rawExt = imageUri.split('.').pop()?.split('?')[0] || 'jpg';
    const ext = rawExt.toLowerCase();
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const fileName = `${profileId}/${Date.now()}-${nextOrder}.${ext}`;

    const arrayBuffer = await new File(imageUri).arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('post-media')
      .upload(`portfolio/${fileName}`, arrayBuffer, { contentType: mimeType });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('post-media')
      .getPublicUrl(`portfolio/${fileName}`);

    const { error: insertError } = await supabase
      .from('portfolio_images')
      .insert({
        profile_id: profileId,
        image_url: urlData.publicUrl,
        display_order: nextOrder,
      });
    if (insertError) throw insertError;

    nextOrder++;
  }
}
