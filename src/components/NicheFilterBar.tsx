import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import { useAuth } from "../context/auth";
import { useProfile } from "../hooks/useProfile";
import type { Niche } from "../types";

const BUBBLE_COLLAPSED = 33;
const BUBBLE_EXPANDED = 170;

interface NicheFilterBarProps {
  niches: Niche[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClearAll: () => void;
  onClearAllExtra?: () => void;
}

export function NicheFilterBar({
  niches,
  selectedIds,
  onToggle,
  onClearAll,
  onClearAllExtra,
}: NicheFilterBarProps) {
  const { session } = useAuth();
  const { data: profileData } = useProfile(session?.user?.id);

  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState("");
  const inputRef = useRef<TextInput>(null);
  const bubbleWidth = useSharedValue(BUBBLE_COLLAPSED);

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    width: bubbleWidth.value,
  }));

  function openSearch() {
    setSearchActive(true);
    bubbleWidth.value = withTiming(BUBBLE_EXPANDED, { duration: 200 });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function closeSearch() {
    bubbleWidth.value = withTiming(BUBBLE_COLLAPSED, { duration: 200 });
    setSearchText("");
    setSearchActive(false);
    inputRef.current?.blur();
  }

  const pinnedIds = profileData?.niches.map((n) => n.id) ?? [];
  const sortedNiches = pinnedIds.length
    ? [
        ...niches.filter((n) => pinnedIds.includes(n.id)),
        ...niches.filter((n) => !pinnedIds.includes(n.id)),
      ]
    : niches;

  const visibleNiches =
    searchActive && searchText.length > 0
      ? sortedNiches.filter((n) =>
          n.name.toLowerCase().includes(searchText.toLowerCase()),
        )
      : sortedNiches;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.nichesRow}
      style={styles.nichesScroll}
    >
      {/* All button */}
      <TouchableOpacity
        style={[
          styles.nicheChip,
          selectedIds.size === 0 && styles.nicheChipActive,
        ]}
        onPress={() => {
          onClearAll();
          onClearAllExtra?.();
        }}
        activeOpacity={0.7}
        accessibilityLabel="Show all niches"
        accessibilityRole="button"
        accessibilityState={{ selected: selectedIds.size === 0 }}
      >
        <Text
          style={[
            styles.nicheChipText,
            selectedIds.size === 0 && styles.nicheChipTextActive,
          ]}
        >
          All
        </Text>
      </TouchableOpacity>

      {/* Expanding search bubble */}
      <Animated.View
        style={[
          styles.searchBubble,
          animatedBubbleStyle,
        ]}
      >
        <TouchableOpacity
          onPress={searchActive ? closeSearch : openSearch}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel={searchActive ? "Close niche search" : "Search niches"}
          accessibilityRole="button"
          accessibilityState={{ selected: searchActive }}
        >
          <Ionicons name="search" size={14} color={Colors.textPrimary} />
        </TouchableOpacity>
        {searchActive && (
          <TextInput
            ref={inputRef}
            style={styles.inlineInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search tags..."
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        )}
        {searchActive && searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchText("")}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel="Clear niche search text"
            accessibilityRole="button"
          >
            <Ionicons name="close-circle" size={14} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Niche chips */}
      {visibleNiches.map((niche) => {
        const active = selectedIds.has(niche.id);
        const color = niche.color ?? Colors.primary;
        return (
          <TouchableOpacity
            key={niche.id}
            style={[
              styles.nicheChip,
              active && { backgroundColor: color, borderColor: color },
            ]}
            onPress={() => onToggle(niche.id)}
            activeOpacity={0.7}
            accessibilityLabel={`Filter by ${niche.name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.nicheChipText,
                active && { color: Colors.textPrimary },
              ]}
            >
              {niche.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nichesScroll: {
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
  searchBubble: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 5,
  },
  searchBubbleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  inlineInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.size.sm,
    paddingVertical: 0,
    minWidth: 0,
  },
});
