import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Background glow */}
      <View style={styles.glowWrap} pointerEvents="none">
        <View style={styles.glow} />
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.wordmark}>BrandMe</Text>
        <Text style={styles.location}>Toronto, ON</Text>
        <Text style={styles.tagline}>
          Discover creators, attend events,{'\n'}and build your brand.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => router.push('/(auth)/sign-up')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.7}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={styles.secondaryButtonText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
  },
  glowWrap: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 500,
    height: 500,
    overflow: 'hidden',
  },
  glow: {
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: Colors.primary,
    opacity: 0.07,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: Spacing.xl,
  },
  wordmark: {
    fontSize: 52,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    letterSpacing: -1.5,
    marginBottom: Spacing.sm,
  },
  location: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.lg,
  },
  tagline: {
    fontSize: Typography.size.lg,
    color: Colors.textSecondary,
    lineHeight: 28,
  },
  actions: {
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  secondaryButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
});
