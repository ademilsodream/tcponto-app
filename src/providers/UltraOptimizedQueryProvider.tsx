
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Simplificando configuração QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1min apenas
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
      retryDelay: 1000
    }
  }
});

export const UltraOptimizedQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
