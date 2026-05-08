import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../src/components/ErrorState";
import { EventCard } from "../../src/components/EventCard";
import { NicheTag } from "../../src/components/NicheTag";
import { PlatformIcon } from "../../src/components/PlatformIcon";
import { PortfolioLightbox } from "../../src/components/PortfolioLightbox";
import { APP_WEBSITE } from "../../src/constants/app";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { useAuth } from "../../src/context/auth";
import {
  useBlockUser,
  useBlockedIds,
  useIsBlockedBy,
  useUnblockUser,
} from "../../src/hooks/useBlock";
import { useAttendingEvents, useHostedEvents } from "../../src/hooks/useEvents";
import {
  useFollowMutation,
  useIsFollowing,
  useUnfollowMutation,
} from "../../src/hooks/useFollow";
import { usePortfolio } from "../../src/hooks/usePortfolio";
import { useProfile, useProfileById } from "../../src/hooks/useProfile";
import { useRefreshHandler } from "../../src/hooks/useRefreshHandler";
import { useReportContent } from "../../src/hooks/useReport";

export default function ViewProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const validId = id && /^\d+$/.test(id) ? id : undefined;
  const { session } = useAuth();
  const { data: myProfileData } = useProfile(session?.user?.id);
  const myProfileId = myProfileData?.profile?.id;

  const {
    data: supabaseData,
    isLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useProfileById(validId);
  const { data: isFollowing, isLoading: followLoading } = useIsFollowing(
    myProfileId,
    validId,
  );
  const followMutation = useFollowMutation();
  const unfollowMutation = useUnfollowMutation();
  const blockMutation = useBlockUser();
  const unblockMutation = useUnblockUser();
  const reportMutation = useReportContent();

  const { data: blockedIds = [], isLoading: blockedIdsLoading } = useBlockedIds(myProfileId);
  const iHaveBlocked = !!validId && blockedIds.includes(validId);
  const { data: isBlockedByThem = false, isLoading: blockedByLoading } =
    useIsBlockedBy(validId, myProfileId);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const posthog = usePostHog();
  const isOwnProfile = supabaseData?.profile?.user_id === session?.user?.id;
  const isMutating = followMutation.isPending || unfollowMutation.isPending;

  // Track profile view
  useEffect(() => {
    if (id && supabaseData?.profile) {
      posthog?.capture("profile_viewed", {
        profile_id: id,
        profile_type: supabaseData.profile.profile_type,
      });
    }
  }, [id, supabaseData?.profile]);

  function handleFollowToggle() {
    if (!myProfileId || !id || isMutating || isOwnProfile) return;
    if (isFollowing) {
      unfollowMutation.mutate({ followerId: myProfileId, followingId: id });
    } else {
      followMutation.mutate({ followerId: myProfileId, followingId: id });
    }
  }

  function handleMoreOptions() {
    const targetName = supabaseData?.profile?.display_name ?? "this user";
    Alert.alert(targetName, undefined, [
      {
        text: "Report User",
        onPress: () => setReportModalVisible(true),
      },
      {
        text: "Block User",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            `Block ${targetName}?`,
            "They won't appear in your feed and you won't appear in theirs. The Loam team will be notified.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: () => {
                  if (!myProfileId || !id) return;
                  blockMutation.mutate(
                    {
                      myProfileId,
                      myDisplayName:
                        myProfileData?.profile?.display_name ?? "A Loam user",
                      myEmail: session?.user?.email ?? "",
                      blockedId: id,
                      blockedDisplayName: targetName,
                    },
                    { onSuccess: () => router.back() },
                  );
                },
              },
            ],
          ),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleSubmitReport() {
    if (!myProfileId || !id || !reportReason.trim()) return;
    reportMutation.mutate(
      {
        myProfileId,
        myDisplayName: myProfileData?.profile?.display_name ?? "A Loam user",
        myEmail: session?.user?.email ?? "",
        reportedProfileId: id,
        reportedDisplayName: supabaseData?.profile?.display_name,
        reason: reportReason.trim(),
      },
      {
        onSuccess: () => {
          setReportModalVisible(false);
          setReportReason("");
          Alert.alert(
            "Report submitted",
            "Thank you for keeping Loam safe. We'll review this shortly.",
          );
        },
        onError: () => {
          Alert.alert(
            "Something went wrong",
            "Your report couldn't be sent. Please try again.",
          );
        },
      },
    );
  }

  const { data: portfolioImages, refetch: refetchPortfolio } =
    usePortfolio(validId);
  const { data: hostedEventsRaw = [], refetch: refetchHosted } =
    useHostedEvents(validId);
  const { data: attendingEvents = [], refetch: refetchAttending } =
    useAttendingEvents(validId);
  const { refreshing, handleRefresh: onRefresh } = useRefreshHandler(
    refetchProfile,
    refetchPortfolio,
    refetchHosted,
    refetchAttending,
  );
  const hostedEvents = hostedEventsRaw.filter((e) => e.status !== "DRAFT");
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const data = supabaseData ?? null;

  async function handleShare() {
    if (!data) return;
    try {
      const url = `${APP_WEBSITE}/profile/${data.profile?.id}`;
      const text = `Check out ${data.profile?.display_name ?? "this creator"} on Loam!`;
      await Share.share({
        // iOS renders both message + url; Android ignores url.
        message: Platform.OS === "android" ? `${text}\n\n${url}` : text,
        url,
      });
    } catch (error) {
      console.error(error);
    }
  }

  function openLink(url: string) {
    const full = url.startsWith("http") ? url : `https://${url}`;
    Linking.openURL(full).catch(() =>
      Alert.alert("Error", "Could not open this link."),
    );
  }

  if (!validId) {
    return (
      <ErrorState message="Invalid profile link" onBack={() => router.back()} />
    );
  }

  if (isLoading || blockedIdsLoading || blockedByLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (profileError || !data) {
    return (
      <ErrorState
        message={profileError ? "Couldn't load profile" : "Profile not found"}
        onRetry={profileError ? refetchProfile : undefined}
        onBack={() => router.back()}
      />
    );
  }

  if (!isOwnProfile && iHaveBlocked) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="ban-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.blockedTitle}>You've blocked this user</Text>
          <Text style={styles.blockedSubtitle}>
            Unblock them to view their profile
          </Text>
          <TouchableOpacity
            style={styles.unblockButton}
            onPress={() => {
              if (!myProfileId || !validId) return;
              unblockMutation.mutate({ myProfileId, blockedId: validId });
            }}
            disabled={unblockMutation.isPending}
            activeOpacity={0.8}
            accessibilityLabel="Unblock user"
            accessibilityRole="button"
          >
            <Text style={styles.unblockButtonText}>
              {unblockMutation.isPending ? "Unblocking…" : "Unblock"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isOwnProfile && isBlockedByThem) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons
            name="person-remove-outline"
            size={48}
            color={Colors.textTertiary}
          />
          <Text style={styles.blockedTitle}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { profile, niches, externalLinks } = data;
  const isCreator = profile.profile_type === "CREATOR";

  return (
    <SafeAreaView style={styles.safeArea}>
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
        <View style={{ flex: 1 }} />
        {/* Follow — hidden on own profile */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={handleFollowToggle}
            activeOpacity={0.8}
            disabled={isMutating || followLoading}
            accessibilityLabel={isFollowing ? "Unfollow" : "Follow"}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.followButtonText,
                isFollowing && styles.followingButtonText,
              ]}
            >
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          accessibilityLabel="Share profile"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-redo" size={25} color={Colors.textPrimary} />
        </TouchableOpacity>
        {/* More options — hidden on own profile */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={handleMoreOptions}
            accessibilityLabel="More options"
            accessibilityRole="button"
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Report user modal */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Report User</Text>
            <Text style={styles.modalSubtitle}>
              Describe why you're reporting this user. We'll review it within 24
              hours.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Describe the reason…"
              placeholderTextColor={Colors.textSecondary}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setReportModalVisible(false);
                  setReportReason("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  !reportReason.trim() && styles.modalSubmitDisabled,
                ]}
                onPress={handleSubmitReport}
                disabled={!reportReason.trim() || reportMutation.isPending}
              >
                <Text style={styles.modalSubmitText}>
                  {reportMutation.isPending ? "Submitting…" : "Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
            </>
          ) : null}

          <View style={styles.avatarSection}>
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
                  onPress={() =>
                    router.push(
                      `/profiles/${encodeURIComponent(niche.name)}` as any,
                    )
                  }
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
        {portfolioImages && portfolioImages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <View style={styles.portfolioGrid}>
              {portfolioImages.map((img, idx) => (
                <TouchableOpacity
                  key={img.id}
                  style={styles.portfolioItem}
                  activeOpacity={0.85}
                  onPress={() => {
                    setLightboxIndex(idx);
                    setLightboxVisible(true);
                    posthog?.capture("portfolio_image_viewed", {
                      profile_id: id,
                      image_index: idx,
                    });
                  }}
                  accessibilityLabel={`Portfolio image ${idx + 1}`}
                  accessibilityRole="image"
                >
                  <Image
                    source={{ uri: img.image_url }}
                    style={styles.portfolioImage}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <PortfolioLightbox
          images={portfolioImages ?? []}
          initialIndex={lightboxIndex}
          visible={lightboxVisible}
          onClose={() => setLightboxVisible(false)}
        />

        {/* Hosted Events */}
        {hostedEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hosting</Text>
            {hostedEvents.map((event) => (
              <View
                key={event.id}
                style={event.status === "CANCELLED" && styles.cancelledCard}
              >
                <EventCard
                  event={event}
                  onPress={() => router.push(`/event/${event.id}` as any)}
                />
                {event.status === "CANCELLED" && (
                  <View style={styles.cancelledOverlay}>
                    <View style={styles.cancelledBadge}>
                      <Text style={styles.cancelledBadgeText}>Cancelled</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Events Attending */}
        {attendingEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Events Attending</Text>
            {attendingEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/event/${event.id}` as any)}
              />
            ))}
          </View>
        )}
      </ScrollView>
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
  // Nav header
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
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
  },
  shareButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  followButton: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  followingButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  followingButtonText: {
    color: Colors.textSecondary,
  },
  moreButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },

  // Report modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.size.md,
    minHeight: 100,
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  modalSubmitDisabled: {
    opacity: 0.4,
  },
  modalSubmitText: {
    color: Colors.textPrimary,
    fontWeight: Typography.weight.semibold,
  },

  // Profile header
  profileHeader: {
    overflow: "hidden",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  // Avatar section
  avatarSection: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
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

  // Portfolio
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

  // Blocked states
  blockedTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  blockedSubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  unblockButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  unblockButtonText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.textPrimary,
  },

  // Hosted events
  cancelledCard: {
    opacity: 0.55,
  },
  cancelledOverlay: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.xl,
  },
  cancelledBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.cancelled + "25",
    borderWidth: 1,
    borderColor: Colors.cancelled + "60",
  },
  cancelledBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    color: Colors.cancelled,
  },
});
