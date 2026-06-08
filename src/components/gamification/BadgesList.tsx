import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { BadgeDef } from '@/lib/gamification';

interface BadgesListProps {
  allBadges: BadgeDef[];
  earnedBadges: BadgeDef[];
  compact?: boolean;
}

export function BadgesList({ allBadges, earnedBadges, compact }: BadgesListProps) {
  const earnedKeys = new Set(earnedBadges.map((b) => b.key));

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {allBadges.map((badge) => {
          const earned = earnedKeys.has(badge.key);
          return (
            <Tooltip key={badge.key}>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all ${
                    earned
                      ? 'bg-primary/10 text-foreground'
                      : 'bg-muted/50 text-muted-foreground opacity-40'
                  }`}
                >
                  <span>{badge.icon}</span>
                  <span className="font-medium">{badge.label}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{badge.description}</p>
                {!earned && <p className="text-xs text-muted-foreground mt-1">Non débloqué</p>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Badges
          <span className="text-xs font-normal text-muted-foreground">
            {earnedBadges.length}/{allBadges.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {allBadges.map((badge) => {
            const earned = earnedKeys.has(badge.key);
            return (
              <Tooltip key={badge.key}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-all ${
                      earned
                        ? 'bg-primary/5 border border-primary/20'
                        : 'bg-muted/30 opacity-40'
                    }`}
                  >
                    <span className="text-2xl">{badge.icon}</span>
                    <span className={`text-xs font-medium ${earned ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {badge.label}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{badge.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
