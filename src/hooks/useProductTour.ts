import { useCallback, useState } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { LayoutDashboard, Inbox, Zap, Users, Bell, BookOpen, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
  const { profile } = useAuth();
  const [tourDone, setTourDone] = useState(() => localStorage.getItem(TOUR_DONE_KEY) === 'true');

  const startTour = useCallback((onFinish?: () => void) => {
    const tourInstance = driver({
      showProgress: true,
      progressText: '{{current}} sur {{total}}',
      showButtons: ['next', 'close'],
      nextBtnText: 'Suivant →',
      doneBtnText: 'Terminer',
      allowClose: true,
      steps: TOUR_STEPS,
      onDestroyed: () => {
        localStorage.setItem(TOUR_DONE_KEY, 'true');
        setTourDone(true);
        onFinish?.();
      },
    });
    tourInstance.drive();
  }, []);

  const shouldShowTour = !!profile?.onboarding_completed && !tourDone;

  return { shouldShowTour, startTour };
}
