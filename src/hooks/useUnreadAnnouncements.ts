
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

      const { data, error } = await supabase
        .from('announcement_recipients')
        .select(`
          announcements!inner (
            id,
            title,
            content,
            priority,
            created_at,
            expires_at,
            is_active
          )
        `)
        .eq('employee_id', user.id)
        .eq('is_read', false)
        .eq('announcements.is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString(), { referencedTable: 'announcements' })
        .order('created_at', { referencedTable: 'announcements', ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar anúncios:', error);
        return;
      }

      console.log('📋 Dados retornados da query:', data);

      const announcements = data
        ?.map(item => item.announcements)
        .filter(Boolean) as Announcement[];

      console.log('✅ Anúncios processados:', announcements);
      setUnreadAnnouncements(announcements || []);
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
