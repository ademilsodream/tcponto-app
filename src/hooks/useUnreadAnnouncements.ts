
import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  expires_at: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_active: boolean;
}

export const useUnreadAnnouncements = (userId: string) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const loadUnreadAnnouncements = async () => {
      try {
        setLoading(true);
        const now = new Date().toISOString();
        
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading unread announcements:', error);
          return;
        }

        setAnnouncements(data || []);
        setUnreadCount(data?.length || 0);
      } catch (error) {
        console.error('Error loading unread announcements:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUnreadAnnouncements();
    
    // Recarregar a cada 2 minutos
    const interval = setInterval(loadUnreadAnnouncements, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [userId]);

  return {
    unreadCount,
    announcements,
    loading
  };
};
