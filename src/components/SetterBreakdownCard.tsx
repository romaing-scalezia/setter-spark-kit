import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import type { Lead } from '@/lib/constants';
import type { Teammate } from '@/hooks/useTeammates';
import { teammateLabel } from '@/hooks/useTeammates';

interface SetterBreakdownCardProps {
  leads: Lead[];
  teammates: Teammate[];
  inPeriod: (value?: string | null) => boolean;
}

const RESPONDED_STATUSES = new Set(['en_cours', 'appel_propose', 'follow_up', 'rendez_vous_booke']);
const CALL_PROPOSED_STATUSES = new Set(['appel_propose', 'rendez_vous_booke']);
const RDV_BOOKED_STATUSES = new Set(['rendez_vous_booke']);

function pct(num: number, den: number) {
  return den === 0 ? '—' : `${Math.round((num / den) * 100)}%`;
}

export function SetterBreakdownCard({ leads, teammates, inPeriod }: SetterBreakdownCardProps) {
  const rows = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of leads) {
      const sid = (l as any).setter_id || l.owner_id;
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(l);
    }
    return Array.from(map.entries()).map(([sid, ls]) => {
      const contacted = ls.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
      const responded = ls.filter((l) => RESPONDED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const calls = ls.filter((l) => CALL_PROPOSED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const rdv = ls.filter((l) => RDV_BOOKED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const t = teammates.find((tm) => tm.id === sid);
      return { sid, name: teammateLabel(t), contacted, responded, calls, rdv };
    }).sort((a, b) => b.rdv - a.rdv || b.contacted - a.contacted);
  }, [leads, teammates, inPeriod]);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Performance par setter
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-3 font-medium">Setter</th>
                <th className="py-2 px-2 text-center font-medium">Conv.</th>
                <th className="py-2 px-2 text-center font-medium">Réponses</th>
                <th className="py-2 px-2 text-center font-medium">Appels</th>
                <th className="py-2 px-2 text-center font-medium">RDV</th>
                <th className="py-2 pl-2 text-right font-medium">Taux RDV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sid} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {r.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground">{r.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center">{r.contacted}</td>
                  <td className="py-2 px-2 text-center">{r.responded}</td>
                  <td className="py-2 px-2 text-center">{r.calls}</td>
                  <td className="py-2 px-2 text-center">{r.rdv}</td>
                  <td className="py-2 pl-2 text-right font-medium text-primary">{pct(r.rdv, r.contacted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
