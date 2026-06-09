import { useQuery } from '@tanstack/react-query';
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

export function useUnipileConversations(account_id: string | null | undefined) {
  const query = useQuery({
    queryKey: ['unipile-conversations', account_id],
    enabled: !!account_id,
    staleTime: 30_000,
    queryFn: async (): Promise<UnipileConversation[]> => {
      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'get_conversations', account_id },
      });
      if (error) throw error;
      const items: any[] =
        (data as any)?.items ??
        (data as any)?.chats ??
        (data as any)?.data ??
        (Array.isArray(data) ? (data as any) : []);
      return items.map(normalize).filter((c) => c.id);
    },
  });

  return {
    conversations: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}