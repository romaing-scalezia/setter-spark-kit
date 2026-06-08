import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Medal } from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  conversations: number;
  responses: number;
  calls_proposed: number;
  meetings_booked: number;
  score: number;
}

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  currentUserId?: string;
  sortBy?: string;
  loading?: boolean;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{rank}</span>;
}

export function LeaderboardTable({ data, currentUserId, sortBy = 'score', loading }: LeaderboardTableProps) {
  const sorted = [...data].sort((a, b) => {
    const key = sortBy as keyof LeaderboardEntry;
    return (b[key] as number) - (a[key] as number);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement...
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Aucune donnée pour cette période
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Setter</TableHead>
          <TableHead className="text-center">Conversations</TableHead>
          <TableHead className="text-center">Réponses</TableHead>
          <TableHead className="text-center">Appels</TableHead>
          <TableHead className="text-center">RDV</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((entry, i) => {
          const isCurrentUser = entry.user_id === currentUserId;
          return (
            <TableRow
              key={entry.user_id}
              className={isCurrentUser ? 'bg-primary/5 font-medium' : ''}
            >
              <TableCell>
                <RankBadge rank={i + 1} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {entry.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={isCurrentUser ? 'text-primary' : 'text-foreground'}>
                    {entry.full_name}
                    {isCurrentUser && <span className="text-xs text-muted-foreground ml-1">(vous)</span>}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-center">{entry.conversations}</TableCell>
              <TableCell className="text-center">{entry.responses}</TableCell>
              <TableCell className="text-center">{entry.calls_proposed}</TableCell>
              <TableCell className="text-center">{entry.meetings_booked}</TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary">
                  {entry.score}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
