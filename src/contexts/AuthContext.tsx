
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { queryClient } from '@/providers/QueryProvider';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Iniciando verificação de autenticação');
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('AuthProvider: Verificando sessão existente...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('AuthProvider: Erro ao obter sessão:', error);
        setLoading(false);
        return;
      }
      
      console.log('AuthProvider: Sessão obtida:', session ? 'existe' : 'não existe');
      
      if (session?.user) {
        console.log('AuthProvider: Usuário encontrado na sessão, carregando perfil...');
        await loadUserProfile(session.user);
      } else {
        console.log('AuthProvider: Nenhuma sessão ativa encontrada');
        setLoading(false);
      }

      // Configurar listener de mudanças de autenticação
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('AuthProvider: Evento de autenticação:', event, session ? 'com sessão' : 'sem sessão');
          
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('AuthProvider: Usuário logou, carregando perfil...');
            // Usar setTimeout para evitar deadlock
            setTimeout(() => {
              loadUserProfile(session.user);
            }, 0);
          } else if (event === 'SIGNED_OUT') {
            console.log('AuthProvider: Usuário deslogou');
            setUser(null);
            setLoading(false);
            // Limpar cache de queries quando logout
            queryClient.clear();
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            console.log('AuthProvider: Token renovado, verificando status do usuário...');
            // Quando token é renovado, verificar se usuário ainda está ativo
            setTimeout(() => {
              loadUserProfile(session.user);
            }, 0);
          }
        }
      );

      return () => {
        console.log('AuthProvider: Removendo listener de autenticação');
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('AuthProvider: Erro inesperado na verificação de autenticação:', error);
      setLoading(false);
    }
  };

  const loadUserProfile = async (authUser: SupabaseUser) => {
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
          // Se não encontrou o perfil, cria um novo
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
          } else {
            console.log('AuthProvider: Perfil criado com sucesso');
            setUser({
              id: newProfile.id,
              name: newProfile.name,
              email: newProfile.email,
              role: newProfile.role as 'admin' | 'user'
            });
          }
        }
      } else {
        // Verificar se o usuário está ativo
        if (profile.status === 'inactive') {
          console.log('AuthProvider: Usuário demitido tentando acessar, fazendo logout...');
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }

        console.log('AuthProvider: Perfil carregado com sucesso:', profile);
        setUser({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role === 'admin' ? 'admin' : 'user'
        });
      }
    } catch (error) {
      console.error('AuthProvider: Erro inesperado ao carregar perfil:', error);
      // Em caso de erro inesperado, fazer logout para evitar estado inconsistente
      await supabase.auth.signOut();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

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
      
      if (data.user) {
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

        await loadUserProfile(data.user);
      }

      return { success: true };
    } catch (error) {
      console.error('AuthProvider: Erro inesperado no login:', error);
      setLoading(false);
      return { success: false, error: 'Erro inesperado ao fazer login' };
    }
  };

  const logout = async () => {
    try {
      console.log('AuthProvider: Fazendo logout...');
      await supabase.auth.signOut();
      setUser(null);
      // Limpar cache de queries no logout
      queryClient.clear();
      console.log('AuthProvider: Logout realizado com sucesso');
    } catch (error) {
      console.error('AuthProvider: Erro ao fazer logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
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
