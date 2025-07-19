import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { PushNotificationService } from '@/services/PushNotificationService';

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
  use_location_tracking: boolean;
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

  const loadProfile = useCallback(async (userId: string) => {
    if (!userId) {
      console.log('❌ Tentativa de carregar perfil sem userId');
      return;
    }
    
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
          use_location_tracking,
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
        console.log('✅ Perfil carregado:', { name: data.name, status: data.status, can_register_time: data.can_register_time, use_location_tracking: data.use_location_tracking });
        setProfile(data);
      } else {
        console.log('⚠️ Nenhum perfil encontrado');
        setProfile(null);
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao carregar perfil:', error);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  }, [user?.id, loadProfile]);

  const logout = useCallback(async () => {
    console.log('🔐 Iniciando logout...');
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      console.log('✅ Logout realizado com sucesso');
    } catch (error) {
      console.error('❌ Erro durante logout:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    console.log('🚀 Inicializando sistema de autenticação...');

    // 1. Configurar listener de mudanças de auth PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      console.log('🔄 Auth state change:', event, session?.user?.email || 'sem usuário');

      // Atualizar estado do usuário imediatamente
      const newUser = session?.user ?? null;
      setUser(newUser);

      // Processar mudanças de estado
      if (event === 'SIGNED_OUT' || !session) {
        console.log('👋 Usuário deslogado');
        setProfile(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newUser) {
          console.log('👤 Usuário logado:', newUser.email);
          setIsLoading(true);
          
          // Usar setTimeout para evitar problemas de deadlock
          setTimeout(() => {
            if (mounted) {
              loadProfile(newUser.id).finally(() => {
                if (mounted) {
                  setIsLoading(false);
                }
              });
            }
          }, 0);
        }
      }
    });

    // 2. Verificar sessão existente DEPOIS de configurar o listener
    const initializeSession = async () => {
      try {
        console.log('🔍 Verificando sessão existente...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          setIsLoading(false);
          return;
        }

        if (session?.user && mounted) {
          console.log('✅ Sessão existente encontrada:', session.user.email);
          setUser(session.user);
          setIsLoading(true);
          
          // Carregar perfil da sessão existente
          loadProfile(session.user.id).finally(() => {
            if (mounted) {
              setIsLoading(false);
            }
          });
        } else {
          console.log('ℹ️ Nenhuma sessão ativa');
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Erro durante inicialização:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Executar inicialização
    initializeSession();

    // Cleanup
    return () => {
      console.log('🧹 Limpando auth context...');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Sem dependências para evitar re-execução

  useEffect(() => {
    if (user && user.id) {
      PushNotificationService.getInstance().initialize(user.id);
    }
  }, [user]);

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

// Hook adicional para verificar permissões
export const useAuthPermissions = () => {
  const { profile } = useOptimizedAuth();
  
  return {
    canRegisterTime: profile?.can_register_time ?? false,
    hasProfile: !!profile,
    isActive: profile?.status === 'active',
    hasShift: !!profile?.shift_id,
    hasDepartment: !!profile?.department_id,
    useLocationTracking: profile?.use_location_tracking ?? true,
  };
};
