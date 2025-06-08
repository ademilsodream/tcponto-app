
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { PushNotificationService } from '@/services/PushNotificationService';

// Cache otimizado para perfis
const profileCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 3 * 60 * 1000; // Reduzido para 3 minutos

interface AuthContextType {
  user: User | null;
  profile: any;
  isLoading: boolean;
  loading: boolean;
  profileLoading: boolean; // ✨ Novo estado específico para perfil
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
  const [profileLoading, setProfileLoading] = useState(false); // ✨ Estado separado

  const fetchProfile = useCallback(async (userId: string, forceRefresh = false) => {
    try {
      setProfileLoading(true);
      
      // Verificar cache apenas se não for refresh forçado
      if (!forceRefresh) {
        const cachedProfile = profileCache.get(userId);
        if (cachedProfile && Date.now() - cachedProfile.timestamp < CACHE_DURATION) {
          setProfile(cachedProfile.data);
          setProfileLoading(false);
          return cachedProfile.data;
        }
      }

      console.log('🔄 Buscando perfil do usuário:', userId);
      
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
        console.error('❌ Erro ao buscar perfil:', error);
        setProfile(null);
        setProfileLoading(false);
        return null;
      }

      console.log('✅ Perfil carregado:', data);
      
      // Atualizar cache e estado
      profileCache.set(userId, { data, timestamp: Date.now() });
      setProfile(data);
      setProfileLoading(false);
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar perfil:', error);
      setProfile(null);
      setProfileLoading(false);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id, true); // Force refresh
    }
  }, [user?.id, fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      console.log('🔑 Tentativa de login para:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Erro no login:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        console.log('✅ Login realizado, carregando perfil...');
        setUser(data.user);
        await fetchProfile(data.user.id);
        
        const pushService = PushNotificationService.getInstance();
        await pushService.initialize(data.user.id);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro no login:', error);
      return { success: false, error: error.message };
    }
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      console.log('🚪 Fazendo logout...');
      
      if (user?.id) {
        const pushService = PushNotificationService.getInstance();
        await pushService.removeToken(user.id);
        profileCache.delete(user.id);
      }

      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      console.log('✅ Logout realizado');
    } catch (error) {
      console.error('❌ Erro ao fazer logout:', error);
    }
  }, [user?.id]);

  const logout = signOut;

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔐 Inicializando autenticação...');
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            console.log('📱 Sessão encontrada, carregando dados do usuário...');
            setUser(session.user);
            await fetchProfile(session.user.id);
            
            const pushService = PushNotificationService.getInstance();
            await pushService.initialize(session.user.id);
          } else {
            console.log('❌ Nenhuma sessão ativa');
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar auth:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // ✨ Listener otimizado de mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔐 Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
          
          const pushService = PushNotificationService.getInstance();
          await pushService.initialize(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          profileCache.clear();
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 Token renovado');
          setUser(session.user);
          // Só recarregar perfil se não tiver um
          if (!profile) {
            await fetchProfile(session.user.id);
          }
        }
        
        if (mounted) {
          setIsLoading(false);
        }
      }
    );

    // ✨ Refresh token otimizado - reduzido para 15 minutos
    const refreshInterval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.auth.refreshSession();
        }
      } catch (error) {
        console.error('❌ Erro ao renovar sessão:', error);
      }
    }, 15 * 60 * 1000); // 15 minutos

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
    profileLoading, // ✨ Novo estado
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
