import { useMemo, useState, memo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Mapbox, { MapView, Camera, MarkerView, UserLocation } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';
import { NicheTag } from '../../src/components/NicheTag';
import { MOCK_PROFILES } from '../../src/mock/profiles';
import { MOCK_EVENTS } from '../../src/mock/events';
import type { ProfileWithNiches, EventWithHost, EventType, Niche } from '../../src/types';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

type Mode = 'CREATORS' | 'EVENTS';
type SelectedPin =
  | { type: 'CREATOR'; data: ProfileWithNiches }
  | { type: 'EVENT'; data: EventWithHost }
  | null;

const CreatorPin = memo(({ initial, isSelected }: { initial: string; isSelected: boolean }) => (
  <View style={[styles.pin, styles.creatorPin, isSelected && styles.pinSelected]}>
    <Text style={styles.pinInitial}>{initial}</Text>
  </View>
));

const EventPin = memo(({ initial, color, isSelected }: { initial: string; color: string; isSelected: boolean }) => (
  <View style={[styles.pin, { backgroundColor: color }, isSelected && styles.pinSelected]}>
    <Text style={styles.pinInitial}>{initial}</Text>
  </View>
));

const EVENT_COLORS: Record<EventType, string> = {
  FASHION_SHOW: Colors.fashionShow,
  NETWORKING: Colors.networking,
  WORKSHOP: Colors.workshop,
  MASTERCLASS: Colors.workshop,
  LISTENING_PARTY: Colors.listeningParty,
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

const EVENT_TYPE_LABEL: Record<EventType, string> = {
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

function formatEventDate(isoString: string): string {
  const date = new Date(isoString);
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const mins = date.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = mins.toString().padStart(2, '0');
  return `${month} ${day} · ${h}:${m} ${ampm}`;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const [mode, setMode] = useState<Mode>('CREATORS');
  const [selectedNicheIds, setSelectedNicheIds] = useState<Set<string>>(new Set());
  const [selectedPin, setSelectedPin] = useState<SelectedPin>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [showRecenterButton, setShowRecenterButton] = useState(false);
  const cameraRef = useRef<any>(null);
  const userCoordsRef = useRef<[number, number] | null>(null);
  const hasInitiallyCentered = useRef(false);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') setLocationGranted(true);
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    const target = MOCK_EVENTS.find(e => e.id === eventId);
    if (!target) return;
    setMode('EVENTS');
    setSelectedNicheIds(new Set());
    setSelectedPin({ type: 'EVENT', data: target });
    setTimeout(() => {
      cameraRef.current?.setCamera({
        centerCoordinate: [target.longitude, target.latitude],
        zoomLevel: 14,
        animationDuration: 800,
      });
    }, 300);
  }, [eventId]);

  // Unique niches across all mock profiles (deduplicated by id)
  const allProfileNiches = useMemo<Niche[]>(() => {
    const seen = new Set<string>();
    const result: Niche[] = [];
    for (const profile of MOCK_PROFILES) {
      for (const niche of profile.niches) {
        if (!seen.has(niche.id)) {
          seen.add(niche.id);
          result.push(niche);
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Unique niches across all mock events (deduplicated by id)
  const allEventNiches = useMemo<Niche[]>(() => {
    const seen = new Set<string>();
    const result: Niche[] = [];
    for (const event of MOCK_EVENTS) {
      for (const niche of event.niches) {
        if (!seen.has(niche.id)) {
          seen.add(niche.id);
          result.push(niche);
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const allNiches = mode === 'CREATORS' ? allProfileNiches : allEventNiches;

  // Filtered profiles based on selected niches
  const visibleProfiles = useMemo(() => {
    if (selectedNicheIds.size === 0) return MOCK_PROFILES;
    return MOCK_PROFILES.filter(p =>
      p.niches.some(n => selectedNicheIds.has(n.id))
    );
  }, [selectedNicheIds]);

  // Filtered events based on selected niches
  const visibleEvents = useMemo(() => {
    if (selectedNicheIds.size === 0) return MOCK_EVENTS;
    return MOCK_EVENTS.filter(e =>
      e.niches.some(n => selectedNicheIds.has(n.id))
    );
  }, [selectedNicheIds]);

  function handleToggleNiche(nicheId: string) {
    setSelectedNicheIds(prev => {
      const next = new Set(prev);
      next.has(nicheId) ? next.delete(nicheId) : next.add(nicheId);
      return next;
    });
    setSelectedPin(null);
  }

  function handleSwitchMode(newMode: Mode) {
    setMode(newMode);
    setSelectedPin(null);
    setSelectedNicheIds(new Set());
  }

  function handleUserLocationUpdate(location: any) {
    const coords: [number, number] = [
      location.coords.longitude,
      location.coords.latitude,
    ];
    userCoordsRef.current = coords;
    if (!hasInitiallyCentered.current) {
      hasInitiallyCentered.current = true;
      cameraRef.current?.flyTo(coords, 800);
    }
  }

  function handleRecenter() {
    if (!userCoordsRef.current) return;
    cameraRef.current?.flyTo(userCoordsRef.current, 800);
    setShowRecenterButton(false);
  }

  function handleMapPress() {
    setSelectedPin(null);
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        onPress={handleMapPress}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onRegionIsChanging={(feature: any) => {
          if (feature.properties?.isUserInteraction) {
            setShowRecenterButton(true);
          }
        }}
      >
        <Camera
          ref={cameraRef}
          centerCoordinate={[-79.3832, 43.6532]}
          zoomLevel={12}
          animationDuration={0}
        />
        {locationGranted && (
          <UserLocation visible onUpdate={handleUserLocationUpdate} minDisplacement={5} />
        )}

        {/* Creator pins */}
        {mode === 'CREATORS' &&
          visibleProfiles.map(profile => {
            const isSelected =
              selectedPin?.type === 'CREATOR' &&
              selectedPin.data.id === profile.id;
            return (
              <MarkerView
                key={profile.id}
                coordinate={[profile.longitude!, profile.latitude!]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap
              >
                <TouchableOpacity
                  onPress={() => setSelectedPin({ type: 'CREATOR', data: profile })}
                  activeOpacity={0.8}
                >
                  <CreatorPin
                    initial={profile.display_name.charAt(0).toUpperCase()}
                    isSelected={isSelected}
                  />
                </TouchableOpacity>
              </MarkerView>
            );
          })}

        {/* Event pins */}
        {mode === 'EVENTS' &&
          visibleEvents.map(event => {
            const isSelected =
              selectedPin?.type === 'EVENT' && selectedPin.data.id === event.id;
            const color = EVENT_COLORS[event.event_type];
            return (
              <MarkerView
                key={event.id}
                coordinate={[event.longitude, event.latitude]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap
              >
                <TouchableOpacity
                  onPress={() => setSelectedPin({ type: 'EVENT', data: event })}
                  activeOpacity={0.8}
                >
                  <EventPin
                    initial={event.event_type.charAt(0)}
                    color={color}
                    isSelected={isSelected}
                  />
                </TouchableOpacity>
              </MarkerView>
            );
          })}
      </MapView>

      {/* Recenter button */}
      {showRecenterButton && locationGranted && (
        <TouchableOpacity
          style={[styles.recenterButton, { bottom: insets.bottom + Spacing.lg }]}
          onPress={handleRecenter}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

      {/* Filter bar — floats above map */}
      <SafeAreaView style={styles.filterBar} edges={['top']}>
        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'CREATORS' && styles.modeButtonActive]}
            onPress={() => handleSwitchMode('CREATORS')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeButtonText, mode === 'CREATORS' && styles.modeButtonTextActive]}>
              Creators
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'EVENTS' && styles.modeButtonActive]}
            onPress={() => handleSwitchMode('EVENTS')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeButtonText, mode === 'EVENTS' && styles.modeButtonTextActive]}>
              Events
            </Text>
          </TouchableOpacity>
        </View>

        {/* Niche filter chips */}
        {(
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nichesRow}
            style={styles.nichesScroll}
          >
            <TouchableOpacity
              style={[styles.nicheChip, selectedNicheIds.size === 0 && styles.nicheChipActive]}
              onPress={() => { setSelectedNicheIds(new Set()); setSelectedPin(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.nicheChipText, selectedNicheIds.size === 0 && styles.nicheChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {allNiches.map(niche => (
              <TouchableOpacity
                key={niche.id}
                style={[styles.nicheChip, selectedNicheIds.has(niche.id) && styles.nicheChipActive]}
                onPress={() => handleToggleNiche(niche.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.nicheChipText, selectedNicheIds.has(niche.id) && styles.nicheChipTextActive]}>
                  {niche.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Bottom preview card */}
      {selectedPin && (
        <View style={[styles.card, { marginBottom: insets.bottom + Spacing.sm }]}>
          {/* Dismiss */}
          <TouchableOpacity style={styles.dismissButton} onPress={() => setSelectedPin(null)}>
            <Ionicons name="close" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>

          {selectedPin.type === 'CREATOR' && (
            <CreatorCard
              profile={selectedPin.data}
              onViewProfile={() => router.push(`/profile/${selectedPin.data.id}`)}
            />
          )}
          {selectedPin.type === 'EVENT' && (
            <EventCard event={selectedPin.data} />
          )}
        </View>
      )}
    </View>
  );
}

// ─── Creator card ─────────────────────────────────────────────────────────────

function CreatorCard({
  profile,
  onViewProfile,
}: {
  profile: ProfileWithNiches;
  onViewProfile: () => void;
}) {
  const isCreator = profile.profile_type === 'CREATOR';
  const visibleNiches = profile.niches.slice(0, 3);

  return (
    <>
      <View style={styles.cardRow}>
        {profile.profile_picture_url ? (
          <Image source={{ uri: profile.profile_picture_url }} style={styles.cardAvatar} />
        ) : (
          <View style={[styles.cardAvatar, styles.cardAvatarPlaceholder]}>
            <Text style={styles.cardAvatarInitial}>
              {profile.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{profile.display_name}</Text>
          <View
            style={[
              styles.typeBadge,
              isCreator ? styles.creatorBadge : styles.businessBadge,
            ]}
          >
            <Text style={[styles.typeBadgeText, isCreator ? styles.creatorBadgeText : styles.businessBadgeText]}>
              {isCreator ? 'Creator' : 'Business'}
            </Text>
          </View>
        </View>
      </View>

      {visibleNiches.length > 0 && (
        <View style={styles.cardNiches}>
          {visibleNiches.map(n => <NicheTag key={n.id} name={n.name} small />)}
          {profile.niches.length > 3 && (
            <Text style={styles.nicheOverflow}>+{profile.niches.length - 3}</Text>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.viewButton} onPress={onViewProfile} activeOpacity={0.8}>
        <Text style={styles.viewButtonText}>View Profile</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.textInverse} />
      </TouchableOpacity>
    </>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: EventWithHost }) {
  const color = EVENT_COLORS[event.event_type];
  const label = EVENT_TYPE_LABEL[event.event_type];

  return (
    <>
      <View style={styles.cardRow}>
        <View style={[styles.eventTypeDot, { backgroundColor: color }]} />
        <View style={styles.cardInfo}>
          <View style={styles.eventTitleRow}>
            <Text style={[styles.cardName, { flex: 1 }]} numberOfLines={2}>{event.title}</Text>
            {event.is_recurring && (
              <Ionicons name="repeat" size={14} color={Colors.textTertiary} style={styles.recurringIcon} />
            )}
          </View>
          <View style={styles.eventBadges}>
            <View style={[styles.eventTypeBadge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
              <Text style={[styles.eventTypeBadgeText, { color }]}>{label}</Text>
            </View>
            {event.privacy === 'EXCLUSIVE' && (
              <View style={styles.exclusiveBadge}>
                <Ionicons name="lock-closed" size={9} color={Colors.textTertiary} />
                <Text style={styles.exclusiveBadgeText}>Exclusive</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.eventMeta}>
        <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
        <Text style={styles.eventMetaText}>{formatEventDate(event.start_time)}</Text>
      </View>
      <View style={styles.eventMeta}>
        <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
        <Text style={styles.eventMetaText} numberOfLines={1}>{event.address_name}</Text>
      </View>

      <View style={styles.eventCounts}>
        <Text style={styles.eventCountText}>
          <Text style={styles.eventCountNumber}>{event.interested_count}</Text> interested
        </Text>
        <Text style={styles.eventCountSep}> · </Text>
        <Text style={styles.eventCountText}>
          <Text style={styles.eventCountNumber}>{event.going_count}</Text> going
        </Text>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    flex: 1,
  },

  // Pins
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorPin: {
    backgroundColor: Colors.primary,
  },
  pinSelected: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  pinInitial: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: '#ffffff',
  },

  // Recenter button
  recenterButton: {
    position: 'absolute',
    right: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter bar
  filterBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  modeToggle: {
    flexDirection: 'row',
    margin: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    alignSelf: 'center',
    gap: 2,
  },
  modeButton: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  modeButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
  },
  modeButtonTextActive: {
    color: Colors.textPrimary,
  },
  nichesScroll: {
    marginBottom: Spacing.sm,
  },
  nichesRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  nicheChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  nicheChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  nicheChipText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  nicheChipTextActive: {
    color: Colors.textPrimary,
  },

  // Bottom card
  card: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  dismissButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  // Shared card row
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.avatar,
  },
  cardAvatarPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarInitial: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },

  // Creator card
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  creatorBadge: {
    backgroundColor: Colors.creatorBadge + '20',
    borderColor: Colors.creatorBadge + '40',
  },
  businessBadge: {
    backgroundColor: Colors.businessBadge + '20',
    borderColor: Colors.businessBadge + '40',
  },
  typeBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
  creatorBadgeText: { color: Colors.creatorBadge },
  businessBadgeText: { color: Colors.businessBadge },
  cardNiches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  nicheOverflow: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    marginTop: Spacing.xs,
  },
  viewButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textInverse,
  },

  // Event card
  eventTypeDot: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  recurringIcon: {
    marginTop: 2,
  },
  eventBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  exclusiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  exclusiveBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    color: Colors.textTertiary,
  },
  eventTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  eventTypeBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventMetaText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  eventCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  eventCountText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  eventCountNumber: {
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  eventCountSep: {
    color: Colors.textTertiary,
  },
});
