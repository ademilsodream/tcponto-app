import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { PushNotificationService } from '@/services/PushNotificationService';
import { useSessionManager } from '@/hooks/useSessionManager';
import { debugLog, isMobile, checkConnectivity } from '@/utils/debugLogger';
import { mobileSupabase, mobileLogin, getMobileSession, checkSupabaseConnectivity } from '@/integrations/supabase/mobileClient';
import { Capacitor } from '@capacitor/core';

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
  sessionSettings: any;
  sessionWarning: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  loginWithRememberMe: (email: string, password: string, rememberMe: boolean) => Promise<{ error: any }>;
  renewSession: () => Promise<boolean>;
  dismissSessionWarning: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const OptimizedAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionWarningDismissed, setSessionWarningDismissed] = useState(false);

  // Detectar plataforma para escolher o client correto
  const isNative = typeof Capacitor !== 'undefined' && typeof (Capacitor as any).isNativePlatform === 'function' 
    ? Capacitor.isNativePlatform() 
    : false;
  const authClient = isNative ? mobileSupabase : supabase;

  const {
    sessionSettings,
    sessionWarning,
    sessionExpiry,
    createUserSession,
    updateSessionActivity,
    checkSessionExpiry,
    renewToken,
    cleanupExpiredSessions
  } = useSessionManager();

  const hasAccess = !!(profile && profile.can_register_time === true);

  const loadProfile = useCallback(async (userId: string) => {
    if (!userId) {
      debugLog('ERROR', 'Tentativa de carregar perfil sem userId');
      return;
    }
    
    debugLog('INFO', 'Carregando perfil para usuário', { userId, isMobile: isMobile() });
    
    // Verificar conectividade primeiro
    const isConnected = isNative ? await checkSupabaseConnectivity() : await checkConnectivity();
    if (!isConnected) {
      debugLog('ERROR', 'Sem conectividade com o servidor');
      return;
    }
    
    try {
      const { data, error } = await authClient
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
        debugLog('ERROR', 'Erro ao carregar perfil', { error: error.message, code: error.code });
        setProfile(null);
        return;
      }

      if (data) {
        const profileWithLocationTracking: Profile = {
          ...data,
          use_location_tracking: true // Valor padrão conforme schema do banco
        };

        debugLog('INFO', 'Perfil carregado com sucesso', { 
          name: profileWithLocationTracking.name, 
          status: profileWithLocationTracking.status, 
          can_register_time: profileWithLocationTracking.can_register_time,
          use_location_tracking: profileWithLocationTracking.use_location_tracking
        });
        
        setProfile(profileWithLocationTracking);
        
        // Atualizar atividade da sessão
        await updateSessionActivity(userId);
      } else {
        debugLog('WARN', 'Nenhum perfil encontrado');
        setProfile(null);
      }
    } catch (error) {
      debugLog('ERROR', 'Erro inesperado ao carregar perfil', { error });
      setProfile(null);
    }
  }, [updateSessionActivity, authClient, isNative]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  }, [user?.id, loadProfile]);

  const logout = useCallback(async () => {
    console.log('🔐 Iniciando logout...');
    try {
      setIsLoading(true);
      
      // Limpar sessões personalizadas
      if (user?.id) {
        await authClient
          .from('user_sessions')
          .delete()
          .eq('user_id', user.id);
      }
      
      await authClient.auth.signOut();
      console.log('✅ Logout realizado com sucesso');
    } catch (error) {
      console.error('❌ Erro durante logout:', error);
    }
  }, [user?.id, authClient]);

  const loginWithRememberMe = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    debugLog('INFO', 'Tentativa de login', { email, rememberMe, isMobile: isMobile(), isNative });
    
    try {
      // Verificar conectividade primeiro
      const isConnected = isNative ? await checkSupabaseConnectivity() : await checkConnectivity();
      if (!isConnected) {
        debugLog('ERROR', 'Sem conectividade para login');
        return { error: { message: 'Sem conectividade com o servidor' } };
      }
      
      let data: any = null;
      let error: any = null;

      if (isNative) {
        const result = await mobileLogin(email, password);
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        data = result.data;
        error = result.error;
      }

      if (error) {
        return { error };
      }

      if (data.user) {
        // Criar sessão personalizada
        await createUserSession(data.user, rememberMe);
        
        // Salvar preferência de "lembrar-me"
        localStorage.setItem('tcponto_remember_me', rememberMe.toString());
        
        console.log('✅ Login com sessão personalizada realizado:', {
          userId: data.user.id,
          rememberMe,
          sessionDuration: rememberMe ? `${sessionSettings.sessionDurationDays} dias` : '24 horas'
        });
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  }, [createUserSession, sessionSettings.sessionDurationDays, isNative]);

  const renewSession = useCallback(async () => {
    const success = await renewToken();
    if (success) {
      setSessionWarningDismissed(false);
    }
    return success;
  }, [renewToken]);

  const dismissSessionWarning = useCallback(() => {
    setSessionWarningDismissed(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    debugLog('INFO', 'Inicializando sistema de autenticação', { isMobile: isMobile(), isNative });

    const { data: { subscription } } = authClient.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      console.log('🔄 Auth state change:', event, session?.user?.email || 'sem usuário');

      const newUser = session?.user ?? null;
      setUser(newUser);

      // Verificar expiração da sessão
      checkSessionExpiry(session);

      if (event === 'SIGNED_OUT' || !session) {
        console.log('👋 Usuário deslogado');
        setProfile(null);
        setIsLoading(false);
        setSessionWarningDismissed(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newUser) {
          console.log('👤 Usuário logado:', newUser.email);
          setIsLoading(true);
          
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

    const initializeSession = async () => {
      try {
        console.log('🔍 Verificando sessão existente...');
        const { data: { session }, error } = isNative 
          ? await getMobileSession() 
          : await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          setIsLoading(false);
          return;
        }

        if (session?.user && mounted) {
          console.log('✅ Sessão existente encontrada:', session.user.email);
          setUser(session.user);
          setIsLoading(true);
          
          // Verificar expiração da sessão
          checkSessionExpiry(session);
          
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

    initializeSession();

    return () => {
      console.log('🧹 Limpando auth context...');
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkSessionExpiry, loadProfile, authClient, isNative]);

  useEffect(() => {
    if (user && user.id) {
      PushNotificationService.getInstance().initialize(user.id);
    }
  }, [user]);

  // Verificação periódica de sessão
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        checkSessionExpiry(session);
      });
    }, 5 * 60 * 1000); // Verificar a cada 5 minutos

    return () => clearInterval(interval);
  }, [user, checkSessionExpiry]);

  const value = {
    user,
    profile,
    isLoading,
    hasAccess,
    sessionSettings,
    sessionWarning: sessionWarning && !sessionWarningDismissed,
    refreshProfile,
    logout,
    loginWithRememberMe,
    renewSession,
    dismissSessionWarning,
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
