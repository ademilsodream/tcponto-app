
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Configuração otimizada do QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache por 15 minutos por padrão
      staleTime: 15 * 60 * 1000,
      // Não refetch automático
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Retry inteligente
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        const errorMessage = error?.message?.toLowerCase() || '';
        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
