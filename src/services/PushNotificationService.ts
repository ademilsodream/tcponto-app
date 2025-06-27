
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

export class PushNotificationService {
  private static instance: PushNotificationService;
  
  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(userId: string): Promise<void> {
    // Verificar se está em plataforma nativa
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications não suportadas em web - inicializando fallback');
      await this.initializeWebFallback(userId);
      return;
    }

    try {
      console.log('🔔 Inicializando push notifications para usuário:', userId);
      
      // Solicitar permissão
      let permStatus = await PushNotifications.checkPermissions();
      console.log('📋 Status atual da permissão:', permStatus);
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
        console.log('📋 Nova permissão solicitada:', permStatus);
      }
      
      if (permStatus.receive !== 'granted') {
        console.log('❌ Permissão negada para push notifications');
        return;
      }

      // Registrar para receber push notifications
      await PushNotifications.register();
      console.log('✅ Push notifications registradas com sucesso');

      // Configurar listeners
      this.setupListeners(userId);

    } catch (error) {
      console.error('❌ Erro ao inicializar push notifications:', error);
    }
  }

  private async initializeWebFallback(userId: string): Promise<void> {
    // Para web, registrar um token fictício ou usar service worker
    if ('serviceWorker' in navigator && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('✅ Notificações web habilitadas');
          
          // Registrar token fictício para web
          const webToken = `web-${userId}-${Date.now()}`;
          await this.saveTokenToSupabase(userId, webToken, 'web');
        }
      } catch (error) {
        console.error('Erro ao configurar notificações web:', error);
      }
    }
  }

  async sendNotification(notification: {
    userId?: string;
    tokens?: { token: string; platform: string }[];
    title: string;
    body: string;
    data?: any;
  }): Promise<void> {
    try {
      console.log('📤 Enviando push notification:', notification);
      
      // Chamar a edge function para enviar a notificação
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: notification.userId,
          tokens: notification.tokens,
          title: notification.title,
          body: notification.body,
          data: notification.data || {}
        }
      });

      if (error) {
        console.error('❌ Erro ao enviar notificação:', error);
        throw error;
      }

      console.log('✅ Notificação enviada com sucesso:', data);
      
      // Se estiver em web, mostrar notificação local também
      if (!Capacitor.isNativePlatform() && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.body,
            icon: '/favicon.ico'
          });
        }
      }

    } catch (error) {
      console.error('❌ Erro ao enviar notificação:', error);
      throw error;
    }
  }

  // Método conveniente para enviar notificação para um usuário específico
  async sendToUser(userId: string, title: string, body: string, data?: any): Promise<void> {
    return this.sendNotification({
      userId,
      title,
      body,
      data
    });
  }

  // Método para enviar para tokens específicos
  async sendToTokens(tokens: { token: string; platform: string }[], title: string, body: string, data?: any): Promise<void> {
    return this.sendNotification({
      tokens,
      title,
      body,
      data
    });
  }

  private setupListeners(userId: string): void {
    // Receber token de registro
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('🎯 Push registration success, token:', token.value);
      await this.saveTokenToSupabase(userId, token.value, 'android');
    });

    // Erro no registro
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('❌ Push registration error:', error);
    });

    // Notificação recebida
    PushNotifications.addListener('pushNotificationReceived', 
      (notification: PushNotificationSchema) => {
        console.log('📱 Push notification received:', notification);
        
        // Mostrar toast ou modal local se necessário
        // Por enquanto apenas logamos
      }
    );

    // Notificação clicada/ação realizada
    PushNotifications.addListener('pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('👆 Push notification action performed:', notification);
        
        // Aqui pode navegar para tela específica baseado na notificação
        const data = notification.notification.data;
        if (data?.route) {
          // Implementar navegação se necessário
          console.log('Navegando para:', data.route);
        }
      }
    );
  }

  private async saveTokenToSupabase(userId: string, token: string, platform: string): Promise<void> {
    try {
      console.log('💾 Salvando token no Supabase:', { userId, platform, token: token.substring(0, 20) + '...' });
      
      // Primeiro, desativar tokens antigos do mesmo usuário e plataforma
      const { error: updateError } = await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('employee_id', userId)
        .eq('platform', platform);

      if (updateError) {
        console.error('⚠️ Erro ao desativar tokens antigos:', updateError);
      }

      // Inserir novo token
      const { error: insertError } = await supabase
        .from('push_tokens')
        .insert({
          employee_id: userId,
          token,
          platform,
          device_info: await this.getDeviceInfo(),
          is_active: true
        });

      if (insertError) {
        console.error('❌ Erro ao salvar token:', insertError);
      } else {
        console.log('✅ Token salvo com sucesso no Supabase');
      }
    } catch (error) {
      console.error('❌ Erro ao salvar token no Supabase:', error);
    }
  }

  private async getDeviceInfo(): Promise<any> {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Device } = await import('@capacitor/device');
        const info = await Device.getInfo();
        return {
          model: info.model,
          platform: info.platform,
          operatingSystem: info.operatingSystem,
          osVersion: info.osVersion,
          manufacturer: info.manufacturer,
          isVirtual: info.isVirtual,
          webViewVersion: info.webViewVersion
        };
      } else {
        return {
          model: 'web-browser',
          platform: 'web',
          userAgent: navigator.userAgent
        };
      }
    } catch (error) {
      console.error('Erro ao obter info do dispositivo:', error);
      return { model: 'unknown', platform: 'unknown' };
    }
  }

  async removeToken(userId: string): Promise<void> {
    try {
      console.log('🗑️ Removendo tokens do usuário:', userId);
      
      const { error } = await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('employee_id', userId);
      
      if (error) {
        console.error('❌ Erro ao remover token:', error);
      } else {
        console.log('✅ Tokens removidos com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao remover token:', error);
    }
  }

  // Método para testar envio de notificação
  async testNotification(userId: string): Promise<void> {
    try {
      await this.sendToUser(
        userId,
        'Teste de Push Notification',
        'Esta é uma notificação de teste do TCPonto!',
        { type: 'test', timestamp: new Date().toISOString() }
      );
      console.log('✅ Notificação de teste enviada');
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de teste:', error);
      throw error;
    }
  }
}
