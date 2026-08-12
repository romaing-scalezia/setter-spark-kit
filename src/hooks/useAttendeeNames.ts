import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AttendeeInfo {
  first_name?: string | null;
  last_name?: string | null;
  profile_picture_url?: string | null;
  linkedin_url?: string | null;
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
  const publicId =
    data?.public_identifier ??
    data?.publicIdentifier ??
    data?.profile?.public_identifier ??
    null;
  const explicitUrl =
    data?.profile_url ??
    data?.profileUrl ??
    data?.public_profile_url ??
    data?.publicProfileUrl ??
    null;
  const linkedin_url =
    (publicId ? `https://www.linkedin.com/in/${publicId}/` : null) ??
    explicitUrl;
  // Fallback: split `name` if first/last absent
  if (!first && !last && typeof data?.name === 'string') {
    const parts = data.name.trim().split(/\s+/);
    return {
      first_name: parts[0] ?? null,
      last_name: parts.slice(1).join(' ') || null,
      profile_picture_url: pic,
      linkedin_url,
    };
  }
  return { first_name: first, last_name: last, profile_picture_url: pic, linkedin_url };
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
  firstName: string | null;
  lastName: string | null;
  linkedinUrl: string | null;
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
    return { name: '—', avatarUrl: null, firstName: null, lastName: null, linkedinUrl: null, loading: false };
  }

  const entry = cache.get(attendeeId);
  if (!entry || entry.status === 'loading') {
    return { name: '…', avatarUrl: null, firstName: null, lastName: null, linkedinUrl: null, loading: true };
  }
  if (entry.status === 'error' || !entry.info) {
    return { name: truncate(attendeeId), avatarUrl: null, firstName: null, lastName: null, linkedinUrl: null, loading: false };
  }
  const { first_name, last_name, profile_picture_url, linkedin_url } = entry.info;
  const name =
    [first_name, last_name].filter(Boolean).join(' ').trim() ||
    truncate(attendeeId);
  return {
    name,
    avatarUrl: profile_picture_url ?? null,
    firstName: first_name ?? null,
    lastName: last_name ?? null,
    linkedinUrl: linkedin_url ?? null,
    loading: false,
  };
}

interface AttendeeProfile {
  company_name: string | null;
  job_title: string | null;
}

// Unipile's /users/{identifier} response has no separate company field — the
// current role/company only show up combined in `headline`, e.g.
// "Partnerships Manager @ La Growth Machine". Split on the common separators;
// if none match, the whole headline is kept as the job title.
function splitHeadline(headline: string | null | undefined): AttendeeProfile {
  if (!headline) return { company_name: null, job_title: null };
  const match = headline.match(/^(.*?)\s+(?:@|chez|at)\s+(.+)$/i);
  if (match) {
    return { job_title: match[1].trim() || null, company_name: match[2].trim() || null };
  }
  return { job_title: headline.trim() || null, company_name: null };
}

function pickProfile(data: any): AttendeeProfile {
  const explicitCompany =
    data?.company_name ??
    data?.current_company?.name ??
    data?.current_positions?.[0]?.company ??
    data?.work_experience?.[0]?.company ??
    null;
  const explicitJobTitle =
    data?.job_title ??
    data?.current_positions?.[0]?.role ??
    data?.work_experience?.[0]?.position ??
    null;
  if (explicitCompany || explicitJobTitle) {
    return { company_name: explicitCompany, job_title: explicitJobTitle };
  }
  return splitHeadline(data?.headline ?? data?.occupation ?? null);
}

/**
 * On-demand fetch of the richer LinkedIn profile (current company/role) for
 * an attendee. Separate from useAttendeeName's lightweight, eagerly-prefetched
 * cache: this hits Unipile's /users/{identifier} endpoint (needs account_id),
 * which chat_attendees doesn't expose, so it's only fetched when actually
 * needed (e.g. opening "Nouveau lead") rather than for every conversation.
 */
export function useAttendeeProfile(
  providerId: string | null | undefined,
  accountId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['attendee-profile', providerId, accountId],
    queryFn: async (): Promise<AttendeeProfile> => {
      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'get_profile', identifier: providerId, account_id: accountId },
      });
      if (error) throw error;
      return pickProfile(data);
    },
    enabled: enabled && !!providerId && !!accountId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function getCachedAttendeeName(attendeeId: string | null | undefined): string | null {
  if (!attendeeId) return null;
  const entry = cache.get(attendeeId);
  if (!entry || entry.status !== 'loaded' || !entry.info) return null;
  const { first_name, last_name } = entry.info;
  return [first_name, last_name].filter(Boolean).join(' ').trim() || null;
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