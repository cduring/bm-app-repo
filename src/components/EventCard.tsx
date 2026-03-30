import { Ionicons } from "@expo/vector-icons";
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import type { EventWithHost } from "../types";
import { EventTypeBadge } from "./EventTypeBadge";

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface EventCardProps {
  event: EventWithHost;
  onPress: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  const startDate = new Date(event.start_time);
  const month = MONTHS[startDate.getUTCMonth()];
  const day = startDate.getUTCDate();
  const weekday = WEEKDAYS[startDate.getUTCDay()];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${event.title}, ${event.event_type.replace(/_/g, ' ').toLowerCase()}`}
      accessibilityRole="button"
      accessibilityHint="Double tap to view event details"
    >
      {/* Date column */}
      <View style={styles.dateCol}>
        <Text style={styles.month}>{month}</Text>
        <Text style={styles.day}>{day}</Text>
        <Text style={styles.weekday}>{weekday}</Text>
      </View>

      {/* Content — cover image background */}
      <ImageBackground
        source={
          event.cover_image_url ? { uri: event.cover_image_url } : undefined
        }
        style={styles.contentBg}
        imageStyle={styles.contentBgImage}
        resizeMode="cover"
      >
        <View style={styles.contentOverlay}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>

          {/* Badge row */}
          <View style={styles.badgeRow}>
            <EventTypeBadge eventType={event.event_type} small />
            {event.privacy === "EXCLUSIVE" && (
              <View style={styles.exclusiveBadge}>
                <Ionicons name="lock-closed" size={9} color={Colors.primary} />
                <Text style={styles.exclusiveBadgeText}>Exclusive</Text>
              </View>
            )}
            {event.is_recurring && (
              <View style={styles.recurringBadge}>
                <Ionicons
                  name="repeat-outline"
                  size={10}
                  color={Colors.other}
                />
                <Text style={styles.recurringBadgeText}>Recurring</Text>
              </View>
            )}
          </View>

          {/* Attendee counts */}
          <View style={styles.countsRow}>
            <View style={styles.countItem}>
              <View
                style={[styles.dot, { backgroundColor: Colors.interested }]}
              />
              <Text style={styles.countText}>
                {event.interested_count} interested
              </Text>
            </View>
            <View style={styles.countItem}>
              <View style={[styles.dot, { backgroundColor: Colors.going }]} />
              <Text style={styles.countText}>{event.going_count} going</Text>
            </View>
          </View>
        </View>
      </ImageBackground>

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
    flexDirection: "row",
    backgroundColor: "transparent",
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  dateCol: {
    width: 52,
    backgroundColor: Colors.surfaceElevated,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
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
  contentBg: {
    flex: 1,
  },
  contentBgImage: {
    borderTopRightRadius: BorderRadius.card - 1,
    borderBottomRightRadius: BorderRadius.card - 1,
  },
  contentOverlay: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  title: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: "#FFFFFF",
    lineHeight: 24,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    alignItems: "center",
  },
  exclusiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.primary + "20",
    borderWidth: 1,
    borderColor: Colors.primary + "60",
    borderRadius: BorderRadius.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  exclusiveBadgeText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.primary,
  },
  recurringBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.other + "20",
    borderWidth: 1,
    borderColor: Colors.other + "40",
    borderRadius: BorderRadius.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recurringBadgeText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.other,
  },

  countsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  countItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  countText: {
    fontSize: Typography.size.sm,
    color: "rgba(255,255,255,0.65)",
  },
  chevron: {
    alignSelf: "center",
    paddingRight: Spacing.sm,
    position: "absolute",
    right: 0,
  },
});
