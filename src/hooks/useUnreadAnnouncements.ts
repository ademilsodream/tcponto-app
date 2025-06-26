
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

      console.log('📋 Recipients encontrados:', recipientData?.length || 0, recipientData);

      if (!recipientData || recipientData.length === 0) {
        console.log('📭 Nenhum recipient não lido encontrado - DEFININDO LISTA VAZIA');
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
        console.log('📭 Nenhum anúncio ativo encontrado - DEFININDO LISTA VAZIA');
        setUnreadAnnouncements([]);
        setLoading(false);
        return;
      }

      // 🔧 CORREÇÃO: Simplificar a verificação de expiração
      const now = new Date();
      console.log('🕐 Data/hora atual (UTC):', now.toISOString());
      console.log('🕐 Data/hora atual (Local):', now.toString());

      const activeAnnouncements = announcementsData
        .map(announcement => {
          console.log(`🔍 Processando anúncio ${announcement.id}:`);
          console.log('   - Title:', announcement.title);
          console.log('   - expires_at (RAW):', announcement.expires_at);
          
          // Se não tem data de expiração, sempre ativo
          if (!announcement.expires_at) {
            console.log('   ✅ SEM DATA DE EXPIRAÇÃO - SEMPRE ATIVO');
            return {
              ...announcement,
              priority: (announcement.priority || 'normal') as 'low' | 'normal' | 'high'
            };
          }

          // 🔧 CORREÇÃO: Usar comparação de string direta para evitar problemas de timezone
          const expiresAtString = announcement.expires_at;
          const nowString = now.toISOString();
          const isExpired = expiresAtString < nowString;
          
          console.log('   - expires_at (String):', expiresAtString);
          console.log('   - now (String):', nowString);
          console.log('   - isExpired (String comparison):', isExpired);

          if (isExpired) {
            console.log('   ❌ ANÚNCIO EXPIRADO - IGNORANDO');
            return null;
          }

          console.log('   ✅ ANÚNCIO ATIVO - INCLUINDO');
          return {
            ...announcement,
            priority: (announcement.priority || 'normal') as 'low' | 'normal' | 'high'
          };
        })
        .filter(announcement => announcement !== null) as Announcement[];

      console.log('✅ RESULTADO FINAL - Anúncios ativos processados:', activeAnnouncements.length, activeAnnouncements);
      
      // 🔧 CORREÇÃO: Sempre definir o estado, mesmo que seja array vazio
      setUnreadAnnouncements(activeAnnouncements);
      
      if (activeAnnouncements.length > 0) {
        console.log('🎉 SUCESSO! Definindo', activeAnnouncements.length, 'anúncios no state');
      } else {
        console.log('⚠️ ATENÇÃO! Nenhum anúncio ativo após filtros - lista vazia');
      }

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
        console.log('📝 Atualizando lista local: removendo anúncio', announcementId, 'nova lista:', newList.length);
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
    announcements: unreadAnnouncements 
  });

  return {
    unreadAnnouncements,
    loading,
    markAsRead
  };
};
