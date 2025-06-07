
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Bell, Mail, Clock, AlertTriangle, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

interface NotificationSetting {
  id: string;
  notification_type: string;
  is_enabled: boolean;
  frequency: string;
  push_enabled: boolean;
  push_reminder_entry: boolean;
  push_reminder_lunch_start: boolean;
  push_reminder_lunch_end: boolean;
  push_reminder_exit: boolean;
  push_incomplete_records: boolean;
}

const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar configurações atuais
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['notification-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('employee_id', user.id)
        .order('notification_type');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Mutation para atualizar configurações
  const updateSettingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NotificationSetting> }) => {
      const { error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast({
        title: "Configuração atualizada",
        description: "Suas preferências de notificação foram salvas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'incomplete_records':
        return <Clock className="w-4 h-4" />;
      case 'overtime_alert':
        return <AlertTriangle className="w-4 h-4" />;
      case 'approval_required':
        return <Bell className="w-4 h-4" />;
      case 'monthly_summary':
        return <Mail className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationLabel = (type: string) => {
    switch (type) {
      case 'incomplete_records':
        return 'Registros Incompletos';
      case 'overtime_alert':
        return 'Alertas de Horas Extras';
      case 'approval_required':
        return 'Solicitações de Aprovação';
      case 'monthly_summary':
        return 'Resumo Mensal';
      default:
        return type;
    }
  };

  const getNotificationDescription = (type: string) => {
    switch (type) {
      case 'incomplete_records':
        return 'Notificação quando registros de ponto estão incompletos';
      case 'overtime_alert':
        return 'Alerta quando horas extras excedem o limite recomendado';
      case 'approval_required':
        return 'Notificação sobre solicitações que precisam de aprovação';
      case 'monthly_summary':
        return 'Resumo mensal das suas horas trabalhadas';
      default:
        return 'Configuração de notificação';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configurações de Notificação</h2>
        <p className="text-gray-600">
          Gerencie como e quando você deseja receber notificações por email e push notifications.
        </p>
      </div>

      <Alert>
        <Smartphone className="h-4 w-4" />
        <AlertDescription>
          As notificações push mobile funcionam apenas no aplicativo instalado no celular.
          Certifique-se de permitir notificações quando solicitado.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {settings.map((setting) => (
          <Card key={setting.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                {getNotificationIcon(setting.notification_type)}
                {getNotificationLabel(setting.notification_type)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                {getNotificationDescription(setting.notification_type)}
              </p>
              
              {/* Configurações de Email */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Notificações por Email
                </h4>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`email-${setting.id}`}
                      checked={setting.is_enabled}
                      onCheckedChange={(checked) => {
                        updateSettingMutation.mutate({
                          id: setting.id,
                          updates: { is_enabled: checked }
                        });
                      }}
                      disabled={updateSettingMutation.isPending}
                    />
                    <Label htmlFor={`email-${setting.id}`}>
                      {setting.is_enabled ? 'Ativado' : 'Desativado'}
                    </Label>
                  </div>

                  {setting.is_enabled && (
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`frequency-${setting.id}`} className="text-sm">
                        Frequência:
                      </Label>
                      <Select
                        value={setting.frequency}
                        onValueChange={(value) => {
                          updateSettingMutation.mutate({
                            id: setting.id,
                            updates: { frequency: value }
                          });
                        }}
                        disabled={updateSettingMutation.isPending}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Imediato</SelectItem>
                          <SelectItem value="daily">Diário</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Configurações de Push Notification */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Notificações Push (Mobile)
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`push-enabled-${setting.id}`} className="text-sm">
                      Ativar Push Notifications
                    </Label>
                    <Switch
                      id={`push-enabled-${setting.id}`}
                      checked={setting.push_enabled || false}
                      onCheckedChange={(checked) => {
                        updateSettingMutation.mutate({
                          id: setting.id,
                          updates: { push_enabled: checked }
                        });
                      }}
                      disabled={updateSettingMutation.isPending}
                    />
                  </div>

                  {setting.push_enabled && (
                    <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`push-entry-${setting.id}`} className="text-sm">
                          Lembrete de Entrada (08:00)
                        </Label>
                        <Switch
                          id={`push-entry-${setting.id}`}
                          checked={setting.push_reminder_entry || false}
                          onCheckedChange={(checked) => {
                            updateSettingMutation.mutate({
                              id: setting.id,
                              updates: { push_reminder_entry: checked }
                            });
                          }}
                          disabled={updateSettingMutation.isPending}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor={`push-lunch-start-${setting.id}`} className="text-sm">
                          Lembrete Início Almoço (12:00)
                        </Label>
                        <Switch
                          id={`push-lunch-start-${setting.id}`}
                          checked={setting.push_reminder_lunch_start || false}
                          onCheckedChange={(checked) => {
                            updateSettingMutation.mutate({
                              id: setting.id,
                              updates: { push_reminder_lunch_start: checked }
                            });
                          }}
                          disabled={updateSettingMutation.isPending}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor={`push-lunch-end-${setting.id}`} className="text-sm">
                          Lembrete Volta Almoço (13:00)
                        </Label>
                        <Switch
                          id={`push-lunch-end-${setting.id}`}
                          checked={setting.push_reminder_lunch_end || false}
                          onCheckedChange={(checked) => {
                            updateSettingMutation.mutate({
                              id: setting.id,
                              updates: { push_reminder_lunch_end: checked }
                            });
                          }}
                          disabled={updateSettingMutation.isPending}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor={`push-exit-${setting.id}`} className="text-sm">
                          Lembrete de Saída (17:00)
                        </Label>
                        <Switch
                          id={`push-exit-${setting.id}`}
                          checked={setting.push_reminder_exit || false}
                          onCheckedChange={(checked) => {
                            updateSettingMutation.mutate({
                              id: setting.id,
                              updates: { push_reminder_exit: checked }
                            });
                          }}
                          disabled={updateSettingMutation.isPending}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor={`push-incomplete-${setting.id}`} className="text-sm">
                          Registros Incompletos (20:00)
                        </Label>
                        <Switch
                          id={`push-incomplete-${setting.id}`}
                          checked={setting.push_incomplete_records || false}
                          onCheckedChange={(checked) => {
                            updateSettingMutation.mutate({
                              id: setting.id,
                              updates: { push_incomplete_records: checked }
                            });
                          }}
                          disabled={updateSettingMutation.isPending}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {settings.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              Nenhuma configuração de notificação encontrada. 
              Entre em contato com o administrador.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationSettings;
