import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UnipileMessage {
  id: string;
  text: string;
  timestamp: string | null;
  is_sender: boolean;
  raw: any;
}

function normalize(item: any): UnipileMessage {
  const ts =
    item?.timestamp ?? item?.created_at ?? item?.sent_at ?? item?.date ?? null;
  return {
    id: item?.id ?? item?.provider_id ?? `${ts}-${Math.random()}`,
    text: item?.text ?? item?.body ?? item?.message ?? '',
    timestamp: ts,
    is_sender:
      item?.is_sender === true ||
      item?.is_sender === 1 ||
      item?.from_me === true ||
      item?.sender === 'me',
    raw: item,
  };
}

export function useUnipileMessages(chat_id: string | null | undefined) {
  const query = useQuery({
    queryKey: ['unipile-messages', chat_id],
    enabled: !!chat_id,
    staleTime: 10_000,
    queryFn: async (): Promise<UnipileMessage[]> => {
      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'get_messages', chat_id },
      });
      if (error) throw error;
      const items: any[] =
        (data as any)?.items ??
        (data as any)?.messages ??
        (data as any)?.data ??
        (Array.isArray(data) ? (data as any) : []);
      return items
        .map(normalize)
        .sort((a, b) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return ta - tb;
        });
    },
  });

  return {
    messages: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}