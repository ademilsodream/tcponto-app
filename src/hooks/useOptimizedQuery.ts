
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
    staleTime = 5 * 60 * 1000, // ✨ Reduzido para 5 minutos
    refetchInterval = false,
    enableRealtime = false,
    ...otherOptions
  } = options;

  // ✨ QueryFn simplificada
  const optimizedQueryFn = useCallback(async () => {
    try {
      return await queryFn();
    } catch (error: any) {
      console.error('Query error:', error);
      
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes('jwt') || 
          errorMessage.includes('unauthorized') || 
          errorMessage.includes('invalid_token') ||
          errorMessage.includes('session_not_found')) {
        console.log('useOptimizedQuery: Erro de autenticação detectado');
      }
      
      throw error;
    }
  }, [queryFn]);

  return useQuery({
    queryKey,
    queryFn: optimizedQueryFn,
    staleTime,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true, // ✨ Habilitado para reconexão
    refetchOnMount: true, // ✨ Habilitado para mount
    retry: (failureCount, error: any) => {
      if (failureCount >= 1) return false; // ✨ Apenas 1 retry
      
      const errorMessage = error?.message?.toLowerCase() || '';
      
      if (errorMessage.includes('jwt') || 
          errorMessage.includes('unauthorized') || 
          errorMessage.includes('invalid_token') ||
          errorMessage.includes('session_not_found')) {
        return false;
      }
      
      return errorMessage.includes('network') || 
             errorMessage.includes('fetch') ||
             errorMessage.includes('timeout');
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // ✨ Delay reduzido
    ...otherOptions
  });
}

// ✨ Hook simplificado para queries que precisam de real-time updates
export function useRealtimeQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    staleTime: 2 * 60 * 1000, // 2 minutos para realtime
    refetchInterval: false,
    enableRealtime: false
  });
}

// ✨ Hook para queries estáticas (raramente mudam)
export function useStaticQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    staleTime: 15 * 60 * 1000, // 15 minutos para dados estáticos
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  });
}
