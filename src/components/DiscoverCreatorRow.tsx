import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PortfolioLightbox } from "./PortfolioLightbox";
import { NicheTag } from "./NicheTag";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import { usePortfolio } from "../hooks/usePortfolio";
import type { ProfileWithNiches } from "../types";

const STRIP_IMAGE_SIZE = 76;
const STRIP_MAX = 5;

interface Props {
  profile: ProfileWithNiches;
}

export function DiscoverCreatorRow({ profile }: Props) {
  const { data: portfolioImages } = usePortfolio(profile.id);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const visibleNiches = profile.niches.slice(0, 2);
  const hasStrip = !!portfolioImages && portfolioImages.length > 0;
  const stripImages = portfolioImages?.slice(0, STRIP_MAX) ?? [];
  const overflowCount = (portfolioImages?.length ?? 0) - STRIP_MAX;

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxVisible(true);
  }

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.creatorRow}
        onPress={() => router.push(`/profile/${profile.id}`)}
        activeOpacity={0.75}
        accessibilityLabel={`${profile.display_name}, ${profile.profile_type === "CREATOR" ? "Creator" : "Business"}`}
        accessibilityRole="button"
      >
        {profile.profile_picture_url ? (
          <Image
            source={{ uri: profile.profile_picture_url }}
            style={styles.creatorAvatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.creatorAvatar, styles.creatorAvatarPlaceholder]}>
            <Text style={styles.creatorAvatarInitial}>
              {profile.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.creatorInfo}>
          <Text style={styles.creatorName} numberOfLines={1}>
            {profile.display_name}
          </Text>
          {visibleNiches.length > 0 && (
            <View style={styles.creatorNiches}>
              {visibleNiches.map((n) => (
                <NicheTag
                  key={n.id}
                  name={n.name}
                  small
                  color={n.color}
                  onPress={() => router.push(`/profiles/${encodeURIComponent(n.name)}` as any)}
                />
              ))}
            </View>
          )}
          <View style={styles.creatorMeta}>
            <Ionicons
              name="location-outline"
              size={12}
              color={Colors.textTertiary}
            />
            <Text style={styles.creatorMetaText}>
              {profile.location_name ?? "Toronto"}
            </Text>
            <Text style={styles.creatorMetaDot}>·</Text>
            <Text style={styles.creatorMetaText}>
              {profile.follower_count} followers
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {hasStrip && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
        >
          {stripImages.map((img, idx) => (
            <TouchableOpacity
              key={img.id}
              style={styles.stripThumb}
              onPress={() => openLightbox(idx)}
              activeOpacity={0.85}
              accessibilityLabel={`Portfolio image ${idx + 1} of ${portfolioImages!.length} for ${profile.display_name}`}
              accessibilityRole="button"
            >
              <Image
                source={{ uri: img.image_url }}
                style={styles.stripImage}
                contentFit="cover"
              />
            </TouchableOpacity>
          ))}
          {overflowCount > 0 && (
            <TouchableOpacity
              style={[styles.stripThumb, styles.overflowBadge]}
              onPress={() => router.push(`/profile/${profile.id}`)}
              activeOpacity={0.85}
              accessibilityLabel={`${overflowCount} more portfolio images`}
              accessibilityRole="button"
            >
              <Text style={styles.overflowText}>+{overflowCount}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <PortfolioLightbox
        images={portfolioImages ?? []}
        initialIndex={lightboxIndex}
        visible={lightboxVisible}
        onClose={() => setLightboxVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  creatorAvatar: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.avatar,
    flexShrink: 0,
  },
  creatorAvatarPlaceholder: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  creatorAvatarInitial: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  creatorInfo: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  creatorName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  creatorNiches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  creatorMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  creatorMetaText: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  creatorMetaDot: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  stripContent: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  stripThumb: {
    width: STRIP_IMAGE_SIZE,
    height: STRIP_IMAGE_SIZE,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  stripImage: {
    width: STRIP_IMAGE_SIZE,
    height: STRIP_IMAGE_SIZE,
    backgroundColor: Colors.surfaceElevated,
  },
  overflowBadge: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  overflowText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
});
