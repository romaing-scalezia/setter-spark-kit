import { useCallback, useState } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { LayoutDashboard, Inbox, Zap, Users, Bell, BookOpen, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const TOUR_DONE_KEY = 'sf_tour_done';

type MenuItem = {
  key: string;
  icon: React.ElementType;
  title: string;
  description: string;
  required?: boolean;
};

export const MENU_ITEMS: MenuItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, title: 'Dashboard', description: "Vue d'ensemble de votre activité et performances" },
  { key: 'inbox', icon: Inbox, title: 'Inbox', description: 'Toutes vos conversations LinkedIn au même endroit' },
  { key: 'campaigns', icon: Zap, title: 'Campagnes', description: 'Prospection automatisée en séquences multi-étapes' },
  { key: 'leads', icon: Users, title: 'Leads', description: 'Suivez chaque prospect de la prise de contact au closing' },
  { key: 'followup', icon: Bell, title: 'Follow-up', description: 'Ne laissez plus aucune relance sans réponse' },
  { key: 'resources', icon: BookOpen, title: 'Ressources', description: "Vos templates de messages prêts à l'emploi" },
  { key: 'settings', icon: Settings, title: 'Paramètres', description: "Connectez LinkedIn pour débloquer l'inbox et les campagnes", required: true },
];

const TOUR_STEPS: DriveStep[] = MENU_ITEMS.map(item => ({
  element: `[data-tour="${item.key}"]`,
  popover: {
    title: item.key === 'settings' ? 'Paramètres ⚡' : item.title,
    description: item.description,
  },
}));

export function useProductTour() {
  const { user, profile } = useAuth();
  const [tourDone, setTourDone] = useState(() => localStorage.getItem(TOUR_DONE_KEY) === 'true');

  const markTourSeen = useCallback(() => {
    localStorage.setItem(TOUR_DONE_KEY, 'true');
    setTourDone(true);
    if (user) {
      // Le query builder Supabase n'envoie la requete que lorsqu'il est
      // awaite/then-e (comportement "thenable" paresseux) — sans .then()
      // ici, l'appel n'etait jamais reellement declenche et la colonne
      // ne se mettait donc jamais a jour en base.
      (supabase as any).from('profiles').update({ product_tour_seen: true }).eq('id', user.id)
        .then(({ error }: { error: unknown }) => {
          if (error) console.error('[useProductTour] failed to persist product_tour_seen:', error);
        });
    }
  }, [user]);

  const startTour = useCallback((onFinish?: () => void) => {
    // Marked as seen immediately (not just on completion) so the tour
    // doesn't reappear on the next login if the user closes the tab
    // instead of finishing or explicitly dismissing it.
    markTourSeen();

    const tourInstance = driver({
      showProgress: true,
      progressText: '{{current}} sur {{total}}',
      showButtons: ['next', 'close'],
      nextBtnText: 'Suivant →',
      doneBtnText: 'Terminer',
      allowClose: true,
      steps: TOUR_STEPS,
      onDestroyed: () => {
        onFinish?.();
      },
    });
    tourInstance.drive();
  }, [markTourSeen]);

  const shouldShowTour = !!profile?.onboarding_completed && !profile?.product_tour_seen && !tourDone;

  return { shouldShowTour, startTour };
}
