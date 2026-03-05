import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../../src/constants/theme';

export default function CreateScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create</Text>
      <Text style={styles.subtitle}>Create an event or post coming in Stage 4</Text>
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
