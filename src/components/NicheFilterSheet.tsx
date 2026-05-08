import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import type { Niche } from "../types";

interface NicheFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  niches: Niche[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClearAll: () => void;
}

export function NicheFilterSheet({
  visible,
  onClose,
  niches,
  selectedIds,
  onToggle,
  onClearAll,
}: NicheFilterSheetProps) {
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const n of niches) {
    if (n.category && !seen.has(n.category)) {
      seen.add(n.category);
      categories.push(n.category);
    }
  }
  categories.sort();

  // Niches without a category fall into an "Other" bucket at the end
  const uncategorized = niches.filter((n) => !n.category);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearBtn}>Clear</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Filter by Niche</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.doneBtn}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {categories.map((cat) => {
            const items = niches.filter((n) => n.category === cat);
            return (
              <View key={cat} style={styles.section}>
                <Text style={styles.sectionHeader}>{cat}</Text>
                <View style={styles.chipRow}>
                  {items.map((niche) => {
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
                </View>
              </View>
            );
          })}

          {uncategorized.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Other</Text>
              <View style={styles.chipRow}>
                {uncategorized.map((niche) => {
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
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  clearBtn: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
  },
  doneBtn: {
    fontSize: Typography.size.sm,
    color: Colors.primary,
    fontWeight: Typography.weight.semibold,
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
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
