import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { usePostHog } from 'posthog-react-native';
import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';
import { useAuth } from './auth';
import { useProfile } from '../hooks/useProfile';
import {
  useMyRSVPs,
  useSetRSVP,
  useEventRequestors,
  useApproveRequest,
  useDeclineRequest,
} from '../hooks/useRSVP';
import { scheduleEventReminder, cancelEventReminder } from '../hooks/useNotifications';
import type { RSVPStatus, Profile, Event } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type RSVPMap = Record<string, RSVPStatus>;
type RequestorMap = Record<string, Profile[]>;

interface RSVPContextValue {
  // Current user's RSVPs
  myRSVPs: RSVPMap;
  setRSVP: (eventId: string, status: RSVPStatus | null, eventMeta?: { title: string; startTime: string }) => void;
  getRSVP: (eventId: string) => RSVPStatus | null;
  refetchMyRSVPs: () => Promise<any>;

  // Attendance requests for exclusive events the user hosts
  eventRequestors: RequestorMap;
  approveRequest: (eventId: string, profileId: string) => void;
  declineRequest: (eventId: string, profileId: string) => void;
  getPendingCount: (eventId: string) => number;
  refetchRequestors: () => Promise<any>;

  // Event edits / cancellations (persisted to Supabase)
  cancelEvent: (eventId: string) => Promise<void>;
  updateEventLocally: (eventId: string, updates: Partial<Event>) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const RSVPContext = createContext<RSVPContextValue | null>(null);

export function RSVPProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user?.id;

  // Get current user's profile ID
  const { data: profileData } = useProfile(userId);
  const profileId = profileData?.profile.id;

  // ── RSVP data from Supabase ──
  const { data: rsvpData, refetch: refetchMyRSVPs } = useMyRSVPs(profileId);
  const { data: requestorData, refetch: refetchRequestors } = useEventRequestors(profileId);

  // Local optimistic state (mirrors Supabase, updated immediately on mutation)
  const [localRSVPs, setLocalRSVPs] = useState<RSVPMap>({});
  const [localRequestors, setLocalRequestors] = useState<RequestorMap>({});

  // Sync local state when Supabase data arrives
  useEffect(() => {
    if (rsvpData) setLocalRSVPs(rsvpData);
  }, [rsvpData]);

  useEffect(() => {
    if (requestorData) setLocalRequestors(requestorData);
  }, [requestorData]);

  // ── Analytics ──
  const posthog = usePostHog();

  // ── Mutations ──
  const setRSVPMutation = useSetRSVP();
  const approveMutation = useApproveRequest();
  const declineMutation = useDeclineRequest();

  // ── RSVP actions ──

  function setRSVP(eventId: string, status: RSVPStatus | null, eventMeta?: { title: string; startTime: string }) {
    if (!profileId) return;

    const previousRSVPs = { ...localRSVPs };

    // Optimistic update
    setLocalRSVPs(prev => {
      const next = { ...prev };
      if (status === null) {
        delete next[eventId];
      } else {
        next[eventId] = status;
      }
      return next;
    });

    // Track RSVP
    posthog?.capture('event_rsvp', { event_id: eventId, status: status ?? 'removed' });

    // Schedule / cancel event reminder notification
    if (status === 'GOING' && eventMeta) {
      scheduleEventReminder(eventId, eventMeta.title, eventMeta.startTime);
    } else if (status === null || status === 'INTERESTED') {
      cancelEventReminder(eventId);
    }

    // Persist to Supabase
    setRSVPMutation.mutate({ eventId, profileId, status }, {
      onError: (err) => {
        setLocalRSVPs(previousRSVPs);
        Sentry.captureException(err, { tags: { context: 'rsvp_set' } });
        Alert.alert('Action failed', 'We encountered an error trying to update your RSVP. Please try again.');
      },
    });
  }

  function getRSVP(eventId: string): RSVPStatus | null {
    return localRSVPs[eventId] ?? null;
  }

  // ── Request management ──

  function approveRequest(eventId: string, requestorProfileId: string) {
    if (!profileId) return;

    // Optimistic update
    setLocalRequestors(prev => ({
      ...prev,
      [eventId]: (prev[eventId] ?? []).filter(p => p.id !== requestorProfileId),
    }));

    approveMutation.mutate({ eventId, requestorProfileId, hostProfileId: profileId }, {
      onError: (err) => {
        Sentry.captureException(err, { tags: { context: 'rsvp_approve' } });
        Alert.alert('Action failed', 'We encountered an error trying to approve this request. Please try again.');
      },
    });
  }

  function declineRequest(eventId: string, requestorProfileId: string) {
    if (!profileId) return;

    // Optimistic update
    setLocalRequestors(prev => ({
      ...prev,
      [eventId]: (prev[eventId] ?? []).filter(p => p.id !== requestorProfileId),
    }));

    declineMutation.mutate({ eventId, requestorProfileId, hostProfileId: profileId }, {
      onError: (err) => {
        Sentry.captureException(err, { tags: { context: 'rsvp_decline' } });
        Alert.alert('Action failed', 'We encountered an error trying to decline this request. Please try again.');
      },
    });
  }

  function getPendingCount(eventId: string): number {
    return (localRequestors[eventId] ?? []).length;
  }

  // ── Event cancel / edit (writes to Supabase, then invalidates queries) ──

  async function cancelEvent(eventId: string) {
    const { error } = await supabase
      .from('events')
      .update({ status: 'CANCELLED' })
      .eq('id', eventId);
    if (error) {
      Sentry.captureException(error, { tags: { context: 'event_cancel' } });
      Alert.alert('Action failed', 'We encountered an error trying to cancel your event. Please try again.');
    } else {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['hostedEvents'] });
    }
  }

  async function updateEventLocally(eventId: string, updates: Partial<Event>) {
    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId);
    if (error) {
      Sentry.captureException(error, { tags: { context: 'event_update' } });
      Alert.alert('Action failed', 'We encountered an error trying to save your changes. Please try again.');
    } else {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['hostedEvents'] });
    }
  }

  return (
    <RSVPContext.Provider
      value={{
        myRSVPs: localRSVPs,
        setRSVP,
        getRSVP,
        refetchMyRSVPs,
        eventRequestors: localRequestors,
        approveRequest,
        declineRequest,
        getPendingCount,
        refetchRequestors,
        cancelEvent,
        updateEventLocally,
      }}
    >
      {children}
    </RSVPContext.Provider>
  );
}

export function useRSVP() {
  const ctx = useContext(RSVPContext);
  if (!ctx) throw new Error('useRSVP must be used within RSVPProvider');
  return ctx;
}
