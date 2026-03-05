export const Colors = {
  // Brand
  primary: '#FF5E1A',
  primaryLight: '#FF7A42',
  primaryDark: '#E04000',

  // Backgrounds (dark mode)
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1E1E1E',
  border: '#282828',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#5A5A5A',
  textInverse: '#0A0A0A',

  // Status / RSVP
  interested: '#F59E0B',
  going: '#22C55E',
  cancelled: '#EF4444',

  // Tab bar
  tabActive: '#FF5E1A',
  tabInactive: '#5A5A5A',
  tabBackground: '#0F0F0F',

  // Niche chips
  chipBackground: '#2A1A0F',
  chipText: '#FF8C55',
  chipBorder: '#4A2A10',

  // Event type badges
  fashionShow: '#EC4899',
  networking: '#3B82F6',
  workshop: '#F59E0B',
  listeningParty: '#8B5CF6',
  community: '#22C55E',
  other: '#6B7280',

  // Profile type badges
  creatorBadge: '#FF5E1A',
  businessBadge: '#0EA5E9',
} as const;

export const Typography = {
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
  card: 14,
  chip: 20,
  avatar: 9999,
} as const;
