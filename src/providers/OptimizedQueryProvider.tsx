
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ✨ Configuração otimizada e simplificada do QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ✨ Cache balanceado
      staleTime: 5 * 60 * 1000, // 5 minutos (reduzido de 30)
      gcTime: 15 * 60 * 1000, // 15 minutos no garbage collector
      
      // ✨ Configurações de refetch otimizadas
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // ✨ Habilitado para reconexão
      refetchOnMount: true, // ✨ Habilitado para mount
      refetchInterval: false,
      
      // ✨ Retry simplificado
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        
        const errorMessage = error?.message?.toLowerCase() || '';
        
        // Não retry para erros de auth
        if (errorMessage.includes('jwt') || 
            errorMessage.includes('unauthorized') || 
            errorMessage.includes('invalid_token') ||
            errorMessage.includes('session_not_found')) {
          console.log('QueryProvider: Erro de auth detectado');
          return false;
        }
        
        // Retry para erros de rede
        return errorMessage.includes('network') || 
               errorMessage.includes('fetch') ||
               errorMessage.includes('timeout');
      },
      
      // ✨ Delay otimizado
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000),
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
        
        const errorMessage = error?.message?.toLowerCase() || '';
        if (errorMessage.includes('jwt') || 
            errorMessage.includes('unauthorized') || 
            errorMessage.includes('invalid_token')) {
          console.log('QueryProvider: Erro de auth em mutation');
        }
      },
    },
  },
});

// ✨ Listener simplificado para auth state
let authStateListenerSetup = false;

const setupAuthListener = () => {
  if (authStateListenerSetup) return;
  
  console.log('QueryProvider: Configurando listener de auth...');
  
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('QueryProvider: Auth event:', event);
    
    if (event === 'SIGNED_OUT') {
      console.log('QueryProvider: Limpando cache após logout...');
      queryClient.clear();
    } else if (event === 'SIGNED_IN') {
      console.log('QueryProvider: Login detectado, limpando cache...');
      queryClient.clear();
    } else if (event === 'TOKEN_REFRESHED') {
      console.log('QueryProvider: Token renovado');
      // Não invalidar tudo, apenas queries de auth se necessário
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes('profile') || key?.includes('user');
        }
      });
    }
  });
  
  authStateListenerSetup = true;
};

// ✨ Cleanup simplificado
const setupCacheCleanup = () => {
  const cleanupInterval = setInterval(() => {
    console.log('QueryProvider: Executando limpeza de cache...');
    queryClient.getQueryCache().clear();
  }, 60 * 60 * 1000); // A cada 60 minutos (reduzido de 30)
  
  return () => clearInterval(cleanupInterval);
};

interface OptimizedQueryProviderProps {
  children: React.ReactNode;
}

export const OptimizedQueryProvider: React.FC<OptimizedQueryProviderProps> = ({ children }) => {
  React.useEffect(() => {
    setupAuthListener();
    const cleanupCache = setupCacheCleanup();
    
    return () => {
      cleanupCache();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
