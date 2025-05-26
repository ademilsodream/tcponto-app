
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Configurar listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        
        if (session?.user) {
          console.log('User authenticated, fetching profile for:', session.user.id);
          // Buscar perfil do usuário
          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            console.log('Profile fetch result:', { profile, error });
            
            if (error) {
              console.error('Error fetching profile:', error);
              setUser(null);
              setIsAuthenticated(false);
            } else if (profile) {
              const userData: User = {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                role: profile.role === 'admin' ? 'admin' : 'user',
                hourlyRate: Number(profile.hourly_rate) || 50,
                overtimeRate: (Number(profile.hourly_rate) || 50) * 1.5
              };
              console.log('Setting user data:', userData);
              setUser(userData);
              setIsAuthenticated(true);
            }
          } catch (error) {
            console.error('Error in profile fetch:', error);
            setUser(null);
            setIsAuthenticated(false);
          }
        } else {
          console.log('No session, clearing user');
          setUser(null);
          setIsAuthenticated(false);
        }
        setLoading(false);
      }
    );

    // Verificar sessão existente
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }
        
        console.log('Initial session check:', session?.user?.email);
        // Se há sessão, o onAuthStateChange será chamado automaticamente
        if (!session) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error in checkSession:', error);
        setLoading(false);
      }
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('Attempting login for:', email);
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Login result:', { data: data?.user?.email, error });

      if (error) {
        console.error('Login error:', error);
        setLoading(false);
        return false;
      }

      if (data.user) {
        console.log('Login successful, auth state will change automatically');
        // O estado será atualizado automaticamente pelo onAuthStateChange
        return true;
      }

      setLoading(false);
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      console.log('Logging out');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      // O estado será limpo automaticamente pelo onAuthStateChange
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated,
      loading
    }}>
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
