
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ✨ QueryClient ultra otimizado
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ✨ Cache agressivo mas inteligente
      staleTime: 1 * 60 * 1000, // 1 minuto
      gcTime: 5 * 60 * 1000, // 5 minutos
      
      // ✨ Configurações ultra responsivas
      refetchOnWindowFocus: false,
      refetchOnReconnect: false, // ✨ Desabilitado para speed
      refetchOnMount: false, // ✨ Usar apenas cache
      refetchInterval: false,
      
      // ✨ Retry mínimo para velocidade
      retry: 0, // ✨ Sem retry para velocidade máxima
      retryDelay: 500, // ✨ Delay mínimo
    },
    mutations: {
      retry: 0, // ✨ Sem retry em mutations para responsividade
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

// ✨ Auth listener ultra otimizado
let authListenerSetup = false;

const setupOptimizedAuthListener = () => {
  if (authListenerSetup) return;
  
  console.log('🚀 Configurando auth listener otimizado...');
  
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      console.log('🧹 Limpando cache após logout...');
      queryClient.clear();
    } else if (event === 'SIGNED_IN') {
      console.log('✅ Login detectado');
      // ✨ Não limpar cache no login para manter velocidade
    }
  });
  
  authListenerSetup = true;
};

// ✨ Cleanup ultra otimizado - menos frequente
const setupOptimizedCleanup = () => {
  const cleanupInterval = setInterval(() => {
    console.log('🧹 Limpeza de cache otimizada...');
    // ✨ Remover apenas queries antigas, não todas
    queryClient.getQueryCache().clear();
  }, 5 * 60 * 1000); // ✨ A cada 5 minutos apenas
  
  return () => clearInterval(cleanupInterval);
};

export const UltraOptimizedQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  React.useEffect(() => {
    setupOptimizedAuthListener();
    const cleanupCache = setupOptimizedCleanup();
    
    return () => {
      cleanupCache();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
