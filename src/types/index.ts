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
  banner_image_url?: string;
  location_name?: string;
  location_fsa?: string;
  latitude?: number;
  longitude?: number;
  follower_count: number;
  following_count: number;
  created_at: string;
}

export interface ProfileSettings {
  profile_id: string;
  push_token: string | null;
  notifications_enabled: boolean;
}

// ─── Niches ──────────────────────────────────────────────────────────────────

export interface Niche {
  id: string;
  name: string;
  color?: string;
}

// ─── External Links ──────────────────────────────────────────────────────────

export type PlatformName =
  | 'Instagram'
  | 'TikTok'
  | 'YouTube'
  | 'X'
  | 'Twitch'
  | 'Spotify'
  | 'SoundCloud'
  | 'LinkedIn'
  | 'Pinterest'
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
  | 'CONCERT'
  | 'FESTIVAL'
  | 'NIGHTLIFE'
  | 'CONFERENCE'
  | 'SEMINAR'
  | 'WEBINAR'
  | 'MEETUP'
  | 'DINING'
  | 'HAPPY_HOUR'
  | 'GALA'
  | 'AWARDS'
  | 'WELLNESS_SESSION'
  | 'TOURNAMENT'
  | 'DROP_IN'
  | 'PARTY'
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

// ─── Portfolio ───────────────────────────────────────────────────────────────

export interface PortfolioImage {
  id: string;
  profile_id: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'new_follower'
  | 'new_rsvp_going'
  | 'new_rsvp_requested'
  | 'rsvp_approved'
  | 'rsvp_declined';

export interface AppNotification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  actor_id: string | null;
  event_id: string | null;
  read_at: string | null;
  created_at: string;
  actor?: Profile;
  event?: Pick<Event, 'id' | 'title' | 'cover_image_url'>;
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

// ─── Moderation ───────────────────────────────────────────────────────────────

export interface BlockedUserEntry {
  id: string;
  blocked_id: string;
  created_at: string;
  blocked_profile: Pick<Profile, 'id' | 'display_name' | 'profile_picture_url'>;
}

export interface ContentReport {
  id: string;
  reporter_id: string;
  reported_profile_id: string | null;
  reported_event_id: string | null;
  reason: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  created_at: string;
}
