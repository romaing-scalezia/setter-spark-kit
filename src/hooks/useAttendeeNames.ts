import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AttendeeInfo {
  first_name?: string | null;
  last_name?: string | null;
  profile_picture_url?: string | null;
}

type Status = 'loading' | 'loaded' | 'error';

interface Entry {
  status: Status;
  info?: AttendeeInfo;
}

const cache: Map<string, Entry> = new Map();
const inflight: Map<string, Promise<void>> = new Map();
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

function pickName(data: any): AttendeeInfo {
  const first = data?.first_name ?? data?.firstName ?? null;
  const last = data?.last_name ?? data?.lastName ?? null;
  const pic =
    data?.profile_picture_url ??
    data?.picture_url ??
    data?.profilePictureUrl ??
    null;
  // Fallback: split `name` if first/last absent
  if (!first && !last && typeof data?.name === 'string') {
    const parts = data.name.trim().split(/\s+/);
    return {
      first_name: parts[0] ?? null,
      last_name: parts.slice(1).join(' ') || null,
      profile_picture_url: pic,
    };
  }
  return { first_name: first, last_name: last, profile_picture_url: pic };
}

async function fetchAttendee(attendeeId: string) {
  if (cache.has(attendeeId)) return;
  if (inflight.has(attendeeId)) return inflight.get(attendeeId);

  cache.set(attendeeId, { status: 'loading' });
  notify();

  const p = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'get_attendee', attendee_id: attendeeId },
      });
      if (error) throw error;
      cache.set(attendeeId, { status: 'loaded', info: pickName(data) });
    } catch {
      cache.set(attendeeId, { status: 'error' });
    } finally {
      inflight.delete(attendeeId);
      notify();
    }
  })();

  inflight.set(attendeeId, p);
  return p;
}

function truncate(id: string) {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function useAttendeeName(attendeeId: string | null | undefined): {
  name: string;
  avatarUrl: string | null;
  loading: boolean;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (!attendeeId) return;
    if (!cache.has(attendeeId)) {
      fetchAttendee(attendeeId);
    }
  }, [attendeeId]);

  if (!attendeeId) {
    return { name: '—', avatarUrl: null, loading: false };
  }

  const entry = cache.get(attendeeId);
  if (!entry || entry.status === 'loading') {
    return { name: '…', avatarUrl: null, loading: true };
  }
  if (entry.status === 'error' || !entry.info) {
    return { name: truncate(attendeeId), avatarUrl: null, loading: false };
  }
  const { first_name, last_name, profile_picture_url } = entry.info;
  const name =
    [first_name, last_name].filter(Boolean).join(' ').trim() ||
    truncate(attendeeId);
  return { name, avatarUrl: profile_picture_url ?? null, loading: false };
}

export function useAttendeeNamesPrefetch(ids: Array<string | null | undefined>) {
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const id of ids) {
      if (!id || seen.current.has(id)) continue;
      seen.current.add(id);
      if (!cache.has(id)) fetchAttendee(id);
    }
  }, [ids]);
}