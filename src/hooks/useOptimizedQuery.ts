
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  queryKey: any[];
  queryFn: () => Promise<T>;
  staleTime?: number;
  enableRealtime?: boolean;
}

export function useOptimizedQuery<T>(options: OptimizedQueryOptions<T>) {
  const {
    queryKey,
    queryFn,
    staleTime = 30 * 1000, // ✨ 30 segundos para máxima velocidade
    enableRealtime = false,
    ...otherOptions
  } = options;

  // ✨ QueryFn ultra otimizada
  const optimizedQueryFn = useCallback(async () => {
    try {
      return await queryFn();
    } catch (error: any) {
      console.error('Query error:', error);
      throw error;
    }
  }, [queryFn]);

  return useQuery({
    queryKey,
    queryFn: optimizedQueryFn,
    staleTime,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false, // ✨ Usar cache sempre que possível
    retry: 0, // ✨ Sem retry para velocidade máxima
    retryDelay: 0,
    ...otherOptions
  });
}

// ✨ Hook para dados que mudam raramente (ultra cache)
export function useStaticQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    staleTime: 10 * 60 * 1000, // 10 minutos para dados estáticos
  });
}

// ✨ Hook para dados críticos (cache mínimo)
export function useCriticalQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    staleTime: 5 * 1000, // 5 segundos para dados críticos
    refetchOnMount: true, // ✨ Sempre buscar dados críticos
  });
}
