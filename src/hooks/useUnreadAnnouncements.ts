
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
      console.log('🔍 INICIANDO BUSCA DE ANÚNCIOS para usuário:', user.id);
      setLoading(true);

      // Primeiro, buscar os IDs dos anúncios não lidos do usuário
      const { data: recipientData, error: recipientError } = await supabase
        .from('announcement_recipients')
        .select('announcement_id')
        .eq('employee_id', user.id)
        .eq('is_read', false);

      if (recipientError) {
        console.error('❌ Erro ao buscar recipients:', recipientError);
        setLoading(false);
        return;
      }

      console.log('🎯 DEBUG - User ID:', user.id);
      console.log('📋 Recipients não lidos encontrados:', recipientData?.length || 0, recipientData);

      if (!recipientData || recipientData.length === 0) {
        console.log('📭 Nenhum recipient não lido encontrado para este usuário');
        setUnreadAnnouncements([]);
        setLoading(false);
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
        setLoading(false);
        return;
      }

      console.log('📋 Anúncios RAW encontrados:', announcementsData?.length || 0, announcementsData);

      if (!announcementsData || announcementsData.length === 0) {
        console.log('📭 Nenhum anúncio ativo encontrado');
        setUnreadAnnouncements([]);
        setLoading(false);
        return;
      }

      // ✅ CORREÇÃO: Usar apenas DATA para comparação de expiração
      const today = new Date().toISOString().split('T')[0]; // Apenas a data: YYYY-MM-DD
      console.log('📅 Data atual (apenas data):', today);

      const activeAnnouncements = announcementsData
        .filter(announcement => {
          console.log(`🔍 Verificando anúncio ${announcement.id}: ${announcement.title}`);
          console.log('   - expires_at:', announcement.expires_at);
          
          // Se não tem data de expiração, sempre ativo
          if (!announcement.expires_at) {
            console.log('   ✅ SEM DATA DE EXPIRAÇÃO - SEMPRE ATIVO');
            return true;
          }

          // Extrair apenas a data da expiração (YYYY-MM-DD)
          const expirationDate = announcement.expires_at.split('T')[0];
          console.log('   - expirationDate (apenas data):', expirationDate);
          console.log('   - today:', today);

          // Comparação: anúncio é válido se expira hoje ou depois de hoje
          const isValid = expirationDate >= today;
          console.log('   - isValid:', isValid);

          if (!isValid) {
            console.log('   ❌ ANÚNCIO EXPIRADO - IGNORANDO');
            return false;
          }

          console.log('   ✅ ANÚNCIO VÁLIDO - INCLUINDO');
          return true;
        })
        .map(announcement => ({
          ...announcement,
          priority: (announcement.priority || 'normal') as 'low' | 'normal' | 'high'
        }));

      console.log('✅ RESULTADO FINAL - Anúncios válidos:', activeAnnouncements.length, activeAnnouncements);
      setUnreadAnnouncements(activeAnnouncements);

    } catch (error) {
      console.error('❌ Erro inesperado ao buscar anúncios:', error);
      setUnreadAnnouncements([]);
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
      setUnreadAnnouncements(prev => {
        const newList = prev.filter(announcement => announcement.id !== announcementId);
        console.log('📝 Atualizando lista local: nova lista:', newList.length);
        return newList;
      });
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

  console.log('🏠 Hook useUnreadAnnouncements retornando:', { 
    unreadAnnouncements: unreadAnnouncements.length, 
    loading,
    userId: user?.id
  });

  return {
    unreadAnnouncements,
    loading,
    markAsRead
  };
};
