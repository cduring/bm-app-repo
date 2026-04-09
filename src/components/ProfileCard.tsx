import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import type { Niche, Profile } from "../types";
import { NicheTag } from "./NicheTag";

interface ProfileCardProps {
  profile: Profile;
  niches: Niche[];
  onPress?: () => void;
}

export function ProfileCard({ profile, niches, onPress }: ProfileCardProps) {
  const isCreator = profile.profile_type === "CREATOR";
  const visibleNiches = niches.slice(0, 3);
  const overflowCount = niches.length - visibleNiches.length;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={`${profile.display_name}, ${isCreator ? "Creator" : "Business"}`}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={onPress ? "Double tap to view profile" : undefined}
    >
      {profile.profile_picture_url ? (
        <Image
          source={{ uri: profile.profile_picture_url }}
          style={styles.avatar}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>
            {profile.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.display_name}
          </Text>
        </View>

        {niches.length > 0 && (
          <View style={styles.niches}>
            {visibleNiches.map((niche) => (
              <NicheTag key={niche.id} name={niche.name} small color={niche.color} />
            ))}
            {overflowCount > 0 && (
              <Text style={styles.overflow}>+{overflowCount}</Text>
            )}
          </View>
        )}
      </View>

      <View
        style={[styles.dot, isCreator ? styles.creatorDot : styles.businessDot]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.avatar,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  name: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  niches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    alignItems: "center",
  },
  overflow: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    alignSelf: "center",
  },
  dot: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  creatorDot: {
    backgroundColor: Colors.creatorBadge,
  },
  businessDot: {
    backgroundColor: Colors.businessBadge,
  },
});
