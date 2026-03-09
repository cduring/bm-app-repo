import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { NicheTag } from './NicheTag';
import { EventTypeBadge } from './EventTypeBadge';
import { formatTimeRange } from '../utils/date';
import type { EventWithHost } from '../types';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const WEEKDAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

interface EventCardProps {
  event: EventWithHost;
  onPress: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  const startDate = new Date(event.start_time);
  const month = MONTHS[startDate.getUTCMonth()];
  const day = startDate.getUTCDate();
  const weekday = WEEKDAYS[startDate.getUTCDay()];

  const visibleNiches = event.niches.slice(0, 2);
  const overflowCount = event.niches.length - visibleNiches.length;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Date column */}
      <View style={styles.dateCol}>
        <Text style={styles.month}>{month}</Text>
        <Text style={styles.day}>{day}</Text>
        <Text style={styles.weekday}>{weekday}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        {/* Badge row */}
        <View style={styles.badgeRow}>
          <EventTypeBadge eventType={event.event_type} small />
          {event.privacy === 'EXCLUSIVE' && (
            <View style={styles.exclusiveBadge}>
              <Ionicons name="lock-closed" size={9} color={Colors.primary} />
              <Text style={styles.exclusiveBadgeText}>Exclusive</Text>
            </View>
          )}
          {event.is_recurring && (
            <View style={styles.recurringBadge}>
              <Ionicons name="repeat-outline" size={10} color={Colors.other} />
              <Text style={styles.recurringBadgeText}>Recurring</Text>
            </View>
          )}
        </View>

        {/* Location */}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.metaText} numberOfLines={1}>{event.address_name}</Text>
        </View>

        {/* Time */}
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.metaText}>{formatTimeRange(event.start_time, event.end_time)}</Text>
        </View>

        {/* Host */}
        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.metaText}>by {event.host.display_name}</Text>
        </View>

        {/* Niches */}
        {visibleNiches.length > 0 && (
          <View style={styles.niches}>
            {visibleNiches.map(niche => (
              <NicheTag key={niche.id} name={niche.name} small />
            ))}
            {overflowCount > 0 && (
              <Text style={styles.overflow}>+{overflowCount}</Text>
            )}
          </View>
        )}

        {/* Attendee counts */}
        <View style={styles.countsRow}>
          <View style={styles.countItem}>
            <View style={[styles.dot, { backgroundColor: Colors.interested }]} />
            <Text style={styles.countText}>{event.interested_count} interested</Text>
          </View>
          <View style={styles.countItem}>
            <View style={[styles.dot, { backgroundColor: Colors.going }]} />
            <Text style={styles.countText}>{event.going_count} going</Text>
          </View>
        </View>
      </View>

      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={16}
        color={Colors.textTertiary}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  dateCol: {
    width: 52,
    backgroundColor: Colors.surfaceElevated,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 2,
  },
  month: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  day: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  weekday: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    gap: 5,
  },
  title: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  exclusiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary + '60',
    borderRadius: BorderRadius.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  exclusiveBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    color: Colors.primary,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.other + '20',
    borderWidth: 1,
    borderColor: Colors.other + '40',
    borderRadius: BorderRadius.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recurringBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    color: Colors.other,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    flex: 1,
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
  },
  countsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 2,
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  countText: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  chevron: {
    alignSelf: 'center',
    paddingRight: Spacing.sm,
  },
});