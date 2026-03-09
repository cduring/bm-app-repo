import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { EventTypeBadge } from './EventTypeBadge';
import { formatDayDate, formatTimeRange } from '../utils/date';
import type { EventWithHost, RSVPStatus } from '../types';

const EVENT_BANNER_COLOR: Record<string, string> = {
  FASHION_SHOW: Colors.fashionShow,
  LISTENING_PARTY: Colors.listeningParty,
  NETWORKING: Colors.networking,
  WORKSHOP: Colors.workshop,
  MASTERCLASS: Colors.workshop,
  COMMUNITY: Colors.community,
};

function getBannerColor(eventType: string): string {
  return EVENT_BANNER_COLOR[eventType] ?? Colors.other;
}

interface EventFullCardProps {
  event: EventWithHost;
  height: number;
  rsvp: RSVPStatus | null;
  isInterested: boolean;
  onRSVP: (status: RSVPStatus) => void;
  onToggleInterested: () => void;
  onViewDetails: () => void;
}

export function EventFullCard({ event, height, rsvp, isInterested, onRSVP, onToggleInterested, onViewDetails }: EventFullCardProps) {
  const bannerColor = getBannerColor(event.event_type);
  const isPublic = event.privacy === 'PUBLIC';

  return (
    <View style={[styles.card, { height }]}>
      {/* Background */}
      {event.cover_image_url ? (
        <Image
          source={{ uri: event.cover_image_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bannerColor + '25' }]} />
      )}

      {/* Subtle full-card darkening overlay (images only) */}
      {event.cover_image_url ? (
        <View style={[StyleSheet.absoluteFill, styles.imageOverlay]} />
      ) : null}

      {/* Bottom content panel */}
      <View style={styles.panel}>
        {/* Swipe hint */}
        <View style={styles.swipeHint}>
          <Ionicons name="chevron-up" size={18} color={Colors.textTertiary} />
        </View>

        {/* Top row: badges + Details button */}
        <View style={styles.topRow}>
          <View style={styles.badges}>
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
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.detailsBtn} onPress={onViewDetails} activeOpacity={0.8}>
            <Text style={styles.detailsBtnText}>Details</Text>
            <Ionicons name="arrow-forward" size={13} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        {/* Meta rows */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.metaText}>
            {formatDayDate(event.start_time)} · {formatTimeRange(event.start_time, event.end_time)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>{event.address_name}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.metaText}>by {event.host.display_name}</Text>
        </View>

        {/* Counts */}
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

        {/* RSVP */}
        <View style={styles.rsvpArea}>
          {isPublic ? (
            <View style={styles.rsvpRow}>
              <TouchableOpacity
                style={[styles.rsvpBtn, rsvp === 'INTERESTED' && styles.rsvpBtnInterested]}
                onPress={() => onRSVP('INTERESTED')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={rsvp === 'INTERESTED' ? 'star' : 'star-outline'}
                  size={16}
                  color={rsvp === 'INTERESTED' ? Colors.textInverse : Colors.textPrimary}
                />
                <Text style={[styles.rsvpBtnText, rsvp === 'INTERESTED' && styles.rsvpBtnTextActive]}>
                  Interested
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rsvpBtn, rsvp === 'GOING' && styles.rsvpBtnGoing]}
                onPress={() => onRSVP('GOING')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={rsvp === 'GOING' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={16}
                  color={rsvp === 'GOING' ? Colors.textInverse : Colors.textPrimary}
                />
                <Text style={[styles.rsvpBtnText, rsvp === 'GOING' && styles.rsvpBtnTextActive]}>
                  Going
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rsvpRow}>
              <TouchableOpacity
                style={[styles.rsvpBtn, isInterested && styles.rsvpBtnInterested]}
                onPress={onToggleInterested}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isInterested ? 'star' : 'star-outline'}
                  size={16}
                  color={isInterested ? Colors.textInverse : Colors.textPrimary}
                />
                <Text style={[styles.rsvpBtnText, isInterested && styles.rsvpBtnTextActive]}>
                  Interested
                </Text>
              </TouchableOpacity>
              {rsvp === null ? (
                <TouchableOpacity
                  style={[styles.rsvpBtn, styles.rsvpBtnExclusiveAccess]}
                  onPress={() => onRSVP('REQUESTED')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="lock-open-outline" size={16} color={Colors.primary} />
                  <Text style={[styles.rsvpBtnText, styles.rsvpBtnTextPrimary]}>Request Access</Text>
                </TouchableOpacity>
              ) : rsvp === 'REQUESTED' ? (
                <View style={[styles.rsvpBtn, styles.rsvpBtnDisabled]}>
                  <Ionicons name="time-outline" size={16} color={Colors.textTertiary} />
                  <Text style={[styles.rsvpBtnText, styles.rsvpBtnTextDisabled]}>Pending…</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.rsvpBtn, styles.rsvpBtnGoing]}
                  onPress={() => onRSVP('GOING')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={16} color={Colors.textInverse} />
                  <Text style={[styles.rsvpBtnText, styles.rsvpBtnTextActive]}>Going ✓</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  imageOverlay: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,10,0.88)',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  swipeHint: {
    alignItems: 'center',
    marginBottom: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
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
    backgroundColor: Colors.other + '20',
    borderWidth: 1,
    borderColor: Colors.other + '40',
    borderRadius: BorderRadius.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  detailsBtnText: {
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.medium,
  },
  title: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  countsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  rsvpArea: {
    marginTop: 2,
  },
  rsvpRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rsvpBtnInterested: {
    backgroundColor: Colors.interested,
    borderColor: Colors.interested,
  },
  rsvpBtnGoing: {
    backgroundColor: Colors.going,
    borderColor: Colors.going,
  },
  rsvpBtnText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  rsvpBtnTextActive: {
    color: Colors.textInverse,
  },
  rsvpBtnFullPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  rsvpBtnFullGoing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.going,
  },
  rsvpBtnFullDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  rsvpBtnFullText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  rsvpBtnFullDisabledText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.textTertiary,
  },
  rsvpBtnExclusiveAccess: {
    borderColor: Colors.primary + '60',
    backgroundColor: Colors.primary + '15',
  },
  rsvpBtnDisabled: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rsvpBtnTextPrimary: {
    color: Colors.primary,
  },
  rsvpBtnTextDisabled: {
    color: Colors.textTertiary,
    fontWeight: Typography.weight.medium,
  },
});
