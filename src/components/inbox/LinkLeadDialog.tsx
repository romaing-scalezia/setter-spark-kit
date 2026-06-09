import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  linkedinUrl?: string | null;
  onLinked: () => void;
}

export function LinkLeadDialog({ open, onOpenChange, chatId, linkedinUrl, onLinked }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let req = supabase
        .from('leads')
        .select('id, first_name, last_name')
        .eq('owner_id', user.id)
        .limit(10);
      if (debounced) {
        const parts = debounced.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          const [a, b] = parts;
          req = req.or(
            `and(first_name.ilike.%${a}%,last_name.ilike.%${b}%),and(first_name.ilike.%${b}%,last_name.ilike.%${a}%)`,
          );
        } else {
          req = req.or(
            `first_name.ilike.%${debounced}%,last_name.ilike.%${debounced}%`,
          );
        }
      }
      const { data, error } = await req;
      if (cancelled) return;
      if (!error) setResults((data ?? []) as LeadRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debounced, user]);

  const link = async (leadId: string) => {
    setLinkingId(leadId);
    const patch: Record<string, any> = { unipile_chat_id: chatId };
    if (linkedinUrl) patch.linkedin_url = linkedinUrl;
    const { error } = await (supabase.from('leads') as any)
      .update(patch)
      .eq('id', leadId);
    setLinkingId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }
    toast({ title: 'Conversation liée au lead' });
    onOpenChange(false);
    setQuery('');
    onLinked();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lier à un lead</DialogTitle>
          <DialogDescription>
            Recherchez un lead existant pour l'associer à cette conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Nom ou prénom..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-72 space-y-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recherche...
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun lead trouvé.
            </p>
          ) : (
            results.map((lead) => (
              <button
                key={lead.id}
                onClick={() => link(lead.id)}
                disabled={linkingId === lead.id}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <span>
                  {(lead.first_name ?? '') + ' ' + (lead.last_name ?? '')}
                </span>
                {linkingId === lead.id && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}