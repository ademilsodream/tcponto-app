
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
  role: 'admin' | 'user';
  can_register_time: boolean; // ✨ Novo campo para controle de acesso
  departments?: { id: string; name: string };
  job_functions?: { id: string; name: string };
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  hasAccess: boolean; // ✨ Novo campo para verificar se pode acessar
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>; // ✨ Novo método de logout
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ✨ Cache otimizado para o perfil
const profileCache = new Map<string, { data: Profile; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

export const OptimizedAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✨ Função para verificar se o usuário tem acesso
  const hasAccess = useMemo(() => {
    if (!profile) return false;
    return profile.status === 'active' && profile.can_register_time === true;
  }, [profile]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      profileCache.clear();
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      // Verificar cache primeiro
      const cachedProfile = profileCache.get(userId);
      if (cachedProfile && Date.now() - cachedProfile.timestamp < CACHE_DURATION) {
        setProfile(cachedProfile.data);
        return;
      }

      // ✨ Timeout para query de perfil
      const profilePromise = supabase
        .from('profiles')
        .select(`
          *,
          departments(id, name),
          job_functions(id, name)
        `)
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile timeout')), 8000);
      });

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar perfil:', error);
        return;
      }

      if (data) {
        // ✨ Validar role com type guard
        const validateRole = (role: any): 'admin' | 'user' => {
          return role === 'admin' ? 'admin' : 'user';
        };

        const profileData: Profile = {
          ...data,
          role: validateRole(data.role),
          can_register_time: Boolean(data.can_register_time) // ✨ Garantir que seja boolean
        };
        
        // ✨ Verificar se o usuário tem acesso básico
        if (profileData.status !== 'active') {
          console.warn('⚠️ Usuário com status inativo:', profileData.status);
          // Forçar logout para usuários inativos
          await logout();
          return;
        }

        // Atualizar cache
        profileCache.set(userId, {
          data: profileData,
          timestamp: Date.now()
        });
        
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      // ✨ Em caso de erro, fazer logout por segurança
      if (error instanceof Error && error.message === 'Profile timeout') {
        console.warn('⚠️ Timeout no carregamento do perfil - fazendo logout');
        await logout();
      }
    }
  }, [logout]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      profileCache.delete(user.id);
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  useEffect(() => {
    let mounted = true;
    let initializationTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        // ✨ Timeout de segurança para auth
        initializationTimeout = setTimeout(() => {
          if (mounted) {
            console.warn('⚠️ Auth initialization timeout - prosseguindo');
            setIsLoading(false);
          }
        }, 8000);

        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            await loadProfile(session.user.id);
          }
          clearTimeout(initializationTimeout);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Erro na inicialização:', error);
        if (mounted) {
          clearTimeout(initializationTimeout);
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
          profileCache.clear();
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(() => ({
    user,
    profile,
    isLoading,
    hasAccess, // ✨ Novo campo
    refreshProfile,
    logout // ✨ Novo método
  }), [user, profile, isLoading, hasAccess, refreshProfile, logout]);

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
