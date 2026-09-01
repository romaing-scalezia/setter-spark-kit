import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'user' | 'coach' | 'admin';
export type MembershipPlan = 'free' | 'starter' | 'pro' | 'coach';
export type MembershipStatus = 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';

type ProfileData = {
  full_name: string | null;
  email: string | null;
  role: AppRole | null;
  debug_role_switch_enabled: boolean;
  onboarding_completed: boolean;
  source: string | null;
  product_tour_seen: boolean;
};

type ProspectQuota = {
  used: number;
  total: number;
  remaining: number;
  resetAt: string | null;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  activeRole: AppRole;
  profile: ProfileData | null;
  plan: MembershipPlan;
  membershipStatus: MembershipStatus;
  trialEndsAt: string | null;
  prospectQuota: ProspectQuota;
  hasSalesNav: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  switchRole: (role: AppRole) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [plan, setPlan] = useState<MembershipPlan>('free');
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>('trialing');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [prospectQuota, setProspectQuota] = useState<ProspectQuota>({ used: 0, total: 400, remaining: 400, resetAt: null });
  const [hasSalesNav, setHasSalesNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchUserData = useCallback(async (userId: string, fullName?: string | null, source?: string | null) => {
    try {
      await supabase.rpc('bootstrap_current_user', { _full_name: fullName ?? null });

      // Persist source from signup URL if provided and profile doesn't have one yet
      if (source && source !== 'organic') {
        await (supabase as any).from('profiles').update({ source }).eq('id', userId).is('source', null);
      }

      const [rolesRes, profileRes, membershipRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('full_name, email, role, debug_role_switch_enabled, onboarding_completed, source, product_tour_seen, has_sales_nav').eq('id', userId).single(),
        (supabase as any).from('memberships').select('plan, status, current_period_end, prospects_imported_count, prospects_imported_reset_at').eq('user_id', userId).maybeSingle(),
      ]);

      if (rolesRes.data?.role) {
        setRoles([rolesRes.data.role as AppRole]);
      } else if (profileRes.data?.role) {
        setRoles([profileRes.data.role as AppRole]);
      } else {
        setRoles(['user']);
      }

      if (profileRes.data) {
        setProfile({
          full_name: profileRes.data.full_name,
          email: profileRes.data.email,
          role: profileRes.data.role as AppRole | null,
          debug_role_switch_enabled: profileRes.data.debug_role_switch_enabled ?? false,
          onboarding_completed: profileRes.data.onboarding_completed ?? false,
          source: (profileRes.data as any).source ?? null,
          product_tour_seen: (profileRes.data as any).product_tour_seen ?? false,
        });
        setHasSalesNav((profileRes.data as any).has_sales_nav ?? false);

        // Identifie l'utilisateur dans Crisp
        if (typeof window !== 'undefined' && (window as any).$crisp) {
          const crisp = (window as any).$crisp;
          const email = profileRes.data.email;
          if (email) crisp.push(['set', 'user:email', [email]]);
          if (profileRes.data.full_name) crisp.push(['set', 'user:nickname', [profileRes.data.full_name]]);
        }
      }

      let membership = membershipRes?.data;

      // Nouvel utilisateur : crée le membership avec trial 14j
      if (!membership) {
        const now = new Date();
        const periodStart = now.toISOString();
        const periodEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: created } = await (supabase as any)
          .from('memberships')
          .insert({ user_id: userId, plan: 'free', status: 'trialing', current_period_start: periodStart, current_period_end: periodEnd })
          .select('plan, status, current_period_end')
          .single();
        membership = created;
      }

      setPlan((membership?.plan as MembershipPlan) ?? 'free');
      setMembershipStatus((membership?.status as MembershipStatus) ?? 'trialing');
      setTrialEndsAt(membership?.current_period_end ?? null);

      const quotaMap: Record<string, number> = { free: 400, starter: 400, pro: 2000, coach: 0 };
      const planKey = (membership?.plan as string) ?? 'free';
      const total = quotaMap[planKey] ?? 0;
      const used = membership?.prospects_imported_count ?? 0;
      setProspectQuota({ used, total, remaining: Math.max(0, total - used), resetAt: membership?.prospects_imported_reset_at ?? null });
    } catch (err) {
      console.error('fetchUserData error:', err);
      setRoles(['user']);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!user) return;
    await fetchUserData(user.id, user.user_metadata?.full_name ?? null);
  }, [fetchUserData, user]);

  useEffect(() => {
    // 1. First restore session from storage
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        await fetchUserData(currentSession.user.id, currentSession.user.user_metadata?.full_name ?? null, currentSession.user.user_metadata?.source ?? null);
      }
      setLoading(false);
      initializedRef.current = true;
    });

    // 2. Then listen for subsequent changes (sign in/out/token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRoles([]);
        setProfile(null);
        if (initializedRef.current) {
          // Already initialized, just clear state
        }
        return;
      }

      // Fire and forget - do NOT await inside onAuthStateChange
      if (initializedRef.current) {
        // Only fetch user data on subsequent auth changes (not initial load)
        fetchUserData(nextSession.user.id, nextSession.user.user_metadata?.full_name ?? null, nextSession.user.user_metadata?.source ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const switchRole = async (role: AppRole) => {
    try {
      if (!user) throw new Error('Utilisateur non connecté');
      const { error } = await supabase.rpc('set_user_role', { _target_user_id: user.id, _role: role });
      if (error) throw error;
      await refreshUserData();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const activeRole = roles[0] || profile?.role || 'user';

  return (
    <AuthContext.Provider value={{ user, session, roles, activeRole, profile, plan, membershipStatus, trialEndsAt, prospectQuota, hasSalesNav, loading, signOut, refreshUserData, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
