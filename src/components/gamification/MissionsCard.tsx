import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, CheckCircle2 } from 'lucide-react';
import type { Lead } from '@/lib/constants';
import { DAILY_MISSIONS, WEEKLY_MISSIONS, type Mission } from '@/lib/gamification';

interface MissionsCardProps {
  leads: Lead[];
  todayRange: { start: Date; end: Date };
  weekRange: { start: Date; end: Date };
}

function MissionRow({ mission, leads, range }: { mission: Mission; leads: Lead[]; range: { start: Date; end: Date } }) {
  const value = mission.getValue(leads, range);
  const progress = Math.min(100, Math.round((value / mission.target) * 100));
  const completed = value >= mission.target;

  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 rounded-full p-1 ${completed ? 'text-success' : 'text-muted-foreground'}`}>
        {completed ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-sm mb-1">
          <span className={`font-medium ${completed ? 'text-success' : 'text-foreground'}`}>{mission.label}</span>
          <span className="text-muted-foreground">{value}/{mission.target}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    </div>
  );
}

export function MissionsCard({ leads, todayRange, weekRange }: MissionsCardProps) {
  const dailyCompleted = DAILY_MISSIONS.filter((m) => m.getValue(leads, todayRange) >= m.target).length;
  const weeklyCompleted = WEEKLY_MISSIONS.filter((m) => m.getValue(leads, weekRange) >= m.target).length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Objectifs du jour</span>
            <span className="text-xs font-normal text-muted-foreground">
              {dailyCompleted}/{DAILY_MISSIONS.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAILY_MISSIONS.map((m) => (
            <MissionRow key={m.key} mission={m} leads={leads} range={todayRange} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Objectifs de la semaine</span>
            <span className="text-xs font-normal text-muted-foreground">
              {weeklyCompleted}/{WEEKLY_MISSIONS.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {WEEKLY_MISSIONS.map((m) => (
            <MissionRow key={m.key} mission={m} leads={leads} range={weekRange} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
