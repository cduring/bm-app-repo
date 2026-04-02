import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../src/components/ErrorState";
import { EventCard } from "../../src/components/EventCard";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { useAuth } from "../../src/context/auth";
import { useRSVP } from "../../src/context/rsvp";
import { useEvents, useHostedEvents } from "../../src/hooks/useEvents";
import { useProfile } from "../../src/hooks/useProfile";
import type { EventWithHost } from "../../src/types";
import { formatDayDate } from "../../src/utils/date";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "attending" | "hosting";
type AttendingTab = "interested" | "requested" | "going";

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyEventsScreen() {
  const { session } = useAuth();
  const { data: profileData } = useProfile(session?.user?.id);
  const profileId = profileData?.profile.id;
  const { myRSVPs } = useRSVP();
  const { data: eventsData, isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useEvents();
  const { data: hostedEventsData, isLoading: hostedLoading, error: hostedError, refetch: refetchHosted } = useHostedEvents(profileId);

  const [mode, setMode] = useState<Mode>("attending");
  const [activeTab, setActiveTab] = useState<AttendingTab>("interested");
  const [refreshing, setRefreshing] = useState(false);
  const [headerWidth, setHeaderWidth] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  function handleModeChange(newMode: Mode) {
    setMode(newMode);
    Animated.spring(indicatorAnim, {
      toValue: newMode === "attending" ? 0 : 1,
      useNativeDriver: true,
      tension: 70,
      friction: 9,
    }).start();
  }

  const indicatorX = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, headerWidth / 2],
  });

  const allEvents: EventWithHost[] = eventsData ?? [];

  // Attending — three separate buckets
  const interestedEvents = allEvents.filter(
    (e) => myRSVPs[e.id] === "INTERESTED" && e.status !== "CANCELLED",
  );
  const requestedEvents = allEvents.filter(
    (e) => myRSVPs[e.id] === "REQUESTED" && e.status !== "CANCELLED",
  );
  const goingEvents = allEvents.filter(
    (e) => myRSVPs[e.id] === "GOING" && e.status !== "CANCELLED",
  );

  // Hosting — uses dedicated hook that includes DRAFT/CANCELLED (with RSVP counts)
  const hostedEvents: EventWithHost[] = hostedEventsData ?? [];

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchEvents(), refetchHosted()]);
    setRefreshing(false);
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ── Header: Uber-style mode tabs ── */}
        <View
          style={styles.header}
          onLayout={(e) => setHeaderWidth(e.nativeEvent.layout.width)}
        >
          <TouchableOpacity
            style={styles.modeTab}
            onPress={() => handleModeChange("attending")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={22}
              color={
                mode === "attending" ? Colors.textPrimary : Colors.textTertiary
              }
            />
            <Text
              style={[
                styles.modeTabText,
                mode === "attending" && styles.modeTabTextActive,
              ]}
            >
              Attending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeTab}
            onPress={() => handleModeChange("hosting")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="megaphone-outline"
              size={22}
              color={
                mode === "hosting" ? Colors.textPrimary : Colors.textTertiary
              }
            />
            <Text
              style={[
                styles.modeTabText,
                mode === "hosting" && styles.modeTabTextActive,
              ]}
            >
              Hosting
            </Text>
          </TouchableOpacity>

          {/* Sliding indicator */}
          <Animated.View
            style={[
              styles.modeTabIndicator,
              {
                width: headerWidth > 0 ? headerWidth / 2 - Spacing.lg * 2 : 0,
                transform: [{ translateX: indicatorX }],
              },
            ]}
          />
        </View>

        {/* ── Attending: 3-tab segmented control ── */}
        {mode === "attending" && (
          <View style={styles.segmentedControl}>
            <SegmentTab
              label="Interested"
              icon="star"
              active={activeTab === "interested"}
              count={interestedEvents.length}
              onPress={() => setActiveTab("interested")}
            />
            <SegmentTab
              label="Requested"
              icon="time-outline"
              active={activeTab === "requested"}
              count={requestedEvents.length}
              onPress={() => setActiveTab("requested")}
            />
            <SegmentTab
              label="Going"
              icon="checkmark-circle"
              active={activeTab === "going"}
              count={goingEvents.length}
              onPress={() => setActiveTab("going")}
            />
          </View>
        )}

        {/* ── Content ── */}
        {(eventsLoading && !eventsData) || (hostedLoading && !hostedEventsData) ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : (mode === "attending" ? eventsError : hostedError) ? (
          <ErrorState
            message="Couldn't load your events"
            onRetry={mode === "attending" ? refetchEvents : refetchHosted}
          />
        ) : mode === "attending" ? (
          <AttendingView
            activeTab={activeTab}
            interestedEvents={interestedEvents}
            requestedEvents={requestedEvents}
            goingEvents={goingEvents}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        ) : (
          <HostingView
            hostedEvents={hostedEvents}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Segment Tab ─────────────────────────────────────────────────────────────

function SegmentTab({
  label,
  icon,
  active,
  count,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  count: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons
        name={icon as any}
        size={13}
        color={active ? Colors.textInverse : Colors.textTertiary}
      />
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.badge, active && styles.badgeActive]}>
          <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Attending View ───────────────────────────────────────────────────────────

function AttendingView({
  activeTab,
  interestedEvents,
  requestedEvents,
  goingEvents,
  refreshing,
  onRefresh,
}: {
  activeTab: AttendingTab;
  interestedEvents: EventWithHost[];
  requestedEvents: EventWithHost[];
  goingEvents: EventWithHost[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const events =
    activeTab === "interested"
      ? interestedEvents
      : activeTab === "requested"
        ? requestedEvents
        : goingEvents;

  type EmptyConfig = { icon: string; title: string; subtitle: string };
  const emptyConfig: Record<AttendingTab, EmptyConfig> = {
    interested: {
      icon: "star-outline",
      title: "Nothing saved yet",
      subtitle: "Tap the star on any event to save it here.",
    },
    requested: {
      icon: "time-outline",
      title: "No pending requests",
      subtitle:
        "Request access to exclusive events and they'll appear here while you wait.",
    },
    going: {
      icon: "calendar-outline",
      title: "No upcoming events",
      subtitle: "RSVP to events and they'll show up here.",
    },
  };

  const empty = emptyConfig[activeTab];

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        events.length === 0 ? styles.emptyContainer : styles.listContent
      }
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          <EventCard
            event={item}
            onPress={() => router.push(`/event/${item.id}`)}
          />
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons
            name={empty.icon as any}
            size={48}
            color={Colors.textTertiary}
          />
          <Text style={styles.emptyTitle}>{empty.title}</Text>
          <Text style={styles.emptySubtitle}>{empty.subtitle}</Text>
          <TouchableOpacity
            style={styles.emptyAction}
            onPress={() => router.push("/(tabs)/map")}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyActionText}>Explore the Map →</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

// ─── Hosting View ─────────────────────────────────────────────────────────────

function HostingView({
  hostedEvents,
  refreshing,
  onRefresh,
}: {
  hostedEvents: EventWithHost[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  if (hostedEvents.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.emptyState}>
          <Ionicons
            name="megaphone-outline"
            size={48}
            color={Colors.textTertiary}
          />
          <Text style={styles.emptyTitle}>No hosted events yet</Text>
          <Text style={styles.emptySubtitle}>
            Events you create will appear here so you can manage them.
          </Text>
          <TouchableOpacity
            style={styles.emptyAction}
            onPress={() => router.push("/(tabs)/create")}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyActionText}>Create an Event →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      {hostedEvents.map((event) => (
        <TouchableOpacity
          key={event.id}
          style={[
            styles.hostedCard,
            event.status === "CANCELLED" && styles.hostedCardCancelled,
          ]}
          onPress={() => router.push(`/event/${event.id}`)}
          activeOpacity={0.8}
        >
          {/* Left: info */}
          <View style={styles.hostedCardInfo}>
            <View style={styles.hostedCardTitleRow}>
              <Text style={styles.hostedCardTitle} numberOfLines={1}>
                {event.title}
              </Text>
              {event.is_recurring && (
                <Ionicons
                  name="repeat-outline"
                  size={13}
                  color={Colors.textTertiary}
                />
              )}
            </View>
            <Text style={styles.hostedCardDate}>
              {formatDayDate(event.start_time)}
            </Text>
            <View style={styles.hostedCardMeta}>
              {event.status === "CANCELLED" ? (
                <View style={styles.cancelledBadge}>
                  <Text style={styles.cancelledBadgeText}>Cancelled</Text>
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
                      event.privacy === "EXCLUSIVE" ? "lock-closed" : "earth"
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
                    {event.privacy === "EXCLUSIVE" ? "Exclusive" : "Public"}
                  </Text>
                </View>
              )}
              <Text style={styles.rsvpCountText}>
                {event.interested_count} interested · {event.going_count} going
              </Text>
            </View>
          </View>

          {/* Right: edit + chevron */}
          <View style={styles.hostedCardActions}>
            {event.status !== "CANCELLED" && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => router.push(`/event/edit/${event.id}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            )}
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.textTertiary}
            />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header: Uber-style mode tabs ──
  header: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  modeTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: 4,
  },
  modeTabText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
  },
  modeTabTextActive: {
    color: Colors.textPrimary,
  },
  modeTabIndicator: {
    position: "absolute",
    bottom: 0,
    left: Spacing.lg,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
  },

  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Segmented control (3 tabs) ──
  segmentedControl: {
    flexDirection: "row",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: Spacing.sm - 1,
    borderRadius: BorderRadius.sm,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
  },
  segmentTextActive: {
    color: Colors.textInverse,
  },
  badge: {
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeActive: {
    backgroundColor: Colors.textInverse + "30",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: Typography.weight.bold,
    color: Colors.textTertiary,
  },
  badgeTextActive: {
    color: Colors.textInverse,
  },

  // ── Lists ──
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
  },

  // ── Card wrapper ──
  cardWrapper: {
    position: "relative",
  },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyAction: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + "60",
    backgroundColor: Colors.primary + "10",
  },
  emptyActionText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.primary,
  },

  // ── Hosted event cards ──
  hostedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  hostedCardCancelled: {
    opacity: 0.45,
  },
  hostedCardInfo: {
    flex: 1,
    gap: 4,
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
  hostedCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
    marginTop: 2,
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
  rsvpCountText: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  hostedCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  editButton: {
    padding: 4,
  },
});
