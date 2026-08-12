import { ArrowRight } from 'lucide-react';

interface ConversionRatesProps {
  conversations: number;
  responses: number;
  callsProposed: number;
  meetingsBooked: number;
  closedWon: number;
}

function pct(num: number, den: number): string {
  if (den === 0) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

export function ConversionRates({ conversations, responses, callsProposed, meetingsBooked, closedWon }: ConversionRatesProps) {
  const rates = [
    { label: 'Réponse', value: pct(responses, conversations), sub: `${responses}/${conversations}` },
    { label: 'Appel proposé', value: pct(callsProposed, responses), sub: `${callsProposed}/${responses}` },
    { label: 'Booking', value: pct(meetingsBooked, callsProposed), sub: `${meetingsBooked}/${callsProposed}` },
    { label: 'Conversion', value: pct(closedWon, meetingsBooked), sub: `${closedWon}/${meetingsBooked}` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {rates.map((r) => (
        <div key={r.label} className="rounded-lg border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-primary">{r.value}</p>
          <p className="text-xs font-medium text-foreground mt-1">{r.label}</p>
          <p className="text-xs text-muted-foreground">{r.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function MiniFunnel({ conversations, responses, callsProposed, meetingsBooked }: ConversionRatesProps) {
  const steps = [
    { label: 'Conversations', count: conversations },
    { label: 'Réponses', count: responses },
    { label: 'Appels', count: callsProposed },
    { label: 'RDV', count: meetingsBooked },
  ];
  const max = Math.max(...steps.map((s) => s.count), 1);

  return (
    <div className="flex items-end gap-1 h-16">
      {steps.map((s, i) => (
        <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-foreground">{s.count}</span>
          <div
            className="w-full rounded-t bg-primary/80 transition-all duration-500"
            style={{ height: `${Math.max((s.count / max) * 100, 8)}%` }}
          />
          <span className="text-[10px] text-muted-foreground leading-tight text-center">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
