import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../src/components/EmptyState";
import { EventCard } from "../src/components/EventCard";
import { ProfileCard } from "../src/components/ProfileCard";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../src/constants/theme";
import { useEvents } from "../src/hooks/useEvents";
import { useNiches } from "../src/hooks/useNiches";
import {
  useDiscoveryProfiles,
  useSearchEvents,
  useSearchProfiles,
} from "../src/hooks/useSearch";
import type { EventWithHost, ProfileWithNiches } from "../src/types";

type ResultTab = "ALL" | "CREATORS" | "EVENTS";

export default function SearchScreen() {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ResultTab>("ALL");
  const [selectedNicheIds, setSelectedNicheIds] = useState<Set<string>>(
    new Set(),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: niches = [] } = useNiches();

  const {
    data: profileResults = [],
    isFetching: fetchingProfiles,
    error: profileSearchError,
    refetch: refetchProfiles,
  } = useSearchProfiles(query);
  const {
    data: eventResults = [],
    isFetching: fetchingEvents,
    error: eventSearchError,
    refetch: refetchEvents,
  } = useSearchEvents(query);
  const {
    data: discoveryProfiles = [],
    isFetching: fetchingDiscovery,
  } = useDiscoveryProfiles();
  const {
    data: allEvents = [],
    isFetching: fetchingAllEvents,
  } = useEvents();

  const hasNicheFilter = selectedNicheIds.size > 0;

  const isLoading =
    (query.length > 0 && (fetchingProfiles || fetchingEvents)) ||
    (!query && hasNicheFilter && (fetchingDiscovery || fetchingAllEvents));
  const searchError = profileSearchError || eventSearchError;

  // Client-side niche filtering for search results
  const filteredProfiles = useMemo(() => {
    const source = query ? profileResults : discoveryProfiles;
    if (!hasNicheFilter) return source;
    return source.filter((p) =>
      p.niches.some((n) => selectedNicheIds.has(n.id)),
    );
  }, [query, profileResults, discoveryProfiles, selectedNicheIds, hasNicheFilter]);

  const filteredEvents = useMemo(() => {
    const source = (query ? eventResults : allEvents) as EventWithHost[];
    if (!hasNicheFilter) return source;
    return source.filter((e) =>
      e.niches.some((n) => selectedNicheIds.has(n.id)),
    );
  }, [query, eventResults, allEvents, selectedNicheIds, hasNicheFilter]);

  function toggleNiche(id: string) {
    setSelectedNicheIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(inputValue.trim());
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

  function handleClear() {
    setInputValue("");
    setQuery("");
  }

  // Combine all results into a single list for FlatList
  type ListItem =
    | { _type: "sectionHeader"; label: string; count: number }
    | { _type: "profile"; data: ProfileWithNiches }
    | { _type: "event"; data: EventWithHost }
    | { _type: "noResults" };

  const listData: ListItem[] = (() => {
    if (!query && !hasNicheFilter) return [];

    const showProfiles = activeTab === "ALL" || activeTab === "CREATORS";
    const showEvents = activeTab === "ALL" || activeTab === "EVENTS";
    const items: ListItem[] = [];

    if (showProfiles) {
      if (filteredProfiles.length > 0) {
        if (activeTab === "ALL") {
          items.push({
            _type: "sectionHeader",
            label: "People",
            count: filteredProfiles.length,
          });
        }
        filteredProfiles.forEach((p) =>
          items.push({ _type: "profile", data: p }),
        );
      }
    }

    if (showEvents) {
      if (filteredEvents.length > 0) {
        if (activeTab === "ALL") {
          items.push({
            _type: "sectionHeader",
            label: "Events",
            count: filteredEvents.length,
          });
        }
        filteredEvents.forEach((e) =>
          items.push({ _type: "event", data: e }),
        );
      }
    }

    if (items.length === 0 && !isLoading) {
      items.push({ _type: "noResults" });
    }

    return items;
  })();

  function renderItem({ item }: { item: ListItem }) {
    if (item._type === "sectionHeader") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.label}</Text>
          <Text style={styles.sectionCount}>{item.count}</Text>
        </View>
      );
    }
    if (item._type === "profile") {
      return (
        <View style={styles.resultItem}>
          <ProfileCard
            profile={item.data}
            niches={item.data.niches}
            onPress={() => router.push(`/profile/${item.data.id}`)}
          />
        </View>
      );
    }
    if (item._type === "event") {
      return (
        <View style={styles.resultItem}>
          <EventCard
            event={item.data}
            onPress={() => router.push(`/event/${item.data.id}`)}
          />
        </View>
      );
    }
    if (item._type === "noResults") {
      return (
        <View style={styles.noResults}>
          <Ionicons
            name="search-outline"
            size={40}
            color={Colors.textTertiary}
          />
          <Text style={styles.noResultsTitle}>
            No results for &quot;{query}&quot;
          </Text>
          <Text style={styles.noResultsSubtitle}>
            {hasNicheFilter
              ? "Try a different niche filter or search term"
              : "Try a different name, niche, or event title"}
          </Text>
        </View>
      );
    }
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Discover</Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={18}
              color={Colors.textTertiary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search creators & events…"
              placeholderTextColor={Colors.textTertiary}
              value={inputValue}
              onChangeText={setInputValue}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              accessibilityLabel="Search input"
              accessibilityHint="Type to search creators and events"
            />
            {inputValue.length > 0 && (
              <TouchableOpacity
                onPress={handleClear}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Colors.textTertiary}
                />
              </TouchableOpacity>
            )}
          </View>
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
              !hasNicheFilter && filterStyles.nicheChipActive,
            ]}
            onPress={() => setSelectedNicheIds(new Set())}
            activeOpacity={0.7}
            accessibilityLabel="Show all niches"
            accessibilityRole="button"
            accessibilityState={{ selected: !hasNicheFilter }}
          >
            <Text
              style={[
                filterStyles.nicheChipText,
                !hasNicheFilter && filterStyles.nicheChipTextActive,
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
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
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

        {/* Result tabs — shown when there's a query or niche filter */}
        {(query.length > 0 || hasNicheFilter) && (
          <View style={styles.tabs}>
            {(["ALL", "CREATORS", "EVENTS"] as ResultTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
                accessibilityLabel={`Show ${tab.toLowerCase()} results`}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab }}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tab === "ALL"
                    ? "All"
                    : tab === "CREATORS"
                      ? "People"
                      : "Events"}
                </Text>
                {tab === "CREATORS" && filteredProfiles.length > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {filteredProfiles.length}
                    </Text>
                  </View>
                )}
                {tab === "EVENTS" && filteredEvents.length > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {filteredEvents.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        {!query && !hasNicheFilter ? (
          <EmptyState
            icon="compass-outline"
            iconSize={56}
            title="Find your community"
            subtitle={"Search for creators by name or niche,\nor find events happening around Toronto"}
          />
        ) : isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : searchError ? (
          <View style={styles.loadingState}>
            <Ionicons
              name="cloud-offline-outline"
              size={36}
              color={Colors.textTertiary}
            />
            <Text style={styles.errorText}>Search unavailable</Text>
            <TouchableOpacity
              onPress={() => {
                refetchProfiles();
                refetchEvents();
              }}
              style={styles.retryLink}
            >
              <Text style={styles.retryLinkText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item, index) => {
              if (item._type === "profile") return `profile-${item.data.id}`;
              if (item._type === "event") return `event-${item.data.id}`;
              return `${item._type}-${index}`;
            }}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.size["2xl"],
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  searchRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weight.semibold,
  },
  tabBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: BorderRadius.full,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  resultItem: {
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionHeaderText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionCount: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  noResults: {
    alignItems: "center",
    paddingTop: Spacing["2xl"],
    gap: Spacing.md,
  },
  noResultsTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  noResultsSubtitle: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  errorText: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  retryLink: {
    marginTop: Spacing.sm,
  },
  retryLinkText: {
    fontSize: Typography.size.base,
    color: Colors.primary,
    fontWeight: Typography.weight.semibold as any,
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
