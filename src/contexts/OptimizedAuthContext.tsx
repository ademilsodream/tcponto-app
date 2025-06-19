import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
  const [initialized, setInitialized] = useState(false);

  const hasAccess = !!(profile && profile.can_register_time === true);

  const logout = useCallback(async () => {
    console.log('🔐 Iniciando logout...');
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      // Os estados serão resetados automaticamente pelo onAuthStateChange
      console.log('✅ Logout realizado com sucesso');
    } catch (error) {
      console.error('❌ Erro durante logout:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    if (!userId) return;
    
    console.log('📥 Carregando perfil para usuário:', userId);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          hourly_rate,
          overtime_rate,
          employee_code,
          status,
          shift_id,
          department_id,
          job_function_id,
          can_register_time,
          departments:department_id(id, name),
          job_functions:job_function_id(id, name)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao carregar perfil:', error);
        setProfile(null);
        return;
      }

      if (data) {
        console.log('✅ Perfil carregado com sucesso:', data);
        setProfile(data);
      } else {
        console.log('⚠️ Nenhum perfil encontrado para o usuário');
        setProfile(null);
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao carregar perfil:', error);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      console.log('🚀 Inicializando autenticação...');
      
      try {
        // Primeiro, verificar se já existe uma sessão
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          setIsLoading(false);
          setInitialized(true);
          return;
        }

        if (mounted) {
          if (session?.user) {
            console.log('✅ Sessão existente encontrada:', session.user.email);
            setUser(session.user);
            await loadProfile(session.user.id);
          } else {
            console.log('ℹ️ Nenhuma sessão ativa encontrada');
            setUser(null);
            setProfile(null);
          }
          setIsLoading(false);
          setInitialized(true);
        }
      } catch (error) {
        console.error('❌ Erro durante inicialização:', error);
        if (mounted) {
          setIsLoading(false);
          setInitialized(true);
        }
      }
    };

    // Configurar listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || !initialized) return;

      console.log('🔄 Mudança de estado de auth:', event, session?.user?.email || 'sem usuário');

      switch (event) {
        case 'SIGNED_IN':
          if (session?.user) {
            setUser(session.user);
            setIsLoading(true);
            await loadProfile(session.user.id);
            setIsLoading(false);
          }
          break;
        
        case 'SIGNED_OUT':
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          break;
        
        case 'TOKEN_REFRESHED':
          // Não precisamos fazer nada especial aqui
          console.log('🔄 Token renovado');
          break;
        
        default:
          break;
      }
    });

    // Inicializar a autenticação
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, initialized]);

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

// Hook adicional para verificar se o usuário tem permissões específicas
export const useAuthPermissions = () => {
  const { profile } = useOptimizedAuth();
  
  return {
    canRegisterTime: profile?.can_register_time ?? false,
    hasProfile: !!profile,
    isActive: profile?.status === 'active',
    hasShift: !!profile?.shift_id,
    hasDepartment: !!profile?.department_id,
  };
};