
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TimeQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

export function useOptimizedTimeQuery(date: string, options: TimeQueryOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const {
    enabled = true,
    staleTime = 2 * 60 * 1000, // 2 minutos por padrão
    refetchInterval = false
  } = options;

  // Query otimizada para registro de ponto
  const query = useQuery({
    queryKey: ['time-record', user?.id, date],
    queryFn: async () => {
      if (!user) return null;
      
      console.log('📅 Buscando registro para data:', date);
      
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    },
    enabled: enabled && !!user,
    staleTime,
    refetchInterval,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Invalidação inteligente - apenas quando necessário
  const invalidateRecord = useCallback(() => {
    queryClient.invalidateQueries({ 
      queryKey: ['time-record', user?.id, date],
      exact: true 
    });
  }, [queryClient, user?.id, date]);

  // Atualização otimística para melhor UX
  const updateRecordOptimistic = useCallback((updates: any) => {
    queryClient.setQueryData(['time-record', user?.id, date], (old: any) => {
      if (!old) return old;
      return { ...old, ...updates };
    });
  }, [queryClient, user?.id, date]);

  // Cancelar queries quando componente desmonta
  useEffect(() => {
    return () => {
      queryClient.cancelQueries({ 
        queryKey: ['time-record', user?.id, date] 
      });
    };
  }, [queryClient, user?.id, date]);

  return {
    ...query,
    invalidateRecord,
    updateRecordOptimistic
  };
}

// Hook especializado para localizações (cache longo)
export function useOptimizedLocationsQuery() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['allowed-locations-static'],
    queryFn: async () => {
      console.log('📍 Carregando localizações (cache longo)...');
      
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      return (data || []).map(location => ({
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        range_meters: Number(location.range_meters)
      }));
    },
    staleTime: 30 * 60 * 1000, // 30 minutos
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Prefetch para cache
  const prefetchLocations = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['allowed-locations-static'],
      queryFn: query.queryFn,
      staleTime: 30 * 60 * 1000
    });
  }, [queryClient, query.queryFn]);

  return {
    ...query,
    prefetchLocations
  };
}

// Hook para perfil do usuário (cache médio)
export function useOptimizedProfileQuery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['user-profile-static', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email, role')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Perfil não encontrado');
        return null;
      }

      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutos
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (!user) {
        queryClient.removeQueries({ 
          queryKey: ['user-profile-static'] 
        });
      }
    };
  }, [queryClient, user]);

  return query;
}
