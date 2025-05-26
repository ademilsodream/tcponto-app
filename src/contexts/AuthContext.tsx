
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        
        if (session?.user) {
          // Defer profile fetching to avoid blocking auth state change
          setTimeout(async () => {
            console.log('User authenticated, fetching profile for:', session.user.id);
            try {
              const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
              
              console.log('Profile fetch result:', { profile, error });
              
              if (profile && !error) {
                const userData: User = {
                  id: profile.id,
                  name: profile.name,
                  email: profile.email,
                  role: profile.role === 'admin' ? 'admin' : 'user',
                  hourlyRate: Number(profile.hourly_rate),
                  overtimeRate: Number(profile.hourly_rate) * 1.5
                };
                console.log('Setting user data:', userData);
                setUser(userData);
                setIsAuthenticated(true);
              } else if (error) {
                console.error('Error fetching profile:', error);
                setUser(null);
                setIsAuthenticated(false);
              } else {
                console.error('No profile found for user:', session.user.id);
                // Create a basic profile if it doesn't exist
                const { data: newProfile, error: createError } = await supabase
                  .from('profiles')
                  .insert({
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.email || 'Usuário',
                    role: 'user',
                    hourly_rate: 50.00
                  })
                  .select()
                  .single();
                
                if (newProfile && !createError) {
                  const userData: User = {
                    id: newProfile.id,
                    name: newProfile.name,
                    email: newProfile.email,
                    role: newProfile.role === 'admin' ? 'admin' : 'user',
                    hourlyRate: Number(newProfile.hourly_rate),
                    overtimeRate: Number(newProfile.hourly_rate) * 1.5
                  };
                  console.log('Created and set new user profile:', userData);
                  setUser(userData);
                  setIsAuthenticated(true);
                } else {
                  console.error('Failed to create profile:', createError);
                  setUser(null);
                  setIsAuthenticated(false);
                }
              }
            } catch (error) {
              console.error('Error in profile handling:', error);
              setUser(null);
              setIsAuthenticated(false);
            }
          }, 0);
        } else {
          console.log('No session, clearing user');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email);
      if (session) {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('Attempting login for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Login result:', { data: data?.user?.email, error });

      if (error) {
        console.error('Login error:', error);
        return false;
      }

      return !!data.user;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    console.log('Logging out');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated
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
