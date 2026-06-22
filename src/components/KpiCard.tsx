import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon?: React.ReactNode;
  className?: string;
}

export function KpiCard({ title, value, subtitle, trend, icon, className }: KpiCardProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {icon && <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>}
            {trend !== undefined && (
              <span className={cn(
                'flex items-center text-xs font-medium',
                trend > 0 ? 'text-success' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {trend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : trend < 0 ? <TrendingDown className="h-3 w-3 mr-0.5" /> : <Minus className="h-3 w-3 mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
