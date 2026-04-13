import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useRefreshHandler } from '../src/hooks/useRefreshHandler';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../src/components/EmptyState';
import { BorderRadius, Colors, Spacing, Typography } from '../src/constants/theme';
import { useAuth } from '../src/context/auth';
import { useProfile } from '../src/hooks/useProfile';
import {
  useNotificationsData,
  useMarkRead,
  useMarkAllRead,
  useUnreadCount,
} from '../src/hooks/useNotificationsData';
import { timeAgo } from '../src/utils/date';
import type { AppNotification, NotificationType } from '../src/types';

function notificationBody(type: NotificationType, eventTitle?: string): string {
  switch (type) {
    case 'new_follower':
      return 'started following you.';
    case 'new_rsvp_going':
      return eventTitle ? `is going to ${eventTitle}.` : 'is going to your event.';
    case 'new_rsvp_requested':
      return eventTitle ? `requested to join ${eventTitle}.` : 'requested to join your event.';
    case 'rsvp_approved':
      return eventTitle ? `approved your request for ${eventTitle}.` : 'approved your request.';
    case 'rsvp_declined':
      return eventTitle ? `declined your request for ${eventTitle}.` : 'declined your request.';
  }
}

function NotificationRow({
  item,
  profileId,
  onPress,
}: {
  item: AppNotification;
  profileId: string;
  onPress: (item: AppNotification) => void;
}) {
  const isUnread = !item.read_at;
  const actorName = item.actor?.display_name ?? 'Someone';
  const eventTitle = item.event?.title;
  const body = notificationBody(item.type, eventTitle);

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${actorName} ${body}`}
    >
      {/* Unread dot */}
      <View style={styles.dotContainer}>
        {isUnread && <View style={styles.unreadDot} />}
      </View>

      {/* Actor avatar */}
      {item.actor?.profile_picture_url ? (
        <Image
          source={{ uri: item.actor.profile_picture_url }}
          style={styles.avatar}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={20} color={Colors.textTertiary} />
        </View>
      )}

      {/* Text content */}
      <View style={styles.textContent}>
        <Text style={styles.bodyText} numberOfLines={2}>
          <Text style={styles.actorName}>{actorName} </Text>
          {body}
        </Text>
        <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
      </View>

      {/* Event thumbnail */}
      {item.event?.cover_image_url && (
        <Image
          source={{ uri: item.event.cover_image_url }}
          style={styles.eventThumb}
          contentFit="cover"
        />
      )}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: profileData } = useProfile(userId);
  const profileId = profileData?.profile?.id;

  const { data: notifications = [], isLoading, refetch } = useNotificationsData(profileId);
  const { data: unreadCount = 0 } = useUnreadCount(profileId);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const { refreshing, handleRefresh: onRefresh } = useRefreshHandler(refetch);

  function handlePress(item: AppNotification) {
    if (!profileId) return;
    if (!item.read_at) {
      markRead.mutate({ notificationId: item.id, profileId });
    }
    if (item.type === 'new_follower' && item.actor_id) {
      router.push(`/profile/${item.actor_id}` as any);
    } else if (item.event_id) {
      router.push(`/event/${item.event_id}` as any);
    }
  }

  function handleMarkAllRead() {
    if (profileId) markAllRead.mutate(profileId);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0}
          activeOpacity={0.7}
          accessibilityLabel="Mark all as read"
          accessibilityRole="button"
        >
          <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllDisabled]}>
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            profileId={profileId ?? ''}
            onPress={handlePress}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="notifications-off-outline"
              title="No notifications yet"
              subtitle="You'll see new followers, RSVPs and more here"
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
      />
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 44;
const THUMB_SIZE = 44;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 80,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  markAllText: {
    width: 80,
    textAlign: 'right',
    fontSize: Typography.size.sm,
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
  },
  markAllDisabled: {
    color: Colors.textTertiary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  rowUnread: {
    backgroundColor: Colors.surface,
  },
  dotContainer: {
    width: 8,
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
    gap: 3,
  },
  bodyText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actorName: {
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  timestamp: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  eventThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: BorderRadius.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 8 + AVATAR_SIZE + Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
  },
});
