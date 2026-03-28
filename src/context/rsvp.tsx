import { createContext, useContext, useState, type ReactNode } from 'react';
import type { RSVPStatus, Profile, EventWithHost, Event } from '../types';
import { MOCK_MY_RSVPS, MOCK_EVENT_REQUESTORS } from '../mock/rsvps';

// ─── Types ────────────────────────────────────────────────────────────────────

type RSVPMap = Record<string, RSVPStatus>;
type RequestorMap = Record<string, Profile[]>;
type EventEditsMap = Record<string, Partial<Event>>;

interface RSVPContextValue {
  // Current user's RSVPs
  myRSVPs: RSVPMap;
  setRSVP: (eventId: string, status: RSVPStatus | null) => void;
  getRSVP: (eventId: string) => RSVPStatus | null;

  // Attendance requests for exclusive events the user hosts
  eventRequestors: RequestorMap;
  approveRequest: (eventId: string, profileId: string) => void;
  declineRequest: (eventId: string, profileId: string) => void;
  getPendingCount: (eventId: string) => number;

  // In-memory event edits / cancellations (cleared on app restart)
  cancelledEventIds: string[];
  cancelEvent: (eventId: string) => void;
  updateEventLocally: (eventId: string, updates: Partial<Event>) => void;
  getEffectiveEvent: (event: EventWithHost) => EventWithHost;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const RSVPContext = createContext<RSVPContextValue | null>(null);

export function RSVPProvider({ children }: { children: ReactNode }) {
  const [myRSVPs, setMyRSVPs] = useState<RSVPMap>(MOCK_MY_RSVPS);
  const [eventRequestors, setEventRequestors] = useState<RequestorMap>(MOCK_EVENT_REQUESTORS);
  const [cancelledEventIds, setCancelledEventIds] = useState<string[]>([]);
  const [eventEdits, setEventEdits] = useState<EventEditsMap>({});

  function setRSVP(eventId: string, status: RSVPStatus | null) {
    setMyRSVPs(prev => {
      const next = { ...prev };
      if (status === null) {
        delete next[eventId];
      } else {
        next[eventId] = status;
      }
      return next;
    });
  }

  function getRSVP(eventId: string): RSVPStatus | null {
    return myRSVPs[eventId] ?? null;
  }

  function approveRequest(eventId: string, profileId: string) {
    setEventRequestors(prev => ({
      ...prev,
      [eventId]: (prev[eventId] ?? []).filter(p => p.id !== profileId),
    }));
  }

  function declineRequest(eventId: string, profileId: string) {
    setEventRequestors(prev => ({
      ...prev,
      [eventId]: (prev[eventId] ?? []).filter(p => p.id !== profileId),
    }));
  }

  function getPendingCount(eventId: string): number {
    return (eventRequestors[eventId] ?? []).length;
  }

  function cancelEvent(eventId: string) {
    setCancelledEventIds(prev =>
      prev.includes(eventId) ? prev : [...prev, eventId]
    );
  }

  function updateEventLocally(eventId: string, updates: Partial<Event>) {
    setEventEdits(prev => ({
      ...prev,
      [eventId]: { ...(prev[eventId] ?? {}), ...updates },
    }));
  }

  function getEffectiveEvent(event: EventWithHost): EventWithHost {
    const edits = eventEdits[event.id] ?? {};
    const isCancelled = cancelledEventIds.includes(event.id);
    return {
      ...event,
      ...edits,
      status: isCancelled ? 'CANCELLED' : (edits.status ?? event.status),
    };
  }

  return (
    <RSVPContext.Provider
      value={{
        myRSVPs,
        setRSVP,
        getRSVP,
        eventRequestors,
        approveRequest,
        declineRequest,
        getPendingCount,
        cancelledEventIds,
        cancelEvent,
        updateEventLocally,
        getEffectiveEvent,
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
