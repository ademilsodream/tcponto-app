
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
      console.log('❌ Usuário não está logado');
      setUnreadAnnouncements([]);
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Buscando anúncios não lidos para o usuário:', user.id);

      // Primeiro, buscar os IDs dos anúncios não lidos do usuário
      const { data: recipientData, error: recipientError } = await supabase
        .from('announcement_recipients')
        .select('announcement_id')
        .eq('employee_id', user.id)
        .eq('is_read', false);

      if (recipientError) {
        console.error('❌ Erro ao buscar recipients:', recipientError);
        return;
      }

      console.log('📋 Recipients encontrados:', recipientData);

      if (!recipientData || recipientData.length === 0) {
        console.log('📭 Nenhum recipient não lido encontrado');
        setUnreadAnnouncements([]);
        return;
      }

      // Buscar os anúncios pelos IDs encontrados
      const announcementIds = recipientData.map(r => r.announcement_id);
      console.log('🔍 Buscando anúncios pelos IDs:', announcementIds);

      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select(`
          id,
          title,
          content,
          priority,
          created_at,
          expires_at
        `)
        .in('id', announcementIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (announcementsError) {
        console.error('❌ Erro ao buscar anúncios:', announcementsError);
        return;
      }

      console.log('📋 Anúncios encontrados:', announcementsData);

      if (!announcementsData || announcementsData.length === 0) {
        console.log('📭 Nenhum anúncio ativo encontrado');
        setUnreadAnnouncements([]);
        return;
      }

      // Filtrar anúncios não expirados
      const activeAnnouncements = announcementsData.filter(announcement => {
        if (announcement.expires_at) {
          const isExpired = new Date(announcement.expires_at) < new Date();
          if (isExpired) {
            console.log(`⏰ Anúncio ${announcement.id} expirado, ignorando`);
            return false;
          }
        }
        return true;
      });

      console.log('✅ Anúncios ativos processados:', activeAnnouncements);
      setUnreadAnnouncements(activeAnnouncements);
    } catch (error) {
      console.error('❌ Erro inesperado ao buscar anúncios:', error);
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
    if (user) {
      console.log('👤 Usuário logado detectado, carregando anúncios...');
      fetchUnreadAnnouncements();
    } else {
      console.log('👤 Usuário não logado, aguardando...');
      setLoading(false);
    }
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
