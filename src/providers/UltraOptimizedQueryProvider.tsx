
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a stable query client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: 1000
    }
  }
});

interface UltraOptimizedQueryProviderProps {
  children: React.ReactNode;
}

export const UltraOptimizedQueryProvider: React.FC<UltraOptimizedQueryProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
