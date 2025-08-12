import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { debugLog, isMobile } from '@/utils/debugLogger';

const SUPABASE_URL = "https://cyapqtyrefkdemhxryvs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5YXBxdHlyZWZrZGVtaHhyeXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNjM3OTAsImV4cCI6MjA2MzgzOTc5MH0.E-Okftoiz6Le5jOuq6PwF030O0eNIuvBbf2cvF1kVs8";

// Cliente Supabase otimizado para mobile
export const mobileSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Desabilitar para mobile
    flowType: 'pkce',
    storage: {
      getItem: (key: string) => {
        try {
          debugLog('DEBUG', 'Storage getItem', { key });
          return localStorage.getItem(key);
        } catch (error) {
          debugLog('ERROR', 'Storage getItem failed', { key, error });
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          debugLog('DEBUG', 'Storage setItem', { key });
          localStorage.setItem(key, value);
        } catch (error) {
          debugLog('ERROR', 'Storage setItem failed', { key, error });
        }
      },
      removeItem: (key: string) => {
        try {
          debugLog('DEBUG', 'Storage removeItem', { key });
          localStorage.removeItem(key);
        } catch (error) {
          debugLog('ERROR', 'Storage removeItem failed', { key, error });
        }
      }
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 5 // Reduzir para mobile
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'tcponto-mobile'
    }
  }
});

// Função para verificar conectividade
export const checkSupabaseConnectivity = async () => {
  try {
    debugLog('INFO', 'Verificando conectividade com Supabase');
    
    const startTime = Date.now();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    debugLog('INFO', 'Conectividade verificada', { 
      status: response.status, 
      responseTime: `${responseTime}ms`,
      isMobile: isMobile()
    });
    
    return response.ok;
  } catch (error) {
    debugLog('ERROR', 'Falha na verificação de conectividade', { error });
    return false;
  }
};

// Função para login com retry
export const mobileLogin = async (email: string, password: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      debugLog('INFO', `Tentativa de login ${attempt}/${maxRetries}`, { email });
      
      const { data, error } = await mobileSupabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        debugLog('ERROR', `Erro na tentativa ${attempt}`, { error: error.message });
        
        if (attempt === maxRetries) {
          return { data: null, error };
        }
        
        // Aguardar antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      debugLog('INFO', 'Login realizado com sucesso', { 
        userId: data.user?.id,
        attempt 
      });
      
      return { data, error: null };
    } catch (error) {
      debugLog('ERROR', `Erro inesperado na tentativa ${attempt}`, { error });
      
      if (attempt === maxRetries) {
        return { data: null, error };
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return { data: null, error: { message: 'Todas as tentativas falharam' } };
};

// Função para obter sessão com retry
export const getMobileSession = async (maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      debugLog('INFO', `Tentativa de obter sessão ${attempt}/${maxRetries}`);
      
      const { data, error } = await mobileSupabase.auth.getSession();

      if (error) {
        debugLog('ERROR', `Erro ao obter sessão na tentativa ${attempt}`, { error: error.message });
        
        if (attempt === maxRetries) {
          return { data: null, error };
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      debugLog('INFO', 'Sessão obtida com sucesso', { 
        hasSession: !!data.session,
        userId: data.session?.user?.id,
        attempt 
      });
      
      return { data, error: null };
    } catch (error) {
      debugLog('ERROR', `Erro inesperado ao obter sessão na tentativa ${attempt}`, { error });
      
      if (attempt === maxRetries) {
        return { data: null, error };
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return { data: null, error: { message: 'Todas as tentativas falharam' } };
};
