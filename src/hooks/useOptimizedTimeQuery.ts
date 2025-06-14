
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

interface TimeQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

export function useOptimizedTimeQuery(date: string, options: TimeQueryOptions = {}) {
  const { user } = useOptimizedAuth();
  const queryClient = useQueryClient();
  
  const {
    enabled = true,
    staleTime = 30 * 60 * 1000, // 30 minutos por padrão
    refetchInterval = false
  } = options;

  // ✨ Query com timeout obrigatório
  const query = useQuery({
    queryKey: ['time-record', user?.id, date],
    queryFn: async () => {
      if (!user) return null;
      
      console.log('📅 Buscando registro para data:', date);
      
      // ✨ Timeout para evitar queries infinitas
      const queryPromise = supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .single();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 10000);
      });

      try {
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return data;
      } catch (error: any) {
        if (error.message === 'Query timeout') {
          console.warn('⚠️ Query timeout - retornando null');
          return null;
        }
        throw error;
      }
    },
    enabled: enabled && !!user,
    staleTime,
    refetchInterval: false, // ✨ Sempre desabilitado
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1, // ✨ Apenas 1 retry
    retryDelay: 1000 // ✨ 1 segundo entre retries
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

  // ✨ Cleanup automático quando componente desmonta
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

  const fetchLocations = useCallback(async () => {
    console.log('📍 Carregando localizações (cache longo)...');
    
    // ✨ Timeout para locations
    const locationsPromise = supabase
      .from('allowed_locations')
      .select('*')
      .eq('is_active', true)
      .order('name');

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Locations timeout')), 8000);
    });

    try {
      const { data, error } = await Promise.race([locationsPromise, timeoutPromise]) as any;

      if (error) throw error;
      
      return (data || []).map((location: any) => ({
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        range_meters: Number(location.range_meters)
      }));
    } catch (error: any) {
      if (error.message === 'Locations timeout') {
        console.warn('⚠️ Locations timeout - retornando array vazio');
        return [];
      }
      throw error;
    }
  }, []);

  const query = useQuery({
    queryKey: ['allowed-locations-static'],
    queryFn: fetchLocations,
    staleTime: 60 * 60 * 1000, // 60 minutos
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
    retryDelay: 2000
  });

  const prefetchLocations = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['allowed-locations-static'],
      queryFn: fetchLocations,
      staleTime: 60 * 60 * 1000
    });
  }, [queryClient, fetchLocations]);

  return {
    ...query,
    prefetchLocations
  };
}

// Hook para perfil do usuário (cache médio)
export function useOptimizedProfileQuery() {
  const { user } = useOptimizedAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['user-profile-static', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      // ✨ Timeout para profile
      const profilePromise = supabase
        .from('profiles')
        .select('name, email, role')
        .eq('id', user.id)
        .single();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile timeout')), 6000);
      });

      try {
        const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

        if (error && error.code !== 'PGRST116') {
          console.warn('Perfil não encontrado');
          return null;
        }

        return data;
      } catch (error: any) {
        if (error.message === 'Profile timeout') {
          console.warn('⚠️ Profile timeout - retornando null');
          return null;
        }
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000, // 30 minutos
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
    retryDelay: 1500
  });

  // ✨ Cleanup ao desmontar
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
