import { Ionicons } from "@expo/vector-icons";
import Mapbox, {
  Camera,
  MapView,
  MarkerView,
  UserLocation,
} from "@rnmapbox/maps";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { usePostHog } from "posthog-react-native";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ErrorState } from "../../src/components/ErrorState";
import { NicheFilterBar } from "../../src/components/NicheFilterBar";
import { NicheTag } from "../../src/components/NicheTag";
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABEL,
} from "../../src/constants/eventTypes";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { useMapEvents, useMapProfiles } from "../../src/hooks/useMapData";
import type { EventWithHost, Niche, ProfileWithNiches } from "../../src/types";
import { useAuth } from "../../src/context/auth";
import { IntroModal } from "../../src/components/IntroModal";
import { useIntroModal } from "../../src/hooks/useIntroModal";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

const GTA_CENTER: [number, number] = [-79.3832, 43.6532];
// Approximate bounding box of the Greater Toronto Area visible at zoom ~12
const GTA_VIEW_BOUNDS = {
  minLng: -79.64,
  maxLng: -79.13,
  minLat: 43.52,
  maxLat: 43.79,
};

type Mode = "CREATORS" | "EVENTS";
type SelectedPin =
  | { type: "CREATOR"; data: ProfileWithNiches }
  | { type: "EVENT"; data: EventWithHost }
  | null;

type PinGroup<T> =
  | { kind: "cluster"; count: number; lng: number; lat: number; items: T[] }
  | { kind: "single"; item: T };

// At zoom >= 14 the visible width at Toronto's latitude is ~1km — disable clustering.
const CLUSTER_MAX_ZOOM = 14;

function clusterPoints<T>(
  points: { lng: number; lat: number; item: T }[],
  zoom: number,
): PinGroup<T>[] {
  if (zoom >= CLUSTER_MAX_ZOOM) {
    return points.map((p) => ({ kind: "single", item: p.item }));
  }
  // Convert a 50px screen-radius to geographic degrees at this zoom level
  // (Mapbox uses 512px tiles)
  const threshold = (50 * 360) / (Math.pow(2, zoom) * 512);
  const assigned = new Set<number>();
  const groups: PinGroup<T>[] = [];

  for (let i = 0; i < points.length; i++) {
    if (assigned.has(i)) continue;
    assigned.add(i);
    const members = [points[i]];
    for (let j = i + 1; j < points.length; j++) {
      if (assigned.has(j)) continue;
      const dlng = points[i].lng - points[j].lng;
      const dlat = points[i].lat - points[j].lat;
      if (Math.sqrt(dlng * dlng + dlat * dlat) < threshold) {
        members.push(points[j]);
        assigned.add(j);
      }
    }
    if (members.length === 1) {
      groups.push({ kind: "single", item: members[0].item });
    } else {
      const lng = members.reduce((s, p) => s + p.lng, 0) / members.length;
      const lat = members.reduce((s, p) => s + p.lat, 0) / members.length;
      groups.push({
        kind: "cluster",
        count: members.length,
        lng,
        lat,
        items: members.map((m) => m.item),
      });
    }
  }
  return groups;
}

// Returns a consistent ~300m coordinate offset seeded from the event ID.
// Used to displace exclusive event pins so the exact venue isn't pinpointable.
function getExclusiveOffset(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++)
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  const dlat = ((h & 0xff) - 128) / 42000;
  const dlng = (((h >> 8) & 0xff) - 128) / 42000;
  return [dlat, dlng];
}

function CreatorPinComponent({
  initial,
  imageUrl,
  isSelected,
}: {
  initial: string;
  imageUrl?: string;
  isSelected: boolean;
}) {
  const scale = useSharedValue(1.0);

  useEffect(() => {
    scale.value = withTiming(isSelected ? 1.2 : 1.0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [isSelected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.pin,
        styles.creatorPin,
        isSelected && styles.pinSelected,
        animStyle,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.pinImage}
          contentFit="cover"
        />
      ) : (
        <Text style={styles.pinInitial}>{initial}</Text>
      )}
    </Animated.View>
  );
}
const CreatorPin = memo(CreatorPinComponent);

function EventPinComponent({
  initial,
  imageUrl,
  color,
  isSelected,
}: {
  initial: string;
  imageUrl?: string;
  color: string;
  isSelected: boolean;
}) {
  const scale = useSharedValue(1.0);

  useEffect(() => {
    scale.value = withTiming(isSelected ? 1.2 : 1.0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [isSelected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.pin,
        styles.eventPin,
        { backgroundColor: color },
        isSelected && styles.eventPinSelected,
        animStyle,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.pinImage, styles.eventPinImage]}
          contentFit="cover"
        />
      ) : (
        <Text style={styles.pinInitial}>{initial}</Text>
      )}
    </Animated.View>
  );
}
const EventPin = memo(EventPinComponent);

function SwipeDismissCard({
  visible = true,
  onDismiss,
  children,
  style,
}: {
  visible?: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const swipeY = useSharedValue(0);
  const entryY = useSharedValue(160);
  const entryScale = useSharedValue(0.82);

  // Entry animation on mount
  useEffect(() => {
    entryY.value = withSpring(0, { damping: 16, stiffness: 240, mass: 0.9 });
    entryScale.value = withSpring(1, {
      damping: 16,
      stiffness: 240,
      mass: 0.9,
    });
  }, []);

  // Exit animation when visible becomes false
  useEffect(() => {
    if (!visible) {
      entryY.value = withTiming(160, {
        duration: 220,
        easing: Easing.in(Easing.quad),
      });
      entryScale.value = withTiming(0.85, {
        duration: 220,
        easing: Easing.in(Easing.quad),
      });
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      swipeY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 60) {
        runOnJS(onDismiss)();
      } else {
        swipeY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: entryY.value + swipeY.value },
      { scale: entryScale.value },
    ],
    opacity: Math.max(0, 1 - swipeY.value / 150),
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const THUMB = 28;
const STEP = 22; // THUMB minus 6px overlap

function CreatorClusterPin({ items }: { items: ProfileWithNiches[] }) {
  const visible = items.slice(0, 2);
  const overflow = items.length - 2;
  const slots = overflow > 0 ? visible.length + 1 : visible.length;
  const containerWidth = THUMB + (slots - 1) * STEP;

  return (
    <View style={{ width: containerWidth, height: THUMB }}>
      {visible.map((p, i) => (
        <View
          key={p.id}
          style={[
            styles.clusterThumb,
            styles.clusterThumbCircle,
            { left: i * STEP, zIndex: i + 1 },
          ]}
        >
          {p.profile_picture_url ? (
            <Image
              source={{ uri: p.profile_picture_url }}
              style={styles.clusterThumbImage}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.clusterThumbInitial}>
              {p.display_name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={[
            styles.clusterThumb,
            styles.clusterThumbCircle,
            styles.clusterOverflow,
            { left: visible.length * STEP, zIndex: visible.length + 1 },
          ]}
        >
          <Text style={styles.clusterOverflowText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

function EventClusterPin({ items }: { items: EventWithHost[] }) {
  const visible = items.slice(0, 2);
  const overflow = items.length - 2;
  const slots = overflow > 0 ? visible.length + 1 : visible.length;
  const containerWidth = THUMB + (slots - 1) * STEP;

  return (
    <View style={{ width: containerWidth, height: THUMB }}>
      {visible.map((e, i) => {
        const color = EVENT_TYPE_COLOR[e.event_type];
        return (
          <View
            key={e.id}
            style={[
              styles.clusterThumb,
              styles.clusterThumbSquare,
              { left: i * STEP, zIndex: i + 1, backgroundColor: color },
            ]}
          >
            {e.cover_image_url ? (
              <Image
                source={{ uri: e.cover_image_url }}
                style={styles.clusterThumbImage}
                contentFit="cover"
              />
            ) : (
              <Text style={styles.clusterThumbInitial}>
                {e.event_type.charAt(0)}
              </Text>
            )}
          </View>
        );
      })}
      {overflow > 0 && (
        <View
          style={[
            styles.clusterThumb,
            styles.clusterThumbSquare,
            styles.clusterOverflow,
            { left: visible.length * STEP, zIndex: visible.length + 1 },
          ]}
        >
          <Text style={styles.clusterOverflowText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

function formatEventDate(isoString: string): string {
  const date = new Date(isoString);
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  const hours = date.getHours();
  const mins = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = mins.toString().padStart(2, "0");
  return `${month} ${day} · ${h}:${m} ${ampm}`;
}

export default function MapScreen() {
  const { session } = useAuth();
  const introModal = useIntroModal('map', session?.user?.id);
  const posthog = usePostHog();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const [mode, setMode] = useState<Mode>("CREATORS");
  const [selectedNicheIds, setSelectedNicheIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPin, setSelectedPin] = useState<SelectedPin>(null);
  const [topPinData, setTopPinData] = useState<SelectedPin>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [showRecenterButton, setShowRecenterButton] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(12);
  const cameraRef = useRef<any>(null);
  const userCoordsRef = useRef<[number, number] | null>(null);
  const hasInitiallyCentered = useRef(false);
  const lastZoomRef = useRef(12);
  const topPinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: mapProfiles = [],
    error: profilesError,
    refetch: refetchProfiles,
  } = useMapProfiles();
  const {
    data: mapEvents = [],
    error: eventsError,
    refetch: refetchMapEvents,
  } = useMapEvents();

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === "granted") setLocationGranted(true);
    });
  }, []);

  useEffect(() => {
    if (!eventId || mapEvents.length === 0) return;
    const target = mapEvents.find((e) => e.id === eventId);
    if (!target) return;
    setMode("EVENTS");
    setSelectedNicheIds(new Set());
    const pin: SelectedPin = { type: "EVENT", data: target };
    setSelectedPin(pin);
    setTopPinData(pin);
    setTimeout(() => {
      cameraRef.current?.setCamera({
        centerCoordinate: [target.longitude, target.latitude],
        zoomLevel: 14,
        animationDuration: 800,
      });
    }, 300);
  }, [eventId, mapEvents]);

  // Unique niches across real profiles (deduplicated by id)
  const allProfileNiches = useMemo<Niche[]>(() => {
    const seen = new Set<string>();
    const result: Niche[] = [];
    for (const profile of mapProfiles) {
      for (const niche of profile.niches) {
        if (!seen.has(niche.id)) {
          seen.add(niche.id);
          result.push(niche);
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [mapProfiles]);

  // Unique niches across real events (deduplicated by id)
  const allEventNiches = useMemo<Niche[]>(() => {
    const seen = new Set<string>();
    const result: Niche[] = [];
    for (const event of mapEvents) {
      for (const niche of event.niches) {
        if (!seen.has(niche.id)) {
          seen.add(niche.id);
          result.push(niche);
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [mapEvents]);

  const allNiches = mode === "CREATORS" ? allProfileNiches : allEventNiches;

  // Filtered profiles based on selected niches
  const visibleProfiles = useMemo(() => {
    if (selectedNicheIds.size === 0) return mapProfiles;
    return mapProfiles.filter((p) =>
      p.niches.some((n) => selectedNicheIds.has(n.id)),
    );
  }, [selectedNicheIds, mapProfiles]);

  // Filtered events based on selected niches
  const visibleEvents = useMemo(() => {
    if (selectedNicheIds.size === 0) return mapEvents;
    return mapEvents.filter((e) =>
      e.niches.some((n) => selectedNicheIds.has(n.id)),
    );
  }, [selectedNicheIds, mapEvents]);

  const profileGroups = useMemo<PinGroup<ProfileWithNiches>[]>(() => {
    const pts = visibleProfiles
      .filter((p) => p.longitude != null && p.latitude != null)
      .map((p) => ({ lng: p.longitude!, lat: p.latitude!, item: p }));
    return clusterPoints(pts, currentZoom);
  }, [visibleProfiles, currentZoom]);

  const eventGroups = useMemo<PinGroup<EventWithHost>[]>(() => {
    const pts = visibleEvents.map((e) => ({
      lng: e.longitude,
      lat: e.latitude,
      item: e,
    }));
    return clusterPoints(pts, currentZoom);
  }, [visibleEvents, currentZoom]);

  useEffect(() => {
    return () => {
      if (topPinTimerRef.current) clearTimeout(topPinTimerRef.current);
    };
  }, []);

  const selectPin = useCallback(
    (pin: SelectedPin) => {
      if (topPinTimerRef.current) clearTimeout(topPinTimerRef.current);
      setSelectedPin(pin);
      setTopPinData(pin);
      if (pin) {
        posthog?.capture("map_pin_tapped", {
          pin_type: pin.type,
          pin_id: pin.type === "CREATOR" ? pin.data.id : pin.data.id,
        });
      }
    },
    [posthog],
  );

  // Deselect with a short delay so the shrink + card-exit animations play out
  const deselectPin = useCallback(() => {
    setSelectedPin(null);
    if (topPinTimerRef.current) clearTimeout(topPinTimerRef.current);
    topPinTimerRef.current = setTimeout(() => setTopPinData(null), 250);
  }, []);

  // Immediate clear — used when context changes (mode switch, cluster zoom)
  const clearPin = useCallback(() => {
    if (topPinTimerRef.current) clearTimeout(topPinTimerRef.current);
    setSelectedPin(null);
    setTopPinData(null);
  }, []);

  function handleClusterPress(lng: number, lat: number) {
    clearPin();
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: currentZoom + 2.5,
      animationDuration: 500,
    });
  }

  function handleToggleNiche(nicheId: string) {
    const wasActive = selectedNicheIds.has(nicheId);
    posthog?.capture("niche_filter_toggled", {
      niche_id: nicheId,
      mode,
      action: wasActive ? "removed" : "added",
    });
    setSelectedNicheIds((prev) => {
      const next = new Set(prev);
      next.has(nicheId) ? next.delete(nicheId) : next.add(nicheId);
      return next;
    });
    deselectPin();
  }

  function handleSwitchMode(newMode: Mode) {
    setMode(newMode);
    clearPin();
    setSelectedNicheIds(new Set());
  }

  function handleUserLocationUpdate(location: any) {
    const lng = location.coords?.longitude;
    const lat = location.coords?.latitude;
    if (
      typeof lng !== "number" ||
      typeof lat !== "number" ||
      isNaN(lng) ||
      isNaN(lat)
    )
      return;
    const coords: [number, number] = [lng, lat];
    userCoordsRef.current = coords;
    if (!hasInitiallyCentered.current) {
      hasInitiallyCentered.current = true;
      const inGTA =
        lng >= GTA_VIEW_BOUNDS.minLng &&
        lng <= GTA_VIEW_BOUNDS.maxLng &&
        lat >= GTA_VIEW_BOUNDS.minLat &&
        lat <= GTA_VIEW_BOUNDS.maxLat;
      if (!inGTA) {
        // User is outside the GTA view — expand to include both GTA and user pin
        const sw: [number, number] = [
          Math.min(lng, GTA_CENTER[0]) - 0.05,
          Math.min(lat, GTA_CENTER[1]) - 0.05,
        ];
        const ne: [number, number] = [
          Math.max(lng, GTA_CENTER[0]) + 0.05,
          Math.max(lat, GTA_CENTER[1]) + 0.05,
        ];
        cameraRef.current?.setCamera({
          bounds: {
            ne,
            sw,
            paddingTop: 80,
            paddingBottom: 80,
            paddingLeft: 40,
            paddingRight: 40,
          },
          animationDuration: 800,
        });
      }
      // If in GTA, leave the camera on the default GTA view
    }
  }

  function handleRecenter() {
    if (!userCoordsRef.current) return;
    cameraRef.current?.setCamera({
      centerCoordinate: userCoordsRef.current,
      zoomLevel: 14,
      animationDuration: 800,
    });
    setShowRecenterButton(false);
  }

  function handleMapPress() {
    deselectPin();
  }

  if (profilesError && eventsError) {
    return (
      <ErrorState
        message="Couldn't load map data"
        onRetry={() => {
          refetchProfiles();
          refetchMapEvents();
        }}
      />
    );
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
        onCameraChanged={(payload: any) => {
          if (payload.type === "user") {
            setShowRecenterButton(true);
          }
          const z = payload.properties?.zoom;
          if (z != null && Math.abs(z - lastZoomRef.current) >= 0.3) {
            lastZoomRef.current = z;
            setCurrentZoom(z);
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
          <UserLocation
            visible
            onUpdate={handleUserLocationUpdate}
            minDisplacement={5}
          />
        )}

        {/* Creator pins */}
        {mode === "CREATORS" &&
          profileGroups.map((group) => {
            if (group.kind === "cluster") {
              return (
                <MarkerView
                  key={group.items
                    .map((p) => p.id)
                    .sort()
                    .join("+")}
                  coordinate={[group.lng, group.lat]}
                  anchor={{ x: 0.5, y: 0.5 }}
                  allowOverlap
                >
                  <TouchableOpacity
                    onPress={() => handleClusterPress(group.lng, group.lat)}
                    activeOpacity={0.8}
                  >
                    <CreatorClusterPin items={group.items} />
                  </TouchableOpacity>
                </MarkerView>
              );
            }
            const profile = group.item;
            const isSelected =
              selectedPin?.type === "CREATOR" &&
              selectedPin.data.id === profile.id;
            return (
              <MarkerView
                key={profile.id}
                coordinate={[profile.longitude!, profile.latitude!]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap
              >
                <View
                  style={isSelected ? styles.hiddenPin : undefined}
                  pointerEvents={isSelected ? "none" : "auto"}
                >
                  <TouchableOpacity
                    onPress={() =>
                      selectPin({ type: "CREATOR", data: profile })
                    }
                    activeOpacity={0.8}
                    accessibilityLabel={`${profile.display_name} on map`}
                    accessibilityRole="button"
                  >
                    <CreatorPin
                      initial={profile.display_name.charAt(0).toUpperCase()}
                      imageUrl={profile.profile_picture_url}
                      isSelected={false}
                    />
                  </TouchableOpacity>
                </View>
              </MarkerView>
            );
          })}

        {/* Selected creator pin — rendered last to stay on top */}
        {mode === "CREATORS" &&
          topPinData?.type === "CREATOR" &&
          (() => {
            const profile = topPinData.data;
            const isSelected =
              selectedPin?.type === "CREATOR" &&
              selectedPin.data.id === profile.id;
            return (
              <MarkerView
                key={`top-${profile.id}`}
                coordinate={[profile.longitude!, profile.latitude!]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap
              >
                <TouchableOpacity
                  onPress={() => selectPin({ type: "CREATOR", data: profile })}
                  activeOpacity={0.8}
                >
                  <CreatorPin
                    initial={profile.display_name.charAt(0).toUpperCase()}
                    imageUrl={profile.profile_picture_url}
                    isSelected={isSelected}
                  />
                </TouchableOpacity>
              </MarkerView>
            );
          })()}

        {/* Event pins */}
        {mode === "EVENTS" &&
          eventGroups.map((group) => {
            if (group.kind === "cluster") {
              return (
                <MarkerView
                  key={group.items
                    .map((e) => e.id)
                    .sort()
                    .join("+")}
                  coordinate={[group.lng, group.lat]}
                  anchor={{ x: 0.5, y: 0.5 }}
                  allowOverlap
                >
                  <TouchableOpacity
                    onPress={() => handleClusterPress(group.lng, group.lat)}
                    activeOpacity={0.8}
                  >
                    <EventClusterPin items={group.items} />
                  </TouchableOpacity>
                </MarkerView>
              );
            }
            const event = group.item;
            const isSelected =
              selectedPin?.type === "EVENT" && selectedPin.data.id === event.id;
            const color = EVENT_TYPE_COLOR[event.event_type];
            const isExclusive = event.privacy === "EXCLUSIVE";
            const [dlat, dlng] = isExclusive
              ? getExclusiveOffset(event.id)
              : [0, 0];
            return (
              <MarkerView
                key={event.id}
                coordinate={[event.longitude + dlng, event.latitude + dlat]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap
              >
                <View
                  style={isSelected ? styles.hiddenPin : undefined}
                  pointerEvents={isSelected ? "none" : "auto"}
                >
                  <TouchableOpacity
                    onPress={() => selectPin({ type: "EVENT", data: event })}
                    activeOpacity={0.8}
                    accessibilityLabel={`${event.title} on map`}
                    accessibilityRole="button"
                  >
                    <View>
                      <EventPin
                        initial={event.event_type.charAt(0)}
                        imageUrl={event.cover_image_url ?? undefined}
                        color={color}
                        isSelected={false}
                      />
                      {isExclusive && (
                        <View style={styles.exclusivePinBadge}>
                          <Ionicons name="lock-closed" size={8} color="#fff" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </MarkerView>
            );
          })}

        {/* Selected event pin — rendered last to stay on top */}
        {mode === "EVENTS" &&
          topPinData?.type === "EVENT" &&
          (() => {
            const event = topPinData.data;
            const isSelected =
              selectedPin?.type === "EVENT" && selectedPin.data.id === event.id;
            const color = EVENT_TYPE_COLOR[event.event_type];
            const isExclusive = event.privacy === "EXCLUSIVE";
            const [dlat, dlng] = isExclusive
              ? getExclusiveOffset(event.id)
              : [0, 0];
            return (
              <MarkerView
                key={`top-${event.id}`}
                coordinate={[event.longitude + dlng, event.latitude + dlat]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap
              >
                <TouchableOpacity
                  onPress={() => selectPin({ type: "EVENT", data: event })}
                  activeOpacity={0.8}
                >
                  <View>
                    <EventPin
                      initial={event.event_type.charAt(0)}
                      imageUrl={event.cover_image_url ?? undefined}
                      color={color}
                      isSelected={isSelected}
                    />
                    {isExclusive && (
                      <View style={styles.exclusivePinBadge}>
                        <Ionicons name="lock-closed" size={8} color="#fff" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </MarkerView>
            );
          })()}
      </MapView>

      {/* Recenter button */}
      {showRecenterButton && locationGranted && (
        <TouchableOpacity
          style={[
            styles.recenterButton,
            { bottom: insets.bottom + Spacing.lg },
          ]}
          onPress={handleRecenter}
          activeOpacity={0.8}
          accessibilityLabel="Recenter map on my location"
          accessibilityRole="button"
        >
          <Ionicons name="locate" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

      {/* Filter bar — floats above map */}
      <SafeAreaView style={styles.filterBar} edges={["top"]}>
        {/* Top row: mode toggle + search button */}
        <View style={styles.topRow}>
          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === "CREATORS" && styles.modeButtonActive,
              ]}
              onPress={() => handleSwitchMode("CREATORS")}
              activeOpacity={0.8}
              accessibilityLabel="Show creators on map"
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === "CREATORS" }}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "CREATORS" && styles.modeButtonTextActive,
                ]}
              >
                Creators
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === "EVENTS" && styles.modeButtonActive,
              ]}
              onPress={() => handleSwitchMode("EVENTS")}
              activeOpacity={0.8}
              accessibilityLabel="Show events on map"
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === "EVENTS" }}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "EVENTS" && styles.modeButtonTextActive,
                ]}
              >
                Events
              </Text>
            </TouchableOpacity>
          </View>
          {/* Search button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => router.push("/search")}
            activeOpacity={0.8}
            accessibilityLabel="Search creators and events"
            accessibilityRole="button"
          >
            <Ionicons name="search" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Niche filter chips */}
        <NicheFilterBar
          niches={allNiches}
          selectedIds={selectedNicheIds}
          onToggle={handleToggleNiche}
          onClearAll={() => setSelectedNicheIds(new Set())}
          onClearAllExtra={deselectPin}
        />
      </SafeAreaView>

      {/* Bottom preview card — swipe down to dismiss */}
      {topPinData && (
        <SwipeDismissCard
          key={topPinData.data.id}
          visible={selectedPin !== null}
          onDismiss={deselectPin}
          style={[
            styles.card,
            { marginBottom: insets.bottom + Spacing.sm, overflow: "hidden" },
          ]}
        >
          {/* Banner background for creator cards */}
          {topPinData.type === "CREATOR" &&
            topPinData.data.banner_image_url && (
              <>
                <Image
                  source={{ uri: topPinData.data.banner_image_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                <View style={styles.mapBannerOverlay} />
              </>
            )}
          {/* Drag handle */}
          <View style={styles.dragHandle} />
          {/* Dismiss button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={deselectPin}
            accessibilityLabel="Dismiss card"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>

          {topPinData.type === "CREATOR" && (
            <CreatorCard
              profile={topPinData.data}
              onViewProfile={() =>
                router.push(`/profile/${topPinData.data.id}`)
              }
            />
          )}
          {topPinData.type === "EVENT" && (
            <EventCard
              event={topPinData.data}
              onViewEvent={() => router.push(`/event/${topPinData.data.id}`)}
            />
          )}
        </SwipeDismissCard>
      )}
      <IntroModal
        visible={introModal.visible}
        onDismiss={introModal.dismiss}
        title="Explore the Map"
        body="See creators and events pinned around the city. Tap any pin to preview details, then explore your neighbourhood."
        icon="map-outline"
      />
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
  const visibleNiches = profile.niches.slice(0, 5);
  const overflow = profile.niches.length - 5;

  return (
    <>
      <View style={styles.cardRow}>
        {profile.profile_picture_url ? (
          <Image
            source={{ uri: profile.profile_picture_url }}
            style={styles.cardAvatar}
          />
        ) : (
          <View style={[styles.cardAvatar, styles.cardAvatarPlaceholder]}>
            <Text style={styles.cardAvatarInitial}>
              {profile.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {profile.display_name}
          </Text>
          <Text
            style={[
              styles.cardTypeLabel,
              profile.profile_type === "CREATOR"
                ? styles.cardTypeLabelCreator
                : styles.cardTypeLabelBusiness,
            ]}
          >
            {profile.profile_type === "CREATOR" ? "Creator" : "Business"}
          </Text>
        </View>
      </View>
      {visibleNiches.length > 0 && (
        <View style={styles.cardNiches}>
          {visibleNiches.map((n) => (
            <NicheTag key={n.id} name={n.name} color={n.color} />
          ))}
          {overflow > 0 && (
            <View style={styles.nicheOverflowCircle}>
              <Text style={styles.nicheOverflowCircleText}>+{overflow}</Text>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.viewButton}
        onPress={onViewProfile}
        activeOpacity={0.8}
      >
        <Text style={styles.viewButtonText}>View Profile</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.textInverse} />
      </TouchableOpacity>
    </>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  onViewEvent,
}: {
  event: EventWithHost;
  onViewEvent: () => void;
}) {
  const color = EVENT_TYPE_COLOR[event.event_type] ?? Colors.textTertiary;
  const label = EVENT_TYPE_LABEL[event.event_type];

  return (
    <>
      <View style={styles.cardRow}>
        {event.cover_image_url ? (
          <Image
            source={{ uri: event.cover_image_url }}
            style={styles.eventCoverThumb}
          />
        ) : (
          <View style={[styles.eventTypeDot, { backgroundColor: color }]}>
            <Text style={styles.eventTypeDotInitial}>{label.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <View style={styles.eventTitleRow}>
            <Text style={[styles.cardName, { flex: 1 }]} numberOfLines={2}>
              {event.title}
            </Text>
          </View>
          <View style={styles.eventBadges}>
            <View
              style={[
                styles.eventTypeBadge,
                { backgroundColor: color + "25", borderColor: color + "60" },
              ]}
            >
              <Text style={[styles.eventTypeBadgeText, { color }]}>
                {label}
              </Text>
            </View>
            {event.privacy === "EXCLUSIVE" && (
              <View style={styles.exclusiveBadge}>
                <Ionicons
                  name="lock-closed"
                  size={9}
                  color={Colors.textTertiary}
                />
                <Text style={styles.exclusiveBadgeText}>Exclusive</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.eventMetaRow}>
        <View style={styles.eventMeta}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color={Colors.textTertiary}
          />
          <Text style={styles.eventMetaText}>
            {formatEventDate(event.start_time)}
          </Text>
        </View>
        <View style={[styles.eventMeta, styles.eventMetaAddress]}>
          <Ionicons
            name={
              event.privacy === "EXCLUSIVE"
                ? "lock-closed-outline"
                : "location-outline"
            }
            size={13}
            color={Colors.textTertiary}
          />
          <Text style={styles.eventMetaText} numberOfLines={1}>
            {event.privacy === "EXCLUSIVE"
              ? "Location hidden"
              : event.address_name}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.viewButton}
        onPress={onViewEvent}
        activeOpacity={0.8}
      >
        <Text style={styles.viewButtonText}>View Event</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.textInverse} />
      </TouchableOpacity>
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

  hiddenPin: {
    opacity: 0,
  },

  // Cluster stacked thumbnails
  clusterThumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  clusterThumbCircle: {
    borderRadius: THUMB / 2,
    backgroundColor: Colors.primary,
  },
  clusterThumbSquare: {
    borderRadius: 6,
  },
  clusterThumbImage: {
    width: "100%",
    height: "100%",
  },
  clusterThumbInitial: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: "#ffffff",
  },
  clusterOverflow: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.primary,
  },
  clusterOverflowText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },

  // Pins
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  creatorPin: {
    backgroundColor: Colors.primary,
  },
  eventPin: {
    borderRadius: 8,
  },
  pinSelected: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  eventPinSelected: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  pinInitial: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: "#ffffff",
  },
  pinImage: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  eventPinImage: {
    borderRadius: 8,
  },

  // Recenter button
  recenterButton: {
    position: "absolute",
    right: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Filter bar
  filterBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  modeToggle: {
    flexDirection: "row",
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    gap: 2,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    alignItems: "center",
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
  // Bottom card banner overlay
  mapBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.60)",
  },

  // Bottom card
  card: {
    position: "absolute",
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
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: Spacing.xs,
  },
  dismissButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },

  // Shared card row
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cardAvatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.avatar,
  },
  cardAvatarPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },

  // Creator card
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  creatorBadge: {
    backgroundColor: Colors.creatorBadge + "20",
    borderColor: Colors.creatorBadge + "40",
  },
  businessBadge: {
    backgroundColor: Colors.businessBadge + "20",
    borderColor: Colors.businessBadge + "40",
  },
  typeBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
  creatorBadgeText: { color: Colors.creatorBadge },
  businessBadgeText: { color: Colors.businessBadge },
  cardTypeLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
  },
  cardTypeLabelCreator: {
    color: Colors.creatorBadge,
  },
  cardTypeLabelBusiness: {
    color: Colors.businessBadge,
  },
  cardNiches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    alignItems: "center",
  },
  nicheOverflowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  nicheOverflowCircleText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  eventTypeDotInitial: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: "#ffffff",
  },
  eventCoverThumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
  },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  eventBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  exclusivePinBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  exclusiveBadge: {
    flexDirection: "row",
    alignItems: "center",
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
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  eventTypeBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  eventMetaAddress: {
    flexShrink: 1,
    maxWidth: "50%",
  },
  eventMetaText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
});
