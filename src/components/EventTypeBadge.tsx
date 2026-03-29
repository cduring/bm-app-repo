import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../constants/theme';
import type { EventType } from '../types';

export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  FASHION_SHOW: Colors.fashionShow,      // '#EC4899' pink
  LISTENING_PARTY: Colors.listeningParty, // '#8B5CF6' violet
  NETWORKING: Colors.networking,          // '#3B82F6' blue
  WORKSHOP: Colors.workshop,              // '#F59E0B' amber
  MASTERCLASS: Colors.workshop,           // '#F59E0B' amber
  COMMUNITY: Colors.community,            // '#22C55E' green
  PERFORMANCE: '#EC4899',   // pink — live arts
  OPEN_MIC: '#A855F7',      // purple — spoken/music
  SCREENING: '#06B6D4',     // cyan — film/visual
  STUDIO_SESSION: '#10B981', // emerald — production
  PANEL: '#3B82F6',          // blue — discussion
  CRITIQUE_SESSION: '#F97316', // orange — feedback
  HACKATHON: '#EF4444',     // red — intense/competitive
  COLLAB_SESSION: '#22C55E', // green — collaborative
  OPEN_CALL: '#F59E0B',     // amber — opportunity
  POP_UP: '#EC4899',        // pink — retail/fashion
  MARKET: '#10B981',        // emerald — commerce
  LAUNCH_PARTY: '#8B5CF6',  // violet — celebration
  EXHIBITION: '#06B6D4',    // cyan — gallery/art
  OPEN_STUDIO: '#10B981',   // emerald — creative space
  PHOTOSHOOT: '#F43F5E',    // rose — visual/photo
  GROUP_RUN: '#22C55E',     // green — fitness
  FITNESS_CLASS: '#EF4444', // red — active/energy
  RETREAT: '#6366F1',       // indigo — calm/reflective
  GAME_NIGHT: '#F59E0B',    // amber — fun
  BLOCK_PARTY: '#F97316',   // orange — outdoor/community
  COMPETITION: '#EF4444',   // red — competitive
  CHARITY: '#22C55E',       // green — giving
  VIRTUAL_EVENT: '#6366F1', // indigo — digital
  OTHER: Colors.other,      // '#6B7280' gray
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