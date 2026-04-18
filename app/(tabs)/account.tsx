import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../src/components/ErrorState";
import { IntroModal } from "../../src/components/IntroModal";
import { NicheTag } from "../../src/components/NicheTag";
import { PlatformIcon } from "../../src/components/PlatformIcon";
import { PortfolioLightbox } from "../../src/components/PortfolioLightbox";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { useAuth } from "../../src/context/auth";
import { useHostedEvents } from "../../src/hooks/useEvents";
import { useIntroModal } from "../../src/hooks/useIntroModal";
import { useUnreadCount } from "../../src/hooks/useNotificationsData";
import {
  useAddPortfolioImage,
  usePortfolio,
  useRemovePortfolioImage,
} from "../../src/hooks/usePortfolio";
import { useProfile } from "../../src/hooks/useProfile";
import { useRefreshHandler } from "../../src/hooks/useRefreshHandler";
import { supabase } from "../../src/lib/supabase";
import { formatDayDate } from "../../src/utils/date";

export default function AccountScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const introModal = useIntroModal("account", userId);
  const { data, isLoading, error, refetch } = useProfile(userId);
  const profileId = data?.profile?.id;
  const { data: unreadCount = 0 } = useUnreadCount(profileId);
  const { data: hostedEvents = [], refetch: refetchHosted } =
    useHostedEvents(profileId);
  const { data: portfolioImages, refetch: refetchPortfolio } =
    usePortfolio(profileId);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const { refreshing, handleRefresh: onRefresh } = useRefreshHandler(
    refetch,
    refetchHosted,
    refetchPortfolio,
  );
  const addPortfolioImage = useAddPortfolioImage();
  const removePortfolioImage = useRemovePortfolioImage();
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  async function handleAddPortfolioImage() {
    if (!profileId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      addPortfolioImage.mutate(
        { profileId, imageUri: result.assets[0].uri },
        {
          onError: (err) => {
            console.error("[account] portfolio upload error:", err);
            Alert.alert(
              "Upload failed",
              "We encountered an error trying to upload your image. Please try again.",
            );
          },
        },
      );
    }
  }

  function handleRemovePortfolioImage(imageId: string) {
    if (!profileId) return;
    Alert.alert("Remove Image", "Remove this image from your portfolio?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removePortfolioImage.mutate({ imageId, profileId }),
      },
    ]);
  }

  async function pickAndUploadBanner() {
    if (!userId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission denied",
        "Photo library access is needed to set a cover photo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingBanner(true);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const path = `${userId}/banner.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("banners")
        .getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ banner_image_url: publicUrl })
        .eq("user_id", userId);
      if (updateError) throw updateError;
      await refetch();
    } catch {
      Alert.alert("Upload failed", "Please try again.");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function removeBanner() {
    if (!userId) return;
    setUploadingBanner(true);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ banner_image_url: null })
        .eq("user_id", userId);
      if (updateError) throw updateError;
      // Also remove the file from storage (best-effort)
      await supabase.storage.from("banners").remove([`${userId}/banner.jpg`]);
      await refetch();
    } catch {
      Alert.alert("Error", "Could not remove cover photo. Please try again.");
    } finally {
      setUploadingBanner(false);
    }
  }

  function handleBannerPress() {
    if (uploadingBanner) return;
    const options = ["Change Cover Photo", "Remove Cover Photo", "Cancel"];
    const destructiveButtonIndex = 1;
    const cancelButtonIndex = 2;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex, cancelButtonIndex },
        (index) => {
          if (index === 0) pickAndUploadBanner();
          else if (index === 1) removeBanner();
        },
      );
    } else {
      Alert.alert("Cover Photo", undefined, [
        { text: "Change Cover Photo", onPress: pickAndUploadBanner },
        {
          text: "Remove Cover Photo",
          style: "destructive",
          onPress: removeBanner,
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  function openLink(url: string) {
    const full = url.startsWith("http") ? url : `https://${url}`;
    Linking.openURL(full).catch(() =>
      Alert.alert("Error", "Could not open this link."),
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (error || !data) {
    return <ErrorState message="Couldn't load profile" onRetry={refetch} />;
  }

  const { profile, niches, externalLinks } = data;
  const isCreator = profile.profile_type === "CREATOR";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.push("/notifications" as any)}
            activeOpacity={0.7}
            accessibilityLabel={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
            accessibilityRole="button"
          >
            <Ionicons
              name="notifications-outline"
              size={26}
              color={Colors.textPrimary}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Image
            source={require("../../assets/images/loam-wordmark.png")}
            style={styles.wordmark}
            contentFit="contain"
          />
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.push("/settings" as any)}
            activeOpacity={0.7}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <Ionicons
              name="settings-outline"
              size={26}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Profile header: banner behind avatar + name */}
        <View style={styles.profileHeader}>
          {profile.banner_image_url ? (
            <>
              <View style={StyleSheet.absoluteFill}>
                <Image
                  source={{ uri: profile.banner_image_url }}
                  style={{ flex: 1 }}
                  contentFit="cover"
                />
              </View>
              <View style={styles.bannerOverlay} />
              <TouchableOpacity
                style={styles.bannerEditBtn}
                onPress={handleBannerPress}
                disabled={uploadingBanner}
                accessibilityLabel="Change cover photo"
                accessibilityRole="button"
              >
                {uploadingBanner ? (
                  <ActivityIndicator size="small" color={Colors.textPrimary} />
                ) : (
                  <Ionicons
                    name="camera-outline"
                    size={18}
                    color={Colors.textPrimary}
                  />
                )}
              </TouchableOpacity>
            </>
          ) : null}

          <View style={styles.avatarSection}>
            {!profile.banner_image_url && (
              <TouchableOpacity
                style={styles.addBannerBtn}
                onPress={pickAndUploadBanner}
                disabled={uploadingBanner}
                activeOpacity={0.7}
                accessibilityLabel="Add cover photo"
                accessibilityRole="button"
              >
                {uploadingBanner ? (
                  <ActivityIndicator size="small" color={Colors.textTertiary} />
                ) : (
                  <>
                    <Ionicons
                      name="image-outline"
                      size={13}
                      color={Colors.textTertiary}
                    />
                    <Text style={styles.addBannerText}>Add cover photo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {profile.profile_picture_url ? (
              <Image
                source={{ uri: profile.profile_picture_url }}
                style={[
                  styles.avatar,
                  profile.banner_image_url ? styles.avatarWithBorder : null,
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPlaceholder,
                  profile.banner_image_url ? styles.avatarWithBorder : null,
                ]}
              >
                <Text style={styles.avatarInitial}>
                  {profile.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={styles.displayName}>{profile.display_name}</Text>

            <View style={styles.metaRow}>
              <View
                style={[
                  styles.typeBadge,
                  isCreator ? styles.creatorBadge : styles.businessBadge,
                ]}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    isCreator
                      ? styles.creatorBadgeText
                      : styles.businessBadgeText,
                  ]}
                >
                  {isCreator ? "Creator" : "Business"}
                </Text>
              </View>
              {profile.location_name ? (
                <View style={styles.locationRow}>
                  <Ionicons
                    name="location-outline"
                    size={13}
                    color={Colors.textTertiary}
                  />
                  <Text style={styles.locationText}>
                    {profile.location_name}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              router.push(
                `/follow-list?mode=followers&profileId=${profile.id}` as any,
              )
            }
            activeOpacity={0.7}
            accessibilityLabel={`${profile.follower_count} followers`}
            accessibilityRole="button"
          >
            <Text style={styles.statNumber}>{profile.follower_count}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              router.push(
                `/follow-list?mode=following&profileId=${profile.id}` as any,
              )
            }
            activeOpacity={0.7}
            accessibilityLabel={`${profile.following_count} following`}
            accessibilityRole="button"
          >
            <Text style={styles.statNumber}>{profile.following_count}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          {profile.years_in_business != null && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {profile.years_in_business}
                </Text>
                <Text style={styles.statLabel}>Yrs Active</Text>
              </View>
            </>
          )}
        </View>

        {/* Bio */}
        {profile.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* Niches */}
        {niches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niches</Text>
            <View style={styles.niches}>
              {niches.map((niche) => (
                <NicheTag
                  key={niche.id}
                  name={niche.name}
                  color={niche.color}
                />
              ))}
            </View>
          </View>
        )}

        {/* External Links */}
        {externalLinks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Links</Text>
            <View style={styles.links}>
              {externalLinks.map((link) => (
                <TouchableOpacity
                  key={link.id}
                  style={styles.linkButton}
                  onPress={() => openLink(link.url)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Open ${link.platform_name}`}
                  accessibilityRole="link"
                >
                  <PlatformIcon
                    platform={link.platform_name}
                    size={18}
                    color={Colors.primary}
                  />
                  <Text style={styles.linkText}>{link.platform_name}</Text>
                  <Ionicons
                    name="open-outline"
                    size={13}
                    color={Colors.textTertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Portfolio */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <TouchableOpacity
              onPress={handleAddPortfolioImage}
              activeOpacity={0.7}
              accessibilityLabel="Add portfolio image"
              accessibilityRole="button"
            >
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={Colors.primary}
              />
            </TouchableOpacity>
          </View>
          {!portfolioImages || portfolioImages.length === 0 ? (
            <TouchableOpacity
              style={styles.portfolioEmpty}
              onPress={handleAddPortfolioImage}
              activeOpacity={0.7}
              accessibilityLabel="Add portfolio images"
              accessibilityRole="button"
            >
              <Ionicons
                name="images-outline"
                size={28}
                color={Colors.textTertiary}
              />
              <Text style={styles.portfolioEmptyText}>
                Add portfolio images
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.portfolioGrid}>
              {portfolioImages.map((img, idx) => (
                <TouchableOpacity
                  key={img.id}
                  style={styles.portfolioItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setLightboxIndex(idx);
                    setLightboxVisible(true);
                  }}
                  onLongPress={() => handleRemovePortfolioImage(img.id)}
                  accessibilityLabel={`Portfolio image ${idx + 1}, long press to remove`}
                  accessibilityRole="image"
                >
                  <Image
                    source={{ uri: img.image_url }}
                    style={styles.portfolioImage}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <PortfolioLightbox
            images={portfolioImages ?? []}
            initialIndex={lightboxIndex}
            visible={lightboxVisible}
            onClose={() => setLightboxVisible(false)}
          />
        </View>

        {/* My Hosted Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Events</Text>
            {hostedEvents.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/my-events")}
                activeOpacity={0.7}
                accessibilityLabel="See RSVPs"
                accessibilityRole="link"
              >
                <Text style={styles.sectionLink}>See RSVPs →</Text>
              </TouchableOpacity>
            )}
          </View>

          {hostedEvents.length === 0 ? (
            <View style={styles.hostedEmpty}>
              <Ionicons
                name="calendar-outline"
                size={28}
                color={Colors.textTertiary}
              />
              <Text style={styles.hostedEmptyText}>No hosted events yet</Text>
              <TouchableOpacity
                onPress={() => router.push("/host")}
                activeOpacity={0.7}
                accessibilityLabel="Create your first event"
                accessibilityRole="link"
              >
                <Text style={styles.hostedEmptyLink}>
                  Create your first event →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.hostedList}>
              {hostedEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={[
                    styles.hostedCard,
                    event.status === "CANCELLED" && styles.hostedCardCancelled,
                  ]}
                  onPress={() => router.push(`/event/${event.id}`)}
                  activeOpacity={0.8}
                  accessibilityLabel={`${event.title}, ${formatDayDate(event.start_time)}`}
                  accessibilityRole="button"
                >
                  <View style={styles.hostedCardMain}>
                    <View style={styles.hostedCardInfo}>
                      <View style={styles.hostedCardTitleRow}>
                        <Text style={styles.hostedCardTitle} numberOfLines={1}>
                          {event.title}
                        </Text>
                      </View>
                      <Text style={styles.hostedCardDate}>
                        {formatDayDate(event.start_time)}
                      </Text>
                    </View>

                    <View style={styles.hostedCardRight}>
                      {event.status === "CANCELLED" ? (
                        <View style={styles.cancelledBadge}>
                          <Text style={styles.cancelledBadgeText}>
                            Cancelled
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.privacyBadge,
                            event.privacy === "EXCLUSIVE" &&
                              styles.privacyBadgeExclusive,
                          ]}
                        >
                          <Ionicons
                            name={
                              event.privacy === "EXCLUSIVE"
                                ? "lock-closed"
                                : "earth"
                            }
                            size={10}
                            color={
                              event.privacy === "EXCLUSIVE"
                                ? Colors.primary
                                : Colors.textTertiary
                            }
                          />
                          <Text
                            style={[
                              styles.privacyBadgeText,
                              event.privacy === "EXCLUSIVE" &&
                                styles.privacyBadgeTextExclusive,
                            ]}
                          >
                            {event.privacy === "EXCLUSIVE"
                              ? "Exclusive"
                              : "Public"}
                          </Text>
                        </View>
                      )}
                      <View style={styles.rsvpCounts}>
                        <Text style={styles.rsvpCountText}>
                          {event.interested_count} interested ·{" "}
                          {event.going_count} going
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.textTertiary}
                    style={styles.hostedCardChevron}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <IntroModal
        visible={introModal.visible}
        onDismiss={introModal.dismiss}
        title="Your Profile"
        body="This is your public presence on Loam. Add portfolio work, build your following, and manage your settings."
        icon="person-outline"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
    gap: Spacing.sm,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  wordmark: {
    flex: 1,
    height: 50,
  },
  headerIconButton: {
    padding: 6,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: Typography.weight.bold,
    lineHeight: 12,
  },

  // Profile header
  profileHeader: {
    overflow: "hidden",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  bannerEditBtn: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Avatar section
  avatarSection: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  addBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  addBannerText: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.avatar,
    marginBottom: Spacing.md,
  },
  avatarWithBorder: {
    borderWidth: 3,
    borderColor: Colors.background,
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
  displayName: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  creatorBadge: {
    backgroundColor: Colors.creatorBadge + "15",
    borderColor: Colors.creatorBadge + "50",
  },
  businessBadge: {
    backgroundColor: Colors.businessBadge + "15",
    borderColor: Colors.businessBadge + "50",
  },
  typeBadgeText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  creatorBadgeText: {
    color: Colors.creatorBadge,
  },
  businessBadgeText: {
    color: Colors.businessBadge,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  locationText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statNumber: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  bio: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  niches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  links: {
    gap: Spacing.xs,
  },
  linkButton: {
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
  linkText: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },

  // Section header row
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLink: {
    fontSize: Typography.size.sm,
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
  },

  // Hosted events empty state
  hostedEmpty: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  hostedEmptyText: {
    fontSize: Typography.size.base,
    color: Colors.textTertiary,
  },
  hostedEmptyLink: {
    fontSize: Typography.size.sm,
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
  },

  // Hosted events list
  hostedList: {
    gap: Spacing.sm,
  },
  hostedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  hostedCardCancelled: {
    opacity: 0.5,
  },
  hostedCardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  hostedCardInfo: {
    flex: 1,
    gap: 3,
  },
  hostedCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  hostedCardTitle: {
    flex: 1,
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  hostedCardDate: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  hostedCardRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.border,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  privacyBadgeExclusive: {
    backgroundColor: Colors.primary + "15",
    borderColor: Colors.primary + "40",
  },
  privacyBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    color: Colors.textTertiary,
  },
  privacyBadgeTextExclusive: {
    color: Colors.primary,
  },
  cancelledBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.cancelled + "15",
    borderWidth: 1,
    borderColor: Colors.cancelled + "40",
  },
  cancelledBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    color: Colors.cancelled,
  },
  rsvpCounts: {},
  rsvpCountText: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  hostedCardChevron: {
    marginLeft: Spacing.xs,
  },

  // Log out
  logOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cancelled + "40",
    backgroundColor: Colors.cancelled + "10",
  },
  logOutText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.cancelled,
  },

  // Portfolio
  portfolioEmpty: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    backgroundColor: Colors.surfaceElevated,
  },
  portfolioEmptyText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  portfolioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  portfolioItem: {
    width:
      (Dimensions.get("window").width - Spacing.lg * 2 - Spacing.xs * 2) / 3,
    aspectRatio: 1,
  },
  portfolioImage: {
    width: "100%" as any,
    height: "100%" as any,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
  },
});
