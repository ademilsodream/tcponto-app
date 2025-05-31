
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Configuração otimizada do QueryClient para evitar travamentos
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache otimizado - 5 minutos para dados normais
      staleTime: 5 * 60 * 1000,
      // Dados ficam no cache por 10 minutos
      gcTime: 10 * 60 * 1000,
      // Configurações para evitar refetch excessivo
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      refetchOnMount: true,
      // Retry configurado de forma mais conservadora
      retry: (failureCount, error) => {
        // Máximo 2 tentativas
        if (failureCount >= 2) return false;
        
        const errorMessage = error?.message?.toLowerCase() || '';
        
        // Para erros de auth, não tentar novamente
        if (errorMessage.includes('jwt') || 
            errorMessage.includes('unauthorized') || 
            errorMessage.includes('invalid_token') ||
            errorMessage.includes('session_not_found') ||
            errorMessage.includes('refresh_token_not_found')) {
          console.log('QueryProvider: Erro de autenticação detectado, não fazendo retry');
          return false;
        }
        
        // Para erros de rede, tentar novamente
        if (errorMessage.includes('network') || 
            errorMessage.includes('fetch') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('connection')) {
          console.log('QueryProvider: Erro de rede detectado, fazendo retry');
          return true;
        }
        
        return false;
      },
      retryDelay: (attemptIndex) => {
        // Delay progressivo mas limitado a 3 segundos
        return Math.min(1000 * Math.pow(1.5, attemptIndex), 3000);
      },
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('QueryProvider: Erro em mutation:', error);
        
        const errorMessage = error?.message?.toLowerCase() || '';
        
        // Se erro de auth em mutation, invalidar cache de forma seletiva
        if (errorMessage.includes('jwt') || 
            errorMessage.includes('unauthorized') || 
            errorMessage.includes('invalid_token')) {
          console.log('QueryProvider: Erro de auth em mutation, invalidando queries específicas...');
          
          // Invalidar apenas queries relacionadas a auth, não tudo
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              const queryKey = query.queryKey[0] as string;
              return queryKey?.includes('profile') || queryKey?.includes('user') || queryKey?.includes('auth');
            }
          });
        }
      },
    },
  },
});

// Sistema de monitoramento para detectar invalidações excessivas
let invalidationCount = 0;
let lastInvalidationReset = Date.now();

const originalInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);

queryClient.invalidateQueries = function(...args) {
  const now = Date.now();
  
  // Reset contador a cada minuto
  if (now - lastInvalidationReset > 60000) {
    invalidationCount = 0;
    lastInvalidationReset = now;
  }
  
  invalidationCount++;
  
  // Alertar se muitas invalidações
  if (invalidationCount > 10) {
    console.warn('QueryProvider: Muitas invalidações de cache detectadas!', {
      count: invalidationCount,
      args: args
    });
  }
  
  return originalInvalidateQueries.apply(this, args);
};

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  // REMOVIDO: listener de auth state change duplicado
  // O controle de auth agora é totalmente centralizado no AuthContext
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
