import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  const hasAccess = !!(profile && profile.status === "active" && profile.can_register_time);

  const logout = async () => {
    console.log('🔐 Iniciando logout...');
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      console.log('✅ Logout realizado com sucesso');
    } catch (error) {
      console.error('❌ Erro durante logout:', error);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      console.log('👤 Carregando perfil do usuário:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          departments(id, name),
          job_functions(id, name)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao carregar perfil:', error);
        setProfile(null);
        return;
      }

      if (data) {
        const profileData = { 
          ...data, 
          can_register_time: Boolean(data.can_register_time) 
        };
        setProfile(profileData);
        console.log('✅ Perfil carregado:', profileData.name);
      } else {
        console.log('⚠️ Perfil não encontrado para o usuário, criando perfil mínimo...');
        // Cria perfil mínimo
        const { error: insertError } = await supabase.from('profiles').insert({
          id: userId,
          name: '',
          email: user?.email || '',
          role: 'user',
          hourly_rate: 0.00
        });
        if (insertError) {
          console.error('❌ Erro ao criar perfil automaticamente:', insertError);
          setProfile(null);
          return;
        }
        // Tenta carregar novamente
        const { data: newProfile, error: newProfileError } = await supabase
          .from('profiles')
          .select(`*, departments(id, name), job_functions(id, name)`)
          .eq('id', userId)
          .maybeSingle();
        if (newProfile) {
          const profileData = { 
            ...newProfile, 
            can_register_time: Boolean(newProfile.can_register_time) 
          };
          setProfile(profileData);
          console.log('✅ Perfil criado e carregado:', profileData.name);
        } else {
          console.error('❌ Erro ao carregar perfil recém-criado:', newProfileError);
          setProfile(null);
        }
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao carregar/criar perfil:', error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticação...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          setIsLoading(false);
          return;
        }

        if (!mounted) return;

        if (session?.user) {
          console.log('✅ Sessão encontrada:', session.user.email);
          setUser(session.user);
          await loadProfile(session.user.id);
        } else {
          console.log('ℹ️ Nenhuma sessão ativa encontrada');
        }
      } catch (error) {
        console.error('❌ Erro durante inicialização:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Configurar listener de mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('🔐 Auth state changed:', event);
      
      if (session?.user) {
        console.log('✅ Sessão ativa:', {
          user_id: session.user.id,
          email: session.user.email,
          expires_at: session.expires_at ? new Date(session.expires_at * 1000) : null
        });
        
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        console.log('❌ Sessão encerrada');
        setUser(null);
        setProfile(null);
      }
      
      setIsLoading(false);
    });

    // Inicializar autenticação
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
