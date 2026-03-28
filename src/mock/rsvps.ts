import type { Profile } from '../types';
import { MOCK_PROFILES } from './profiles';

/** Current mock user's RSVPs (eventId → RSVPStatus) */
export const MOCK_MY_RSVPS: Record<string, 'INTERESTED' | 'REQUESTED' | 'GOING'> = {
  'e2': 'INTERESTED',  // Beat Cypher (PUBLIC) — watching with interest
  'e3': 'GOING',       // Creator Networking Mixer (PUBLIC) — confirmed attendance
  'e4': 'REQUESTED',   // Glam Lab Workshop (EXCLUSIVE) — awaiting host approval
  'e5': 'GOING',       // Harvest Table Pop-Up (PUBLIC) — confirmed attendance
};

/**
 * Mock users who have REQUESTED access to exclusive events.
 * Only visible to the event host; keyed by eventId.
 */
export const MOCK_EVENT_REQUESTORS: Record<string, Profile[]> = {
  // e1 is the EXCLUSIVE event hosted by p1 (Jordan Ellis / current mock user)
  'e1': [
    MOCK_PROFILES[1], // p2 — Amara Osei
    MOCK_PROFILES[2], // p3
  ],
};
