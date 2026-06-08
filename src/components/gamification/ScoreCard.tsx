import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Star, Zap, Calendar } from 'lucide-react';

interface ScoreCardProps {
  totalScore: number;
  todayScore: number;
  weekScore: number;
  level: { level: number; title: string; nextThreshold: number; progress: number };
  streak: { current_streak: number; longest_streak: number };
}

export function ScoreCard({ totalScore, todayScore, weekScore, level, streak }: ScoreCardProps) {
  return (
    <Card className="border-0 bg-gradient-to-br from-primary/5 via-card to-primary/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Setting Score</p>
            <p className="text-3xl font-bold text-foreground">{totalScore}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
            <Star className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-semibold text-primary">Niv. {level.level} — {level.title}</span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progression vers Niv. {level.level + 1}</span>
            <span>{level.progress}%</span>
          </div>
          <Progress value={level.progress} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-background/80 p-3 text-center">
            <Zap className="h-4 w-4 text-warning mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{todayScore}</p>
            <p className="text-xs text-muted-foreground">Aujourd'hui</p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 text-center">
            <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{weekScore}</p>
            <p className="text-xs text-muted-foreground">Cette semaine</p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 text-center">
            <Calendar className="h-4 w-4 text-success mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{streak.current_streak}</p>
            <p className="text-xs text-muted-foreground">Jours consécutifs</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
