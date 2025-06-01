
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlayCircle, Clock, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

const AutomatedChecks: React.FC = () => {
  // Mutation para executar verificação de registros incompletos
  const runIncompleteCheckMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('check_incomplete_records');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Verificação executada",
        description: "Verificação de registros incompletos foi executada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na verificação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para executar verificação de horas extras
  const runOvertimeCheckMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('check_excessive_overtime');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Verificação executada",
        description: "Verificação de horas extras excessivas foi executada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na verificação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para processar notificações pendentes
  const processNotificationsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-notifications');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Notificações processadas",
        description: `${data.processed} notificação(ões) enviada(s) com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verificações Automatizadas</h2>
        <p className="text-gray-600">
          Execute verificações manuais do sistema de detecção de anomalias e processamento de notificações.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Estas verificações normalmente são executadas automaticamente. Use estas opções apenas para testes 
          ou quando necessário executar verificações fora do cronograma normal.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Registros Incompletos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Verifica funcionários com registros de ponto incompletos do dia anterior 
              e gera alertas e notificações conforme necessário.
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <CheckCircle className="w-3 h-3 mr-1" />
                Execução diária automática
              </Badge>
            </div>
            <Button
              onClick={() => runIncompleteCheckMutation.mutate()}
              disabled={runIncompleteCheckMutation.isPending}
              className="w-full"
            >
              {runIncompleteCheckMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              Executar Verificação
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Horas Extras Excessivas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Detecta funcionários com mais de 2 horas extras no dia anterior 
              e envia alertas para promover equilíbrio work-life.
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <CheckCircle className="w-3 h-3 mr-1" />
                Execução diária automática
              </Badge>
            </div>
            <Button
              onClick={() => runOvertimeCheckMutation.mutate()}
              disabled={runOvertimeCheckMutation.isPending}
              className="w-full"
              variant="outline"
            >
              {runOvertimeCheckMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              Executar Verificação
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-green-600" />
            Processamento de Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Processa todas as notificações pendentes na fila e as envia por email para os destinatários.
            Este processo normalmente é executado automaticamente, mas pode ser iniciado manualmente quando necessário.
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <CheckCircle className="w-3 h-3 mr-1" />
              Processamento automático ativo
            </Badge>
          </div>
          <Button
            onClick={() => processNotificationsMutation.mutate()}
            disabled={processNotificationsMutation.isPending}
            className="w-full"
            variant="default"
          >
            {processNotificationsMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="w-4 h-4 mr-2" />
            )}
            Processar Notificações Pendentes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AutomatedChecks;
