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
import { useEventsByNiche } from '../../src/hooks/useSearch';
import { useNiches } from '../../src/hooks/useNiches';
import { EmptyState } from '../../src/components/EmptyState';
import { EventCard } from '../../src/components/EventCard';
import { Colors, Typography, Spacing } from '../../src/constants/theme';
import type { EventWithHost } from '../../src/types';

export default function EventsByNicheScreen() {
  const { niche: rawNiche } = useLocalSearchParams<{ niche: string }>();
  const nicheName = decodeURIComponent(rawNiche ?? '');

  const { data: allNiches = [] } = useNiches();
  const nicheObj = allNiches.find(n => n.name.toLowerCase() === nicheName.toLowerCase());

  const { data: events = [], isLoading, error, refetch, isRefetching } = useEventsByNiche(nicheName);

  function renderItem({ item }: { item: EventWithHost }) {
    return (
      <EventCard
        event={item}
        onPress={() => router.push(`/event/${item.id}` as any)}
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
            {nicheName} Events
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
            subtitle="Could not load events. Pull down to try again."
          />
        </View>
      ) : events.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No upcoming events in this niche"
          subtitle="Check back later or explore another niche."
        />
      ) : (
        <FlatList
          data={events}
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
