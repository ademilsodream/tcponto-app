
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, checkSessionHealth } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { queryClient } from '@/providers/QueryProvider';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Sistema de debouncing para invalidações de cache
let invalidationTimeout: NodeJS.Timeout | null = null;

const debouncedInvalidateCache = (reason: string) => {
  if (invalidationTimeout) {
    clearTimeout(invalidationTimeout);
  }
  
  invalidationTimeout = setTimeout(() => {
    console.log(`AuthProvider: Invalidando cache (razão: ${reason})`);
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey[0] as string;
        return queryKey?.includes('profile') || queryKey?.includes('time_records') || queryKey?.includes('employee');
      }
    });
  }, 1000);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Sistema de health check periódico
  useEffect(() => {
    const healthCheckInterval = setInterval(async () => {
      if (session && !loading) {
        const isHealthy = await checkSessionHealth();
        if (!isHealthy) {
          console.log('AuthProvider: Sessão não saudável detectada, fazendo logout...');
          await handleLogout();
        }
      }
    }, 300000); // A cada 5 minutos

    return () => clearInterval(healthCheckInterval);
  }, [session, loading]);

  const loadUserProfile = useCallback(async (authUser: SupabaseUser, currentSession: Session) => {
    try {
      console.log('AuthProvider: Carregando perfil do usuário:', authUser.id);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('AuthProvider: Erro ao carregar perfil:', error);
        
        if (error.code === 'PGRST116') {
          console.log('AuthProvider: Perfil não encontrado, criando novo...');
          const newProfile = {
            id: authUser.id,
            name: authUser.email?.split('@')[0] || 'Usuário',
            email: authUser.email || '',
            role: authUser.email === 'admin@tcponto.com' ? 'admin' : 'user',
            hourly_rate: 50.00
          };

          const { error: insertError } = await supabase
            .from('profiles')
            .insert(newProfile);

          if (insertError) {
            console.error('AuthProvider: Erro ao criar perfil:', insertError);
            throw insertError;
          } else {
            console.log('AuthProvider: Perfil criado com sucesso');
            setUser({
              id: newProfile.id,
              name: newProfile.name,
              email: newProfile.email,
              role: newProfile.role as 'admin' | 'user'
            });
            setSession(currentSession);
          }
        } else {
          throw error;
        }
      } else {
        // Verificar se o usuário está ativo
        if (profile.status === 'inactive') {
          console.log('AuthProvider: Usuário demitido tentando acessar, fazendo logout...');
          await handleLogout();
          return;
        }

        console.log('AuthProvider: Perfil carregado com sucesso');
        setUser({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role === 'admin' ? 'admin' : 'user'
        });
        setSession(currentSession);
      }
    } catch (error) {
      console.error('AuthProvider: Erro inesperado ao carregar perfil:', error);
      await handleLogout();
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      console.log('AuthProvider: Executando logout...');
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      queryClient.clear();
    } catch (error) {
      console.error('AuthProvider: Erro ao fazer logout:', error);
      // Forçar limpeza mesmo com erro
      setUser(null);
      setSession(null);
      queryClient.clear();
    }
  }, []);

  useEffect(() => {
    if (isInitialized) return;

    console.log('AuthProvider: Iniciando verificação de autenticação');
    
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Configurar listener primeiro
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, currentSession) => {
            if (!mounted) return;

            console.log('AuthProvider: Evento de autenticação:', event, currentSession ? 'com sessão' : 'sem sessão');
            
            if (event === 'SIGNED_IN' && currentSession?.user) {
              console.log('AuthProvider: Usuário logou, carregando perfil...');
              await loadUserProfile(currentSession.user, currentSession);
              debouncedInvalidateCache('login');
            } else if (event === 'SIGNED_OUT') {
              console.log('AuthProvider: Usuário deslogou');
              setUser(null);
              setSession(null);
              queryClient.clear();
            } else if (event === 'TOKEN_REFRESHED' && currentSession?.user) {
              console.log('AuthProvider: Token renovado, atualizando sessão...');
              setSession(currentSession);
              // Invalidação mais seletiva em token refresh
              debouncedInvalidateCache('token_refresh');
            } else if (event === 'INITIAL_SESSION' && currentSession?.user) {
              console.log('AuthProvider: Sessão inicial encontrada');
              await loadUserProfile(currentSession.user, currentSession);
            }
            
            if (!loading) setLoading(false);
          }
        );

        // Depois verificar sessão existente
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthProvider: Erro ao obter sessão:', error);
        } else if (initialSession?.user && mounted) {
          console.log('AuthProvider: Sessão existente encontrada');
          await loadUserProfile(initialSession.user, initialSession);
        }

        setIsInitialized(true);
        setLoading(false);

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('AuthProvider: Erro na inicialização:', error);
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [isInitialized, loading, loadUserProfile]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('AuthProvider: Tentativa de login para:', email);
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('AuthProvider: Erro no login:', error);
        setLoading(false);
        return { 
          success: false, 
          error: error.message === 'Invalid login credentials' 
            ? 'E-mail ou senha inválidos'
            : 'Erro ao fazer login: ' + error.message
        };
      }

      console.log('AuthProvider: Login realizado com sucesso');
      
      if (data.user && data.session) {
        // Verificar status do usuário antes de fazer login
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.user.id)
          .single();

        if (profile?.status === 'inactive') {
          await supabase.auth.signOut();
          setLoading(false);
          return { 
            success: false, 
            error: 'Acesso negado. Funcionário foi demitido e não pode mais acessar o sistema.'
          };
        }

        await loadUserProfile(data.user, data.session);
      }

      setLoading(false);
      return { success: true };
    } catch (error) {
      console.error('AuthProvider: Erro inesperado no login:', error);
      setLoading(false);
      return { success: false, error: 'Erro inesperado ao fazer login' };
    }
  };

  const logout = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  return (
    <AuthContext.Provider value={{ user, session, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
