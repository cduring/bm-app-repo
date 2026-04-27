import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_WEBSITE } from "../../src/constants/app";
import { ErrorState } from "../../src/components/ErrorState";
import { EventTypeBadge } from "../../src/components/EventTypeBadge";
import { LocationMapPreview } from "../../src/components/LocationMapPreview";
import { NicheTag } from "../../src/components/NicheTag";
import { ProfileCard } from "../../src/components/ProfileCard";
import { EVENT_TYPE_COLOR } from "../../src/constants/eventTypes";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { useAuth } from "../../src/context/auth";
import { useRSVP } from "../../src/context/rsvp";
import { useEventById } from "../../src/hooks/useEvents";
import { useProfile } from "../../src/hooks/useProfile";
import { useRefreshHandler } from "../../src/hooks/useRefreshHandler";
import type { RSVPStatus } from "../../src/types";
import { formatDayDate, formatTimeRange } from "../../src/utils/date";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const validId = id && /^\d+$/.test(id) ? id : undefined;
  const { session } = useAuth();
  const {
    data: event,
    isLoading,
    error: eventError,
    refetch: refetchEvent,
  } = useEventById(validId);
  const { data: profileData } = useProfile(session?.user?.id);
  const {
    getRSVP,
    setRSVP,
    refetchMyRSVPs,
    eventRequestors,
    approveRequest,
    declineRequest,
    getPendingCount,
    refetchRequestors,
  } = useRSVP();
  const { refreshing, handleRefresh: onRefresh } =
    useRefreshHandler(refetchEvent, refetchMyRSVPs, refetchRequestors);

  const rsvp: RSVPStatus | null = id ? getRSVP(id) : null;
  const displayedInterestedCount = event
    ? event.privacy === "EXCLUSIVE"
      ? event.interested_count + (event.requested_count ?? 0)
      : event.interested_count
    : 0;

  function handleRSVP(status: RSVPStatus) {
    if (!id) return;

    const eventMeta = event ? { title: event.title, startTime: event.start_time } : undefined;

    if (event?.privacy === "EXCLUSIVE" && rsvp === "GOING") {
      Alert.alert(
        "Leave exclusive event?",
        "You were accepted by the host. Leaving will remove your spot and you would need to request access again.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: () => setRSVP(id, rsvp === status ? null : status, eventMeta),
          },
        ]
      );
      return;
    }

    setRSVP(id, rsvp === status ? null : status, eventMeta);
  }

  function handleApprove(profileId: string) {
    if (!id) return;
    Alert.alert("Approve Request", "Let this person into the event?", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => approveRequest(id, profileId) },
    ]);
  }

  function handleDecline(profileId: string) {
    if (!id) return;
    Alert.alert(
      "Decline Request",
      "Are you sure you want to decline this request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () => declineRequest(id, profileId),
        },
      ],
    );
  }

  async function handleShare() {
    if (!event) return;
    try {
      const url = `${APP_WEBSITE}/event/${event.id}`;
      const text = `Check out ${event.title} on Loam!`;
      await Share.share({
        // iOS renders both message + url; Android ignores url.
        message: Platform.OS === "android" ? `${text}\n\n${url}` : text,
        url,
      });
    } catch (error) {
      console.error(error);
    }
  }

  if (!validId) {
    return <ErrorState message="Invalid event link" onBack={() => router.back()} />;
  }

  if (isLoading && !event) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (eventError || !event) {
    return (
      <ErrorState
        message={eventError ? "Couldn't load event" : "Event not found"}
        onRetry={eventError ? refetchEvent : undefined}
        onBack={() => router.back()}
      />
    );
  }

  const bannerColor = EVENT_TYPE_COLOR[event.event_type];
  const isPublic = event.privacy === "PUBLIC";
  const isHost = !!profileData && profileData.profile.id === event.host_id;
  const canSeeAttendees = isHost || isPublic || rsvp === "GOING";
  const isCancelled = event.status === "CANCELLED";
  const pendingCount = id ? getPendingCount(id) : 0;
  const requestors = id ? (eventRequestors[id] ?? []) : [];
  const isAddressVisible =
    event.privacy === "PUBLIC" || isHost || rsvp === "GOING";

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Nav Header */}
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
        <TouchableOpacity
          style={styles.shareButton}
          accessibilityLabel="Share event"
          accessibilityRole="button"
          onPress={handleShare}
        >
          <Ionicons name="arrow-redo" size={25} color={Colors.textPrimary} />
        </TouchableOpacity>
        {isHost && !isCancelled && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(`/event/edit/${event.id}`)}
            accessibilityLabel="Edit event"
            accessibilityRole="button"
          >
            <Ionicons name="create" size={25} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

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
        {/* Cancelled Banner */}
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="close-circle" size={16} color={Colors.cancelled} />
            <Text style={styles.cancelledBannerText}>
              This event has been cancelled
            </Text>
          </View>
        )}

        {/* Type Banner */}
        {event.cover_image_url ? (
          <View style={styles.banner}>
            <Image
              source={{ uri: event.cover_image_url }}
              style={styles.bannerImage}
              contentFit="cover"
              accessibilityLabel={`Cover image for ${event.title}`}
            />
            {event.privacy === "EXCLUSIVE" && (
              <View style={styles.bannerBottomRight}>
                <Ionicons
                  name="lock-closed"
                  size={12}
                  color={Colors.textPrimary}
                />
                <Text style={styles.bannerLabelOnImage}>Exclusive</Text>
              </View>
            )}
          </View>
        ) : (
          <View
            style={[styles.banner, { backgroundColor: bannerColor + "30" }]}
          >
            {event.privacy === "EXCLUSIVE" && (
              <View style={styles.bannerBottomRight}>
                <Ionicons
                  name="lock-closed"
                  size={12}
                  color={Colors.textSecondary}
                />
                <Text style={styles.bannerLabel}>Exclusive</Text>
              </View>
            )}
          </View>
        )}

        {/* Title + Meta */}
        <View style={styles.section}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <EventTypeBadge eventType={event.event_type} />
          <View style={styles.metaRow}>
            <Ionicons
              name={
                isAddressVisible ? "location-outline" : "lock-closed-outline"
              }
              size={15}
              color={Colors.textTertiary}
            />
            <Text
              style={[
                styles.metaText,
                !isAddressVisible && styles.metaTextDimmed,
              ]}
            >
              {isAddressVisible
                ? event.address_name
                : "Location revealed once approved"}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name="calendar-outline"
              size={15}
              color={Colors.textTertiary}
            />
            <Text style={styles.metaText}>
              {formatDayDate(event.start_time)} ·{" "}
              {formatTimeRange(event.start_time, event.end_time)}
            </Text>
          </View>
        </View>

        {/* Attendee Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.interested }]}>
              {displayedInterestedCount}
            </Text>
            <Text style={styles.statLabel}>Interested</Text>
          </View>
          <View style={styles.statDivider} />
          {canSeeAttendees ? (
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push(`/event/attendees/${event.id}`)}
              activeOpacity={0.7}
              accessibilityLabel={`${event.going_count} going, tap to view attendees`}
              accessibilityRole="button"
            >
              <Text style={[styles.statNumber, { color: Colors.going }]}>
                {event.going_count}
              </Text>
              <Text style={styles.statLabel}>Going ›</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: Colors.going }]}>
                {event.going_count}
              </Text>
              <Text style={styles.statLabel}>Going</Text>
            </View>
          )}
          {isHost && pendingCount > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: Colors.primary }]}>
                  {pendingCount}
                </Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </>
          )}
        </View>

        {/* RSVP Buttons (hidden if cancelled or host) */}
        {!isCancelled && !isHost && (
          <View style={styles.rsvpSection}>
            {isPublic ? (
              <View style={styles.rsvpRow}>
                <TouchableOpacity
                  style={[
                    styles.rsvpButton,
                    rsvp === "INTERESTED" && styles.rsvpButtonInterested,
                  ]}
                  onPress={() => handleRSVP("INTERESTED")}
                  activeOpacity={0.8}
                  accessibilityLabel={
                    rsvp === "INTERESTED"
                      ? "Remove interested"
                      : "Mark as interested"
                  }
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={rsvp === "INTERESTED" ? "star" : "star-outline"}
                    size={16}
                    color={
                      rsvp === "INTERESTED"
                        ? Colors.textInverse
                        : Colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.rsvpButtonText,
                      rsvp === "INTERESTED" && styles.rsvpButtonTextActive,
                    ]}
                  >
                    Interested
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.rsvpButton,
                    rsvp === "GOING" && styles.rsvpButtonGoing,
                  ]}
                  onPress={() => handleRSVP("GOING")}
                  activeOpacity={0.8}
                  accessibilityLabel={
                    rsvp === "GOING" ? "Remove going" : "Mark as going"
                  }
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={
                      rsvp === "GOING"
                        ? "checkmark-circle"
                        : "checkmark-circle-outline"
                    }
                    size={16}
                    color={
                      rsvp === "GOING"
                        ? Colors.textInverse
                        : Colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.rsvpButtonText,
                      rsvp === "GOING" && styles.rsvpButtonTextActive,
                    ]}
                  >
                    Going
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.rsvpRow}>
                <TouchableOpacity
                  style={[
                    styles.rsvpButton,
                    rsvp === "INTERESTED" && styles.rsvpButtonInterested,
                  ]}
                  onPress={() => handleRSVP("INTERESTED")}
                  activeOpacity={0.8}
                  accessibilityLabel={
                    rsvp === "INTERESTED"
                      ? "Remove interested"
                      : "Mark as interested"
                  }
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={rsvp === "INTERESTED" ? "star" : "star-outline"}
                    size={16}
                    color={
                      rsvp === "INTERESTED"
                        ? Colors.textInverse
                        : Colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.rsvpButtonText,
                      rsvp === "INTERESTED" && styles.rsvpButtonTextActive,
                    ]}
                  >
                    Interested
                  </Text>
                </TouchableOpacity>
                {rsvp === null || rsvp === "INTERESTED" ? (
                  <TouchableOpacity
                    style={[
                      styles.rsvpButton,
                      styles.rsvpButtonExclusiveAccess,
                    ]}
                    onPress={() => handleRSVP("REQUESTED")}
                    activeOpacity={0.8}
                    accessibilityLabel="Request access"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="lock-open-outline"
                      size={16}
                      color={Colors.primary}
                    />
                    <Text
                      style={[
                        styles.rsvpButtonText,
                        styles.rsvpButtonTextPrimary,
                      ]}
                    >
                      Request Access
                    </Text>
                  </TouchableOpacity>
                ) : rsvp === "REQUESTED" ? (
                  <TouchableOpacity
                    style={[styles.rsvpButton, styles.rsvpButtonDisabled]}
                    onPress={() => handleRSVP("REQUESTED")}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={Colors.textTertiary}
                    />
                    <Text
                      style={[
                        styles.rsvpButtonText,
                        styles.rsvpButtonTextDisabled,
                      ]}
                    >
                      Pending…
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.rsvpButton, styles.rsvpButtonGoing]}
                    onPress={() => handleRSVP("GOING")}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={Colors.textInverse}
                    />
                    <Text
                      style={[
                        styles.rsvpButtonText,
                        styles.rsvpButtonTextActive,
                      ]}
                    >
                      Going ✓
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Manage Requests (host only, exclusive events) */}
        {isHost && event.privacy === "EXCLUSIVE" && (
          <View style={styles.section}>
            <View style={styles.manageHeader}>
              <Text style={styles.sectionTitle}>Attendance Requests</Text>
              {pendingCount > 0 && (
                <View style={styles.pendingCountBadge}>
                  <Text style={styles.pendingCountText}>{pendingCount}</Text>
                </View>
              )}
            </View>

            {requestors.length === 0 ? (
              <View style={styles.manageEmpty}>
                <Text style={styles.manageEmptyText}>No pending requests</Text>
              </View>
            ) : (
              <View style={styles.requestorList}>
                {requestors.map((requestor) => (
                  <View key={requestor.id} style={styles.requestorRow}>
                    {requestor.profile_picture_url ? (
                      <Image
                        source={{ uri: requestor.profile_picture_url }}
                        style={styles.requestorAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.requestorAvatar,
                          styles.requestorAvatarPlaceholder,
                        ]}
                      >
                        <Text style={styles.requestorAvatarInitial}>
                          {requestor.display_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.requestorInfo}>
                      <Text style={styles.requestorName} numberOfLines={1}>
                        {requestor.display_name}
                      </Text>
                      <Text style={styles.requestorType}>
                        {requestor.profile_type === "CREATOR"
                          ? "Creator"
                          : "Business"}
                      </Text>
                    </View>
                    <View style={styles.requestorActions}>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => handleApprove(requestor.id)}
                        activeOpacity={0.8}
                        accessibilityLabel={`Approve ${requestor.display_name}`}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={Colors.going}
                        />
                        <Text style={styles.approveText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineButton}
                        onPress={() => handleDecline(requestor.id)}
                        activeOpacity={0.8}
                        accessibilityLabel={`Decline ${requestor.display_name}`}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={Colors.cancelled}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Host Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hosted By</Text>
          <ProfileCard
            profile={event.host}
            niches={[]}
            onPress={() => router.push(`/profile/${event.host.id}`)}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About This Event</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        {/* Niches */}
        {event.niches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niches</Text>
            <View style={styles.niches}>
              {event.niches.map((niche) => (
                <NicheTag
                  key={niche.id}
                  name={niche.name}
                  color={niche.color}
                  onPress={() => router.push(`/events/${encodeURIComponent(niche.name)}` as any)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Map Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          {isAddressVisible ? (
            <LocationMapPreview
              latitude={event.latitude}
              longitude={event.longitude}
              height={180}
            />
          ) : (
            <View style={styles.locationPlaceholder}>
              <View style={styles.locationMapDimmed} pointerEvents="none">
                <LocationMapPreview
                  latitude={event.latitude}
                  longitude={event.longitude}
                  height={180}
                />
              </View>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: "rgba(255,255,255,0.08)" },
                ]}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: "rgba(10,10,10,0.72)" },
                ]}
              />
              <View style={styles.locationOverlay}>
                <Ionicons name="lock-closed" size={28} color="#fff" />
                <Text style={styles.locationPlaceholderText}>
                  Location is revealed once your invite is accepted
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },
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
  backButton: { width: 40, height: 40, justifyContent: "center" },
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
  editButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },

  // Cancelled banner
  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.cancelled + "15",
    borderBottomWidth: 1,
    borderBottomColor: Colors.cancelled + "30",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  cancelledBannerText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.cancelled,
  },

  // Banner
  banner: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    // contentFit="cover" is passed as prop to expo-image
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerCenter: { alignItems: "center" },
  bannerBottomLeft: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bannerBottomRight: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bannerLabel: { fontSize: Typography.size.xs, color: Colors.textSecondary },
  bannerLabelOnImage: {
    fontSize: Typography.size.xs,
    color: Colors.textPrimary,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  eventTitle: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  metaText: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    flex: 1,
  },
  metaTextDimmed: {
    color: Colors.textTertiary,
    fontStyle: "italic",
  },
  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statNumber: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
  },
  statLabel: { fontSize: Typography.size.xs, color: Colors.textTertiary },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  // RSVP
  rsvpSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  rsvpRow: { flexDirection: "row", gap: Spacing.sm },
  rsvpButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  rsvpButtonInterested: {
    backgroundColor: Colors.interested,
    borderColor: Colors.interested,
  },
  rsvpButtonGoing: {
    backgroundColor: Colors.going,
    borderColor: Colors.going,
  },
  rsvpButtonText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  rsvpButtonTextActive: { color: Colors.textInverse },
  rsvpButtonExclusiveAccess: {
    borderColor: Colors.primary + "60",
    backgroundColor: Colors.primary + "15",
  },
  rsvpButtonDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  rsvpButtonTextPrimary: { color: Colors.primary },
  rsvpButtonTextDisabled: {
    color: Colors.textTertiary,
    fontWeight: Typography.weight.medium,
  },

  // Manage requests
  manageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pendingCountBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  pendingCountText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.textInverse,
  },
  manageEmpty: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  manageEmptyText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  requestorList: {
    gap: Spacing.sm,
  },
  requestorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  requestorAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.avatar,
  },
  requestorAvatarPlaceholder: {
    backgroundColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  requestorAvatarInitial: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  requestorInfo: {
    flex: 1,
    gap: 2,
  },
  requestorName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  requestorType: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  requestorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  approveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.going + "15",
    borderWidth: 1,
    borderColor: Colors.going + "40",
  },
  approveText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.going,
  },
  declineButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.cancelled + "15",
    borderWidth: 1,
    borderColor: Colors.cancelled + "40",
  },

  description: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  niches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  locationPlaceholder: {
    height: 180,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  locationMapDimmed: {
    opacity: 0.15,
  },
  locationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  locationPlaceholderText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
});
