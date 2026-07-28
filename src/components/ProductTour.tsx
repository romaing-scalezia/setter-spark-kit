import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductTour, MENU_ITEMS } from '@/hooks/useProductTour';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LayoutGrid, ArrowRight } from 'lucide-react';

const DEMO_CALENDAR_URL = 'https://calendar.google.com/appointments/schedules/AcZssZ3Ps_JwCfgLfulSONCwXbJtYw4HQNDEuQvXkvxqThmlcaCc1boLyJKOKbTuM9eiOZpmol1lZRBz';

export function ProductTour() {
  const { shouldShowTour, startTour } = useProductTour();
  const navigate = useNavigate();
  const started = useRef(false);
  const [showRecap, setShowRecap] = useState(false);

  useEffect(() => {
    if (shouldShowTour && !started.current) {
      started.current = true;
      startTour(() => setShowRecap(true));
    }
  }, [shouldShowTour, startTour]);

  return (
    <>
      <style>{`
        .driver-popover-next-btn {
          background: #5851E8 !important;
          color: #fff !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 6px 16px !important;
          font-weight: 600 !important;
          font-size: 13px !important;
        }
        .driver-popover-next-btn:hover,
        .driver-popover-next-btn:focus {
          background: #4A43DA !important;
          color: #fff !important;
        }
      `}</style>
      <Dialog open={showRecap} onOpenChange={setShowRecap}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <div className="space-y-3 bg-[#5851E8] px-8 pb-8 pt-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white">
              <LayoutGrid className="h-7 w-7 text-[#5851E8]" />
            </div>
            <DialogTitle className="text-xl font-semibold text-white">Vous avez fait le tour !</DialogTitle>
            <p className="text-sm text-white/70">Voici ce que vous avez découvert</p>
          </div>

          <div className="space-y-6 px-8 pb-8 pt-6">
            <ul className="space-y-3">
              {MENU_ITEMS.map(item => (
                <li key={item.key} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.title}</span>
                      {item.required && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">⚡ Requis</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-2 pt-1">
              <Button
                className="w-full"
                size="lg"
                onClick={() => { setShowRecap(false); navigate('/settings?tab=linkedin'); }}
              >
                Connecter mon LinkedIn <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                size="lg"
                onClick={() => window.open(DEMO_CALENDAR_URL, '_blank')}
              >
                Réserver une démo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
