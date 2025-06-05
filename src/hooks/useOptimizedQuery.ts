
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
    staleTime = 30 * 60 * 1000, // 30 minutos por padrão
    refetchInterval = false, // Sempre desabilitado
    enableRealtime = false,
    ...otherOptions
  } = options;

  // QueryFn otimizada com error handling aprimorado
  const optimizedQueryFn = useCallback(async () => {
    try {
      return await queryFn();
    } catch (error: any) {
      console.error('Query error:', error);
      
      // Se for erro de autenticação, não tentar novamente
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
    refetchInterval: false, // Sempre desabilitado
    refetchOnWindowFocus: false, // Desabilitado
    refetchOnReconnect: false, // Desabilitado
    refetchOnMount: false, // Desabilitado
    retry: (failureCount, error: any) => {
      // Retry logic inteligente com foco em auth
      if (failureCount >= 2) return false;
      
      const errorMessage = error?.message?.toLowerCase() || '';
      
      // Não retry para erros de autenticação
      if (errorMessage.includes('jwt') || 
          errorMessage.includes('unauthorized') || 
          errorMessage.includes('invalid_token') ||
          errorMessage.includes('session_not_found')) {
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
    ...otherOptions
  });
}

// Hook para queries que precisam de real-time updates
export function useRealtimeQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    staleTime: 30 * 60 * 1000, // 30 minutos
    refetchInterval: false, // Desabilitado
    enableRealtime: false // Desabilitado
  });
}

// Hook para queries estáticas (raramente mudam)
export function useStaticQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    staleTime: 60 * 60 * 1000, // 60 minutos
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  });
}
