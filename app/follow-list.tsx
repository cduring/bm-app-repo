import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useFollowers, useFollowing } from '../src/hooks/useFollow';
import { EmptyState } from '../src/components/EmptyState';
import { ProfileCard } from '../src/components/ProfileCard';
import { Colors, Typography, Spacing } from '../src/constants/theme';
import type { Profile } from '../src/types';

export default function FollowListScreen() {
  const { mode, profileId } = useLocalSearchParams<{
    mode: 'followers' | 'following';
    profileId: string;
  }>();

  const isFollowers = mode === 'followers';
  const { data: followers, isLoading: loadingFollowers } = useFollowers(
    isFollowers ? profileId : undefined,
  );
  const { data: following, isLoading: loadingFollowing } = useFollowing(
    !isFollowers ? profileId : undefined,
  );

  const profiles = isFollowers ? followers : following;
  const isLoading = isFollowers ? loadingFollowers : loadingFollowing;

  function renderItem({ item }: { item: Profile }) {
    return (
      <ProfileCard
        profile={item}
        niches={[]}
        onPress={() => router.push(`/profile/${item.id}`)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{isFollowers ? 'Followers' : 'Following'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : !profiles || profiles.length === 0 ? (
        <EmptyState
          icon={isFollowers ? 'people-outline' : 'person-add-outline'}
          title={isFollowers ? 'No followers yet' : 'Not following anyone yet'}
          subtitle={isFollowers
            ? 'When people follow this profile, they\u2019ll appear here.'
            : 'Profiles that are followed will appear here.'}
        />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
  navTitle: {
    flex: 1,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
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
