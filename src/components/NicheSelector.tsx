import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import type { Niche } from "../types";

const BUBBLE_COLLAPSED = 33;
const BUBBLE_EXPANDED = 200;

interface NicheSelectorProps {
  niches: Niche[];
  selectedIds: string[] | Set<string>;
  onToggle: (id: string) => void;
}

export function NicheSelector({ niches, selectedIds, onToggle }: NicheSelectorProps) {
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState("");
  const inputRef = useRef<TextInput>(null);
  const bubbleWidth = useSharedValue(BUBBLE_COLLAPSED);

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    width: bubbleWidth.value,
  }));

  function isSelected(id: string): boolean {
    return Array.isArray(selectedIds)
      ? selectedIds.includes(id)
      : selectedIds.has(id);
  }

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

  const visibleNiches =
    searchActive && searchText.length > 0
      ? niches.filter((n) =>
          n.name.toLowerCase().includes(searchText.toLowerCase()),
        )
      : niches;

  return (
    <View style={styles.nicheGrid}>
      {/* Expanding search bubble — first in grid */}
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
            placeholder="Search niches..."
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
        const selected = isSelected(niche.id);
        const color = niche.color ?? Colors.primary;
        return (
          <TouchableOpacity
            key={niche.id}
            style={[
              styles.chip,
              selected && {
                borderColor: color,
                backgroundColor: color + "25",
                shadowColor: color,
                shadowOpacity: 0.5,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
                elevation: 5,
              },
            ]}
            onPress={() => onToggle(niche.id)}
            activeOpacity={0.7}
            accessibilityLabel={`${niche.name}, ${selected ? "selected" : "not selected"}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
          >
            <Text
              style={[
                styles.chipText,
                selected && { color, fontWeight: Typography.weight.medium },
              ]}
            >
              {niche.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nicheGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  chipText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
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
    paddingVertical: Spacing.sm,
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
