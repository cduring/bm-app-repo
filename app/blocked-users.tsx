import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../src/constants/theme";
import { useAuth } from "../src/context/auth";
import {
  useBlockedProfiles,
  useUnblockUser,
} from "../src/hooks/useBlock";
import { useProfile } from "../src/hooks/useProfile";
import type { BlockedUserEntry } from "../src/types";

export default function BlockedUsersScreen() {
  const { session } = useAuth();
  const { data: myProfileData } = useProfile(session?.user?.id);
  const myProfileId = myProfileData?.profile?.id;

  const { data: blockedUsers = [], isLoading } = useBlockedProfiles(myProfileId);
  const unblockMutation = useUnblockUser();

  function handleUnblock(entry: BlockedUserEntry) {
    if (!myProfileId) return;
    Alert.alert(
      `Unblock ${entry.blocked_profile.display_name}?`,
      "They will be able to appear in your feed again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: () =>
            unblockMutation.mutate({
              myProfileId,
              blockedId: entry.blocked_id,
            }),
        },
      ],
    );
  }

  function renderItem({ item }: { item: BlockedUserEntry }) {
    const { blocked_profile } = item;
    return (
      <View style={styles.row}>
        {blocked_profile.profile_picture_url ? (
          <Image
            source={{ uri: blocked_profile.profile_picture_url }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {blocked_profile.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>
          {blocked_profile.display_name}
        </Text>
        <TouchableOpacity
          style={styles.unblockButton}
          onPress={() => handleUnblock(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.unblockText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Blocked Users</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            blockedUsers.length === 0 ? styles.emptyContainer : styles.list
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                You haven't blocked anyone.
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    paddingVertical: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.sm,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  name: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  unblockButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unblockText: {
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.semibold,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 44 + Spacing.sm + Spacing.md,
  },
});
