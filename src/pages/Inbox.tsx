import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Link2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUnipileAccount } from '@/hooks/useUnipileAccount';
import {
  useUnipileConversations,
  type UnipileConversation,
} from '@/hooks/useUnipileConversations';
import { useUnipileMessages } from '@/hooks/useUnipileMessages';
import { LinkLeadDialog } from '@/components/inbox/LinkLeadDialog';

function formatTs(ts: string | null) {
  if (!ts) return '';
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
}

function useLinkedLead(chatId: string | null) {
  return useQuery({
    queryKey: ['linked-lead', chatId],
    enabled: !!chatId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('leads') as any)
        .select('id, first_name, last_name')
        .eq('unipile_chat_id', chatId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; first_name: string | null; last_name: string | null } | null;
    },
  });
}

export default function Inbox() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { account, loading: accountLoading } = useUnipileAccount();
  const [selected, setSelected] = useState<UnipileConversation | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const queryClient = useQueryClient();

  // Redirect guard
  useEffect(() => {
    if (!accountLoading && !account) {
      toast({
        title: 'LinkedIn non connecté',
        description: 'Connectez votre compte LinkedIn pour accéder à l\'Inbox.',
      });
      navigate('/settings', { replace: true });
    }
  }, [accountLoading, account, navigate, toast]);

  const { conversations, loading: convosLoading } = useUnipileConversations(
    account?.account_id ?? null,
  );
  const { messages, loading: msgsLoading, refetch: refetchMessages } =
    useUnipileMessages(selected?.id ?? null);
  const { data: linkedLead, refetch: refetchLinked } = useLinkedLead(selected?.id ?? null);

  const sortedConvos = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      }),
    [conversations],
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.functions.invoke('unipile-proxy', {
      body: { action: 'send_message', chat_id: selected.id, text: text.trim() },
    });
    setSending(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Envoi échoué', description: error.message });
      return;
    }
    setText('');
    refetchMessages();
  };

  if (accountLoading || !account) {
    return (
      <AppLayout>
        <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[360px_1fr]">
          <div className="border-r p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[360px_1fr] min-h-0">
        {/* Left — Conversations */}
        <aside className="flex flex-col border-r min-h-0">
          <div className="flex items-center justify-between border-b p-4">
            <h1 className="text-base font-semibold">Inbox</h1>
            <span className="text-xs text-muted-foreground">
              {sortedConvos.length}
            </span>
          </div>
          <ScrollArea className="flex-1">
            {convosLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : sortedConvos.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Aucune conversation.
              </p>
            ) : (
              <ul className="divide-y">
                {sortedConvos.map((c) => {
                  const active = selected?.id === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelected(c)}
                        className={`flex w-full items-start gap-3 p-3 text-left hover:bg-muted/60 ${
                          active ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {(c.name?.[0] ?? '?').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formatTs(c.timestamp)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.last_message || '—'}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </aside>

        {/* Right — Detail */}
        <section className="flex min-h-0 flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Sélectionnez une conversation
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b p-4">
                <div>
                  <p className="text-sm font-medium">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTs(selected.timestamp)}
                  </p>
                </div>
                {linkedLead ? (
                  <Link
                    to="/leads"
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    <Link2 className="h-3 w-3" />
                    {(linkedLead.first_name ?? '') + ' ' + (linkedLead.last_name ?? '')}
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLinkOpen(true)}
                  >
                    <Link2 className="mr-2 h-3.5 w-3.5" />
                    Lier à un lead
                  </Button>
                )}
              </header>

              <ScrollArea className="flex-1 p-4">
                {msgsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-2/3" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Aucun message.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {messages.map((m) => (
                      <li
                        key={m.id}
                        className={`flex ${m.is_sender ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                            m.is_sender
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              m.is_sender
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {formatTs(m.timestamp)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>

              <form onSubmit={handleSend} className="flex items-center gap-2 border-t p-3">
                <Input
                  placeholder="Votre message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !text.trim()}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>

      {selected && (
        <LinkLeadDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          chatId={selected.id}
          onLinked={() => {
            refetchLinked();
            queryClient.invalidateQueries({ queryKey: ['linked-lead', selected.id] });
          }}
        />
      )}
    </AppLayout>
  );
}