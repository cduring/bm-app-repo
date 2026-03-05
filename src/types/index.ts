// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export type ProfileType = 'CREATOR' | 'BUSINESS';

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  bio: string;
  profile_type: ProfileType;
  years_in_business?: number;
  profile_picture_url?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  follower_count: number;
  following_count: number;
  created_at: string;
}

// ─── Niches ──────────────────────────────────────────────────────────────────

export interface Niche {
  id: string;
  name: string;
}

export interface ProfileNiche {
  profile_id: string;
  niche_id: string;
}

// ─── External Links ──────────────────────────────────────────────────────────

export type PlatformName =
  | 'Instagram'
  | 'TikTok'
  | 'YouTube'
  | 'Twitter'
  | 'Spotify'
  | 'SoundCloud'
  | 'LinkedIn'
  | 'Website'
  | 'Other';

export interface ExternalLink {
  id: string;
  profile_id: string;
  platform_name: PlatformName;
  url: string;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type EventType =
  | 'FASHION_SHOW'
  | 'NETWORKING'
  | 'WORKSHOP'
  | 'LISTENING_PARTY'
  | 'COMMUNITY'
  | 'OTHER';

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';

export interface Event {
  id: string;
  host_id: string;
  title: string;
  description: string;
  event_type: EventType;
  start_time: string;
  end_time: string;
  latitude: number;
  longitude: number;
  address_name: string;
  status: EventStatus;
  created_at: string;
}

// ─── RSVPs ───────────────────────────────────────────────────────────────────

export type RSVPStatus = 'INTERESTED' | 'GOING';

export interface EventRSVP {
  event_id: string;
  profile_id: string;
  status: RSVPStatus;
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export interface Post {
  id: string;
  author_id: string;
  media_url: string;
  caption: string;
  created_at: string;
}

// ─── Social Graph ─────────────────────────────────────────────────────────────

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

// ─── Portfolio ───────────────────────────────────────────────────────────────

export interface PortfolioImage {
  id: string;
  profile_id: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

// ─── Enriched types (joined queries) ─────────────────────────────────────────

/** Profile with its associated niches resolved */
export interface ProfileWithNiches extends Profile {
  niches: Niche[];
  external_links: ExternalLink[];
}

/** Event with host profile attached */
export interface EventWithHost extends Event {
  host: Profile;
  interested_count: number;
  going_count: number;
}
