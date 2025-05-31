
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { checkSessionHealth } from '@/integrations/supabase/client';

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  queryKey: any[];
  queryFn: () => Promise<T>;
  staleTime?: number;
  refetchInterval?: number | false;
  enableRealtime?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

// Sistema de monitoramento de queries
const queryMetrics = {
  activeQueries: new Set<string>(),
  failedQueries: new Map<string, number>(),
  lastCleanup: Date.now()
};

// Cleanup periódico das métricas
setInterval(() => {
  const now = Date.now();
  if (now - queryMetrics.lastCleanup > 300000) { // 5 minutos
    queryMetrics.failedQueries.clear();
    queryMetrics.lastCleanup = now;
  }
}, 60000); // A cada minuto

export function useOptimizedQuery<T>(options: OptimizedQueryOptions<T>) {
  const {
    queryKey,
    queryFn,
    staleTime = 5 * 60 * 1000, // 5 minutos por padrão
    refetchInterval = false,
    enableRealtime = false,
    priority = 'normal',
    ...otherOptions
  } = options;

  const queryKeyString = JSON.stringify(queryKey);
  const lastExecutionRef = useRef<number>(0);
  const isExecutingRef = useRef<boolean>(false);

  // QueryFn otimizada com health check e throttling
  const optimizedQueryFn = useCallback(async (): Promise<T> => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutionRef.current;
    
    // Throttling para evitar execução excessiva
    if (timeSinceLastExecution < 1000 && isExecutingRef.current) {
      console.log('useOptimizedQuery: Throttling query execution para:', queryKeyString);
      throw new Error('Query throttled');
    }

    // Verificar se a query já falhou muito recentemente
    const failureCount = queryMetrics.failedQueries.get(queryKeyString) || 0;
    if (failureCount >= 3) {
      console.log('useOptimizedQuery: Query com muitas falhas, aguardando:', queryKeyString);
      throw new Error('Query temporarily disabled due to repeated failures');
    }

    isExecutingRef.current = true;
    lastExecutionRef.current = now;
    
    try {
      // Health check antes de executar queries críticas
      if (priority === 'high') {
        const isHealthy = await checkSessionHealth();
        if (!isHealthy) {
          throw new Error('Session not healthy');
        }
      }

      queryMetrics.activeQueries.add(queryKeyString);
      console.log('useOptimizedQuery: Executando query:', queryKeyString);
      
      const result = await queryFn();
      
      // Reset contador de falhas em caso de sucesso
      queryMetrics.failedQueries.delete(queryKeyString);
      
      return result;
    } catch (error: any) {
      console.error('useOptimizedQuery: Erro na query:', queryKeyString, error);
      
      // Incrementar contador de falhas
      const currentFailures = queryMetrics.failedQueries.get(queryKeyString) || 0;
      queryMetrics.failedQueries.set(queryKeyString, currentFailures + 1);
      
      // Análise do tipo de erro
      const errorMessage = error?.message?.toLowerCase() || '';
      
      if (errorMessage.includes('jwt') || 
          errorMessage.includes('unauthorized') || 
          errorMessage.includes('invalid_token') ||
          errorMessage.includes('session_not_found') ||
          errorMessage.includes('refresh_token_not_found')) {
        console.log('useOptimizedQuery: Erro de autenticação detectado');
      }
      
      throw error;
    } finally {
      isExecutingRef.current = false;
      queryMetrics.activeQueries.delete(queryKeyString);
    }
  }, [queryFn, queryKeyString, priority]);

  // Configurar staleTime baseado na prioridade
  const adaptiveStaleTime = priority === 'high' ? staleTime * 0.5 : 
                           priority === 'low' ? staleTime * 2 : 
                           staleTime;

  return useQuery({
    queryKey,
    queryFn: optimizedQueryFn,
    staleTime: adaptiveStaleTime,
    refetchInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: priority === 'high',
    retry: (failureCount, error: any) => {
      // Sistema de retry mais inteligente
      if (failureCount >= 2) return false;
      
      const errorMessage = error?.message?.toLowerCase() || '';
      
      // Não retry para erros de autenticação
      if (errorMessage.includes('jwt') || 
          errorMessage.includes('unauthorized') || 
          errorMessage.includes('invalid_token') ||
          errorMessage.includes('session_not_found') ||
          errorMessage.includes('refresh_token_not_found') ||
          errorMessage.includes('query throttled') ||
          errorMessage.includes('query temporarily disabled')) {
        return false;
      }
      
      // Retry para erros de rede
      if (errorMessage.includes('network') || 
          errorMessage.includes('fetch') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('connection')) {
        return true;
      }
      
      return false;
    },
    retryDelay: (attemptIndex) => {
      // Delay adaptativo baseado na prioridade
      const baseDelay = priority === 'high' ? 500 : 1000;
      return Math.min(baseDelay * Math.pow(1.5, attemptIndex), 5000);
    },
    ...otherOptions
  });
}

// Hook para queries críticas (dados de auth, perfil)
export function useCriticalQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    priority: 'high',
    staleTime: 2 * 60 * 1000, // 2 minutos para dados críticos
    refetchInterval: false,
    refetchOnWindowFocus: false
  });
}

// Hook para queries que precisam de real-time updates
export function useRealtimeQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    priority: 'normal',
    staleTime: 30 * 1000, // 30 segundos para real-time
    refetchInterval: 2 * 60 * 1000, // 2 minutos
    enableRealtime: true
  });
}

// Hook para queries estáticas (raramente mudam)
export function useStaticQuery<T>(options: OptimizedQueryOptions<T>) {
  return useOptimizedQuery({
    ...options,
    priority: 'low',
    staleTime: 15 * 60 * 1000, // 15 minutos
    refetchInterval: false,
    refetchOnWindowFocus: false
  });
}

// Função para obter métricas das queries (para debugging)
export const getQueryMetrics = () => ({
  activeQueries: Array.from(queryMetrics.activeQueries),
  failedQueries: Object.fromEntries(queryMetrics.failedQueries),
  activeCount: queryMetrics.activeQueries.size
});
