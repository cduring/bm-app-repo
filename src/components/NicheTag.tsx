import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../constants/theme';

interface NicheTagProps {
  name: string;
  small?: boolean;
  color?: string;
}

export function NicheTag({ name, small = false, color }: NicheTagProps) {
  const chipStyle = color
    ? { backgroundColor: color + '20', borderColor: color + '70' }
    : undefined;
  const textStyle = color ? { color } : undefined;

  return (
    <View
      style={[styles.chip, small && styles.chipSmall, chipStyle]}
      accessibilityRole="text"
      accessibilityLabel={name}
    >
      <Text style={[styles.text, small && styles.textSmall, textStyle]}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: Colors.chipBackground,
    borderWidth: 1,
    borderColor: Colors.chipBorder,
    borderRadius: BorderRadius.chip,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  chipSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.chipText,
  },
  textSmall: {
    fontSize: Typography.size.xs,
  },
});
