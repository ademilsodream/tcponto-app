
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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    try {
      console.log('Fetching profile for user:', userId);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      if (!profile) {
        console.error('No profile found for user:', userId);
        return null;
      }

      const userData: User = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role === 'admin' ? 'admin' : 'user',
        hourlyRate: Number(profile.hourly_rate) || 50,
        overtimeRate: (Number(profile.hourly_rate) || 50) * 1.5
      };

      console.log('Profile loaded successfully:', userData);
      return userData;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  };

  const updateAuthState = async (session: Session | null) => {
    console.log('Updating auth state, session exists:', !!session);
    
    if (session?.user) {
      const userData = await fetchUserProfile(session.user.id);
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
        console.log('User authenticated successfully:', userData.role);
      } else {
        console.error('Failed to load user profile');
        setUser(null);
        setIsAuthenticated(false);
      }
    } else {
      console.log('No session, clearing user state');
      setUser(null);
      setIsAuthenticated(false);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    console.log('AuthProvider initializing...');
    
    let mounted = true;

    // Setup auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        if (mounted) {
          await updateAuthState(session);
        }
      }
    );

    // Check for existing session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        console.log('Initial session check:', session?.user?.email || 'No session');
        
        if (mounted) {
          await updateAuthState(session);
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Attempting login for:', email);
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        setLoading(false);
        return { 
          success: false, 
          error: error.message === 'Invalid login credentials' 
            ? 'E-mail ou senha inválidos'
            : 'Erro ao fazer login. Tente novamente.'
        };
      }

      if (data.user) {
        console.log('Login successful for:', data.user.email);
        // Auth state will be updated by onAuthStateChange
        return { success: true };
      }

      setLoading(false);
      return { success: false, error: 'Erro inesperado no login' };
    } catch (error) {
      console.error('Login exception:', error);
      setLoading(false);
      return { success: false, error: 'Erro ao fazer login. Tente novamente.' };
    }
  };

  const logout = async () => {
    try {
      console.log('Logging out...');
      await supabase.auth.signOut();
      // Auth state will be cleared by onAuthStateChange
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
