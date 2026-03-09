import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEventById } from '../../src/hooks/useEvents';
import { NicheTag } from '../../src/components/NicheTag';
import { ProfileCard } from '../../src/components/ProfileCard';
import { EventTypeBadge } from '../../src/components/EventTypeBadge';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';
import { MOCK_EVENTS } from '../../src/mock/events';
import { formatDayDate, formatTimeRange, formatRecurrenceLabel } from '../../src/utils/date';
import type { RSVPStatus } from '../../src/types';

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

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: supabaseData, isLoading } = useEventById(id);
  const [rsvp, setRsvp] = useState<RSVPStatus | null>(null);
  const [isInterested, setIsInterested] = useState(false);

  const mockEvent = MOCK_EVENTS.find(e => e.id === id);
  const event = supabaseData ?? mockEvent ?? null;

  function handleRSVP(status: RSVPStatus) {
    setRsvp(prev => (prev === status ? null : status));
  }

  if (isLoading && !mockEvent) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
        <Text style={styles.errorText}>Event not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bannerColor = getBannerColor(event.event_type);
  const recurrenceLabel = formatRecurrenceLabel(event.recurrence_rule);
  const isPublic = event.privacy === 'PUBLIC';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Nav Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{event.title}</Text>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Type Banner */}
        {event.cover_image_url ? (
          <View style={styles.banner}>
            <Image source={{ uri: event.cover_image_url }} style={styles.bannerImage} />
            <View style={[styles.bannerOverlay, { backgroundColor: bannerColor + '40' }]} />
            <View style={styles.bannerCenter}>
              <EventTypeBadge eventType={event.event_type} />
            </View>
            {event.is_recurring && (
              <View style={styles.bannerBottomLeft}>
                <Ionicons name="repeat-outline" size={12} color={Colors.textPrimary} />
                <Text style={styles.bannerLabelOnImage}>Recurring Event</Text>
              </View>
            )}
            {event.privacy === 'EXCLUSIVE' && (
              <View style={styles.bannerBottomRight}>
                <Ionicons name="lock-closed" size={12} color={Colors.textPrimary} />
                <Text style={styles.bannerLabelOnImage}>Exclusive</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.banner, { backgroundColor: bannerColor + '30' }]}>
            <View style={styles.bannerCenter}>
              <EventTypeBadge eventType={event.event_type} />
            </View>
            {event.is_recurring && (
              <View style={styles.bannerBottomLeft}>
                <Ionicons name="repeat-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.bannerLabel}>Recurring Event</Text>
              </View>
            )}
            {event.privacy === 'EXCLUSIVE' && (
              <View style={styles.bannerBottomRight}>
                <Ionicons name="lock-closed" size={12} color={Colors.textSecondary} />
                <Text style={styles.bannerLabel}>Exclusive</Text>
              </View>
            )}
          </View>
        )}

        {/* Title + Meta */}
        <View style={styles.section}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={15} color={Colors.textTertiary} />
            <Text style={styles.metaText}>{event.address_name}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={15} color={Colors.textTertiary} />
            <Text style={styles.metaText}>
              {formatDayDate(event.start_time)} · {formatTimeRange(event.start_time, event.end_time)}
            </Text>
          </View>
          {recurrenceLabel && (
            <View style={styles.metaRow}>
              <Ionicons name="repeat-outline" size={15} color={Colors.textTertiary} />
              <Text style={styles.recurrenceText}>{recurrenceLabel}</Text>
            </View>
          )}
        </View>

        {/* Attendee Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.interested }]}>
              {event.interested_count}
            </Text>
            <Text style={styles.statLabel}>Interested</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.going }]}>
              {event.going_count}
            </Text>
            <Text style={styles.statLabel}>Going</Text>
          </View>
        </View>

        {/* RSVP Buttons */}
        <View style={styles.rsvpSection}>
          {isPublic ? (
            <View style={styles.rsvpRow}>
              <TouchableOpacity
                style={[styles.rsvpButton, rsvp === 'INTERESTED' && styles.rsvpButtonInterested]}
                onPress={() => handleRSVP('INTERESTED')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={rsvp === 'INTERESTED' ? 'star' : 'star-outline'}
                  size={16}
                  color={rsvp === 'INTERESTED' ? Colors.textInverse : Colors.textSecondary}
                />
                <Text style={[styles.rsvpButtonText, rsvp === 'INTERESTED' && styles.rsvpButtonTextActive]}>
                  Interested
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rsvpButton, rsvp === 'GOING' && styles.rsvpButtonGoing]}
                onPress={() => handleRSVP('GOING')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={rsvp === 'GOING' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={16}
                  color={rsvp === 'GOING' ? Colors.textInverse : Colors.textSecondary}
                />
                <Text style={[styles.rsvpButtonText, rsvp === 'GOING' && styles.rsvpButtonTextActive]}>
                  Going
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rsvpRow}>
              <TouchableOpacity
                style={[styles.rsvpButton, isInterested && styles.rsvpButtonInterested]}
                onPress={() => setIsInterested(prev => !prev)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isInterested ? 'star' : 'star-outline'}
                  size={16}
                  color={isInterested ? Colors.textInverse : Colors.textSecondary}
                />
                <Text style={[styles.rsvpButtonText, isInterested && styles.rsvpButtonTextActive]}>
                  Interested
                </Text>
              </TouchableOpacity>
              {rsvp === null ? (
                <TouchableOpacity
                  style={[styles.rsvpButton, styles.rsvpButtonExclusiveAccess]}
                  onPress={() => handleRSVP('REQUESTED')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="lock-open-outline" size={16} color={Colors.primary} />
                  <Text style={[styles.rsvpButtonText, styles.rsvpButtonTextPrimary]}>Request Access</Text>
                </TouchableOpacity>
              ) : rsvp === 'REQUESTED' ? (
                <View style={[styles.rsvpButton, styles.rsvpButtonDisabled]}>
                  <Ionicons name="time-outline" size={16} color={Colors.textTertiary} />
                  <Text style={[styles.rsvpButtonText, styles.rsvpButtonTextDisabled]}>Pending…</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.rsvpButton, styles.rsvpButtonGoing]}
                  onPress={() => handleRSVP('GOING')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={16} color={Colors.textInverse} />
                  <Text style={[styles.rsvpButtonText, styles.rsvpButtonTextActive]}>Going ✓</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Host Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hosted By</Text>
          <ProfileCard
            profile={event.host}
            niches={event.niches}
            onPress={() => router.push(`/profile/${event.host.id}`)}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About This Event</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        {/* Niches */}
        {event.niches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niches</Text>
            <View style={styles.niches}>
              {event.niches.map(niche => (
                <NicheTag key={niche.id} name={niche.name} />
              ))}
            </View>
          </View>
        )}

        {/* Map Teaser */}
        <View style={styles.section}>
          <View style={styles.mapTeaser}>
            <Ionicons name="map-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.mapAddress} numberOfLines={2}>{event.address_name}</Text>
            <TouchableOpacity onPress={() => router.push(`/(tabs)/map?eventId=${event.id}`)}>
              <Text style={styles.mapLink}>View on Map →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  errorText: { color: Colors.textSecondary, fontSize: Typography.size.base },
  backLink: { marginTop: Spacing.sm },
  backLinkText: { color: Colors.primary, fontSize: Typography.size.base },

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
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  navTitle: {
    flex: 1,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  shareButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },

  // Banner
  banner: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerCenter: { alignItems: 'center' },
  bannerBottomLeft: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bannerBottomRight: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bannerLabel: { fontSize: Typography.size.xs, color: Colors.textSecondary },
  bannerLabelOnImage: { fontSize: Typography.size.xs, color: Colors.textPrimary },

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  eventTitle: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaText: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    flex: 1,
  },
  recurrenceText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    flex: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNumber: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  statLabel: { fontSize: Typography.size.xs, color: Colors.textTertiary },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  // RSVP
  rsvpSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  rsvpRow: { flexDirection: 'row', gap: Spacing.sm },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  rsvpButtonInterested: {
    backgroundColor: Colors.interested,
    borderColor: Colors.interested,
  },
  rsvpButtonGoing: {
    backgroundColor: Colors.going,
    borderColor: Colors.going,
  },
  rsvpButtonText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  rsvpButtonTextActive: { color: Colors.textInverse },
  rsvpButtonExclusiveAccess: {
    borderColor: Colors.primary + '60',
    backgroundColor: Colors.primary + '15',
  },
  rsvpButtonDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  rsvpButtonTextPrimary: { color: Colors.primary },
  rsvpButtonTextDisabled: { color: Colors.textTertiary, fontWeight: Typography.weight.medium },
  rsvpButtonFullPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  rsvpButtonFullGoing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.going,
  },
  rsvpButtonFullDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rsvpButtonFullText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  rsvpButtonFullDisabledText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.textTertiary,
  },

  sectionTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  description: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  niches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  // Map teaser
  mapTeaser: {
    height: 140,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  mapAddress: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  mapLink: {
    fontSize: Typography.size.base,
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
  },
});