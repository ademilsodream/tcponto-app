
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, AlertTriangle, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface IncompleteRecord {
  date: string;
  missingFields: string[];
  completedCount: number;
}

const IncompleteRecordsProfile: React.FC = () => {
  const [incompleteRecords, setIncompleteRecords] = useState<IncompleteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    console.log('IncompleteRecordsProfile: useEffect triggered, user:', user?.id);
    if (user) {
      loadIncompleteRecords();
    } else {
      console.log('IncompleteRecordsProfile: No user found');
      setLoading(false);
    }
  }, [user]);

  const loadIncompleteRecords = async () => {
    if (!user) {
      console.log('IncompleteRecordsProfile: No user available for loading records');
      return;
    }

    try {
      console.log('IncompleteRecordsProfile: Starting to load records for user:', user.id);
      setLoading(true);
      setError(null);
      
      // Buscar registros do mês atual
      const currentDate = new Date();
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      console.log('IncompleteRecordsProfile: Fetching records from', firstDayOfMonth.toISOString().split('T')[0], 'to', lastDayOfMonth.toISOString().split('T')[0]);

      const { data: records, error: fetchError } = await supabase
        .from('time_records')
        .select('date, clock_in, lunch_start, lunch_end, clock_out')
        .eq('user_id', user.id)
        .gte('date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('date', lastDayOfMonth.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (fetchError) {
        console.error('IncompleteRecordsProfile: Error fetching records:', fetchError);
        throw fetchError;
      }

      console.log('IncompleteRecordsProfile: Fetched records:', records?.length || 0);

      // Processar registros incompletos
      const incomplete: IncompleteRecord[] = [];
      
      // Criar array de todos os dias úteis do mês
      const allDays: string[] = [];
      for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        // Incluir apenas dias úteis (segunda a sexta)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          allDays.push(d.toISOString().split('T')[0]);
        }
      }

      console.log('IncompleteRecordsProfile: Processing', allDays.length, 'business days');

      // Verificar cada dia útil
      allDays.forEach(date => {
        const record = records?.find(r => r.date === date);
        
        if (!record) {
          // Dia sem nenhum registro
          incomplete.push({
            date,
            missingFields: ['Entrada', 'Início do Almoço', 'Fim do Almoço', 'Saída'],
            completedCount: 0
          });
        } else {
          // Verificar quais campos estão faltando
          const missingFields: string[] = [];
          let completedCount = 0;

          if (!record.clock_in) missingFields.push('Entrada');
          else completedCount++;

          if (!record.lunch_start) missingFields.push('Início do Almoço');
          else completedCount++;

          if (!record.lunch_end) missingFields.push('Fim do Almoço');
          else completedCount++;

          if (!record.clock_out) missingFields.push('Saída');
          else completedCount++;

          if (missingFields.length > 0) {
            incomplete.push({
              date,
              missingFields,
              completedCount
            });
          }
        }
      });

      console.log('IncompleteRecordsProfile: Found', incomplete.length, 'incomplete records');
      setIncompleteRecords(incomplete);
    } catch (error) {
      console.error('IncompleteRecordsProfile: Error loading incomplete records:', error);
      setError('Erro ao carregar registros. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getProgressColor = (completedCount: number) => {
    switch (completedCount) {
      case 0: return 'text-red-600';
      case 1: return 'text-red-500';
      case 2: return 'text-orange-500';
      case 3: return 'text-yellow-500';
      default: return 'text-green-600';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-32 space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <div className="text-lg">Carregando registros...</div>
          <div className="text-sm text-gray-600">Verificando registros do mês atual</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-32 space-y-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
          <div className="text-lg text-red-600">Erro ao carregar dados</div>
          <div className="text-sm text-gray-600">{error}</div>
          <Button onClick={() => loadIncompleteRecords()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-32 space-y-4">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
          <div className="text-lg text-amber-600">Usuário não autenticado</div>
          <div className="text-sm text-gray-600">Por favor, faça login para ver seus registros</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Registros Incompletos - Mês Atual
        </CardTitle>
      </CardHeader>
      <CardContent>
        {incompleteRecords.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-lg text-green-600 font-medium">
              Parabéns! Todos os registros do mês estão completos.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Você tem todos os 4 registros diários preenchidos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-amber-800">
                Você tem {incompleteRecords.length} dia(s) com registros incompletos neste mês.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {incompleteRecords.map((record) => (
                <div 
                  key={record.date}
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">
                      {formatDate(record.date)}
                    </h4>
                    <div className={`flex items-center gap-1 ${getProgressColor(record.completedCount)}`}>
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {record.completedCount}/4 registros
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Registros faltantes:</p>
                    <div className="flex flex-wrap gap-1">
                      {record.missingFields.map((field) => (
                        <span 
                          key={field}
                          className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {new Date(record.date) < new Date(new Date().toISOString().split('T')[0]) && (
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Para dias anteriores, você pode solicitar edição através da tela de registro de ponto.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IncompleteRecordsProfile;
