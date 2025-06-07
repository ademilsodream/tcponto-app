import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { PushNotificationService } from '@/services/PushNotificationService';

// Cache para perfis de usuário
const profileCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

interface AuthContextType {
  user: User | null;
  profile: any;
  isLoading: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // Verificar cache
      const cachedProfile = profileCache.get(userId);
      if (cachedProfile && Date.now() - cachedProfile.timestamp < CACHE_DURATION) {
        return cachedProfile.data;
      }

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

      // Atualizar cache
      profileCache.set(userId, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }, [user?.id, fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Erro no login:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        const profileData = await fetchProfile(data.user.id);
        setProfile(profileData);
        
        const pushService = PushNotificationService.getInstance();
        await pushService.initialize(data.user.id);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Erro no login:', error);
      return { success: false, error: error.message };
    }
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      if (user?.id) {
        const pushService = PushNotificationService.getInstance();
        await pushService.removeToken(user.id);
        profileCache.delete(user.id); // Limpar cache ao fazer logout
      }

      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }, [user?.id]);

  const logout = signOut;

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            const profileData = await fetchProfile(session.user.id);
            if (mounted) {
              setProfile(profileData);
            }
            
            const pushService = PushNotificationService.getInstance();
            await pushService.initialize(session.user.id);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Erro ao inicializar auth:', error);
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
          const profileData = await fetchProfile(session.user.id);
          if (mounted) {
            setProfile(profileData);
          }
          
          const pushService = PushNotificationService.getInstance();
          await pushService.initialize(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          profileCache.clear(); // Limpar todo o cache ao fazer logout
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
          if (!profile) {
            const profileData = await fetchProfile(session.user.id);
            if (mounted) {
              setProfile(profileData);
            }
          }
        }
        
        if (mounted) {
          setIsLoading(false);
        }
      }
    );

    // Refresh token a cada 30 minutos (aumentado de 15 para 30)
    const refreshInterval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.auth.refreshSession();
        }
      } catch (error) {
        console.error('Erro ao renovar sessão:', error);
      }
    }, 30 * 60 * 1000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [fetchProfile]);

  const value = {
    user,
    profile,
    isLoading,
    loading: isLoading,
    signOut,
    logout,
    login,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
