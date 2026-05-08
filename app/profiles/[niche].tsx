import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useProfilesByNiche } from '../../src/hooks/useSearch';
import { useNiches } from '../../src/hooks/useNiches';
import { useExcludedIds } from '../../src/hooks/useBlock';
import { useAuth } from '../../src/context/auth';
import { useProfile } from '../../src/hooks/useProfile';
import { EmptyState } from '../../src/components/EmptyState';
import { ProfileCard } from '../../src/components/ProfileCard';
import { Colors, Typography, Spacing } from '../../src/constants/theme';
import type { ProfileWithNiches } from '../../src/types';

export default function ProfilesByNicheScreen() {
  const { niche: rawNiche } = useLocalSearchParams<{ niche: string }>();
  const nicheName = decodeURIComponent(rawNiche ?? '');

  const { session } = useAuth();
  const { data: myProfileData } = useProfile(session?.user?.id);
  const myProfileId = myProfileData?.profile?.id;
  const excludedIds = useExcludedIds(myProfileId);

  const { data: allNiches = [] } = useNiches();
  const nicheObj = allNiches.find(n => n.name.toLowerCase() === nicheName.toLowerCase());

  const { data: profiles = [], isLoading, error, refetch, isRefetching } = useProfilesByNiche(nicheName);

  const visibleProfiles = useMemo(
    () => excludedIds.length > 0
      ? profiles.filter(p => !excludedIds.includes(String(p.id)))
      : profiles,
    [profiles, excludedIds],
  );

  function renderItem({ item }: { item: ProfileWithNiches }) {
    return (
      <ProfileCard
        profile={item}
        niches={item.niches}
        onPress={() => router.push(`/profile/${item.id}` as any)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleRow}>
          {nicheObj?.color && (
            <View style={[styles.nicheDot, { backgroundColor: nicheObj.color }]} />
          )}
          <Text style={styles.navTitle} numberOfLines={1}>
            {nicheName} Creators
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title="Something went wrong"
            subtitle="Could not load creators. Pull down to try again."
          />
        </View>
      ) : visibleProfiles.length === 0 ? (
        <EmptyState
          icon="person-outline"
          title="No creators in this niche yet"
          subtitle="Check back later or explore another niche."
        />
      ) : (
        <FlatList
          data={visibleProfiles}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
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
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nicheDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  navTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
});
