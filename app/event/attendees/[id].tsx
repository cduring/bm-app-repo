import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useRefreshHandler } from "../../../src/hooks/useRefreshHandler";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../../src/components/EmptyState";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../../src/constants/theme";
import { useEventById } from "../../../src/hooks/useEvents";
import {
  useEventAttendees,
  useRevokeAttendee,
} from "../../../src/hooks/useRSVP";
import type { Profile } from "../../../src/types";

export default function EventAttendeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"going" | "interested">("going");
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());

  const { data: event } = useEventById(id);
  const isExclusive = event?.privacy === "EXCLUSIVE";

  const {
    data: attendees,
    isLoading,
    refetch,
  } = useEventAttendees(id, activeTab === "going" ? "GOING" : "INTERESTED");

  const revokeMutation = useRevokeAttendee();
  const { refreshing, handleRefresh } = useRefreshHandler(refetch);

  function handleRevoke(profile: Profile) {
    if (!id) return;
    Alert.alert(
      "Remove Attendee",
      `Remove ${profile.display_name} from this event?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            // Optimistic removal
            setRevokedIds((prev) => new Set([...prev, profile.id]));
            revokeMutation.mutate(
              { eventId: id, profileId: profile.id },
              {
                onError: () => {
                  // Undo optimistic removal on error
                  setRevokedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(profile.id);
                    return next;
                  });
                  Alert.alert(
                    "Error",
                    "Couldn't remove this attendee. Please try again.",
                  );
                },
              },
            );
          },
        },
      ],
    );
  }

  const visibleAttendees = (attendees ?? []).filter(
    (p) => !revokedIds.has(p.id),
  );

  const emptyConfig = {
    going: {
      icon: "checkmark-circle-outline" as const,
      title: "No one going yet",
      subtitle: "Attendees who RSVP will appear here.",
    },
    interested: {
      icon: "star-outline" as const,
      title: "No one interested yet",
      subtitle: "People who mark themselves interested will appear here.",
    },
  };

  const empty = emptyConfig[activeTab];

  function renderItem({ item }: { item: Profile }) {
    return (
      <View style={styles.row}>
        {/* Avatar */}
        {item.profile_picture_url ? (
          <Image
            source={{ uri: item.profile_picture_url }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {item.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Info */}
        <TouchableOpacity
          style={styles.rowInfo}
          onPress={() => router.push(`/profile/${item.id}`)}
          activeOpacity={0.7}
        >
          <Text style={styles.rowName} numberOfLines={1}>
            {item.display_name}
          </Text>
          <Text style={styles.rowType}>
            {item.profile_type === "CREATOR" ? "Creator" : "Business"}
          </Text>
        </TouchableOpacity>

        {/* Revoke (host only, Going tab, exclusive events) */}
        {isExclusive && activeTab === "going" && (
          <TouchableOpacity
            style={styles.revokeButton}
            onPress={() => handleRevoke(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={16} color={Colors.cancelled} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Nav Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.navTitleBlock}>
          <Text style={styles.navTitle}>Attendees</Text>
          {event?.title ? (
            <Text style={styles.navSubtitle} numberOfLines={1}>
              {event.title}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "going" && styles.tabActive]}
          onPress={() => setActiveTab("going")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "going" && styles.tabTextActive,
            ]}
          >
            Going
            {event && event.going_count > 0 ? ` · ${event.going_count}` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "interested" && styles.tabActive]}
          onPress={() => setActiveTab("interested")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "interested" && styles.tabTextActive,
            ]}
          >
            Interested
            {event && event.interested_count > 0
              ? ` · ${event.interested_count}`
              : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading && !attendees ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : visibleAttendees.length === 0 ? (
        <EmptyState icon={empty.icon} title={empty.title} subtitle={empty.subtitle} />
      ) : (
        <FlatList
          data={visibleAttendees}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
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
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  navTitleBlock: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  navTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  navSubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    maxWidth: 220,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.textPrimary,
  },
  tabText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weight.semibold,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.avatar,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  rowType: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  revokeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.cancelled + "15",
    borderWidth: 1,
    borderColor: Colors.cancelled + "40",
  },
});
