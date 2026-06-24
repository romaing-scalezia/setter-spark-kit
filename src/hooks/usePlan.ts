import { useAuth } from '@/contexts/AuthContext';

const STARTER_PLANS = ['starter', 'pro', 'coach'] as const;

export function usePlan() {
  const { plan, membershipStatus, trialEndsAt, activeRole } = useAuth();

  const isPrivilegedRole = activeRole === 'coach' || activeRole === 'admin';

  const isTrialing = membershipStatus === 'trialing';
  const trialExpired = isTrialing && trialEndsAt ? new Date(trialEndsAt) < new Date() : false;
  const trialDaysLeft = isTrialing && trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isActive = membershipStatus === 'active';

  // Peut accéder à l'app : trial en cours OU abonnement actif OU rôle privilégié
  const canAccess = isPrivilegedRole || isActive || (isTrialing && !trialExpired);

  // Accès aux features StarterPack (leaderboard, notes coach)
  const hasStarterAccess = isPrivilegedRole || STARTER_PLANS.includes(plan as any);

  return { plan, membershipStatus, isTrialing, trialExpired, trialDaysLeft, isActive, canAccess, hasStarterAccess };
}
