import { useAuth } from '@/contexts/AuthContext';

export function usePlan() {
  const { plan, membershipStatus, trialEndsAt, activeRole, profile } = useAuth();

  const isPrivilegedRole = activeRole === 'coach' || activeRole === 'admin';

  const isTrialing = membershipStatus === 'trialing';
  const trialExpired = isTrialing && trialEndsAt ? new Date(trialEndsAt) < new Date() : false;
  const trialDaysLeft = isTrialing && trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isActive = membershipStatus === 'active';

  // Peut accéder à l'app : trial en cours OU abonnement actif OU rôle privilégié
  const canAccess = isPrivilegedRole || isActive || (isTrialing && !trialExpired);

  // Accès aux features StarterPack (leaderboard, notes coach) : rôle privilégié OU source starterpack
  const hasStarterAccess = isPrivilegedRole || profile?.source === 'starterpack';

  return { plan, membershipStatus, isTrialing, trialExpired, trialDaysLeft, isActive, canAccess, hasStarterAccess };
}
