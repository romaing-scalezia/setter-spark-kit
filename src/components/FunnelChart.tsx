import { STATUS_CONFIG, FUNNEL_STATUSES, type LeadStatus } from '@/lib/constants';

interface FunnelChartProps {
  data: Record<LeadStatus, number>;
}

export function FunnelChart({ data }: FunnelChartProps) {
  const max = Math.max(...FUNNEL_STATUSES.map((s) => data[s] || 0), 1);

  return (
    <div className="space-y-3">
      {FUNNEL_STATUSES.map((status) => {
        const count = data[status] || 0;
        const pct = (count / max) * 100;
        const config = STATUS_CONFIG[status];
        return (
          <div key={status} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{config.label}</span>
              <span className="font-medium text-foreground">{count}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted">
              <div
                className={`h-3 rounded-full ${config.bg} transition-all duration-500`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
