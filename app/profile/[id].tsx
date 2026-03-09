import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useProfileById } from '../../src/hooks/useProfile';
import { NicheTag } from '../../src/components/NicheTag';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';
import { PLATFORM_ICONS } from '../../src/constants/platformIcons';
import { MOCK_PROFILES } from '../../src/mock/profiles';
import type { ProfileWithNiches } from '../../src/types';

function mockToProfileData(p: ProfileWithNiches) {
  return {
    profile: p,
    niches: p.niches,
    externalLinks: p.external_links ?? [],
  };
}

export default function ViewProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: supabaseData, isLoading } = useProfileById(id);
  const [isFollowing, setIsFollowing] = useState(false);

  const mockProfile = MOCK_PROFILES.find(p => p.id === id);
  const data = supabaseData ?? (mockProfile ? mockToProfileData(mockProfile) : null);

  function openLink(url: string) {
    const full = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(full).catch(() =>
      Alert.alert('Error', 'Could not open this link.')
    );
  }

  if (isLoading && !mockProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
        <Text style={styles.errorText}>Profile not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { profile, niches, externalLinks } = data;
  const isCreator = profile.profile_type === 'CREATOR';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Navigation header */}
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{profile.display_name}</Text>
        {/* Follow button */}
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={() => setIsFollowing(f => !f)}
          activeOpacity={0.8}
        >
          <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Name + Badge */}
        <View style={styles.avatarSection}>
          {profile.profile_picture_url ? (
            <Image source={{ uri: profile.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {profile.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.displayName}>{profile.display_name}</Text>

          <View style={styles.metaRow}>
            <View style={[styles.typeBadge, isCreator ? styles.creatorBadge : styles.businessBadge]}>
              <Text style={[styles.typeBadgeText, isCreator ? styles.creatorBadgeText : styles.businessBadgeText]}>
                {isCreator ? 'Creator' : 'Business'}
              </Text>
            </View>
            {profile.location_name ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
                <Text style={styles.locationText}>{profile.location_name}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.follower_count}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.following_count}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          {profile.years_in_business != null && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{profile.years_in_business}</Text>
                <Text style={styles.statLabel}>Yrs Active</Text>
              </View>
            </>
          )}
        </View>

        {/* Bio */}
        {profile.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* Niches */}
        {niches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niches</Text>
            <View style={styles.niches}>
              {niches.map(niche => (
                <NicheTag key={niche.id} name={niche.name} />
              ))}
            </View>
          </View>
        )}

        {/* External Links */}
        {externalLinks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Links</Text>
            <View style={styles.links}>
              {externalLinks.map(link => (
                <TouchableOpacity
                  key={link.id}
                  style={styles.linkButton}
                  onPress={() => openLink(link.url)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={PLATFORM_ICONS[link.platform_name] as any}
                    size={18}
                    color={Colors.primary}
                  />
                  <Text style={styles.linkText}>{link.platform_name}</Text>
                  <Ionicons name="open-outline" size={13} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.base,
  },
  backLink: {
    marginTop: Spacing.sm,
  },
  backLinkText: {
    color: Colors.primary,
    fontSize: Typography.size.base,
  },

  // Nav header
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  followButton: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  followingButtonText: {
    color: Colors.textSecondary,
  },

  // Avatar section
  avatarSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.avatar,
    marginBottom: Spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  displayName: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  creatorBadge: {
    backgroundColor: Colors.creatorBadge + '15',
    borderColor: Colors.creatorBadge + '50',
  },
  businessBadge: {
    backgroundColor: Colors.businessBadge + '15',
    borderColor: Colors.businessBadge + '50',
  },
  typeBadgeText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  creatorBadgeText: {
    color: Colors.creatorBadge,
  },
  businessBadgeText: {
    color: Colors.businessBadge,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bio: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  niches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  links: {
    gap: Spacing.xs,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkText: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
});
