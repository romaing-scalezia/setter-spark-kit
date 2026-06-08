import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeaderboardTable } from '@/components/gamification/LeaderboardTable';
import { useLeaderboard } from '@/hooks/useGamification';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy } from 'lucide-react';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear
} from 'date-fns';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';

function getRange(period: Period) {
  const now = new Date();
  switch (period) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year': return { start: startOfYear(now), end: endOfYear(now) };
  }
}

const SORT_OPTIONS = [
  { value: 'score', label: 'Score global' },
  { value: 'meetings_booked', label: 'RDV bookés' },
  { value: 'calls_proposed', label: 'Appels proposés' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'responses', label: 'Réponses' },
];

export default function LeaderboardPage() {
  const { user, activeRole } = useAuth();
  const [period, setPeriod] = useState<Period>('week');
  const [sortBy, setSortBy] = useState('score');
  const [scope, setScope] = useState<'global' | 'coach'>('global');

  const range = getRange(period);

  // For coach scope, get coach assignments
  const { data: assignedCoaches = [] } = useQuery({
    queryKey: ['user-coaches'],
    queryFn: async () => {
      if (activeRole === 'coach' || activeRole === 'admin') {
        const { data } = await supabase.from('coach_assignments').select('coach_id').eq('coach_id', user!.id);
        return data || [];
      }
      return [];
    },
    enabled: !!user && (activeRole === 'coach' || activeRole === 'admin'),
  });

  const coachId = scope === 'coach' && (activeRole === 'coach' || activeRole === 'admin') ? user?.id : null;

  const { data: leaderboard = [], isLoading } = useLeaderboard(range.start, range.end, coachId);

  const showScopeFilter = activeRole === 'coach' || activeRole === 'admin';

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="today">Aujourd'hui</TabsTrigger>
              <TabsTrigger value="week">Semaine</TabsTrigger>
              <TabsTrigger value="month">Mois</TabsTrigger>
              <TabsTrigger value="quarter">Trimestre</TabsTrigger>
              <TabsTrigger value="year">Année</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showScopeFilter && (
            <Select value={scope} onValueChange={(v) => setScope(v as 'global' | 'coach')}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="coach">Mes élèves</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Classement {scope === 'coach' ? 'de vos élèves' : 'global'} — {
                { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette année' }[period]
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeaderboardTable data={leaderboard} currentUserId={user?.id} sortBy={sortBy} loading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
