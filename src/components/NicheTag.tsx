import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../constants/theme';

interface NicheTagProps {
  name: string;
  small?: boolean;
}

export function NicheTag({ name, small = false }: NicheTagProps) {
  return (
    <View style={[styles.chip, small && styles.chipSmall]}>
      <Text style={[styles.text, small && styles.textSmall]}>{name}</Text>
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
