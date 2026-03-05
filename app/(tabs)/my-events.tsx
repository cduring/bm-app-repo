import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../../src/constants/theme';

export default function MyEventsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Events</Text>
      <Text style={styles.subtitle}>Interested & Going event lists coming in Stage 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
  },
});
