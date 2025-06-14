
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
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
  role: 'admin' | 'user'; // ✨ Adicionado role à interface
  departments?: { id: string; name: string };
  job_functions?: { id: string; name: string };
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ✨ Cache otimizado para o perfil
const profileCache = new Map<string, { data: Profile; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // ✨ Reduzido para 2 minutos

export const OptimizedAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      // Verificar cache primeiro
      const cachedProfile = profileCache.get(userId);
      if (cachedProfile && Date.now() - cachedProfile.timestamp < CACHE_DURATION) {
        setProfile(cachedProfile.data);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*, departments(id, name), job_functions(id, name)')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar perfil:', error);
        return;
      }

      if (data) {
        const profileData: Profile = {
          ...data,
          role: data.role || 'user' // ✨ Garantir que role sempre existe
        };
        
        // Atualizar cache
        profileCache.set(userId, {
          data: profileData,
          timestamp: Date.now()
        });
        
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      // Limpar cache ao forçar refresh
      profileCache.delete(user.id);
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            await loadProfile(session.user.id);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Erro na inicialização:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          // Limpar cache ao fazer logout
          profileCache.clear();
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(() => ({
    user,
    profile,
    isLoading,
    refreshProfile
  }), [user, profile, isLoading, refreshProfile]);

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
