import { useEffect, useState } from "react";
import {
  ActionSheetIOS,
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { DraggablePinMap } from "../src/components/DraggablePinMap";
import { NicheSelector } from "../src/components/NicheSelector";
import { useAuth } from "../src/context/auth";
import { supabase } from "../src/lib/supabase";
import { useProfile } from "../src/hooks/useProfile";
import { useNiches } from "../src/hooks/useNiches";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from "../src/constants/theme";
import { PlatformIcon } from "../src/components/PlatformIcon";
import type { PlatformName } from "../src/types";
import { resolvePostalCode } from "../src/utils/location";


const PLATFORMS: PlatformName[] = [
  "Instagram",
  "TikTok",
  "YouTube",
  "X",
  "Twitch",
  "Spotify",
  "SoundCloud",
  "LinkedIn",
  "Pinterest",
  "Eventbrite",
  "Website",
  "Other",
];

// Platforms that take a username/handle — we construct the URL ourselves.
// Platforms NOT listed here (Spotify, Eventbrite, Website, Other) take a full URL.
const PLATFORM_HANDLE_CONFIG: Partial<
  Record<PlatformName, { prefix: string; buildUrl: (handle: string) => string }>
> = {
  Instagram: {
    prefix: "instagram.com/",
    buildUrl: (h) => `https://instagram.com/${h}`,
  },
  TikTok: {
    prefix: "tiktok.com/@",
    buildUrl: (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`,
  },
  YouTube: {
    prefix: "youtube.com/@",
    buildUrl: (h) => `https://youtube.com/@${h.replace(/^@/, "")}`,
  },
  X: {
    prefix: "x.com/",
    buildUrl: (h) => `https://x.com/${h.replace(/^@/, "")}`,
  },
  Twitch: {
    prefix: "twitch.tv/",
    buildUrl: (h) => `https://twitch.tv/${h}`,
  },
  SoundCloud: {
    prefix: "soundcloud.com/",
    buildUrl: (h) => `https://soundcloud.com/${h}`,
  },
  LinkedIn: {
    prefix: "linkedin.com/in/",
    buildUrl: (h) => `https://linkedin.com/in/${h}`,
  },
  Pinterest: {
    prefix: "pinterest.com/",
    buildUrl: (h) => `https://pinterest.com/${h}`,
  },
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
  const { data: niches = [] } = useNiches();

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationFsa, setLocationFsa] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [selectedNicheIds, setSelectedNicheIds] = useState<string[]>([]);
  const [links, setLinks] = useState<LinkDraft[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null); // local URI if changed
  const [removedPhoto, setRemovedPhoto] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add link form
  const [addingLink, setAddingLink] = useState(false);
  const [newPlatform, setNewPlatform] = useState<PlatformName>("Instagram");
  const [newHandle, setNewHandle] = useState("");

  // Pre-fill form once data loads
  useEffect(() => {
    if (!data) return;
    const { profile, niches, externalLinks } = data;
    setDisplayName(profile.display_name);
    setBio(profile.bio ?? "");
    setYearsInBusiness(profile.years_in_business?.toString() ?? "");
    setLocationName(profile.location_name ?? "");
    setLocationFsa(profile.location_fsa ?? "");
    setLatitude(profile.latitude ?? null);
    setLongitude(profile.longitude ?? null);
    setSelectedNicheIds(niches.map((n) => String(n.id)));
    setLinks(
      externalLinks.map((l) => ({
        id: l.id,
        platform_name: l.platform_name,
        url: l.url,
      })),
    );
  }, [data]);

  async function handleFsaChange(text: string) {
    const clean = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3);
    setLocationFsa(clean);
    setError(null);
    if (latitude !== null) {
      setLatitude(null);
      setLongitude(null);
    }
    if (clean.length === 3) {
      if (!/^[A-Z][0-9][A-Z]$/.test(clean)) {
        setError("Enter a valid Canadian postal code area (e.g. M5V, N2L).");
        return;
      }
      setGeocoding(true);
      try {
        const result = await resolvePostalCode(clean);
        if (result) {
          setLatitude(result.latitude);
          setLongitude(result.longitude);
          if (!locationName.trim()) setLocationName(result.locationLabel);
        } else {
          setError(
            "Couldn't find that postal area. Check the first 3 characters of your Canadian postal code.",
          );
        }
      } catch {
        setError(
          "Couldn't look up that location. Check your connection and try again.",
        );
      } finally {
        setGeocoding(false);
      }
    }
  }

  function toggleNiche(id: string) {
    setSelectedNicheIds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission denied",
        "Photo library access is needed to change your photo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as ImagePicker.MediaType,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setRemovedPhoto(false);
    }
  }

  function removePhoto() {
    setPhotoUri(null);
    setRemovedPhoto(true);
  }

  function handlePhotoPress() {
    const hasPhoto =
      !removedPhoto && (photoUri || data?.profile.profile_picture_url);
    if (!hasPhoto) {
      pickPhoto();
      return;
    }
    const options = ["Change Photo", "Remove Photo", "Cancel"];
    const destructiveButtonIndex = 1;
    const cancelButtonIndex = 2;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex, cancelButtonIndex },
        (index) => {
          if (index === 0) pickPhoto();
          else if (index === 1) removePhoto();
        },
      );
    } else {
      Alert.alert("Profile Photo", undefined, [
        { text: "Change Photo", onPress: pickPhoto },
        { text: "Remove Photo", style: "destructive", onPress: removePhoto },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  async function uploadPhoto(uri: string): Promise<string> {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const path = `${userId}/profile.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);
    // Bust the cache with a timestamp so the app re-fetches the new image
    return `${urlData.publicUrl}?t=${Date.now()}`;
  }

  function addLink() {
    const raw = newHandle.trim();
    if (!raw) return;
    const config = PLATFORM_HANDLE_CONFIG[newPlatform];
    let url: string;
    if (config) {
      url = config.buildUrl(raw);
    } else {
      try {
        const parsed = new URL(raw);
        if (parsed.protocol !== 'https:') {
          setError("Links must use https://");
          return;
        }
        url = parsed.href;
      } catch {
        setError("Please enter a valid URL starting with https://");
        return;
      }
    }
    setLinks((prev) => [...prev, { platform_name: newPlatform, url }]);
    setNewHandle("");
    setAddingLink(false);
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Upload photo if changed, or clear if removed
      let profilePictureUrl = data?.profile.profile_picture_url ?? null;
      if (removedPhoto) {
        profilePictureUrl = null;
        // Best-effort: remove old file from storage
        if (userId) {
          await supabase.storage
            .from("avatars")
            .remove([`${userId}/profile.jpg`])
            .catch(() => {});
        }
      } else if (photoUri) {
        profilePictureUrl = await uploadPhoto(photoUri);
      }

      // 2. Upsert profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: userId,
            profile_type: data!.profile.profile_type,
            display_name: displayName.trim(),
            bio: bio.trim(),
            years_in_business: yearsInBusiness
              ? parseInt(yearsInBusiness, 10)
              : null,
            location_name: locationName.trim() || null,
            location_fsa: locationFsa.trim() || null,
            latitude,
            longitude,
            profile_picture_url: profilePictureUrl,
          },
          { onConflict: "user_id" },
        )
        .select("id")
        .single();

      if (profileError || !profile) {
        throw profileError ?? new Error("Failed to save profile.");
      }

      // 3. Replace niches
      await supabase
        .from("profile_niches")
        .delete()
        .eq("profile_id", profile.id);
      if (selectedNicheIds.length > 0) {
        const { error: nicheError } = await supabase
          .from("profile_niches")
          .insert(
            selectedNicheIds.map((nicheId) => ({
              profile_id: profile.id,
              niche_id: nicheId,
            })),
          );
        if (nicheError) throw nicheError;
      }

      // 4. Replace external links
      await supabase
        .from("external_links")
        .delete()
        .eq("profile_id", profile.id);
      if (links.length > 0) {
        const { error: linkError } = await supabase
          .from("external_links")
          .insert(
            links.map((l) => ({
              profile_id: profile.id,
              platform_name: l.platform_name,
              url: l.url,
            })),
          );
        if (linkError) throw linkError;
      }

      // 5. Invalidate so account screen refreshes
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      router.back();
    } catch (e: any) {
      console.error("[edit-profile] save error:", e);
      setError(
        "We encountered an error trying to save your profile. Please try again.",
      );
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

  const currentAvatarUri = removedPhoto
    ? null
    : (photoUri ?? data?.profile.profile_picture_url ?? null);
  const displayNameInitial = (
    displayName ||
    (data?.profile.display_name ?? "?")
  )
    .charAt(0)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Navigation header */}
        <View style={styles.navHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
            accessibilityLabel="Save profile"
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={Colors.textPrimary} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sticky error banner — outside ScrollView so it stays visible */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={Colors.cancelled}
            />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => setError(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Dismiss error"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={16} color={Colors.cancelled} />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile Photo ── */}
          <View style={styles.photoSection}>
            {currentAvatarUri ? (
              <Image source={{ uri: currentAvatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{displayNameInitial}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={handlePhotoPress}
              activeOpacity={0.7}
              accessibilityLabel={currentAvatarUri ? "Change profile photo" : "Add profile photo"}
              accessibilityRole="button"
            >
              <Ionicons
                name="camera-outline"
                size={16}
                color={Colors.primary}
              />
              <Text style={styles.changePhotoText}>
                {currentAvatarUri ? "Change Photo" : "Add Photo"}
              </Text>
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
                maxLength={50}
                accessibilityLabel="Display name"
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
                maxLength={500}
                accessibilityLabel="Bio"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Years Active</Text>
              <TextInput
                style={styles.input}
                value={yearsInBusiness}
                onChangeText={(t) =>
                  setYearsInBusiness(t.replace(/[^0-9]/g, ""))
                }
                placeholder="e.g. 3"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
                accessibilityLabel="Years active"
              />
            </View>
          </View>

          {/* ── Location ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Neighbourhood / Area</Text>
              <TextInput
                style={styles.input}
                value={locationName}
                onChangeText={setLocationName}
                placeholder="e.g. Kensington Market"
                placeholderTextColor={Colors.textTertiary}
                autoComplete="postal-address-locality"
                textContentType="addressCity"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={100}
                accessibilityLabel="Neighbourhood or area"
              />
              <Text style={styles.locationHint}>
                You can change this to something more reflective of where
                you&apos;re based — for example: Toronto, Ontario → Kensington
                Market
              </Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Postal Code Area</Text>
              <TextInput
                style={styles.input}
                value={locationFsa}
                onChangeText={handleFsaChange}
                placeholder="e.g. M5V"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="postal-code"
                textContentType="postalCode"
                maxLength={3}
                returnKeyType="done"
                accessibilityLabel="Postal code area"
              />
              {geocoding && (
                <View style={styles.geocodingRow}>
                  <ActivityIndicator size="small" color={Colors.textTertiary} />
                  <Text style={styles.geocodingText}>Looking up location…</Text>
                </View>
              )}
              {latitude !== null && (
                <>
                  <DraggablePinMap
                    pinLatitude={latitude}
                    pinLongitude={longitude!}
                    onPinMoved={(lat, lng) => {
                      setLatitude(lat);
                      setLongitude(lng);
                    }}
                    height={200}
                  />
                  <View style={styles.dragHint}>
                    <Ionicons
                      name="hand-left-outline"
                      size={14}
                      color={Colors.textTertiary}
                    />
                    <Text style={styles.dragHintText}>
                      Hold and drag the pin to adjust the location
                    </Text>
                  </View>
                  <View style={styles.warningNote}>
                    <Ionicons
                      name="warning-outline"
                      size={14}
                      color={Colors.primary}
                    />
                    <Text style={styles.warningNoteText}>
                      Do not place the pin on your home address. Choose a nearby
                      intersection or landmark instead — this pin is visible to
                      other users.
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Niches ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niches</Text>
            <NicheSelector
              niches={niches}
              selectedIds={selectedNicheIds}
              onToggle={toggleNiche}
            />
          </View>

          {/* ── External Links ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Links</Text>

            {links.map((link, index) => (
              <View key={index} style={styles.linkRow}>
                <PlatformIcon
                  platform={link.platform_name}
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.linkPlatform}>{link.platform_name}</Text>
                <Text style={styles.linkUrl} numberOfLines={1}>
                  {link.url}
                </Text>
                <TouchableOpacity
                  onPress={() => removeLink(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={`Remove ${link.platform_name} link`}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={Colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            ))}

            {addingLink ? (
              <View style={styles.addLinkForm}>
                {/* Platform picker */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.platformScroll}
                >
                  {PLATFORMS.map((platform) => (
                    <TouchableOpacity
                      key={platform}
                      style={[
                        styles.platformChip,
                        newPlatform === platform && styles.platformChipSelected,
                      ]}
                      onPress={() => { setNewPlatform(platform); setNewHandle(""); }}
                      activeOpacity={0.7}
                      accessibilityLabel={platform}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: newPlatform === platform }}
                    >
                      <PlatformIcon
                        platform={platform}
                        size={14}
                        color={
                          newPlatform === platform
                            ? Colors.primary
                            : Colors.textTertiary
                        }
                      />
                      <Text
                        style={[
                          styles.platformChipText,
                          newPlatform === platform &&
                            styles.platformChipTextSelected,
                        ]}
                      >
                        {platform}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {PLATFORM_HANDLE_CONFIG[newPlatform] ? (
                  <View style={styles.handleInputRow}>
                    <Text style={styles.handlePrefix}>
                      {PLATFORM_HANDLE_CONFIG[newPlatform]!.prefix}
                    </Text>
                    <TextInput
                      style={styles.handleInput}
                      value={newHandle}
                      onChangeText={setNewHandle}
                      placeholder="yourhandle"
                      placeholderTextColor={Colors.textTertiary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="default"
                      returnKeyType="done"
                      onSubmitEditing={addLink}
                    />
                  </View>
                ) : (
                  <TextInput
                    style={styles.input}
                    value={newHandle}
                    onChangeText={setNewHandle}
                    placeholder="https://..."
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    textContentType="URL"
                    returnKeyType="done"
                    onSubmitEditing={addLink}
                  />
                )}
                <View style={styles.addLinkActions}>
                  <TouchableOpacity
                    style={styles.cancelLinkButton}
                    onPress={() => {
                      setAddingLink(false);
                      setNewHandle("");
                    }}
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
                accessibilityLabel="Add link"
                accessibilityRole="button"
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={Colors.primary}
                />
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
    alignItems: "center",
    justifyContent: "center",
  },

  // Nav header
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  navTitle: {
    flex: 1,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  saveButton: {
    width: 60,
    height: 36,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "#2A0A0A",
    borderWidth: 1,
    borderColor: "#4A1A1A",
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
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  changePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + "50",
    backgroundColor: Colors.primary + "10",
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
    textTransform: "uppercase",
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
  locationHint: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    lineHeight: 17,
    marginTop: 4,
  },
  geocodingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  geocodingText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  dragHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  dragHintText: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  warningNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    backgroundColor: "#1A0D00",
    borderWidth: 1,
    borderColor: "#4A2A00",
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  warningNoteText: {
    flex: 1,
    fontSize: Typography.size.xs,
    color: Colors.primary,
    lineHeight: 17,
  },

  // Links
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + "50",
    borderStyle: "dashed",
    backgroundColor: Colors.primary + "08",
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
  handleInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    minHeight: 44,
  },
  handlePrefix: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    marginRight: 2,
  },
  handleInput: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
  },
  platformScroll: {
    marginBottom: Spacing.xs,
  },
  platformChip: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: Colors.primary + "15",
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
    flexDirection: "row",
    gap: Spacing.sm,
  },
  cancelLinkButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
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
    alignItems: "center",
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  confirmLinkText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
});
