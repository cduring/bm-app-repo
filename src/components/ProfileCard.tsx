import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../constants/theme';
import { NicheTag } from './NicheTag';
import type { Profile, Niche } from '../types';

interface ProfileCardProps {
  profile: Profile;
  niches: Niche[];
  onPress?: () => void;
}

export function ProfileCard({ profile, niches, onPress }: ProfileCardProps) {
  const isCreator = profile.profile_type === 'CREATOR';
  const visibleNiches = niches.slice(0, 3);
  const overflowCount = niches.length - visibleNiches.length;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {profile.profile_picture_url ? (
        <Image source={{ uri: profile.profile_picture_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>
            {profile.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.display_name}
          </Text>
          <View style={[styles.badge, isCreator ? styles.creatorBadge : styles.businessBadge]}>
            <Text style={[styles.badgeText, isCreator ? styles.creatorBadgeText : styles.businessBadgeText]}>
              {isCreator ? 'Creator' : 'Business'}
            </Text>
          </View>
        </View>

        {niches.length > 0 && (
          <View style={styles.niches}>
            {visibleNiches.map(niche => (
              <NicheTag key={niche.id} name={niche.name} small />
            ))}
            {overflowCount > 0 && (
              <Text style={styles.overflow}>+{overflowCount}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.avatar,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  creatorBadge: {
    backgroundColor: Colors.creatorBadge + '20',
    borderWidth: 1,
    borderColor: Colors.creatorBadge + '40',
  },
  businessBadge: {
    backgroundColor: Colors.businessBadge + '20',
    borderWidth: 1,
    borderColor: Colors.businessBadge + '40',
  },
  badgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
  creatorBadgeText: {
    color: Colors.creatorBadge,
  },
  businessBadgeText: {
    color: Colors.businessBadge,
  },
  niches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  overflow: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    alignSelf: 'center',
  },
});
