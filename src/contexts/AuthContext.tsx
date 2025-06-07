
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { PushNotificationService } from '@/services/PushNotificationService';

interface AuthContextType {
  user: User | null;
  profile: any;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          departments (
            id,
            name
          ),
          job_functions (
            id,
            name
          )
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  const signOut = async () => {
    try {
      // Remover token de push notification antes de fazer logout
      if (user?.id) {
        const pushService = PushNotificationService.getInstance();
        await pushService.removeToken(user.id);
      }

      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  useEffect(() => {
    // Configurar cliente Supabase para persistir sessão por mais tempo
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id).then(setProfile);
        
        // Inicializar push notifications para usuários logados
        const pushService = PushNotificationService.getInstance();
        pushService.initialize(session.user.id);
      }
      setIsLoading(false);
    });

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
          
          // Inicializar push notifications
          const pushService = PushNotificationService.getInstance();
          await pushService.initialize(session.user.id);
          
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Manter usuário logado quando token é renovado
          setUser(session.user);
          if (!profile) {
            const profileData = await fetchProfile(session.user.id);
            setProfile(profileData);
          }
        }
        
        setIsLoading(false);
      }
    );

    // Configurar refresh automático mais robusto
    const refreshInterval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // Sessão ainda válida, renovar token se necessário
          await supabase.auth.refreshSession();
        }
      } catch (error) {
        console.log('Erro ao renovar sessão:', error);
      }
    }, 15 * 60 * 1000); // A cada 15 minutos

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const value = {
    user,
    profile,
    isLoading,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
