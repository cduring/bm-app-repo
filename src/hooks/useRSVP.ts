import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { RSVPStatus, Profile } from '../types';

type RSVPMap = Record<string, RSVPStatus>;
type RequestorMap = Record<string, Profile[]>;

// ─── Read: current user's RSVPs ───────────────────────────────────────────────

export function useMyRSVPs(profileId: string | undefined) {
  return useQuery<RSVPMap>({
    queryKey: ['myRSVPs', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('event_id, status')
        .eq('profile_id', profileId!);
      if (error) throw error;
      const map: RSVPMap = {};
      for (const row of data ?? []) {
        map[row.event_id] = row.status as RSVPStatus;
      }
      return map;
    },
    enabled: !!profileId,
    staleTime: 30 * 1000,
  });
}

// ─── Write: upsert or remove an RSVP ─────────────────────────────────────────

export function useSetRSVP() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      profileId,
      status,
    }: {
      eventId: string;
      profileId: string;
      status: RSVPStatus | null;
    }) => {
      if (status === null) {
        const { error } = await supabase
          .from('event_rsvps')
          .delete()
          .eq('event_id', eventId)
          .eq('profile_id', profileId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_rsvps')
          .upsert(
            { event_id: eventId, profile_id: profileId, status },
            { onConflict: 'event_id,profile_id' },
          );
        if (error) throw error;
      }
    },
    onSuccess: (_data, { profileId, eventId }) => {
      qc.invalidateQueries({ queryKey: ['myRSVPs', profileId] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// ─── Read: REQUESTED RSVPs for events hosted by this profile ──────────────────

export function useEventRequestors(profileId: string | undefined) {
  return useQuery<RequestorMap>({
    queryKey: ['eventRequestors', profileId],
    queryFn: async () => {
      // Step 1: get IDs of events hosted by this profile
      const { data: hostedEvents, error: eventsErr } = await supabase
        .from('events')
        .select('id')
        .eq('host_id', profileId!);
      if (eventsErr) throw eventsErr;

      const hostedIds = (hostedEvents ?? []).map((e: { id: string }) => e.id);
      if (hostedIds.length === 0) return {};

      // Step 2: get REQUESTED RSVPs for those events, joined with profiles
      const { data: rows, error: rsvpErr } = await supabase
        .from('event_rsvps')
        .select('event_id, profile:profiles!profile_id(*)')
        .in('event_id', hostedIds)
        .eq('status', 'REQUESTED');
      if (rsvpErr) throw rsvpErr;

      const map: RequestorMap = {};
      for (const row of rows ?? []) {
        if (!map[row.event_id]) map[row.event_id] = [];
        map[row.event_id].push(row.profile as unknown as Profile);
      }
      return map;
    },
    enabled: !!profileId,
    staleTime: 30 * 1000,
  });
}

// ─── Write: approve a request (REQUESTED → GOING) ────────────────────────────

export function useApproveRequest() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      requestorProfileId,
    }: {
      eventId: string;
      requestorProfileId: string;
      hostProfileId: string;
    }) => {
      const { error } = await supabase
        .from('event_rsvps')
        .update({ status: 'GOING' })
        .eq('event_id', eventId)
        .eq('profile_id', requestorProfileId);
      if (error) throw error;
    },
    onSuccess: (_data, { hostProfileId, eventId }) => {
      qc.invalidateQueries({ queryKey: ['eventRequestors', hostProfileId] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// ─── Read: attendees for a specific event by status ──────────────────────────

export function useEventAttendees(eventId: string | undefined, status: RSVPStatus) {
  return useQuery<Profile[]>({
    queryKey: ['eventAttendees', eventId, status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('profile:profiles!profile_id(*)')
        .eq('event_id', eventId!)
        .eq('status', status);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.profile as Profile);
    },
    enabled: !!eventId,
    staleTime: 30 * 1000,
  });
}

// ─── Write: revoke an approved attendee (delete their GOING RSVP) ─────────────

export function useRevokeAttendee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, profileId }: { eventId: string; profileId: string }) => {
      const { error } = await supabase
        .from('event_rsvps')
        .delete()
        .eq('event_id', eventId)
        .eq('profile_id', profileId);
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['eventAttendees', eventId] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// ─── Write: decline a request (delete the row) ───────────────────────────────

export function useDeclineRequest() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      requestorProfileId,
    }: {
      eventId: string;
      requestorProfileId: string;
      hostProfileId: string;
    }) => {
      const { error } = await supabase
        .from('event_rsvps')
        .delete()
        .eq('event_id', eventId)
        .eq('profile_id', requestorProfileId);
      if (error) throw error;
    },
    onSuccess: (_data, { hostProfileId, eventId }) => {
      qc.invalidateQueries({ queryKey: ['eventRequestors', hostProfileId] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });
}
