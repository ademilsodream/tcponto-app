
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationLog {
  id: string;
  employee_id: string;
  notification_type: string;
  email_subject: string;
  status: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
  metadata: any;
}

const NotificationLogs: React.FC = () => {
  const queryClient = useQueryClient();

  // Buscar logs de notificação
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['notification-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_logs')
        .select(`
          *,
          profiles:employee_id (name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Mutation para processar notificações pendentes
  const processNotificationsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-notifications');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
      toast({
        title: "Notificações processadas",
        description: `${data.processed} notificação(ões) enviada(s) com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao processar notificações",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Falha</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'incomplete_records':
        return 'Registros Incompletos';
      case 'overtime_alert':
        return 'Alerta de Horas Extras';
      case 'approval_required':
        return 'Aprovação Necessária';
      case 'monthly_summary':
        return 'Resumo Mensal';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Carregando logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Logs de Notificação</h2>
          <p className="text-gray-600">
            Histórico de todas as notificações enviadas pelo sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button
            onClick={() => processNotificationsMutation.mutate()}
            disabled={processNotificationsMutation.isPending}
          >
            {processNotificationsMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            Processar Pendentes
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {logs.map((log) => (
          <Card key={log.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{log.email_subject}</h4>
                    {getStatusBadge(log.status)}
                  </div>
                  <p className="text-sm text-gray-600">
                    {getNotificationTypeLabel(log.notification_type)} • 
                    Para: {(log as any).profiles?.name || 'N/A'} ({(log as any).profiles?.email || 'N/A'})
                  </p>
                  <p className="text-xs text-gray-500">
                    Criado: {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    {log.sent_at && (
                      <> • Enviado: {format(new Date(log.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</>
                    )}
                  </p>
                  {log.error_message && (
                    <p className="text-xs text-red-600 mt-1">
                      Erro: {log.error_message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {logs.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                Nenhuma notificação encontrada no histórico.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NotificationLogs;
