import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { usePostHog } from "posthog-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DraggablePinMap } from "../../src/components/DraggablePinMap";
import { NicheSelector } from "../../src/components/NicheSelector";
import { PlatformIcon } from "../../src/components/PlatformIcon";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { useAuth } from "../../src/context/auth";
import { useNiches } from "../../src/hooks/useNiches";
import { registerForPushNotifications } from "../../src/hooks/useNotifications";
import { PLATFORMS, PLATFORM_HANDLE_CONFIG } from "../../src/lib/platforms";
import { uploadPortfolioImages } from "../../src/lib/portfolioUpload";
import { supabase } from "../../src/lib/supabase";
import type { PlatformName, ProfileType } from "../../src/types";
import { resolvePostalCode } from "../../src/utils/location";

const TOTAL_STEPS = 7;

interface OnboardingData {
  profileType: ProfileType | null;
  displayName: string;
  bio: string;
  yearsInBusiness: string;
  selectedNicheIds: string[];
  photoUri: string | null;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
  portfolioImageUris: string[];
  pendingLinks: { platform_name: PlatformName; url: string }[];
}

export default function OnboardingScreen() {
  const posthog = usePostHog();
  const { session, onboardingComplete } = useAuth();
  const { data: niches = [] } = useNiches();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [notificationsOptIn, setNotificationsOptIn] = useState(true);
  // Step 5 postal prefix input (not saved to Supabase directly; drives coordinate generation)
  const [postalPrefix, setPostalPrefix] = useState("");
  // Step 6 transient link form state
  const [newLinkPlatform, setNewLinkPlatform] =
    useState<PlatformName>("Instagram");
  const [newLinkHandle, setNewLinkHandle] = useState("");
  const [linkError, setLinkError] = useState("");
  const [addingLink, setAddingLink] = useState(false);

  const [data, setData] = useState<OnboardingData>({
    profileType: null,
    displayName: "",
    bio: "",
    yearsInBusiness: "",
    selectedNicheIds: [],
    photoUri: null,
    latitude: null,
    longitude: null,
    locationLabel: "",
    portfolioImageUris: [],
    pendingLinks: [],
  });

  function goBack() {
    setStep((s) => s - 1);
    setError(null);
  }

  function goNext() {
    setError(null);

    if (step === 1 && !data.profileType) {
      setError("Please choose a profile type to continue.");
      return;
    }
    if (step === 2 && !data.displayName.trim()) {
      setError("A display name is required.");
      return;
    }
    if (step === 3 && data.selectedNicheIds.length === 0) {
      setError("Select at least one niche.");
      return;
    }
    if (step === 5 && postalPrefix.length > 0 && postalPrefix.length < 3) {
      setError("Enter all 3 characters of your postal code area (e.g. M5V).");
      return;
    }
    if (step === 7 && (!ageConfirmed || !termsAccepted || !privacyAccepted)) {
      setError("Please confirm all three items to continue.");
      return;
    }

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Camera roll permission is required to pick a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as ImagePicker.MediaType,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setData((d) => ({ ...d, photoUri: result.assets[0].uri }));
    }
  }

  async function pickPortfolioImages() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Camera roll permission is required to pick photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as ImagePicker.MediaType,
      allowsMultipleSelection: true,
      selectionLimit: 9,
      quality: 0.8,
    });
    if (!result.canceled) {
      setData((d) => ({
        ...d,
        portfolioImageUris: [
          ...d.portfolioImageUris,
          ...result.assets.map((a) => a.uri),
        ].slice(0, 9),
      }));
    }
  }

  function addOnboardingLink() {
    const raw = newLinkHandle.trim();
    if (!raw) return;
    const config = PLATFORM_HANDLE_CONFIG[newLinkPlatform];
    let url: string;
    if (config) {
      url = config.buildUrl(raw);
    } else {
      try {
        const parsed = new URL(raw);
        if (parsed.protocol !== "https:") {
          setLinkError("Links must use https://");
          return;
        }
        url = parsed.href;
      } catch {
        setLinkError("Please enter a valid URL starting with https://");
        return;
      }
    }
    setData((d) => ({
      ...d,
      pendingLinks: [
        ...d.pendingLinks,
        { platform_name: newLinkPlatform, url },
      ],
    }));
    setNewLinkHandle("");
    setAddingLink(false);
    setLinkError("");
  }

  async function handlePostalPrefixChange(text: string) {
    // Uppercase, strip non-alphanumeric, cap at 3 chars
    const clean = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3);
    setPostalPrefix(clean);
    setError(null);

    // Clear stale pin whenever input changes
    if (data.latitude !== null) {
      setData((d) => ({
        ...d,
        latitude: null,
        longitude: null,
        locationLabel: "",
      }));
    }

    // Auto-resolve once all 3 chars are entered
    if (clean.length === 3) {
      if (!/^[A-Z][0-9][A-Z]$/.test(clean)) {
        setError("Enter a valid Canadian postal code area (e.g. M5V, N2L).");
        return;
      }
      setGeocoding(true);
      try {
        const result = await resolvePostalCode(clean);
        if (result) {
          setData((d) => ({
            ...d,
            latitude: result.latitude,
            longitude: result.longitude,
            locationLabel: result.locationLabel,
          }));
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

  async function handleFinish() {
    setLoading(true);
    setError(null);

    const user = session?.user;
    if (!user) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    // Upload profile picture if one was selected
    let profilePictureUrl: string | null = null;
    if (data.photoUri) {
      try {
        const response = await fetch(data.photoUri);
        const arrayBuffer = await response.arrayBuffer();
        const path = `${user.id}/profile.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, arrayBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(path);
          profilePictureUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        }
      } catch {
        // Photo upload failed — continue without it, user can add via Edit Profile
      }
    }

    // Upsert so retrying after a partial failure doesn't produce a duplicate row.
    // Requires a UNIQUE constraint on profiles.user_id.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          display_name: data.displayName.trim(),
          bio: data.bio.trim(),
          profile_type: data.profileType,
          years_in_business: data.yearsInBusiness
            ? parseInt(data.yearsInBusiness, 10)
            : null,
          location_name: data.locationLabel.trim() || null,
          location_fsa: postalPrefix || null,
          latitude: data.latitude,
          longitude: data.longitude,
          profile_picture_url: profilePictureUrl,
          follower_count: 0,
          following_count: 0,
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();

    if (profileError || !profile) {
      setError(profileError?.message ?? "Failed to create profile.");
      setLoading(false);
      return;
    }

    let pushToken: string | null = null;
    if (notificationsOptIn) {
      pushToken = (await registerForPushNotifications()) ?? null;
    }
    await supabase.from("profile_settings").upsert(
      {
        profile_id: profile.id,
        notifications_enabled: notificationsOptIn,
        push_token: pushToken,
      },
      { onConflict: "profile_id" },
    );

    if (data.selectedNicheIds.length > 0) {
      // Delete any stale rows first so retrying doesn't insert duplicates.
      await supabase
        .from("profile_niches")
        .delete()
        .eq("profile_id", profile.id);

      const nicheRows = data.selectedNicheIds.map((nicheId) => ({
        profile_id: profile.id,
        niche_id: nicheId,
      }));
      const { error: nicheError } = await supabase
        .from("profile_niches")
        .insert(nicheRows);
      if (nicheError) {
        setError(nicheError.message);
        setLoading(false);
        return;
      }
    }

    // Save portfolio images — non-blocking so a failure never prevents account creation
    if (data.portfolioImageUris.length > 0) {
      try {
        await uploadPortfolioImages(profile.id, data.portfolioImageUris);
      } catch (err) {
        console.error(
          "[onboarding] portfolio upload failed (non-blocking):",
          err,
        );
      }
    }

    // Save external links — non-blocking
    if (data.pendingLinks.length > 0) {
      try {
        const { error: linksErr } = await supabase
          .from("external_links")
          .insert(
            data.pendingLinks.map((l) => ({
              profile_id: profile.id,
              platform_name: l.platform_name,
              url: l.url,
            })),
          );
        if (linksErr) throw linksErr;
      } catch (err) {
        console.error(
          "[onboarding] external links save failed (non-blocking):",
          err,
        );
      }
    }

    setLoading(false);
    posthog?.capture("onboarding_completed", {
      profile_type: data.profileType,
      niches_count: data.selectedNicheIds.length,
      has_photo: !!data.photoUri,
      has_location: data.latitude !== null,
      portfolio_images_count: data.portfolioImageUris.length,
      links_count: data.pendingLinks.length,
    });
    onboardingComplete();
  }

  function toggleNiche(id: string) {
    setData((d) => ({
      ...d,
      selectedNicheIds: d.selectedNicheIds.includes(id)
        ? d.selectedNicheIds.filter((n) => n !== id)
        : [...d.selectedNicheIds, id],
    }));
  }

  const isLastStep = step === TOTAL_STEPS;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${(step / TOTAL_STEPS) * 100}%` },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button — hidden on step 1 (no prior screen) */}
          {step > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={Colors.textPrimary}
              />
            </TouchableOpacity>
          )}
          {step === 1 && <View style={styles.backButton} />}

          {/* ── Step 1: Profile type ── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>What best describes you?</Text>
              <Text style={styles.subtitle}>
                You can always change this later.
              </Text>
              <View style={styles.typeCards}>
                <TouchableOpacity
                  style={[
                    styles.typeCard,
                    data.profileType === "CREATOR" && styles.typeCardActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    setData((d) => ({ ...d, profileType: "CREATOR" }))
                  }
                >
                  <Ionicons
                    name="person"
                    size={32}
                    color={
                      data.profileType === "CREATOR"
                        ? Colors.primary
                        : Colors.textTertiary
                    }
                  />
                  <Text
                    style={[
                      styles.typeCardTitle,
                      data.profileType === "CREATOR" &&
                        styles.typeCardTitleActive,
                    ]}
                  >
                    Creator
                  </Text>
                  <Text style={styles.typeCardDesc}>
                    Artist, model, musician, content creator, or anyone building
                    a personal brand.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeCard,
                    data.profileType === "BUSINESS" && styles.typeCardActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    setData((d) => ({ ...d, profileType: "BUSINESS" }))
                  }
                >
                  <Ionicons
                    name="briefcase"
                    size={32}
                    color={
                      data.profileType === "BUSINESS"
                        ? Colors.primary
                        : Colors.textTertiary
                    }
                  />
                  <Text
                    style={[
                      styles.typeCardTitle,
                      data.profileType === "BUSINESS" &&
                        styles.typeCardTitleActive,
                    ]}
                  >
                    Business
                  </Text>
                  <Text style={styles.typeCardDesc}>
                    Studio, shop, brand, or any business looking to connect with
                    the creator community.
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Step 2: Name & bio ── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Tell us about yourself</Text>
              <Text style={styles.subtitle}>
                This is what others will see on your profile.
              </Text>
              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Display name</Text>
                  <TextInput
                    style={styles.input}
                    value={data.displayName}
                    onChangeText={(v) =>
                      setData((d) => ({ ...d, displayName: v }))
                    }
                    placeholder="Your name or brand name"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoComplete="name"
                    textContentType="name"
                    maxLength={50}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Bio</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={data.bio}
                    onChangeText={(v) => setData((d) => ({ ...d, bio: v }))}
                    placeholder="What do you do? What are you about?"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    numberOfLines={4}
                    maxLength={200}
                    textAlignVertical="top"
                  />
                  <Text style={styles.charCount}>{data.bio.length}/200</Text>
                </View>
                {data.profileType === "BUSINESS" && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Years in business</Text>
                    <TextInput
                      style={styles.input}
                      value={data.yearsInBusiness}
                      onChangeText={(v) =>
                        setData((d) => ({
                          ...d,
                          yearsInBusiness: v.replace(/[^0-9]/g, ""),
                        }))
                      }
                      placeholder="e.g. 3"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Step 3: Niches ── */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Pick your niches</Text>
              <Text style={styles.subtitle}>
                Select all that apply. This helps others find you.
              </Text>
              <NicheSelector
                niches={niches}
                selectedIds={data.selectedNicheIds}
                onToggle={toggleNiche}
              />
            </View>
          )}

          {/* ── Step 4: Photo ── */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Add a profile photo</Text>
              <Text style={styles.subtitle}>
                Put a face to the name. You can skip this for now.
              </Text>
              <View style={styles.photoArea}>
                <TouchableOpacity
                  style={styles.photoButton}
                  activeOpacity={0.8}
                  onPress={pickPhoto}
                >
                  {data.photoUri ? (
                    <Image
                      source={{ uri: data.photoUri }}
                      style={styles.photoPreview}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons
                        name="camera"
                        size={52}
                        color={Colors.textTertiary}
                      />
                      <Text style={styles.photoPlaceholderText}>
                        Tap to choose photo
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                {data.photoUri && (
                  <TouchableOpacity
                    onPress={() => setData((d) => ({ ...d, photoUri: null }))}
                  >
                    <Text style={styles.removePhoto}>Remove photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── Step 5: Location ── */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Where are you based?</Text>
              <Text style={styles.subtitle}>
                Helps nearby creators and businesses discover you. Your exact
                address is never stored or shared.
              </Text>
              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>
                    Postal code area (first 3 characters)
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={postalPrefix}
                    onChangeText={handlePostalPrefixChange}
                    placeholder="e.g. M5V"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="postal-code"
                    textContentType="postalCode"
                    maxLength={3}
                    returnKeyType="done"
                  />
                </View>

                {geocoding && (
                  <View style={styles.geocodingRow}>
                    <ActivityIndicator
                      size="small"
                      color={Colors.textTertiary}
                    />
                    <Text style={styles.geocodingText}>
                      Looking up location…
                    </Text>
                  </View>
                )}

                <View style={styles.privacyNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={14}
                    color={Colors.textTertiary}
                  />
                  <Text style={styles.privacyNoteText}>
                    We only use the first 3 characters of your postal code to
                    place a randomized pin in your general area. Your full
                    postal code and street address are never stored.
                  </Text>
                </View>

                {data.latitude !== null && (
                  <>
                    <View style={styles.locationNameRow}>
                      <Ionicons
                        name="location"
                        size={14}
                        color={Colors.primary}
                      />
                      <Text style={styles.locationNameText}>
                        {data.locationLabel}
                      </Text>
                    </View>
                    <DraggablePinMap
                      pinLatitude={data.latitude}
                      pinLongitude={data.longitude!}
                      onPinMoved={(lat, lng) =>
                        setData((d) => ({
                          ...d,
                          latitude: lat,
                          longitude: lng,
                        }))
                      }
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
                        Do not place the pin on your home address. Choose a
                        nearby intersection or landmark instead — this pin is
                        visible to other users.
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* ── Step 6: Portfolio & Links ── */}
          {step === 6 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Design your profile</Text>
              <Text style={styles.subtitle}>
                Add portfolio images and social links — you can always edit
                these later.
              </Text>

              {/* Portfolio images */}
              <View style={styles.portfolioSection}>
                <Text style={styles.sectionLabel}>Portfolio</Text>
                {data.portfolioImageUris.length > 0 && (
                  <View style={styles.portfolioGrid}>
                    {data.portfolioImageUris.map((uri, i) => (
                      <View key={i} style={styles.portfolioThumbWrap}>
                        <Image source={{ uri }} style={styles.portfolioThumb} />
                        <TouchableOpacity
                          style={styles.portfolioRemove}
                          onPress={() =>
                            setData((d) => ({
                              ...d,
                              portfolioImageUris: d.portfolioImageUris.filter(
                                (_, idx) => idx !== i,
                              ),
                            }))
                          }
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                          accessibilityLabel="Remove photo"
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color={Colors.textPrimary}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                {data.portfolioImageUris.length < 9 && (
                  <TouchableOpacity
                    style={styles.addPhotosButton}
                    onPress={pickPortfolioImages}
                    activeOpacity={0.7}
                    accessibilityLabel="Add portfolio photos"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="images-outline"
                      size={18}
                      color={Colors.primary}
                    />
                    <Text style={styles.addPhotosText}>
                      {data.portfolioImageUris.length === 0
                        ? "Add Photos"
                        : "Add More"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* External links */}
              <View style={styles.portfolioSection}>
                <Text style={styles.sectionLabel}>Social Links</Text>
                {data.pendingLinks.map((link, i) => (
                  <View key={i} style={styles.linkRow}>
                    <PlatformIcon
                      platform={link.platform_name}
                      size={18}
                      color={Colors.primary}
                    />
                    <Text style={styles.linkPlatform}>
                      {link.platform_name}
                    </Text>
                    <Text style={styles.linkUrl} numberOfLines={1}>
                      {link.url}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        setData((d) => ({
                          ...d,
                          pendingLinks: d.pendingLinks.filter(
                            (_, idx) => idx !== i,
                          ),
                        }))
                      }
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
                            newLinkPlatform === platform &&
                              styles.platformChipSelected,
                          ]}
                          onPress={() => {
                            setNewLinkPlatform(platform);
                            setNewLinkHandle("");
                            setLinkError("");
                          }}
                          activeOpacity={0.7}
                          accessibilityLabel={platform}
                          accessibilityRole="radio"
                          accessibilityState={{
                            selected: newLinkPlatform === platform,
                          }}
                        >
                          <PlatformIcon
                            platform={platform}
                            size={14}
                            color={
                              newLinkPlatform === platform
                                ? Colors.primary
                                : Colors.textTertiary
                            }
                          />
                          <Text
                            style={[
                              styles.platformChipText,
                              newLinkPlatform === platform &&
                                styles.platformChipTextSelected,
                            ]}
                          >
                            {platform}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {PLATFORM_HANDLE_CONFIG[newLinkPlatform] ? (
                      <View style={styles.handleInputRow}>
                        <Text style={styles.handlePrefix}>
                          {PLATFORM_HANDLE_CONFIG[newLinkPlatform]!.prefix}
                        </Text>
                        <TextInput
                          style={styles.handleInput}
                          value={newLinkHandle}
                          onChangeText={setNewLinkHandle}
                          placeholder="yourhandle"
                          placeholderTextColor={Colors.textTertiary}
                          autoCapitalize="none"
                          autoCorrect={false}
                          returnKeyType="done"
                          onSubmitEditing={addOnboardingLink}
                        />
                      </View>
                    ) : (
                      <TextInput
                        style={styles.input}
                        value={newLinkHandle}
                        onChangeText={setNewLinkHandle}
                        placeholder="https://..."
                        placeholderTextColor={Colors.textTertiary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        textContentType="URL"
                        returnKeyType="done"
                        onSubmitEditing={addOnboardingLink}
                      />
                    )}

                    {linkError ? (
                      <Text style={styles.linkErrorText}>{linkError}</Text>
                    ) : null}

                    <View style={styles.addLinkActions}>
                      <TouchableOpacity
                        style={styles.cancelLinkButton}
                        onPress={() => {
                          setAddingLink(false);
                          setNewLinkHandle("");
                          setLinkError("");
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cancelLinkText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmLinkButton}
                        onPress={addOnboardingLink}
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
            </View>
          )}

          {/* ── Step 7: Terms & Age ── */}
          {step === 7 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>One last step</Text>
              <Text style={styles.subtitle}>
                Please confirm the following to continue.
              </Text>
              <View style={styles.checkList}>
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setAgeConfirmed((v) => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ageConfirmed }}
                >
                  <Ionicons
                    name={ageConfirmed ? "checkbox" : "square-outline"}
                    size={22}
                    color={ageConfirmed ? Colors.primary : Colors.textTertiary}
                  />
                  <Text style={styles.checkLabel}>
                    I am at least 18 years of age
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setTermsAccepted((v) => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: termsAccepted }}
                >
                  <Ionicons
                    name={termsAccepted ? "checkbox" : "square-outline"}
                    size={22}
                    color={termsAccepted ? Colors.primary : Colors.textTertiary}
                  />
                  <Text style={styles.checkLabel}>
                    I have read and agree to the{" "}
                    <Text
                      style={styles.checkLink}
                      onPress={() =>
                        Linking.openURL("https://loamapp.xyz/terms")
                      }
                    >
                      Terms of Use
                    </Text>
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setPrivacyAccepted((v) => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: privacyAccepted }}
                >
                  <Ionicons
                    name={privacyAccepted ? "checkbox" : "square-outline"}
                    size={22}
                    color={
                      privacyAccepted ? Colors.primary : Colors.textTertiary
                    }
                  />
                  <Text style={styles.checkLabel}>
                    I have read and agree to the{" "}
                    <Text
                      style={styles.checkLink}
                      onPress={() =>
                        Linking.openURL("https://loamapp.xyz/privacy")
                      }
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.notifRow}>
                <View style={styles.notifRowLeft}>
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={Colors.textPrimary}
                  />
                  <Text style={styles.checkLabel}>Enable notifications</Text>
                </View>
                <Switch
                  value={notificationsOptIn}
                  onValueChange={setNotificationsOptIn}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.textPrimary}
                />
              </View>
              <Text style={styles.notifHint}>
                Don't miss out on events, RSVPs, and updates from creators
                around the city.
              </Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={Colors.cancelled}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* CTA */}
        <View style={styles.footer}>
          {((step === 4 && !data.photoUri) ||
            (step === 5 && !data.latitude) ||
            step === 6) && (
            <TouchableOpacity style={styles.skipButton} onPress={goNext}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextButton, loading && styles.nextButtonDisabled]}
            activeOpacity={0.85}
            onPress={goNext}
            disabled={loading}
          >
            {loading && isLastStep ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <Text style={styles.nextButtonText}>
                {isLastStep ? "Finish" : "Continue"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  progressTrack: {
    height: 3,
    backgroundColor: Colors.surfaceElevated,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  stepContent: {
    flex: 1,
  },
  title: {
    fontSize: Typography.size["2xl"],
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },

  // Profile type cards
  typeCards: {
    gap: Spacing.md,
  },
  typeCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  typeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: "#1A0D00",
  },
  typeCardTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  typeCardTitleActive: {
    color: Colors.primary,
  },
  typeCardDesc: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    lineHeight: 19,
  },

  // Form fields
  form: {
    gap: Spacing.md,
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
    height: 110,
    paddingTop: 14,
  },
  charCount: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    textAlign: "right",
  },

  // Photo
  photoArea: {
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing["2xl"],
  },
  photoButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: "hidden",
  },
  photoPreview: {
    width: 200,
    height: 200,
  },
  photoPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  photoPlaceholderText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    textAlign: "center",
  },
  removePhoto: {
    fontSize: Typography.size.sm,
    color: Colors.cancelled,
  },

  // Location
  geocodingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  geocodingText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    lineHeight: 17,
  },
  locationNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  locationNameText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
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

  // Portfolio & Links (step 6)
  portfolioSection: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  portfolioGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
  },
  portfolioThumbWrap: {
    position: "relative" as const,
  },
  portfolioThumb: {
    width: 90,
    height: 90,
    borderRadius: BorderRadius.sm,
  },
  portfolioRemove: {
    position: "absolute" as const,
    top: -6,
    right: -6,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  addPhotosButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + "50",
    borderStyle: "dashed" as const,
    backgroundColor: Colors.primary + "08",
  },
  addPhotosText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.primary,
  },
  linkRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + "50",
    borderStyle: "dashed" as const,
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
  platformScroll: {
    marginBottom: Spacing.xs,
  },
  platformChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
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
  handleInputRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
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
  linkErrorText: {
    fontSize: Typography.size.xs,
    color: Colors.cancelled,
  },
  addLinkActions: {
    flexDirection: "row" as const,
    gap: Spacing.sm,
  },
  cancelLinkButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center" as const,
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
    alignItems: "center" as const,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  confirmLinkText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },

  // Terms & Age checkboxes
  checkList: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: Spacing.sm,
  },
  checkLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.size.base,
    lineHeight: 22,
  },
  checkLink: {
    color: Colors.primary,
    textDecorationLine: "underline",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  notifRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.md,
  },
  notifHint: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    lineHeight: 18,
    marginTop: Spacing.xs,
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
    marginTop: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.cancelled,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
});
