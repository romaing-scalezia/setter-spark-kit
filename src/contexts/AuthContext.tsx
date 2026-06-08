import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'user' | 'coach' | 'admin';

type ProfileData = {
  full_name: string | null;
  email: string | null;
  role: AppRole | null;
  debug_role_switch_enabled: boolean;
  onboarding_completed: boolean;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  activeRole: AppRole;
  profile: ProfileData | null;
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
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchUserData = useCallback(async (userId: string, fullName?: string | null) => {
    try {
      await supabase.rpc('bootstrap_current_user', { _full_name: fullName ?? null });

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('full_name, email, role, debug_role_switch_enabled, onboarding_completed').eq('id', userId).single(),
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
        });
      }
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
        await fetchUserData(currentSession.user.id, currentSession.user.user_metadata?.full_name ?? null);
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
        fetchUserData(nextSession.user.id, nextSession.user.user_metadata?.full_name ?? null);
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
    <AuthContext.Provider value={{ user, session, roles, activeRole, profile, loading, signOut, refreshUserData, switchRole }}>
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
