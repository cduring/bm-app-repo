import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import { useAuth } from "../context/auth";
import { useProfile } from "../hooks/useProfile";
import type { Niche } from "../types";

const BUBBLE_COLLAPSED = 33;
const BUBBLE_EXPANDED = 200;

interface NicheSelectorProps {
  niches: Niche[];
  selectedIds: string[] | Set<string>;
  onToggle: (id: string) => void;
}

export function NicheSelector({
  niches,
  selectedIds,
  onToggle,
}: NicheSelectorProps) {
  const { session } = useAuth();
  const { data: profileData } = useProfile(session?.user?.id);

  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
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

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const n of niches) {
      if (n.category && !seen.has(n.category)) {
        seen.add(n.category);
        result.push(n.category);
      }
    }
    return result.sort();
  }, [niches]);

  const pinnedIds = profileData?.niches.map((n) => n.id) ?? [];

  const categoryFiltered = activeCategory
    ? niches.filter((n) => n.category === activeCategory)
    : niches;

  const sortedNiches = pinnedIds.length
    ? [
        ...categoryFiltered.filter((n) => pinnedIds.includes(n.id)),
        ...categoryFiltered.filter((n) => !pinnedIds.includes(n.id)),
      ]
    : categoryFiltered;

  // When searching, search across all niches regardless of active category
  const visibleNiches =
    searchActive && searchText.length > 0
      ? niches.filter((n) =>
          n.name.toLowerCase().includes(searchText.toLowerCase()),
        )
      : sortedNiches;

  return (
    <View style={styles.nicheGrid}>
      {/* Category picker button */}
      {categories.length > 0 && (
        <TouchableOpacity
          style={[styles.categoryChip, activeCategory !== null && styles.categoryChipActive]}
          onPress={() => setCategoryPickerVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel={activeCategory ? `Category: ${activeCategory}` : "All Categories"}
          accessibilityRole="button"
        >
          <Ionicons
            name="grid-outline"
            size={13}
            color={activeCategory !== null ? Colors.textPrimary : Colors.textSecondary}
          />
          <Text style={[styles.categoryChipText, activeCategory !== null && styles.categoryChipTextActive]}>
            {activeCategory ?? "All Categories"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={11}
            color={activeCategory !== null ? Colors.textPrimary : Colors.textTertiary}
          />
        </TouchableOpacity>
      )}

      {/* Expanding search bubble */}
      <Animated.View style={[styles.searchBubble, animatedBubbleStyle]}>
        <TouchableOpacity
          onPress={searchActive ? closeSearch : openSearch}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel={
            searchActive ? "Close niche search" : "Search niches"
          }
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
            <Ionicons
              name="close-circle"
              size={14}
              color={Colors.textTertiary}
            />
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

      {/* Category picker sheet */}
      <Modal
        visible={categoryPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.sheetSafeArea}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={() => {
                setActiveCategory(null);
                setCategoryPickerVisible(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.sheetClear}>All</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Category</Text>
            <TouchableOpacity
              onPress={() => setCategoryPickerVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.sheetDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={styles.categoryRow}
                  onPress={() => {
                    setActiveCategory(cat);
                    setCategoryPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.categoryRowText, isActive && styles.categoryRowTextActive]}>
                    {cat}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark" size={16} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  nicheGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.textPrimary,
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
  inlineInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.size.sm,
    paddingVertical: 0,
    minWidth: 0,
  },
  sheetSafeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  sheetClear: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  sheetDone: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },
  sheetBody: {
    paddingVertical: Spacing.sm,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  categoryRowText: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.regular,
  },
  categoryRowTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weight.medium,
  },
});
