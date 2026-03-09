import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../constants/theme';
import type { EventType } from '../types';

const EVENT_TYPE_COLOR: Record<EventType, string> = {
  FASHION_SHOW: Colors.fashionShow,
  LISTENING_PARTY: Colors.listeningParty,
  NETWORKING: Colors.networking,
  WORKSHOP: Colors.workshop,
  MASTERCLASS: Colors.workshop,
  COMMUNITY: Colors.community,
  PERFORMANCE: Colors.other,
  OPEN_MIC: Colors.other,
  SCREENING: Colors.other,
  STUDIO_SESSION: Colors.other,
  PANEL: Colors.other,
  CRITIQUE_SESSION: Colors.other,
  HACKATHON: Colors.other,
  COLLAB_SESSION: Colors.other,
  OPEN_CALL: Colors.other,
  POP_UP: Colors.other,
  MARKET: Colors.other,
  LAUNCH_PARTY: Colors.other,
  EXHIBITION: Colors.other,
  OPEN_STUDIO: Colors.other,
  PHOTOSHOOT: Colors.other,
  GROUP_RUN: Colors.other,
  FITNESS_CLASS: Colors.other,
  RETREAT: Colors.other,
  GAME_NIGHT: Colors.other,
  BLOCK_PARTY: Colors.other,
  COMPETITION: Colors.other,
  CHARITY: Colors.other,
  VIRTUAL_EVENT: Colors.other,
  OTHER: Colors.other,
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  FASHION_SHOW: 'Fashion Show',
  PERFORMANCE: 'Performance',
  OPEN_MIC: 'Open Mic',
  SCREENING: 'Screening',
  LISTENING_PARTY: 'Listening Party',
  STUDIO_SESSION: 'Studio Session',
  WORKSHOP: 'Workshop',
  MASTERCLASS: 'Masterclass',
  PANEL: 'Panel',
  CRITIQUE_SESSION: 'Critique',
  HACKATHON: 'Hackathon',
  NETWORKING: 'Networking',
  COMMUNITY: 'Community',
  COLLAB_SESSION: 'Collab Session',
  OPEN_CALL: 'Open Call',
  POP_UP: 'Pop-Up',
  MARKET: 'Market',
  LAUNCH_PARTY: 'Launch Party',
  EXHIBITION: 'Exhibition',
  OPEN_STUDIO: 'Open Studio',
  PHOTOSHOOT: 'Photoshoot',
  GROUP_RUN: 'Group Run',
  FITNESS_CLASS: 'Fitness Class',
  RETREAT: 'Retreat',
  GAME_NIGHT: 'Game Night',
  BLOCK_PARTY: 'Block Party',
  COMPETITION: 'Competition',
  CHARITY: 'Charity',
  VIRTUAL_EVENT: 'Virtual Event',
  OTHER: 'Event',
};

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