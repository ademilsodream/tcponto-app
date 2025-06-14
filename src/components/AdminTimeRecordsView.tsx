
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, User, Calendar } from 'lucide-react';
import { useRealtimeTimeRecords } from '@/hooks/useRealtimeTimeRecords';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdminTimeRecordsView = React.memo(() => {
  const { profile } = useOptimizedAuth();
  const { timeRecords, loading, refreshRecords } = useRealtimeTimeRecords();
  const [refreshing, setRefreshing] = useState(false);

  // ✨ Verificar role de forma segura
  if (profile?.role !== 'admin') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Acesso restrito a administradores
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshRecords();
    setRefreshing(false);
  };

  const getStatusBadge = (record: any) => {
    const hasClockIn = !!record.clock_in;
    const hasClockOut = !!record.clock_out;
    const hasLunchStart = !!record.lunch_start;
    const hasLunchEnd = !!record.lunch_end;

    if (hasClockIn && hasClockOut && hasLunchStart && hasLunchEnd) {
      return <Badge variant="default" className="bg-green-500">Completo</Badge>;
    } else if (hasClockIn) {
      return <Badge variant="secondary" className="bg-yellow-500">Em Andamento</Badge>;
    } else {
      return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const formatTime = (time?: string) => {
    return time ? time.substring(0, 5) : '--:--';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Carregando registros...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Registros de Ponto - Visão Administrativa
            </CardTitle>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {timeRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro de ponto encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {timeRecords.map((record) => (
                <Card key={record.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">ID: {record.user_id.substring(0, 8)}...</span>
                        {getStatusBadge(record)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(record.date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <label className="text-gray-500 block">Entrada</label>
                        <span className="font-medium">{formatTime(record.clock_in)}</span>
                      </div>
                      <div>
                        <label className="text-gray-500 block">Início Almoço</label>
                        <span className="font-medium">{formatTime(record.lunch_start)}</span>
                      </div>
                      <div>
                        <label className="text-gray-500 block">Fim Almoço</label>
                        <span className="font-medium">{formatTime(record.lunch_end)}</span>
                      </div>
                      <div>
                        <label className="text-gray-500 block">Saída</label>
                        <span className="font-medium">{formatTime(record.clock_out)}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-gray-500">Total de Horas: </span>
                        <span className="font-medium">{record.total_hours.toFixed(2)}h</span>
                      </div>
                      {record.locations && (
                        <Badge variant="outline" className="text-xs">
                          Com localização
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

AdminTimeRecordsView.displayName = 'AdminTimeRecordsView';

export default AdminTimeRecordsView;
