import { Progress } from '@/components/ui/progress';

interface ScoreCardProps {
  totalScore: number;
  todayScore: number;
  weekScore: number;
  level: { level: number; title: string; nextThreshold: number; progress: number };
  streak: { current_streak: number; longest_streak: number };
}

export function ScoreCard({ totalScore, level, streak }: ScoreCardProps) {
  const ptsLeft = Math.max(0, level.nextThreshold - totalScore);

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-primary/5 p-5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-primary/30 bg-background">
            <span className="text-xl font-bold text-foreground">{totalScore}</span>
          </div>
          <p className="text-base font-semibold text-foreground">
            {streak.current_streak > 0
              ? `🔥 Série de ${streak.current_streak} jour${streak.current_streak > 1 ? 's' : ''} — continue !`
              : 'Commence ta série aujourd\'hui !'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          Niv. {level.level} — {level.title}
        </span>
      </div>

      <Progress value={level.progress} className="h-4 rounded-full" />

      <p className="text-xs text-muted-foreground">
        Setting Score {totalScore} • Plus que <span className="font-semibold text-foreground">{ptsLeft} pts</span> pour le niveau {level.level + 1}
      </p>
    </div>
  );
}
