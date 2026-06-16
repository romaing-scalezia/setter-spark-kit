import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Link2, CheckCheck, User, Search } from 'lucide-react';
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
import { useAttendeeName } from '@/hooks/useAttendeeNames';
import { CreateLeadModal } from '@/components/CreateLeadModal';
import { useAuth } from '@/contexts/AuthContext';
import { LeadDetailDrawer } from '@/components/LeadDetailDrawer';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusDropdown } from '@/components/StatusDropdown';
import { type Lead, type LeadStatus } from '@/lib/constants';
import { TEMPERATURE_CONFIG, type LeadTemperature } from '@/lib/leadScoring';

function getAttendeeProviderId(c: UnipileConversation): string | null {
  const r = c.raw ?? {};
  return (
    r.attendee_provider_id ??
    r.attendees?.[0]?.provider_id ??
    r.attendees?.[0]?.attendee_provider_id ??
    null
  );
}

function useConversationDisplay(conversation: UnipileConversation): {
  name: string;
  avatarUrl: string | null;
} {
  const raw = (conversation.raw ?? {}) as any;
  const type = raw.type;
  const contentType = raw.content_type;
  const isGroup = type === 1;
  const isInmail = type === 0 && contentType === 'inmail';
  // Group: use conversation.name as-is. Otherwise (1:1, including inmail): resolve via attendee.
  const attendeeId = isGroup ? null : getAttendeeProviderId(conversation);
  const { name: resolvedName, avatarUrl } = useAttendeeName(attendeeId);
  const fallbackName = conversation.name && conversation.name !== '—' ? conversation.name : '—';
  return {
    name: isGroup ? fallbackName : resolvedName,
    avatarUrl: avatarUrl ?? conversation.picture_url ?? null,
  };
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  linkedTemp,
}: {
  conversation: UnipileConversation;
  active: boolean;
  onSelect: () => void;
  linkedTemp?: LeadTemperature;
}) {
  const { name, avatarUrl } = useConversationDisplay(conversation);
  const unread = Number((conversation.raw as any)?.unread_count ?? 0);
  const emoji = linkedTemp ? TEMPERATURE_CONFIG[linkedTemp].emoji : null;
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 p-3 text-left hover:bg-muted/60 ${
        active ? 'bg-primary/5 border-l-2 border-primary' : ''
      }`}
    >
      <Avatar name={name} url={avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`truncate text-sm ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>
            {emoji && <span className="mr-1 text-xs">{emoji}</span>}
            {name}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">
              {formatTs(conversation.timestamp)}
            </span>
            {unread > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ConversationHeaderName({ conversation }: { conversation: UnipileConversation }) {
  const { name } = useConversationDisplay(conversation);
  return <p className="text-sm font-medium">{name}</p>;
}

const AVATAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
];

function hashColor(name: string): string {
  let hash = 0;
  const s = name || '?';
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function Avatar({
  name,
  url,
  size = 'md',
}: {
  name: string;
  url: string | null;
  size?: 'md' | 'lg';
}) {
  const [hasError, setHasError] = useState(false);
  const showImg = !!url && !hasError;
  const dim = size === 'lg' ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-xs';
  return (
    <>
      {showImg && (
        <img
          src={url!}
          alt={name}
          className={`${dim} shrink-0 rounded-full object-cover`}
          onError={(e) => {
            e.preventDefault();
            setHasError(true);
          }}
        />
      )}
      {!showImg && (
        <div
          className={`${dim} flex shrink-0 items-center justify-center rounded-full font-medium text-white ${hashColor(name)}`}
        >
          {(name?.[0] ?? '?').toUpperCase()}
        </div>
      )}
    </>
  );
}

function ConversationHeaderAvatar({ conversation }: { conversation: UnipileConversation }) {
  const { name, avatarUrl } = useConversationDisplay(conversation);
  return <Avatar name={name} url={avatarUrl} size="lg" />;
}

function formatTs(ts: string | null) {
  if (!ts) return '';
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
}

function tempFromScore(score: number): LeadTemperature {
  if (score >= 50) return 'hot';
  if (score >= 25) return 'warm';
  return 'cold';
}

function useLinkedLead(chatId: string | null) {
  return useQuery({
    queryKey: ['linked-lead', chatId],
    enabled: !!chatId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await (supabase.from('leads') as any)
        .select('id, first_name, last_name, status, score')
        .eq('unipile_chat_id', chatId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; first_name: string | null; last_name: string | null; status: LeadStatus; score: number } | null;
    },
  });
}

function useAllLinkedLeads(chatIds: string[]) {
  return useQuery({
    queryKey: ['all-linked-leads', chatIds.join(',')],
    enabled: chatIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from('leads') as any)
        .select('id, score, unipile_chat_id')
        .in('unipile_chat_id', chatIds);
      if (error) throw error;
      const map: Record<string, { score: number }> = {};
      for (const l of data ?? []) map[l.unipile_chat_id] = l;
      return map;
    },
  });
}

function useFullLead(leadId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['full-lead', leadId],
    enabled: !!leadId && enabled,
    queryFn: async () => {
      const { data, error } = await (supabase.from('leads') as any)
        .select('*')
        .eq('id', leadId)
        .single();
      if (error) throw error;
      return data as Lead;
    },
  });
}

export default function Inbox() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { account, loading: accountLoading } = useUnipileAccount();
  const [selected, setSelected] = useState<UnipileConversation | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'hot' | 'followup'>('all');
  const [search, setSearch] = useState('');
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

  const {
    conversations,
    loading: convosLoading,
    loadingMore,
    hasMore,
    loadMore,
  } = useUnipileConversations(account?.account_id ?? null);
  const { messages, loading: msgsLoading, refetch: refetchMessages } =
    useUnipileMessages(selected?.id ?? null);
  const { data: linkedLead, isFetching: linkedLeadLoading, refetch: refetchLinked } = useLinkedLead(selected?.id ?? null);

  const selectedAttendeeId = selected ? getAttendeeProviderId(selected) : null;
  const {
    firstName: attendeeFirstName,
    lastName: attendeeLastName,
    linkedinUrl: attendeeLinkedinUrl,
  } = useAttendeeName(selectedAttendeeId);

  const sortedConvos = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      }),
    [conversations],
  );

  const chatIds = useMemo(() => sortedConvos.map((c) => c.id), [sortedConvos]);
  const { data: allLinkedLeads = {} } = useAllLinkedLeads(chatIds);

  const filteredConvos = useMemo(() => {
    let list = sortedConvos;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => (c.name ?? '').toLowerCase().includes(q));
    }
    if (activeFilter === 'unread') list = list.filter((c) => Number((c.raw as any)?.unread_count ?? 0) > 0);
    if (activeFilter === 'hot') list = list.filter((c) => {
      const l = allLinkedLeads[c.id];
      return l && tempFromScore(l.score) === 'hot';
    });
    return list;
  }, [sortedConvos, search, activeFilter, allLinkedLeads]);

  const { data: fullLead } = useFullLead(linkedLead?.id ?? null, drawerOpen);

  const handleStatusChange = async (status: LeadStatus) => {
    if (!linkedLead) return;
    await (supabase.from('leads') as any).update({ status }).eq('id', linkedLead.id);
    queryClient.invalidateQueries({ queryKey: ['linked-lead', selected?.id] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

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
          <div className="border-b p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-semibold">Inbox</h1>
              <span className="text-xs text-muted-foreground">{filteredConvos.length}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm bg-muted/50"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'unread', 'hot', 'followup'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    activeFilter === f
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {f === 'all' ? 'Tous' : f === 'unread' ? 'Non lus' : f === 'hot' ? '🔥 Chauds' : 'À relancer'}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {convosLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredConvos.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Aucune conversation.
              </p>
            ) : (
              <ul className="divide-y">
                {filteredConvos.map((c) => {
                  const active = selected?.id === c.id;
                  const ll = allLinkedLeads[c.id];
                  return (
                    <li key={c.id}>
                      <ConversationRow
                        conversation={c}
                        active={active}
                        onSelect={() => setSelected(c)}
                        linkedTemp={ll ? tempFromScore(ll.score) : undefined}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            {!convosLoading && hasMore && !loadingMore && (
              <div className="flex w-full justify-center p-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadMore()}
                >
                  Charger plus
                </Button>
              </div>
            )}
            {loadingMore && (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right — Detail */}
        <section className="flex min-h-0 flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Sélectionnez une conversation
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b p-4 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <ConversationHeaderAvatar conversation={selected} />
                  <div className="min-w-0">
                    <ConversationHeaderName conversation={selected} />
                    {linkedLead ? (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs">{TEMPERATURE_CONFIG[tempFromScore(linkedLead.score)].emoji}</span>
                        <StatusBadge status={linkedLead.status} />
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Score {linkedLead.score}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{formatTs(selected.timestamp)}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {linkedLeadLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : linkedLead ? (
                    <>
                      <Button size="sm" onClick={() => navigate('/leads')}>
                        Booker un RDV
                      </Button>
                      <StatusDropdown value={linkedLead.status} onValueChange={handleStatusChange} />
                      <Button size="sm" variant="outline" className="px-2" onClick={() => setDrawerOpen(true)}>
                        <User className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                        <Link2 className="mr-2 h-3.5 w-3.5" />
                        Lier à un lead
                      </Button>
                      <Button size="sm" onClick={() => setCreateOpen(true)}>
                        Créer un lead
                      </Button>
                    </>
                  )}
                </div>
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
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              m.is_sender
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }`}
                          >
                            <span>{formatTs(m.timestamp)}</span>
                            {m.is_sender && (
                              <CheckCheck
                                className={`h-3 w-3 ${
                                  Number((m.raw as any)?.seen ?? 0) === 1
                                    ? 'text-sky-300'
                                    : 'text-primary-foreground/50'
                                }`}
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>

              <div className="border-t">
                <div className="flex items-center gap-2 overflow-x-auto px-3 pt-2 pb-1">
                  <span className="shrink-0 text-xs text-muted-foreground">✦ Suggestions</span>
                  {['Proposer un créneau', 'Répondre chaleureusement', 'Template : Closing'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setText(s)}
                      className="shrink-0 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleSend} className="flex items-end gap-2 p-3 pt-1">
                  <Textarea
                    placeholder="Votre message..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={sending}
                    rows={1}
                    className="max-h-[120px] resize-none"
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                    }}
                  />
                  <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={sending || !text.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>

      {selected && (
        <LinkLeadDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          chatId={selected.id}
          linkedinUrl={attendeeLinkedinUrl}
          onLinked={() => {
            refetchLinked();
            queryClient.invalidateQueries({ queryKey: ['linked-lead', selected.id] });
          }}
        />
      )}

      {selected && linkedLead && (
        <LeadDetailDrawer
          lead={fullLead ?? null}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      )}

      {selected && (
        <CreateLeadModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          initialValues={{
            first_name: attendeeFirstName,
            last_name: attendeeLastName,
            linkedin_url: attendeeLinkedinUrl,
          }}
          onSubmit={async (data) => {
            if (!user) return;
            const { data: lead, error } = await (supabase.from('leads') as any)
              .insert({
                owner_id: user.id,
                setter_id: data.setter_id || user.id,
                first_name: data.first_name,
                last_name: data.last_name,
                linkedin_url: data.linkedin_url || null,
                persona_id: data.persona_id || null,
                outreach_type: (data.outreach_type || null) as any,
                status: 'conversation_engagee',
                conversation_started_at: new Date().toISOString(),
                unipile_chat_id: selected.id,
              })
              .select()
              .single();
            if (error) {
              toast({ variant: 'destructive', title: 'Erreur', description: error.message });
              return;
            }
            await (supabase.from('lead_events') as any).insert({
              lead_id: lead.id,
              user_id: user.id,
              event_type: 'lead_created',
              new_value: 'conversation_engagee',
            });
            toast({ title: 'Lead créé et lié à la conversation' });
            refetchLinked();
            queryClient.invalidateQueries({ queryKey: ['linked-lead', selected.id] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
          }}
        />
      )}
    </AppLayout>
  );
}