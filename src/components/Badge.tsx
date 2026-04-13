import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '../constants/theme';

interface BadgeProps {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  color?: string;
  size?: 'small' | 'medium';
}

export function Badge({
  text,
  icon,
  iconSize = 9,
  color = Colors.primary,
  size = 'small',
}: BadgeProps) {
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color + '20',
          borderColor: color + '60',
          paddingHorizontal: isSmall ? 6 : 8,
          paddingVertical: isSmall ? 2 : 3,
        },
      ]}
    >
      {icon && <Ionicons name={icon} size={iconSize} color={color} />}
      <Text
        style={[
          styles.text,
          {
            color,
            fontSize: isSmall ? Typography.size.xs : Typography.size.sm,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: BorderRadius.chip,
  },
  text: {
    fontWeight: Typography.weight.medium,
  },
});
