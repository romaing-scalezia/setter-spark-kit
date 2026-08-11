import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, subWeeks,
  subMonths, format, addMonths, addWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type DateRange = { start: Date; end: Date };
export type PresetKey =
  | 'today' | 'yesterday' | 'this_week' | 'last_week'
  | 'this_month' | 'last_month' | 'this_quarter' | 'this_year'
  | 'custom_day' | 'custom_week' | 'custom_month' | 'custom_range';

const PRESET_LABELS: Record<PresetKey, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  this_week: 'Cette semaine',
  last_week: 'Semaine précédente',
  this_month: 'Ce mois',
  last_month: 'Mois précédent',
  this_quarter: 'Ce trimestre',
  this_year: 'Cette année',
  custom_day: 'Jour précis',
  custom_week: 'Semaine précise',
  custom_month: 'Mois précis',
  custom_range: 'Plage personnalisée',
};

const QUICK_PRESETS: PresetKey[] = [
  'today', 'yesterday', 'this_week', 'last_week',
  'this_month', 'last_month', 'this_quarter', 'this_year',
];

function getPresetRange(preset: PresetKey): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': { const y = subDays(now, 1); return { start: startOfDay(y), end: endOfDay(y) }; }
    case 'this_week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'last_week': { const lw = subWeeks(now, 1); return { start: startOfWeek(lw, { weekStartsOn: 1 }), end: endOfWeek(lw, { weekStartsOn: 1 }) }; }
    case 'this_month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month': { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
    case 'this_quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'this_year': return { start: startOfYear(now), end: endOfYear(now) };
    default: return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  }
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange, preset?: PresetKey) => void;
  className?: string;
  triggerClassName?: string;
}

export function DateRangeFilter({ value, onChange, className, triggerClassName }: DateRangeFilterProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>('this_week');
  const [mode, setMode] = useState<'presets' | 'custom_day' | 'custom_week' | 'custom_month' | 'custom_range'>('presets');
  const [popoverOpen, setPopoverOpen] = useState(false);

  // For custom month navigation
  const [customMonthDate, setCustomMonthDate] = useState(new Date());
  // For custom week navigation
  const [customWeekDate, setCustomWeekDate] = useState(new Date());

  const handlePreset = (preset: PresetKey) => {
    if (['custom_day', 'custom_week', 'custom_month', 'custom_range'].includes(preset)) {
      setMode(preset as any);
      return;
    }
    setActivePreset(preset);
    onChange(getPresetRange(preset), preset);
    setPopoverOpen(false);
  };

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    setActivePreset('custom_day');
    onChange({ start: startOfDay(day), end: endOfDay(day) }, 'custom_day');
    setPopoverOpen(false);
  };

  const handleWeekSelect = (offset: number) => {
    const next = addWeeks(customWeekDate, offset);
    setCustomWeekDate(next);
    const range = { start: startOfWeek(next, { weekStartsOn: 1 }), end: endOfWeek(next, { weekStartsOn: 1 }) };
    setActivePreset('custom_week');
    onChange(range, 'custom_week');
  };

  const handleMonthSelect = (offset: number) => {
    const next = addMonths(customMonthDate, offset);
    setCustomMonthDate(next);
    const range = { start: startOfMonth(next), end: endOfMonth(next) };
    setActivePreset('custom_month');
    onChange(range, 'custom_month');
  };

  const handleRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setActivePreset('custom_range');
      onChange({ start: startOfDay(range.from), end: endOfDay(range.to) }, 'custom_range');
      setPopoverOpen(false);
    }
  };

  const rangeLabel = useMemo(() => {
    const s = format(value.start, 'dd MMM', { locale: fr });
    const e = format(value.end, 'dd MMM yyyy', { locale: fr });
    return `${s} → ${e}`;
  }, [value]);

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center', className)}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('justify-start gap-2', triggerClassName)}>
            <CalendarIcon className="h-4 w-4" />
            <span className="text-sm">{PRESET_LABELS[activePreset]}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {mode === 'presets' && (
            <div className="p-3 space-y-1 min-w-[200px]">
              <p className="text-xs font-medium text-muted-foreground mb-2">Périodes rapides</p>
              {QUICK_PRESETS.map((p) => (
                <Button
                  key={p}
                  variant={activePreset === p ? 'default' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => handlePreset(p)}
                >
                  {PRESET_LABELS[p]}
                </Button>
              ))}
              <div className="border-t my-2" />
              <p className="text-xs font-medium text-muted-foreground mb-2">Personnalisé</p>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm" onClick={() => setMode('custom_day')}>
                📅 Jour précis
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm" onClick={() => setMode('custom_week')}>
                📅 Semaine précise
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm" onClick={() => setMode('custom_month')}>
                📅 Mois précis
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm" onClick={() => setMode('custom_range')}>
                📅 Plage personnalisée
              </Button>
            </div>
          )}

          {mode === 'custom_day' && (
            <div className="p-2">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Button variant="ghost" size="sm" onClick={() => setMode('presets')}>← Retour</Button>
                <span className="text-sm font-medium">Jour précis</span>
              </div>
              <Calendar
                mode="single"
                onSelect={handleDaySelect}
                locale={fr}
                className="p-3 pointer-events-auto"
              />
            </div>
          )}

          {mode === 'custom_week' && (
            <div className="p-4 min-w-[240px]">
              <div className="flex items-center gap-2 mb-3">
                <Button variant="ghost" size="sm" onClick={() => setMode('presets')}>← Retour</Button>
                <span className="text-sm font-medium">Semaine précise</span>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => handleWeekSelect(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {format(startOfWeek(customWeekDate, { weekStartsOn: 1 }), 'dd MMM', { locale: fr })}
                    {' → '}
                    {format(endOfWeek(customWeekDate, { weekStartsOn: 1 }), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleWeekSelect(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="default" size="sm" className="w-full mt-3" onClick={() => setPopoverOpen(false)}>
                Confirmer
              </Button>
            </div>
          )}

          {mode === 'custom_month' && (
            <div className="p-4 min-w-[240px]">
              <div className="flex items-center gap-2 mb-3">
                <Button variant="ghost" size="sm" onClick={() => setMode('presets')}>← Retour</Button>
                <span className="text-sm font-medium">Mois précis</span>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => handleMonthSelect(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-medium capitalize">
                  {format(customMonthDate, 'MMMM yyyy', { locale: fr })}
                </p>
                <Button variant="ghost" size="icon" onClick={() => handleMonthSelect(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="default" size="sm" className="w-full mt-3" onClick={() => setPopoverOpen(false)}>
                Confirmer
              </Button>
            </div>
          )}

          {mode === 'custom_range' && (
            <div className="p-2">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Button variant="ghost" size="sm" onClick={() => setMode('presets')}>← Retour</Button>
                <span className="text-sm font-medium">Plage personnalisée</span>
              </div>
              <Calendar
                mode="range"
                selected={{ from: value.start, to: value.end }}
                onSelect={handleRangeSelect as any}
                numberOfMonths={2}
                locale={fr}
                className="p-3 pointer-events-auto"
              />
            </div>
          )}
        </PopoverContent>
      </Popover>

      <p className="text-sm text-muted-foreground">
        {rangeLabel}
      </p>
    </div>
  );
}

// Helper to get default range (this week)
export function getDefaultDateRange(): DateRange {
  return getPresetRange('this_week');
}
