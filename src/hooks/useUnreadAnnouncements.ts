
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high';
  created_at: string;
  expires_at?: string;
}

export const useUnreadAnnouncements = () => {
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useOptimizedAuth();

  const fetchUnreadAnnouncements = async () => {
    if (!user) {
      setUnreadAnnouncements([]);
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Buscando anúncios não lidos para o usuário:', user.id);

      // Query mais simples e direta
      const { data, error } = await supabase
        .from('announcement_recipients')
        .select(`
          announcement_id,
          announcements (
            id,
            title,
            content,
            priority,
            created_at,
            expires_at
          )
        `)
        .eq('employee_id', user.id)
        .eq('is_read', false)
        .not('announcements', 'is', null);

      if (error) {
        console.error('❌ Erro ao buscar anúncios:', error);
        return;
      }

      console.log('📋 Dados retornados da query:', data);

      if (!data || data.length === 0) {
        console.log('📭 Nenhum anúncio não lido encontrado');
        setUnreadAnnouncements([]);
        return;
      }

      // Processar e filtrar anúncios
      const announcements = data
        .filter(item => item.announcements) // Filtrar apenas itens com anúncio válido
        .map(item => item.announcements as Announcement)
        .filter(announcement => {
          // Filtrar apenas anúncios ativos
          if (!announcement) return false;
          
          // Se tem data de expiração, verificar se não expirou
          if (announcement.expires_at) {
            const isExpired = new Date(announcement.expires_at) < new Date();
            if (isExpired) {
              console.log(`⏰ Anúncio ${announcement.id} expirado, ignorando`);
              return false;
            }
          }
          
          return true;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('✅ Anúncios processados:', announcements);
      setUnreadAnnouncements(announcements);
    } catch (error) {
      console.error('❌ Erro ao buscar anúncios:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (announcementId: string) => {
    if (!user) return;

    try {
      console.log('📖 Marcando anúncio como lido:', announcementId);

      const { error } = await supabase
        .from('announcement_recipients')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('employee_id', user.id)
        .eq('announcement_id', announcementId);

      if (error) {
        console.error('❌ Erro ao marcar anúncio como lido:', error);
        return;
      }

      console.log('✅ Anúncio marcado como lido com sucesso');

      // Atualizar estado local
      setUnreadAnnouncements(prev => 
        prev.filter(announcement => announcement.id !== announcementId)
      );
    } catch (error) {
      console.error('❌ Erro ao marcar anúncio como lido:', error);
    }
  };

  useEffect(() => {
    fetchUnreadAnnouncements();
  }, [user]);

  // Configurar listener para novos anúncios
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Configurando listener para novos anúncios');

    const channel = supabase
      .channel('announcement_recipients_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcement_recipients',
          filter: `employee_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Novo anúncio recebido:', payload);
          fetchUnreadAnnouncements();
        }
      )
      .subscribe();

    return () => {
      console.log('🛑 Removendo listener de anúncios');
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    unreadAnnouncements,
    loading,
    markAsRead
  };
};
