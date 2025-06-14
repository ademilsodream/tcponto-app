
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

  // Carregar registros iniciais
  useEffect(() => {
    if (!user) return;

    const loadTimeRecords = async () => {
      try {
        setLoading(true);
        console.log('🔄 Carregando registros de ponto...');

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
          .order('created_at', { ascending: false });

        // Se for admin, buscar todos os registros
        // Se for usuário comum, buscar apenas seus registros
        if (profile?.role !== 'admin') {
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

    loadTimeRecords();
  }, [user, profile?.role]);

  // Configurar realtime para receber atualizações em tempo real
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Configurando realtime para time_records...');

    const channel = supabase
      .channel('time_records_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_records'
        },
        (payload) => {
          console.log('📡 Atualização realtime recebida:', payload);
          
          const record = payload.new as TimeRecord;
          const eventType = payload.eventType;

          setTimeRecords(prev => {
            switch (eventType) {
              case 'INSERT':
                // Verificar se já existe para evitar duplicatas
                if (prev.find(r => r.id === record.id)) {
                  return prev;
                }
                console.log('➕ Novo registro adicionado:', record);
                return [record, ...prev];
                
              case 'UPDATE':
                console.log('🔄 Registro atualizado:', record);
                return prev.map(r => r.id === record.id ? record : r);
                
              case 'DELETE':
                console.log('🗑️ Registro removido:', payload.old);
                return prev.filter(r => r.id !== payload.old.id);
                
              default:
                return prev;
            }
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da conexão realtime:', status);
      });

    return () => {
      console.log('🔌 Desconectando realtime...');
      supabase.removeChannel(channel);
    };
  }, [user]);

  const refreshRecords = async () => {
    if (!user) return;

    try {
      console.log('🔄 Atualizando registros manualmente...');
      
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
        .order('created_at', { ascending: false });

      if (profile?.role !== 'admin') {
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
