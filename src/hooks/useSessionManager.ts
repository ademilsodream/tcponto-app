
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

interface SessionSettings {
  sessionDurationDays: number;
  autoRefreshEnabled: boolean;
  rememberMeEnabled: boolean;
  sessionWarningMinutes: number;
  permanentSessionEnabled: boolean;
}

export const useSessionManager = () => {
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
    sessionDurationDays: 30,
    autoRefreshEnabled: true,
    rememberMeEnabled: true,
    sessionWarningMinutes: 60,
    permanentSessionEnabled: true
  });

  const [sessionWarning, setSessionWarning] = useState<boolean>(false);
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);

  // Carregar configurações do sistema
  const loadSessionSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'session_duration_days',
          'auto_refresh_enabled',
          'remember_me_enabled',
          'session_warning_minutes',
          'permanent_session_enabled'
        ]);

      if (error) {
        console.error('❌ Erro ao carregar configurações de sessão:', error);
        return;
      }

      if (data) {
        const settings: Partial<SessionSettings> = {};
        data.forEach(setting => {
          switch (setting.setting_key) {
            case 'session_duration_days':
              settings.sessionDurationDays = parseInt(setting.setting_value);
              break;
            case 'auto_refresh_enabled':
              settings.autoRefreshEnabled = setting.setting_value === 'true';
              break;
            case 'remember_me_enabled':
              settings.rememberMeEnabled = setting.setting_value === 'true';
              break;
            case 'session_warning_minutes':
              settings.sessionWarningMinutes = parseInt(setting.setting_value);
              break;
            case 'permanent_session_enabled':
              settings.permanentSessionEnabled = setting.setting_value === 'true';
              break;
          }
        });

        setSessionSettings(prev => ({ ...prev, ...settings }));
        console.log('✅ Configurações de sessão carregadas:', settings);
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao carregar configurações:', error);
    }
  }, []);

  // Criar sessão personalizada
  const createUserSession = useCallback(async (user: User, rememberMe: boolean = false) => {
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timestamp: new Date().toISOString()
      };

      const sessionDuration = rememberMe ? 
        sessionSettings.sessionDurationDays * 24 * 60 * 60 * 1000 : // Dias para millisegundos
        24 * 60 * 60 * 1000; // 24 horas padrão

      const expiresAt = new Date(Date.now() + sessionDuration);

      const { error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          device_info: deviceInfo,
          expires_at: expiresAt.toISOString(),
          is_permanent: rememberMe && sessionSettings.permanentSessionEnabled
        });

      if (error) {
        console.error('❌ Erro ao criar sessão personalizada:', error);
        return;
      }

      setSessionExpiry(expiresAt);
      console.log('✅ Sessão personalizada criada:', {
        userId: user.id,
        expiresAt: expiresAt.toISOString(),
        rememberMe,
        duration: sessionDuration / (1000 * 60 * 60) + ' horas'
      });
    } catch (error) {
      console.error('❌ Erro inesperado ao criar sessão:', error);
    }
  }, [sessionSettings]);

  // Atualizar atividade da sessão
  const updateSessionActivity = useCallback(async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_permanent', false);

      if (error) {
        console.error('❌ Erro ao atualizar atividade da sessão:', error);
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao atualizar atividade:', error);
    }
  }, []);

  // Verificar se sessão está próxima do vencimento
  const checkSessionExpiry = useCallback((session: Session | null) => {
    if (!session || !sessionExpiry) return;

    const now = new Date();
    const warningTime = new Date(sessionExpiry.getTime() - (sessionSettings.sessionWarningMinutes * 60 * 1000));

    if (now >= warningTime && now < sessionExpiry) {
      setSessionWarning(true);
    } else {
      setSessionWarning(false);
    }
  }, [sessionExpiry, sessionSettings.sessionWarningMinutes]);

  // Renovar token automaticamente
  const renewToken = useCallback(async () => {
    if (!sessionSettings.autoRefreshEnabled) return;

    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Erro ao renovar token:', error);
        return false;
      }

      if (data.session) {
        console.log('✅ Token renovado com sucesso');
        return true;
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao renovar token:', error);
    }
    
    return false;
  }, [sessionSettings.autoRefreshEnabled]);

  // Limpar sessões expiradas
  const cleanupExpiredSessions = useCallback(async () => {
    try {
      const { error } = await supabase.rpc('cleanup_expired_sessions');
      
      if (error) {
        console.error('❌ Erro ao limpar sessões expiradas:', error);
      } else {
        console.log('✅ Sessões expiradas limpas');
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao limpar sessões:', error);
    }
  }, []);

  // Configurar renovação automática
  useEffect(() => {
    if (!sessionSettings.autoRefreshEnabled) return;

    const interval = setInterval(() => {
      renewToken();
    }, 55 * 60 * 1000); // Renovar a cada 55 minutos

    return () => clearInterval(interval);
  }, [sessionSettings.autoRefreshEnabled, renewToken]);

  // Limpeza periódica de sessões
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupExpiredSessions();
    }, 60 * 60 * 1000); // Limpar a cada hora

    return () => clearInterval(interval);
  }, [cleanupExpiredSessions]);

  // Carregar configurações na inicialização
  useEffect(() => {
    loadSessionSettings();
  }, [loadSessionSettings]);

  return {
    sessionSettings,
    sessionWarning,
    sessionExpiry,
    createUserSession,
    updateSessionActivity,
    checkSessionExpiry,
    renewToken,
    cleanupExpiredSessions,
    loadSessionSettings
  };
};
