import { LeadStatus, STATUS_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.bg, config.color, className)}>
      {config.label}
    </span>
  );
}
