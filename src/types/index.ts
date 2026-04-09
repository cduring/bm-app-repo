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
  location_fsa?: string;
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
  color?: string;
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
  | 'Eventbrite'
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
  | 'PERFORMANCE'
  | 'OPEN_MIC'
  | 'SCREENING'
  | 'LISTENING_PARTY'
  | 'STUDIO_SESSION'
  | 'WORKSHOP'
  | 'MASTERCLASS'
  | 'PANEL'
  | 'CRITIQUE_SESSION'
  | 'HACKATHON'
  | 'NETWORKING'
  | 'COMMUNITY'
  | 'COLLAB_SESSION'
  | 'OPEN_CALL'
  | 'POP_UP'
  | 'MARKET'
  | 'LAUNCH_PARTY'
  | 'EXHIBITION'
  | 'OPEN_STUDIO'
  | 'PHOTOSHOOT'
  | 'GROUP_RUN'
  | 'FITNESS_CLASS'
  | 'RETREAT'
  | 'GAME_NIGHT'
  | 'BLOCK_PARTY'
  | 'COMPETITION'
  | 'CHARITY'
  | 'VIRTUAL_EVENT'
  | 'OTHER';

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';

export type EventPrivacy = 'PUBLIC' | 'EXCLUSIVE';

export interface Event {
  id: string;
  host_id: string;
  title: string;
  description: string;
  event_type: EventType;
  privacy: EventPrivacy;
  start_time: string;
  end_time: string;
  latitude: number;
  longitude: number;
  address_name: string;
  status: EventStatus;
  is_recurring: boolean;
  recurrence_rule: string | null;
  recurrence_end_date: string | null;
  parent_event_id: string | null;
  cover_image_url: string | null;
  created_at: string;
}

// ─── RSVPs ───────────────────────────────────────────────────────────────────

export type RSVPStatus = 'INTERESTED' | 'REQUESTED' | 'GOING' | 'DECLINED';

export interface EventRSVP {
  event_id: string;
  profile_id: string;
  status: RSVPStatus;
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
  niches: Niche[];
  requested_count: number;
}
