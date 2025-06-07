
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
      console.log('Push notifications não suportadas em web');
      return;
    }

    try {
      // Solicitar permissão
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      
      if (permStatus.receive !== 'granted') {
        console.log('Permissão negada para push notifications');
        return;
      }

      // Registrar para receber push notifications
      await PushNotifications.register();

      // Configurar listeners
      this.setupListeners(userId);

    } catch (error) {
      console.error('Erro ao inicializar push notifications:', error);
    }
  }

  private setupListeners(userId: string): void {
    // Receber token de registro
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token:', token.value);
      await this.saveTokenToSupabase(userId, token.value);
    });

    // Erro no registro
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', error);
    });

    // Notificação recebida
    PushNotifications.addListener('pushNotificationReceived', 
      (notification: PushNotificationSchema) => {
        console.log('Push notification received:', notification);
        // Pode adicionar lógica customizada aqui
      }
    );

    // Notificação clicada/ação realizada
    PushNotifications.addListener('pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('Push notification action performed:', notification);
        // Pode navegar para tela específica baseado na notificação
      }
    );
  }

  private async saveTokenToSupabase(userId: string, token: string): Promise<void> {
    try {
      const platform = Capacitor.getPlatform();
      
      // Primeiro, desativar tokens antigos do mesmo dispositivo
      await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('employee_id', userId)
        .eq('platform', platform);

      // Inserir novo token
      const { error } = await supabase
        .from('push_tokens')
        .insert({
          employee_id: userId,
          token,
          platform,
          device_info: {
            model: await this.getDeviceInfo(),
            app_version: '1.0.0'
          },
          is_active: true
        });

      if (error) {
        console.error('Erro ao salvar token:', error);
      } else {
        console.log('Token salvo com sucesso no Supabase');
      }
    } catch (error) {
      console.error('Erro ao salvar token no Supabase:', error);
    }
  }

  private async getDeviceInfo(): Promise<any> {
    try {
      const { Device } = await import('@capacitor/device');
      return await Device.getInfo();
    } catch {
      return { model: 'unknown' };
    }
  }

  async removeToken(userId: string): Promise<void> {
    try {
      await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('employee_id', userId);
      
      console.log('Token removido com sucesso');
    } catch (error) {
      console.error('Erro ao remover token:', error);
    }
  }
}
