import { View, Text, StyleSheet } from 'react-native';
import { Typography, BorderRadius, Spacing } from '../constants/theme';
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from '../constants/eventTypes';
import type { EventType } from '../types';

interface EventTypeBadgeProps {
  eventType: EventType;
  small?: boolean;
}

export function EventTypeBadge({ eventType, small = false }: EventTypeBadgeProps) {
  const color = EVENT_TYPE_COLOR[eventType];
  const label = EVENT_TYPE_LABEL[eventType];

  return (
    <View
      style={[
        styles.badge,
        small && styles.badgeSmall,
        { backgroundColor: color + '20', borderColor: color + '60' },
      ]}
    >
      <Text style={[styles.text, small && styles.textSmall, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  textSmall: {
    fontSize: Typography.size.xs,
  },
});