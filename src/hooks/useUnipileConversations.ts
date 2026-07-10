import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UnipileConversation {
  id: string;
  name: string;
  last_message: string;
  timestamp: string | null;
  picture_url?: string | null;
  raw: any;
}

function normalize(item: any): UnipileConversation {
  const lastMsg =
    item?.last_message?.text ??
    item?.last_message?.body ??
    item?.snippet ??
    item?.preview ??
    '';
  return {
    id: item?.id ?? item?.chat_id ?? item?.provider_id ?? '',
    name:
      item?.name ??
      item?.attendee_name ??
      item?.subject ??
      item?.attendees?.[0]?.name ??
      '—',
    last_message: typeof lastMsg === 'string' ? lastMsg : String(lastMsg ?? ''),
    timestamp:
      item?.last_message?.timestamp ??
      item?.timestamp ??
      item?.updated_at ??
      item?.created_at ??
      null,
    picture_url: item?.picture_url ?? item?.attendees?.[0]?.picture_url ?? null,
    raw: item,
  };
}

function sortByRecent(items: UnipileConversation[]): UnipileConversation[] {
  return [...items].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });
}

async function fetchPage(account_id: string, cursor: string | null) {
  const body: Record<string, any> = { action: 'get_conversations', account_id };
  if (cursor) body.cursor = cursor;
  const { data, error } = await supabase.functions.invoke('unipile-proxy', { body });
  if (error) throw error;
  const rawItems: any[] =
    (data as any)?.items ??
    (data as any)?.chats ??
    (data as any)?.data ??
    (Array.isArray(data) ? (data as any) : []);
  const items = sortByRecent(rawItems.map(normalize).filter((c) => c.id));
  const nextCursor: string | null =
    (data as any)?.cursor ??
    (data as any)?.next_cursor ??
    (data as any)?.paging?.cursor ??
    null;
  return { items, cursor: nextCursor };
}

export function useUnipileConversations(account_id: string | null | undefined) {
  const [conversations, setConversations] = useState<UnipileConversation[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqIdRef = useRef(0);

  const initialLoad = useCallback(async () => {
    if (!account_id) return;
    const myReq = ++reqIdRef.current;
    setLoading(true);
    try {
      const { items, cursor: nextCursor } = await fetchPage(account_id, null);
      if (reqIdRef.current !== myReq) return;
      setConversations(items);
      setCursor(nextCursor);
    } finally {
      if (reqIdRef.current === myReq) setLoading(false);
    }
  }, [account_id]);

  useEffect(() => {
    if (!account_id) {
      setConversations([]);
      setCursor(null);
      return;
    }
    initialLoad();
  }, [account_id, initialLoad]);

  const loadMore = useCallback(async () => {
    if (!account_id || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items, cursor: nextCursor } = await fetchPage(account_id, cursor);
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        const merged = [...prev];
        for (const it of items) {
          if (!seen.has(it.id)) merged.push(it);
        }
        return sortByRecent(merged);
      });
      setCursor(nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [account_id, cursor, loadingMore]);

  const cursorRef = useRef(cursor);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);
  const loadingMoreRef = useRef(loadingMore);
  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);

  const loadAll = useCallback(async () => {
    if (!account_id) return;
    let currentCursor = cursorRef.current;
    while (currentCursor) {
      if (loadingMoreRef.current) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      setLoadingMore(true);
      loadingMoreRef.current = true;
      try {
        const { items, cursor: nextCursor } = await fetchPage(account_id, currentCursor);
        setConversations((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          const merged = [...prev];
          for (const it of items) {
            if (!seen.has(it.id)) merged.push(it);
          }
          return sortByRecent(merged);
        });
        currentCursor = nextCursor;
        cursorRef.current = nextCursor;
        setCursor(nextCursor);
      } catch {
        break;
      } finally {
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, [account_id]);

  return {
    conversations,
    loading,
    loadingMore,
    hasMore: cursor !== null,
    loadMore,
    loadAll,
    refetch: initialLoad,
  };
}