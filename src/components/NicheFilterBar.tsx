import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import { useAuth } from "../context/auth";
import { useProfile } from "../hooks/useProfile";
import type { Niche } from "../types";
import { NicheFilterSheet } from "./NicheFilterSheet";

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
  const [sheetVisible, setSheetVisible] = useState(false);

  const activeCount = selectedIds.size;

  const profileNiches = profileData?.niches
    ? niches.filter((n) => profileData.niches.some((pn) => pn.id === n.id))
    : [];

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroll}
      >
        <TouchableOpacity
          style={[styles.chip, activeCount === 0 && styles.chipActive]}
          onPress={() => {
            onClearAll();
            onClearAllExtra?.();
          }}
          activeOpacity={0.7}
          accessibilityLabel="Show all niches"
          accessibilityRole="button"
          accessibilityState={{ selected: activeCount === 0 }}
        >
          <Text style={[styles.chipText, activeCount === 0 && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, styles.filterChip, activeCount > 0 && styles.chipActive]}
          onPress={() => setSheetVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel={activeCount > 0 ? `Filter niches, ${activeCount} active` : "Filter niches"}
          accessibilityRole="button"
        >
          <Ionicons
            name="options-outline"
            size={13}
            color={activeCount > 0 ? Colors.textPrimary : Colors.textSecondary}
          />
          <Text style={[styles.chipText, activeCount > 0 && styles.chipTextActive]}>
            {activeCount > 0 ? `Filter (${activeCount})` : "Filter"}
          </Text>
        </TouchableOpacity>

        {profileNiches.map((niche) => {
          const active = selectedIds.has(niche.id);
          const color = niche.color ?? Colors.primary;
          return (
            <TouchableOpacity
              key={niche.id}
              style={[
                styles.chip,
                active && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => onToggle(niche.id)}
              activeOpacity={0.7}
              accessibilityLabel={`Filter by ${niche.name}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {niche.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <NicheFilterSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        niches={niches}
        selectedIds={selectedIds}
        onToggle={onToggle}
        onClearAll={() => {
          onClearAll();
          onClearAllExtra?.();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: Spacing.sm,
    flexShrink: 0,
    flexGrow: 0,
  },
  row: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: "center",
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignSelf: "flex-start",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.textPrimary,
  },
});
