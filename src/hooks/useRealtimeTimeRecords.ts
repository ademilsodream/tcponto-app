
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

interface TimeRecord {
  id: string;
  user_id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  locations?: any;
  status?: string;
}

export function useRealtimeTimeRecords() {
  const { user, profile } = useOptimizedAuth();
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;

    const loadTimeRecords = async () => {
      try {
        setLoading(true);
        console.log('🔄 Carregando registros otimizado...');

        let query = supabase
          .from('time_records')
          .select(`
            id,
            user_id,
            date,
            clock_in,
            lunch_start,
            lunch_end,
            clock_out,
            total_hours,
            locations,
            status
          `)
          .order('date', { ascending: false })
          .limit(50);

        // Check if user is admin by checking if profile exists and has admin role
        const isAdmin = profile && 'role' in profile && profile.role === 'admin';
        if (!isAdmin) {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
          console.error('❌ Erro ao carregar registros:', error);
          throw error;
        }

        console.log('✅ Registros carregados:', data?.length || 0);
        setTimeRecords(data || []);
      } catch (error) {
        console.error('❌ Erro ao carregar time records:', error);
      } finally {
        setLoading(false);
      }
    };

    timeoutId = setTimeout(loadTimeRecords, 100);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;

    console.log('🔄 Configurando realtime otimizado...');

    const channel = supabase
      .channel('time_records_optimized')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_records'
        },
        (payload) => {
          console.log('📡 Atualização realtime:', payload);
          
          const record = payload.new as TimeRecord;
          const eventType = payload.eventType;

          setTimeRecords(prev => {
            switch (eventType) {
              case 'INSERT':
                if (prev.find(r => r.id === record.id)) return prev;
                return [record, ...prev.slice(0, 49)];
                
              case 'UPDATE':
                return prev.map(r => r.id === record.id ? record : r);
                
              case 'DELETE':
                return prev.filter(r => r.id !== payload.old.id);
                
              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Desconectando realtime...');
      supabase.removeChannel(channel);
    };
  }, [user]);

  const refreshRecords = async () => {
    if (!user) return;

    try {
      console.log('🔄 Refresh otimizado...');
      
      let query = supabase
        .from('time_records')
        .select(`
          id,
          user_id,
          date,
          clock_in,
          lunch_start,
          lunch_end,
          clock_out,
          total_hours,
          locations,
          status
        `)
        .order('date', { ascending: false })
        .limit(50);

      // Check if user is admin
      const isAdmin = profile && 'role' in profile && profile.role === 'admin';
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('✅ Registros atualizados:', data?.length || 0);
      setTimeRecords(data || []);
    } catch (error) {
      console.error('❌ Erro ao atualizar registros:', error);
    }
  };

  return {
    timeRecords,
    loading,
    refreshRecords
  };
}
