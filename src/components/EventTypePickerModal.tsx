import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EVENT_TYPES } from "../constants/eventTypes";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import type { EventType } from "../types";

interface Props {
  visible: boolean;
  onClose: () => void;
  eventType: EventType;
  onSelect: (value: EventType) => void;
}

export function EventTypePickerModal({ visible, onClose, eventType, onSelect }: Props) {
  const [typeSearch, setTypeSearch] = useState("");

  const filtered = EVENT_TYPES.filter(({ label }) =>
    label.toLowerCase().includes(typeSearch.toLowerCase())
  );

  function handleClose() {
    setTypeSearch("");
    onClose();
  }

  function handleSelect(value: EventType) {
    setTypeSearch("");
    onSelect(value);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Event Type</Text>
          <TouchableOpacity onPress={handleClose} style={styles.modalDoneBtn}>
            <Text style={styles.modalDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.typeSearchInput}
          placeholder="Search event types…"
          placeholderTextColor={Colors.textTertiary}
          value={typeSearch}
          onChangeText={setTypeSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <ScrollView contentContainerStyle={styles.typeGrid} showsVerticalScrollIndicator={false}>
          {filtered.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[styles.typeChip, eventType === value && styles.typeChipSelected]}
              onPress={() => handleSelect(value)}
              activeOpacity={0.7}
            >
              {eventType === value && (
                <Ionicons
                  name="checkmark"
                  size={13}
                  color={Colors.primary}
                  style={styles.typeChipCheck}
                />
              )}
              <Text style={[styles.typeChipText, eventType === value && styles.typeChipTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalSafeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  modalDoneBtn: { padding: 4 },
  modalDoneText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },
  typeSearchInput: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  typeChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "20",
  },
  typeChipCheck: { marginRight: 4 },
  typeChipText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  typeChipTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
  },
});
