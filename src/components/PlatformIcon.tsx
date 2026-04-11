import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import type { PlatformName } from '../types';
import { PLATFORM_ICONS } from '../constants/platformIcons';

interface PlatformIconProps {
  platform: PlatformName;
  size: number;
  color: string;
}

export function PlatformIcon({ platform, size, color }: PlatformIconProps) {
  if (platform === 'X') {
    return <FontAwesome6 name="x-twitter" size={size} color={color} />;
  }
  return (
    <Ionicons
      name={PLATFORM_ICONS[platform] as any}
      size={size}
      color={color}
    />
  );
}
