
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
      const { data, error } = await supabase
        .from('announcement_recipients')
        .select(`
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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar anúncios:', error);
        return;
      }

      const announcements = data
        ?.map(item => item.announcements)
        .filter(Boolean) as Announcement[];

      setUnreadAnnouncements(announcements || []);
    } catch (error) {
      console.error('Erro ao buscar anúncios:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (announcementId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('announcement_recipients')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('employee_id', user.id)
        .eq('announcement_id', announcementId);

      if (error) {
        console.error('Erro ao marcar anúncio como lido:', error);
        return;
      }

      // Atualizar estado local
      setUnreadAnnouncements(prev => 
        prev.filter(announcement => announcement.id !== announcementId)
      );
    } catch (error) {
      console.error('Erro ao marcar anúncio como lido:', error);
    }
  };

  useEffect(() => {
    fetchUnreadAnnouncements();
  }, [user]);

  // Configurar listener para novos anúncios
  useEffect(() => {
    if (!user) return;

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
        () => {
          fetchUnreadAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    unreadAnnouncements,
    loading,
    markAsRead
  };
};
