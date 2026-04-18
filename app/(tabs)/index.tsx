import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useRefreshHandler } from "../../src/hooks/useRefreshHandler";
import {
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
import { DiscoverCreatorRow } from "../../src/components/DiscoverCreatorRow";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { NicheTag } from "../../src/components/NicheTag";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { useEvents } from "../../src/hooks/useEvents";
import { useNiches } from "../../src/hooks/useNiches";
import { useDiscoveryProfiles } from "../../src/hooks/useSearch";
import type { EventWithHost, ProfileWithNiches } from "../../src/types";
import { useAuth } from "../../src/context/auth";
import { IntroModal } from "../../src/components/IntroModal";
import { useIntroModal } from "../../src/hooks/useIntroModal";

type ActiveView = "CREATORS" | "EVENTS";

type ListItem =
  | { _type: "dateHeader"; label: string }
  | { _type: "event"; data: EventWithHost }
  | { _type: "creator"; data: ProfileWithNiches }
  | { _type: "empty" };

function groupEventsByDate(
  events: EventWithHost[],
): { label: string; items: EventWithHost[] }[] {
  const groups: { label: string; items: EventWithHost[] }[] = [];
  const seen: Record<string, number> = {};
  for (const e of events) {
    const label = new Date(e.start_time).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    if (seen[label] === undefined) {
      seen[label] = groups.length;
      groups.push({ label, items: [] });
    }
    groups[seen[label]].items.push(e);
  }
  return groups;
}

function formatEventTime(start_time: string): string {
  return new Date(start_time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DiscoverScreen() {
  const { session } = useAuth();
  const introModal = useIntroModal('discover', session?.user?.id);
  const [activeView, setActiveView] = useState<ActiveView>("CREATORS");
  const [selectedNicheIds, setSelectedNicheIds] = useState<Set<string>>(
    new Set(),
  );
  const { data: niches = [] } = useNiches();

  const {
    data: eventsData = [],
    isLoading: loadingEvents,
    error: eventsError,
    refetch: refetchEvents,
  } = useEvents();
  const {
    data: creatorsData = [],
    isLoading: loadingCreators,
    error: creatorsError,
    refetch: refetchCreators,
  } = useDiscoveryProfiles();

  const { refreshing, handleRefresh } = useRefreshHandler(refetchEvents, refetchCreators);

  const isLoading = activeView === "EVENTS" ? loadingEvents : loadingCreators;
  const activeError = activeView === "EVENTS" ? eventsError : creatorsError;
  const activeRefetch =
    activeView === "EVENTS" ? refetchEvents : refetchCreators;

  const filteredEvents = useMemo(() => {
    let result = eventsData as EventWithHost[];
    if (selectedNicheIds.size > 0) {
      result = result.filter((e) =>
        e.niches.some((n) => selectedNicheIds.has(n.id)),
      );
    }
    return result;
  }, [eventsData, selectedNicheIds]);

  const filteredCreators = useMemo(() => {
    let result = creatorsData as ProfileWithNiches[];
    if (selectedNicheIds.size > 0) {
      result = result.filter((p) =>
        p.niches.some((n) => selectedNicheIds.has(n.id)),
      );
    }
    return result;
  }, [creatorsData, selectedNicheIds]);

  const groupedEvents = useMemo(
    () => groupEventsByDate(filteredEvents),
    [filteredEvents],
  );

  const listData: ListItem[] = useMemo(() => {
    if (isLoading) return [];
    if (activeView === "EVENTS") {
      const items: ListItem[] = [];
      for (const { label, items: evts } of groupedEvents) {
        items.push({ _type: "dateHeader", label });
        for (const e of evts) {
          items.push({ _type: "event", data: e });
        }
      }
      if (items.length === 0) items.push({ _type: "empty" });
      return items;
    } else {
      if (filteredCreators.length === 0) return [{ _type: "empty" }];
      return filteredCreators.map((p) => ({
        _type: "creator" as const,
        data: p,
      }));
    }
  }, [activeView, groupedEvents, filteredCreators, isLoading]);

  function toggleNiche(id: string) {
    setSelectedNicheIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderItem({ item }: { item: ListItem }) {
    if (item._type === "dateHeader") {
      return (
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{item.label}</Text>
        </View>
      );
    }

    if (item._type === "event") {
      const event = item.data;
      return (
        <TouchableOpacity
          style={styles.eventRow}
          onPress={() => router.push(`/event/${event.id}`)}
          activeOpacity={0.75}
          accessibilityLabel={`${event.title}, hosted by ${event.host.display_name}`}
          accessibilityRole="button"
        >
          {event.cover_image_url ? (
            <Image
              source={{ uri: event.cover_image_url }}
              style={styles.eventThumb}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.eventThumb, styles.eventThumbPlaceholder]}>
              <Text style={styles.eventThumbInitial}>
                {event.title.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            {event.niches.length > 0 && (
              <View style={styles.eventNiches}>
                {event.niches.slice(0, 2).map((n) => (
                  <NicheTag key={n.id} name={n.name} small color={n.color} />
                ))}
              </View>
            )}
            <View style={styles.eventMeta}>
              <Ionicons
                name="time-outline"
                size={12}
                color={Colors.textTertiary}
              />
              <Text style={styles.eventMetaText}>
                {formatEventTime(event.start_time)}
              </Text>
              <Ionicons
                name={event.privacy === "EXCLUSIVE" ? "lock-closed-outline" : "location-outline"}
                size={12}
                color={Colors.textTertiary}
              />
              <Text style={styles.eventMetaText} numberOfLines={1}>
                {event.privacy === "EXCLUSIVE" ? "Location hidden" : event.address_name}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._type === "creator") {
      return <DiscoverCreatorRow profile={item.data} />;
    }

    if (item._type === "empty") {
      return (
        <EmptyState
          icon="compass-outline"
          title="Nothing here yet"
          subtitle={
            selectedNicheIds.size > 0
              ? "Try a different niche filter"
              : activeView === "EVENTS"
                ? "No upcoming events right now"
                : "No creators found"
          }
        />
      );
    }

    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top row: mode toggle + search button */}
      <View style={styles.topRow}>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              activeView === "CREATORS" && styles.modeButtonActive,
            ]}
            onPress={() => setActiveView("CREATORS")}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeView === "CREATORS" }}
          >
            <Text
              style={[
                styles.modeButtonText,
                activeView === "CREATORS" && styles.modeButtonTextActive,
              ]}
            >
              Creators
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              activeView === "EVENTS" && styles.modeButtonActive,
            ]}
            onPress={() => setActiveView("EVENTS")}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeView === "EVENTS" }}
          >
            <Text
              style={[
                styles.modeButtonText,
                activeView === "EVENTS" && styles.modeButtonTextActive,
              ]}
            >
              Events
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => router.push("/search")}
          activeOpacity={0.8}
          accessibilityLabel="Search creators and events"
          accessibilityRole="button"
        >
          <Ionicons name="search" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Niche filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={filterStyles.nichesRow}
        style={filterStyles.nichesScroll}
      >
        <TouchableOpacity
          style={[
            filterStyles.nicheChip,
            selectedNicheIds.size === 0 && filterStyles.nicheChipActive,
          ]}
          onPress={() => setSelectedNicheIds(new Set())}
          activeOpacity={0.7}
          accessibilityLabel="Show all niches"
          accessibilityRole="button"
          accessibilityState={{ selected: selectedNicheIds.size === 0 }}
        >
          <Text
            style={[
              filterStyles.nicheChipText,
              selectedNicheIds.size === 0 && filterStyles.nicheChipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {niches.map((niche) => {
          const active = selectedNicheIds.has(niche.id);
          const color = niche.color ?? Colors.primary;
          return (
            <TouchableOpacity
              key={niche.id}
              style={[
                filterStyles.nicheChip,
                active && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => toggleNiche(niche.id)}
              activeOpacity={0.7}
              accessibilityLabel={`Filter by ${niche.name}`}
            >
              <Text
                style={[
                  filterStyles.nicheChipText,
                  active && { color: Colors.textPrimary },
                ]}
              >
                {niche.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Feed */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : activeError ? (
        <ErrorState
          message={
            activeView === "EVENTS"
              ? "Couldn't load events"
              : "Couldn't load creators"
          }
          onRetry={activeRefetch}
        />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, index) => {
            if (item._type === "event") return `event-${item.data.id}`;
            if (item._type === "creator") return `creator-${item.data.id}`;
            if (item._type === "dateHeader") return `header-${item.label}`;
            return `empty-${index}`;
          }}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        />
      )}
      <IntroModal
        visible={introModal.visible}
        onDismiss={introModal.dismiss}
        title="Welcome to Discover"
        body="Browse creators and upcoming events in your city. Use the niche filters to find exactly who and what interests you."
        icon="compass-outline"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: Colors.background,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  modeToggle: {
    flexDirection: "row",
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    gap: 2,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
  },
  modeButtonTextActive: {
    color: Colors.textPrimary,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  // Date header
  dateHeader: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  dateHeaderText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  // Event row
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  eventThumb: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    flexShrink: 0,
  },
  eventThumbPlaceholder: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  eventThumbInitial: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  eventInfo: {
    flex: 1,
    gap: 3,
    paddingTop: 2,
  },
  eventTitle: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  eventNiches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    marginTop: 2,
  },
  eventMetaText: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    flexShrink: 1,
  },
});

const filterStyles = StyleSheet.create({
  nichesScroll: {
    height: 36,
    maxHeight: 36,
    marginBottom: Spacing.sm,
    flexShrink: 0,
    flexGrow: 0,
  },
  nichesRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: "center",
  },
  nicheChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignSelf: "flex-start",
  },
  nicheChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  nicheChipText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  nicheChipTextActive: {
    color: Colors.textPrimary,
  },
});
