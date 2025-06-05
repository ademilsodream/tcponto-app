
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Configuração otimizada do QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache por 30 minutos por padrão
      staleTime: 30 * 60 * 1000,
      // Dados ficam no cache por 60 minutos
      gcTime: 60 * 60 * 1000,
      // Desabilitar todos os refetches automáticos
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchInterval: false,
      // Retry inteligente com foco em erros de auth
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        
        const errorMessage = error?.message?.toLowerCase() || '';
        
        // Se for erro de autenticação, não retry
        if (errorMessage.includes('jwt') || 
            errorMessage.includes('unauthorized') || 
            errorMessage.includes('invalid_token') ||
            errorMessage.includes('session_not_found')) {
          console.log('QueryProvider: Erro de autenticação detectado, invalidando cache...');
          queryClient.invalidateQueries();
          return false;
        }
        
        // Retry para erros de rede
        if (errorMessage.includes('network') || 
            errorMessage.includes('fetch') ||
            errorMessage.includes('timeout')) {
          return true;
        }
        
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
        
        // Se erro de auth em mutation, invalidar todas as queries
        const errorMessage = error?.message?.toLowerCase() || '';
        if (errorMessage.includes('jwt') || 
            errorMessage.includes('unauthorized') || 
            errorMessage.includes('invalid_token')) {
          console.log('QueryProvider: Erro de auth em mutation, invalidando cache...');
          queryClient.invalidateQueries();
        }
      },
    },
  },
});

// Configurar listener para mudanças de auth state que invalida cache
let authStateListenerSetup = false;

const setupAuthStateListener = () => {
  if (authStateListenerSetup) return;
  
  console.log('QueryProvider: Configurando listener de mudanças de auth...');
  
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('QueryProvider: Evento de auth:', event);
    
    if (event === 'SIGNED_OUT') {
      console.log('QueryProvider: Usuário deslogou, limpando cache...');
      queryClient.clear();
    } else if (event === 'TOKEN_REFRESHED') {
      console.log('QueryProvider: Token renovado, invalidando queries...');
      // Invalidar queries para garantir que usem o novo token
      queryClient.invalidateQueries();
    } else if (event === 'SIGNED_IN') {
      console.log('QueryProvider: Usuário logou, limpando cache anterior...');
      queryClient.clear();
    }
  });
  
  authStateListenerSetup = true;
};

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  // Configurar listener apenas uma vez
  React.useEffect(() => {
    setupAuthStateListener();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
