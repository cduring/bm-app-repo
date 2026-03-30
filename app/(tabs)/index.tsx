import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
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
import { EventFullCard } from "../../src/components/EventFullCard";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { useRSVP } from "../../src/context/rsvp";
import { useEvents } from "../../src/hooks/useEvents";
import type { EventType } from "../../src/types";

type TimeFilter = "all" | "this_week";

export default function HomeScreen() {
  const { data: eventsData, isLoading, isError, refetch } = useEvents();
  const { getRSVP, setRSVP } = useRSVP();
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [selectedTypes, setSelectedTypes] = useState<Set<EventType>>(new Set());
  const [cardHeight, setCardHeight] = useState(0);

  const allEvents = useMemo(() => {
    return (eventsData ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
  }, [eventsData]);

  const availableTypes = useMemo<EventType[]>(
    () => [...new Set(allEvents.map((e) => e.event_type))],
    [allEvents],
  );

  const filteredEvents = useMemo(() => {
    let result = allEvents;
    if (timeFilter === "this_week") {
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      result = result.filter((e) => new Date(e.start_time) <= weekFromNow);
    }
    if (selectedTypes.size > 0) {
      result = result.filter((e) => selectedTypes.has(e.event_type));
    }
    return result;
  }, [allEvents, timeFilter, selectedTypes]);

  function toggleType(type: EventType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function clearFilters() {
    setTimeFilter("all");
    setSelectedTypes(new Set());
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const hasActiveFilters = timeFilter !== "all" || selectedTypes.size > 0;

  // ── Loading state ──
  if (isLoading && !eventsData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Event Feed</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ──
  if (isError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Event Feed</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={Colors.textTertiary}
          />
          <Text style={styles.emptyTitle}>Couldn't load events</Text>
          <Text style={styles.emptySubtitle}>
            Check your connection and try again
          </Text>
          <TouchableOpacity style={styles.clearBtn} onPress={() => refetch()}>
            <Text style={styles.clearBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Event Feed</Text>
        <TouchableOpacity
          style={styles.searchIconBtn}
          onPress={() => router.push("/search")}
          activeOpacity={0.7}
          accessibilityLabel="Search creators and events"
          accessibilityRole="button"
        >
          <Ionicons name="search" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={filterStyles.row}
        style={filterStyles.scroll}
      >
        {(["all", "this_week"] as TimeFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              filterStyles.pill,
              timeFilter === f && filterStyles.pillActive,
            ]}
            onPress={() => setTimeFilter(f)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                filterStyles.pillText,
                timeFilter === f && filterStyles.pillTextActive,
              ]}
            >
              {f === "all" ? "All Dates" : "This Week"}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={filterStyles.divider} />
        {availableTypes.map((type) => {
          const active = selectedTypes.has(type);
          const label =
            type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
          return (
            <TouchableOpacity
              key={type}
              style={[filterStyles.pill, active && filterStyles.pillActive]}
              onPress={() => toggleType(type)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  filterStyles.pillText,
                  active && filterStyles.pillTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View
        style={styles.stackContainer}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setCardHeight(h);
        }}
      >
        {filteredEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="calendar-outline"
              size={48}
              color={Colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No events found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your filters</Text>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                <Text style={styles.clearBtnText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : cardHeight > 0 ? (
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const rsvp = getRSVP(item.id);
              return (
                <EventFullCard
                  event={item}
                  height={cardHeight}
                  rsvp={rsvp}
                  isInterested={rsvp === "INTERESTED"}
                  onRSVP={(status) =>
                    setRSVP(item.id, rsvp === status ? null : status, {
                      title: item.title,
                      startTime: item.start_time,
                    })
                  }
                  onToggleInterested={() =>
                    setRSVP(
                      item.id,
                      rsvp === "INTERESTED" ? null : "INTERESTED",
                      { title: item.title, startTime: item.start_time },
                    )
                  }
                  onViewDetails={() => router.push(`/event/${item.id}`)}
                />
              );
            }}
            snapToInterval={cardHeight}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.primary}
              />
            }
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.size["xl"],
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  searchIconBtn: { padding: 4 },
  stackContainer: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  clearBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  clearBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.primary,
  },
});

const filterStyles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
    alignItems: "center",
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  pill: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillActive: {
    backgroundColor: Colors.primary + "20",
    borderColor: Colors.primary + "60",
  },
  pillText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.primary,
  },
});
