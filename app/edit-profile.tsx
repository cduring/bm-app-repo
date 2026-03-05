import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../src/context/auth';
import { supabase } from '../src/lib/supabase';
import { useProfile } from '../src/hooks/useProfile';
import { MOCK_NICHES } from '../src/mock/niches';
import { Colors, Typography, Spacing, BorderRadius } from '../src/constants/theme';
import type { PlatformName, ExternalLink } from '../src/types';

const PLATFORMS: PlatformName[] = [
  'Instagram', 'TikTok', 'YouTube', 'Twitter',
  'Spotify', 'SoundCloud', 'LinkedIn', 'Website', 'Other',
];

const PLATFORM_ICONS: Record<PlatformName, string> = {
  Instagram: 'logo-instagram',
  TikTok: 'logo-tiktok',
  YouTube: 'logo-youtube',
  Twitter: 'logo-twitter',
  Spotify: 'musical-notes-outline',
  SoundCloud: 'musical-note-outline',
  LinkedIn: 'logo-linkedin',
  Website: 'globe-outline',
  Other: 'link-outline',
};

interface LinkDraft {
  id?: string; // undefined = new, string = existing
  platform_name: PlatformName;
  url: string;
}

export default function EditProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const { data, isLoading } = useProfile(userId);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [selectedNicheIds, setSelectedNicheIds] = useState<string[]>([]);
  const [links, setLinks] = useState<LinkDraft[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null); // local URI if changed

  // UI state
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add link form
  const [addingLink, setAddingLink] = useState(false);
  const [newPlatform, setNewPlatform] = useState<PlatformName>('Instagram');
  const [newUrl, setNewUrl] = useState('');

  // Pre-fill form once data loads
  useEffect(() => {
    if (!data) return;
    const { profile, niches, externalLinks } = data;
    setDisplayName(profile.display_name);
    setBio(profile.bio ?? '');
    setYearsInBusiness(profile.years_in_business?.toString() ?? '');
    setLocationName(profile.location_name ?? '');
    setLatitude(profile.latitude ?? null);
    setLongitude(profile.longitude ?? null);
    setSelectedNicheIds(niches.map(n => n.id));
    setLinks(externalLinks.map(l => ({ id: l.id, platform_name: l.platform_name, url: l.url })));
  }, [data]);

  function toggleNiche(id: string) {
    setSelectedNicheIds(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    );
  }

  async function geocodeAddress(text: string) {
    if (!text.trim()) return;
    setGeocoding(true);
    try {
      const results = await Location.geocodeAsync(text + ', Toronto, Ontario, Canada');
      if (results.length > 0) {
        setLatitude(results[0].latitude);
        setLongitude(results[0].longitude);
      }
    } catch {
      // Silent — coordinates are optional
    } finally {
      setGeocoding(false);
    }
  }

  async function useGpsLocation() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is needed to use your current location.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      // Reverse geocode for a human-readable label
      const places = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (places.length > 0) {
        const p = places[0];
        const label = p.district ?? p.subregion ?? p.city ?? '';
        if (label) setLocationName(label);
      }
    } catch {
      Alert.alert('Error', 'Could not get your location.');
    } finally {
      setGpsLoading(false);
    }
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Photo library access is needed to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function uploadPhoto(uri: string): Promise<string> {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const path = `${userId}/profile.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    // Bust the cache with a timestamp so the app re-fetches the new image
    return `${urlData.publicUrl}?t=${Date.now()}`;
  }

  function addLink() {
    if (!newUrl.trim()) return;
    const url = newUrl.trim();
    setLinks(prev => [...prev, { platform_name: newPlatform, url }]);
    setNewUrl('');
    setAddingLink(false);
  }

  function removeLink(index: number) {
    setLinks(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Upload photo if changed
      let profilePictureUrl = data?.profile.profile_picture_url ?? null;
      if (photoUri) {
        profilePictureUrl = await uploadPhoto(photoUri);
      }

      // 2. Upsert profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: userId,
            profile_type: data!.profile.profile_type,
            display_name: displayName.trim(),
            bio: bio.trim(),
            years_in_business: yearsInBusiness ? parseInt(yearsInBusiness, 10) : null,
            location_name: locationName.trim() || null,
            latitude,
            longitude,
            profile_picture_url: profilePictureUrl,
          },
          { onConflict: 'user_id' }
        )
        .select('id')
        .single();

      if (profileError || !profile) {
        throw profileError ?? new Error('Failed to save profile.');
      }

      // 3. Replace niches
      await supabase.from('profile_niches').delete().eq('profile_id', profile.id);
      if (selectedNicheIds.length > 0) {
        const { error: nicheError } = await supabase
          .from('profile_niches')
          .insert(selectedNicheIds.map(nicheId => ({ profile_id: profile.id, niche_id: nicheId })));
        if (nicheError) throw nicheError;
      }

      // 4. Replace external links
      await supabase.from('external_links').delete().eq('profile_id', profile.id);
      if (links.length > 0) {
        const { error: linkError } = await supabase
          .from('external_links')
          .insert(links.map(l => ({ profile_id: profile.id, platform_name: l.platform_name, url: l.url })));
        if (linkError) throw linkError;
      }

      // 5. Invalidate so account screen refreshes
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const currentAvatarUri = photoUri ?? data?.profile.profile_picture_url ?? null;
  const displayNameInitial = (displayName || (data?.profile.display_name ?? '?')).charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Navigation header */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textPrimary} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.cancelled} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Profile Photo ── */}
          <View style={styles.photoSection}>
            {currentAvatarUri ? (
              <Image source={{ uri: currentAvatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{displayNameInitial}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.changePhotoButton} onPress={pickPhoto} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={16} color={Colors.primary} />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          {/* ── Basic Info ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Info</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Display Name *</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name or brand"
                placeholderTextColor={Colors.textTertiary}
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people about yourself..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Years Active</Text>
              <TextInput
                style={styles.input}
                value={yearsInBusiness}
                onChangeText={t => setYearsInBusiness(t.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 3"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* ── Location ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Neighbourhood / Area</Text>
              <View style={styles.locationRow}>
                <TextInput
                  style={[styles.input, styles.locationInput]}
                  value={locationName}
                  onChangeText={setLocationName}
                  onEndEditing={e => geocodeAddress(e.nativeEvent.text)}
                  placeholder="e.g. Kensington Market"
                  placeholderTextColor={Colors.textTertiary}
                  autoComplete="postal-address-locality"
                  textContentType="addressCity"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                {geocoding ? (
                  <ActivityIndicator style={styles.locationIcon} color={Colors.textTertiary} size="small" />
                ) : latitude ? (
                  <Ionicons name="checkmark-circle" style={styles.locationIcon} size={20} color={Colors.going} />
                ) : null}
                <TouchableOpacity
                  style={styles.gpsButton}
                  onPress={useGpsLocation}
                  disabled={gpsLoading}
                  activeOpacity={0.7}
                >
                  {gpsLoading ? (
                    <ActivityIndicator color={Colors.primary} size="small" />
                  ) : (
                    <Ionicons name="navigate-outline" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Niches ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niches</Text>
            <View style={styles.nichesGrid}>
              {MOCK_NICHES.map(niche => {
                const selected = selectedNicheIds.includes(niche.id);
                return (
                  <TouchableOpacity
                    key={niche.id}
                    style={[styles.nicheChip, selected && styles.nicheChipSelected]}
                    onPress={() => toggleNiche(niche.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.nicheChipText, selected && styles.nicheChipTextSelected]}>
                      {niche.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── External Links ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Links</Text>

            {links.map((link, index) => (
              <View key={index} style={styles.linkRow}>
                <Ionicons name={PLATFORM_ICONS[link.platform_name] as any} size={18} color={Colors.primary} />
                <Text style={styles.linkPlatform}>{link.platform_name}</Text>
                <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                <TouchableOpacity onPress={() => removeLink(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}

            {addingLink ? (
              <View style={styles.addLinkForm}>
                {/* Platform picker */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platformScroll}>
                  {PLATFORMS.map(platform => (
                    <TouchableOpacity
                      key={platform}
                      style={[styles.platformChip, newPlatform === platform && styles.platformChipSelected]}
                      onPress={() => setNewPlatform(platform)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={PLATFORM_ICONS[platform] as any}
                        size={14}
                        color={newPlatform === platform ? Colors.primary : Colors.textTertiary}
                      />
                      <Text style={[styles.platformChipText, newPlatform === platform && styles.platformChipTextSelected]}>
                        {platform}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TextInput
                  style={styles.input}
                  value={newUrl}
                  onChangeText={setNewUrl}
                  placeholder="https://..."
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  textContentType="URL"
                  returnKeyType="done"
                  onSubmitEditing={addLink}
                />
                <View style={styles.addLinkActions}>
                  <TouchableOpacity
                    style={styles.cancelLinkButton}
                    onPress={() => { setAddingLink(false); setNewUrl(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelLinkText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmLinkButton}
                    onPress={addLink}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmLinkText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addLinkButton}
                onPress={() => setAddingLink(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                <Text style={styles.addLinkButtonText}>Add Link</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Nav header
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  saveButton: {
    width: 60,
    height: 36,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#2A0A0A',
    borderWidth: 1,
    borderColor: '#4A1A1A',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.cancelled,
  },

  // Photo
  photoSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.avatar,
    marginBottom: Spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
    backgroundColor: Colors.primary + '10',
  },
  changePhotoText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.primary,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },

  // Location
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locationInput: {
    flex: 1,
  },
  locationIcon: {
    width: 20,
  },
  gpsButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Niches
  nichesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  nicheChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  nicheChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '20',
  },
  nicheChipText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  nicheChipTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
  },

  // Links
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkPlatform: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textPrimary,
    width: 80,
  },
  linkUrl: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  addLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
    borderStyle: 'dashed',
    backgroundColor: Colors.primary + '08',
  },
  addLinkButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.primary,
  },
  addLinkForm: {
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformScroll: {
    marginBottom: Spacing.xs,
  },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginRight: Spacing.xs,
  },
  platformChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  platformChipText: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  platformChipTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
  },
  addLinkActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelLinkButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelLinkText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  confirmLinkButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  confirmLinkText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
});
