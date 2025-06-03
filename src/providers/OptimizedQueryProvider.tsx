
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Configuração super otimizada do QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache inteligente baseado no tipo de dados
      staleTime: 5 * 60 * 1000, // 5 minutos padrão
      gcTime: 10 * 60 * 1000, // 10 minutos no garbage collector
      
      // Configurações de refetch otimizadas
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      
      // Retry otimizado com menos tentativas
      retry: (failureCount, error) => {
        // Máximo 1 retry para evitar spam
        if (failureCount >= 1) return false;
        
        const errorMessage = error?.message?.toLowerCase() || '';
        
        // Não retry para erros de auth
        if (errorMessage.includes('jwt') || 
            errorMessage.includes('unauthorized') || 
            errorMessage.includes('invalid_token') ||
            errorMessage.includes('session_not_found')) {
          console.log('OptimizedQueryProvider: Erro de auth, invalidando cache...');
          queryClient.invalidateQueries();
          return false;
        }
        
        // Retry apenas para erros de rede
        return errorMessage.includes('network') || 
               errorMessage.includes('fetch') ||
               errorMessage.includes('timeout');
      },
      
      // Delay menor entre retries
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(1.5, attemptIndex), 3000),
    },
    mutations: {
      // Retry apenas 1 vez para mutations
      retry: 1,
      
      // Error handling otimizado
      onError: (error) => {
        console.error('Mutation error:', error);
        
        const errorMessage = error?.message?.toLowerCase() || '';
        if (errorMessage.includes('jwt') || 
            errorMessage.includes('unauthorized') || 
            errorMessage.includes('invalid_token')) {
          console.log('OptimizedQueryProvider: Erro de auth em mutation, invalidando cache...');
          queryClient.invalidateQueries();
        }
      },
    },
  },
});

// Rate limiting para evitar spam de queries
const queryRateLimiter = new Map<string, number>();
const RATE_LIMIT_WINDOW = 1000; // 1 segundo

// Interceptar queries para rate limiting
const originalFetchQuery = queryClient.fetchQuery.bind(queryClient);
queryClient.fetchQuery = function(options: any) {
  const queryKey = JSON.stringify(options.queryKey);
  const now = Date.now();
  const lastCall = queryRateLimiter.get(queryKey) || 0;
  
  // Se chamou muito recentemente, retornar dados em cache
  if (now - lastCall < RATE_LIMIT_WINDOW) {
    const cachedData = queryClient.getQueryData(options.queryKey);
    if (cachedData) {
      console.log('Rate limited query, returning cache:', queryKey);
      return Promise.resolve(cachedData);
    }
  }
  
  queryRateLimiter.set(queryKey, now);
  return originalFetchQuery.call(this, options);
};

// Listener otimizado para auth state - apenas uma vez
let authStateListenerSetup = false;

const setupOptimizedAuthListener = () => {
  if (authStateListenerSetup) return;
  
  console.log('OptimizedQueryProvider: Configurando listener de auth otimizado...');
  
  // Debounce para evitar múltiplas invalidações
  let authChangeTimeout: NodeJS.Timeout;
  
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('OptimizedQueryProvider: Auth event:', event);
    
    // Debounce para evitar invalidações em cascata
    clearTimeout(authChangeTimeout);
    authChangeTimeout = setTimeout(() => {
      if (event === 'SIGNED_OUT') {
        console.log('OptimizedQueryProvider: Limpando cache após logout...');
        queryClient.clear();
        queryRateLimiter.clear();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('OptimizedQueryProvider: Token renovado, invalidando queries críticas...');
        // Invalidar apenas queries críticas de auth
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key.includes('profile') || key.includes('user');
          }
        });
      } else if (event === 'SIGNED_IN') {
        console.log('OptimizedQueryProvider: Login detectado, limpando cache...');
        queryClient.clear();
        queryRateLimiter.clear();
      }
    }, 300); // 300ms de debounce
  });
  
  authStateListenerSetup = true;
};

// Cleanup automático de cache antigo
const setupCacheCleanup = () => {
  const cleanupInterval = setInterval(() => {
    // Limpar rate limiter cache antigo
    const now = Date.now();
    for (const [key, timestamp] of queryRateLimiter.entries()) {
      if (now - timestamp > 5 * 60 * 1000) { // 5 minutos
        queryRateLimiter.delete(key);
      }
    }
    
    // Garbage collect queries antigas
    queryClient.getQueryCache().clear();
  }, 5 * 60 * 1000); // A cada 5 minutos
  
  return () => clearInterval(cleanupInterval);
};

interface OptimizedQueryProviderProps {
  children: React.ReactNode;
}

export const OptimizedQueryProvider: React.FC<OptimizedQueryProviderProps> = ({ children }) => {
  React.useEffect(() => {
    setupOptimizedAuthListener();
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
