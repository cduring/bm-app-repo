import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useRefreshHandler } from "../../src/hooks/useRefreshHandler";
import {
  Animated,
  ActivityIndicator,
  FlatList,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../../src/components/Badge";
import { EmptyState } from "../../src/components/EmptyState";
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
import { IntroModal } from "../../src/components/IntroModal";
import { useIntroModal } from "../../src/hooks/useIntroModal";
import { formatDayDate } from "../../src/utils/date";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "attending" | "hosting";
type AttendingTab = "interested" | "requested" | "going";

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_ORDER: AttendingTab[] = ["interested", "requested", "going"];
const TAB_ICONS: Record<AttendingTab, string> = {
  interested: "star",
  requested: "time-outline",
  going: "checkmark-circle",
};
const TAB_LABELS: Record<AttendingTab, string> = {
  interested: "Interested",
  requested: "Requested",
  going: "Going",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyEventsScreen() {
  const { session } = useAuth();
  const introModal = useIntroModal('my-events', session?.user?.id);
  const { data: profileData } = useProfile(session?.user?.id);
  const profileId = profileData?.profile.id;
  const { myRSVPs } = useRSVP();
  const { data: eventsData, isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useEvents();
  const { data: hostedEventsData, isLoading: hostedLoading, error: hostedError, refetch: refetchHosted } = useHostedEvents(profileId);

  const { refreshing, handleRefresh } = useRefreshHandler(refetchEvents, refetchHosted);

  const [mode, setMode] = useState<Mode>("attending");
  const [activeTab, setActiveTab] = useState<AttendingTab>("interested");
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

  const byDate = (a: EventWithHost, b: EventWithHost) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime();

  // Attending — three separate buckets
  const interestedEvents = allEvents
    .filter((e) => myRSVPs[e.id] === "INTERESTED" && e.status !== "CANCELLED")
    .sort(byDate);
  const requestedEvents = allEvents
    .filter((e) => myRSVPs[e.id] === "REQUESTED" && e.status !== "CANCELLED")
    .sort(byDate);
  const goingEvents = allEvents
    .filter((e) => myRSVPs[e.id] === "GOING" && e.status !== "CANCELLED")
    .sort(byDate);

  // Hosting — uses dedicated hook that includes DRAFT/CANCELLED (with RSVP counts)
  const hostedEvents: EventWithHost[] = (hostedEventsData ?? []).slice().sort(byDate);

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
            accessibilityLabel="Attending"
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "attending" }}
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
            accessibilityLabel="Hosting"
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "hosting" }}
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

        {/* ── Attending: arrow + title + long-press picker ── */}
        {mode === "attending" && (
          <AttendingTabHeader activeTab={activeTab} setActiveTab={setActiveTab} />
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
      <IntroModal
        visible={introModal.visible}
        onDismiss={introModal.dismiss}
        title="Your Events Hub"
        body="Track events you're interested in, requested, or attending — and manage events you're hosting, all in one place."
        icon="calendar-outline"
      />
    </View>
  );
}

// ─── Attending Tab Header ─────────────────────────────────────────────────────

function AttendingTabHeader({
  activeTab,
  setActiveTab,
}: {
  activeTab: AttendingTab;
  setActiveTab: (tab: AttendingTab) => void;
}) {
  const [pickerHighlight, setPickerHighlight] = useState<AttendingTab>(activeTab);

  const isPickerActiveRef = useRef(false);
  const pickerHighlightRef = useRef<AttendingTab>(activeTab);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconLayouts = useRef<{ tab: AttendingTab; pageX: number; width: number }[]>([]);

  const titleOpacity = useRef(new Animated.Value(1)).current;
  const pickerOpacity = useRef(new Animated.Value(0)).current;
  const arrowOpacity = useRef(new Animated.Value(1)).current;

  function cycleTab(dir: 1 | -1) {
    const idx = TAB_ORDER.indexOf(activeTab);
    const next = TAB_ORDER[(idx + dir + 3) % 3];
    setActiveTab(next);
  }

  function activatePicker() {
    isPickerActiveRef.current = true;
    pickerHighlightRef.current = activeTab;
    setPickerHighlight(activeTab);
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(pickerOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(arrowOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  }

  function deactivatePicker() {
    isPickerActiveRef.current = false;
    setActiveTab(pickerHighlightRef.current);
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(pickerOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(arrowOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }

  function updateHighlightFromX(pageX: number) {
    for (const layout of iconLayouts.current) {
      if (pageX >= layout.pageX && pageX <= layout.pageX + layout.width) {
        if (pickerHighlightRef.current !== layout.tab) {
          pickerHighlightRef.current = layout.tab;
          setPickerHighlight(layout.tab);
        }
        return;
      }
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => isPickerActiveRef.current,
      onPanResponderGrant: () => {
        longPressTimer.current = setTimeout(activatePicker, 500);
      },
      onPanResponderMove: (e) => {
        if (isPickerActiveRef.current) {
          updateHighlightFromX(e.nativeEvent.pageX);
        }
      },
      onPanResponderRelease: () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        if (isPickerActiveRef.current) deactivatePicker();
      },
      onPanResponderTerminate: () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        if (isPickerActiveRef.current) deactivatePicker();
      },
    })
  ).current;

  return (
    <View style={styles.attendingTabHeader}>
      {/* Left arrow */}
      <Animated.View style={{ opacity: arrowOpacity }}>
        <TouchableOpacity
          onPress={() => cycleTab(-1)}
          style={styles.tabArrow}
          activeOpacity={0.6}
          accessibilityLabel="Previous tab"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={20} color={Colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Center: title + picker overlay */}
      <View style={styles.tabTitleArea} {...panResponder.panHandlers}>
        {/* Title */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.tabTitleContainer, { opacity: titleOpacity }]}
        >
          <Text style={styles.tabTitleText}>{TAB_LABELS[activeTab]}</Text>
        </Animated.View>

        {/* Icon picker */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.pickerContainer, { opacity: pickerOpacity }]}
        >
          {TAB_ORDER.map((tab) => (
            <View
              key={tab}
              style={[styles.pickerIcon, pickerHighlight === tab && styles.pickerIconActive]}
              onLayout={(e) => {
                (e.target as any).measure(
                  (_x: number, _y: number, width: number, _h: number, pageX: number) => {
                    const idx = iconLayouts.current.findIndex((l) => l.tab === tab);
                    const entry = { tab, pageX, width };
                    if (idx >= 0) iconLayouts.current[idx] = entry;
                    else iconLayouts.current.push(entry);
                  }
                );
              }}
            >
              <Ionicons
                name={TAB_ICONS[tab] as any}
                size={18}
                color={pickerHighlight === tab ? Colors.primary : Colors.textTertiary}
              />
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Right arrow */}
      <Animated.View style={{ opacity: arrowOpacity }}>
        <TouchableOpacity
          onPress={() => cycleTab(1)}
          style={styles.tabArrow}
          activeOpacity={0.6}
          accessibilityLabel="Next tab"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
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
        <EmptyState
          icon={empty.icon as any}
          title={empty.title}
          subtitle={empty.subtitle}
          action={{ label: "Explore the Map", onPress: () => router.push("/(tabs)/map") }}
        />
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
        <EmptyState
          icon="megaphone-outline"
          title="No hosted events yet"
          subtitle="Events you create will appear here so you can manage them."
          action={{ label: "Create an Event", onPress: () => router.push("/host") }}
        />
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
          accessibilityLabel={`${event.title}, ${formatDayDate(event.start_time)}`}
          accessibilityRole="button"
        >
          {/* Left: info */}
          <View style={styles.hostedCardInfo}>
            <View style={styles.hostedCardTitleRow}>
              <Text style={styles.hostedCardTitle} numberOfLines={1}>
                {event.title}
              </Text>
              </View>
            <Text style={styles.hostedCardDate}>
              {formatDayDate(event.start_time)}
            </Text>
            <View style={styles.hostedCardMeta}>
              {event.status === "CANCELLED" ? (
                <Badge text="Cancelled" color={Colors.cancelled} size="medium" />
              ) : (
                <Badge
                  icon={event.privacy === "EXCLUSIVE" ? "lock-closed" : "earth"}
                  iconSize={10}
                  text={event.privacy === "EXCLUSIVE" ? "Exclusive" : "Public"}
                  color={event.privacy === "EXCLUSIVE" ? Colors.primary : Colors.textTertiary}
                  size="medium"
                />
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
                accessibilityLabel={`Edit ${event.title}`}
                accessibilityRole="button"
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

  // ── Attending tab header (arrow + title + picker) ──
  attendingTabHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    height: 40,
  },
  tabArrow: {
    width: 28,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  tabTitleArea: {
    width: 120,
    height: 40,
    position: "relative",
  },
  tabTitleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabTitleText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
  },
  pickerIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
  },
  pickerIconActive: {
    backgroundColor: Colors.primary + "20",
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
