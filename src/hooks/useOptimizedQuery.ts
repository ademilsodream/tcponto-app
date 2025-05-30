
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  queryKey: any[];
  queryFn: () => Promise<T>;
  staleTime?: number;
  refetchInterval?: number | false;
  enableRealtime?: boolean;
}

export function useOptimizedQuery<T>(options: OptimizedQueryOptions<T>) {
  const {
    queryKey,
    queryFn,
    staleTime = 10 * 60 * 1000, // 10 minutos por padrão
    refetchInterval = false, // Desabilitado por padrão
    enableRealtime = false,
    ...otherOptions
  } = options;

  // QueryFn otimizada com error handling
  const optimizedQueryFn = useCallback(async () => {
    try {
      return await queryFn();
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }, [queryFn]);

  return useQuery({
    queryKey,
    queryFn: optimizedQueryFn,
    staleTime,
    refetchInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Retry logic inteligente
      if (failureCount >= 2) return false;
      if (error?.message?.includes('network')) return true;
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    ...otherOptions
  });
}

// Hook para queries que precisam de real-time updates
export function useRealtimeQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    staleTime: 2 * 60 * 1000, // 2 minutos para real-time
    refetchInterval: 5 * 60 * 1000, // 5 minutos
    enableRealtime: true
  });
}

// Hook para queries estáticas (raramente mudam)
export function useStaticQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    staleTime: 30 * 60 * 1000, // 30 minutos
    refetchInterval: false,
    refetchOnWindowFocus: false
  });
}
