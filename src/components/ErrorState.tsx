import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
  onBack,
}: ErrorStateProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + Spacing.sm }]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}
      <Ionicons name="cloud-offline-outline" size={48} color={Colors.textTertiary} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.md,
    padding: Spacing.sm,
  },
  message: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  retryText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
});
