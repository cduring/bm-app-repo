import type { PlatformName } from '../types';

export const PLATFORMS: PlatformName[] = [
  'Instagram',
  'TikTok',
  'YouTube',
  'X',
  'Twitch',
  'Spotify',
  'SoundCloud',
  'LinkedIn',
  'Pinterest',
  'Eventbrite',
  'Website',
  'Other',
];

// Platforms that take a username/handle — URL is constructed automatically.
// Platforms NOT listed here (Spotify, Eventbrite, Website, Other) take a full URL.
export const PLATFORM_HANDLE_CONFIG: Partial<
  Record<PlatformName, { prefix: string; buildUrl: (handle: string) => string }>
> = {
  Instagram: {
    prefix: 'instagram.com/',
    buildUrl: (h) => `https://instagram.com/${h}`,
  },
  TikTok: {
    prefix: 'tiktok.com/@',
    buildUrl: (h) => `https://tiktok.com/@${h.replace(/^@/, '')}`,
  },
  YouTube: {
    prefix: 'youtube.com/@',
    buildUrl: (h) => `https://youtube.com/@${h.replace(/^@/, '')}`,
  },
  X: {
    prefix: 'x.com/',
    buildUrl: (h) => `https://x.com/${h.replace(/^@/, '')}`,
  },
  Twitch: {
    prefix: 'twitch.tv/',
    buildUrl: (h) => `https://twitch.tv/${h}`,
  },
  SoundCloud: {
    prefix: 'soundcloud.com/',
    buildUrl: (h) => `https://soundcloud.com/${h}`,
  },
  LinkedIn: {
    prefix: 'linkedin.com/in/',
    buildUrl: (h) => `https://linkedin.com/in/${h}`,
  },
  Pinterest: {
    prefix: 'pinterest.com/',
    buildUrl: (h) => `https://pinterest.com/${h}`,
  },
};
