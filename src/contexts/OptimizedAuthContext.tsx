import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  name: string;
  email: string;
  hourly_rate: number;
  overtime_rate: number;
  employee_code?: string;
  status?: string;
  shift_id?: string;
  department_id?: string;
  job_function_id?: string;
  can_register_time: boolean;
  departments?: { id: string; name: string };
  job_functions?: { id: string; name: string };
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  hasAccess: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const OptimizedAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasAccess = !!(profile && profile.can_register_time === true);

  const logout = async () => {
    console.log('🔐 Iniciando logout...');
    try {
      await supabase.auth.signOut();
      console.log('🔒 setUser(null) chamado por logout');
      console.trace('🔍 Stack trace do setUser(null) por logout');
      setUser(null);
      setProfile(null);
      console.log('✅ Logout realizado com sucesso');
    } catch (error) {
      console.error('❌ Erro durante logout:', error);
    }
  };

  const loadProfile = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      console.log('🟢 RAW PROFILE DATA:', { data, error, userId });
      if (error) {
        setProfile(null);
        setIsLoading(false);
        return;
      }
      if (data) {
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (error) {
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      setIsLoading(true);
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !mounted) {
          setIsLoading(false);
          return;
        }
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        setUser(null);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });
    initializeAuth();
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    profile,
    isLoading,
    hasAccess,
    refreshProfile,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useOptimizedAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useOptimizedAuth must be used within an OptimizedAuthProvider');
  }
  return context;
};
