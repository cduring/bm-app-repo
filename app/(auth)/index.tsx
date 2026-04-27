import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import TorontoSkyline from "../../src/components/TorontoSkyline";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";

export default function WelcomeScreen() {
  const buttonsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(buttonsOpacity, {
      toValue: 1,
      duration: 600,
      delay: 1500,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Image
            source={require("../../assets/images/loam-wordmark.png")}
            style={styles.wordmark}
            contentFit="contain"
          />
          <Text style={styles.tagline}>
            Toronto's creators, on one map. Find your people, by niche and by
            neighborhood.
          </Text>
        </View>

        <Animated.View style={[styles.actions, { opacity: buttonsOpacity }]}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => router.push("/(auth)/sign-up")}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/(auth)/sign-in")}
          >
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={styles.skyline}>
        <TorontoSkyline />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  hero: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  wordmark: {
    width: 230,
    height: 67,
    marginBottom: Spacing.md,
  },
  tagline: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
    color: Colors.textPrimary,
    textAlign: "center",
    lineHeight: 24,
  },
  actions: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
  },
  primaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  loginLink: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
  skyline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
