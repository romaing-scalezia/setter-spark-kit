import { LeadStatus, STATUS_CONFIG } from '@/lib/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StatusDropdownProps {
  value: LeadStatus;
  onValueChange: (value: LeadStatus) => void;
  disabled?: boolean;
}

export function StatusDropdown({ value, onValueChange, disabled }: StatusDropdownProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as LeadStatus)} disabled={disabled}>
      <SelectTrigger className="w-[180px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <SelectItem key={key} value={key}>
            <span className={`inline-flex items-center gap-2 ${config.color}`}>
              <span className={`h-2 w-2 rounded-full ${config.bg} ${config.color} border`} />
              {config.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
