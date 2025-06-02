import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, AlertTriangle, Clock, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getWorkingDaysInMonth, isWorkingDay } from '@/utils/workingDays';

interface IncompleteRecord {
  date: string;
  missingFields: string[];
  completedCount: number;
  isWeekend: boolean;
}

interface IncompleteRecordsProfileProps {
  onBack?: () => void;
}

const IncompleteRecordsProfile: React.FC<IncompleteRecordsProfileProps> = ({ onBack }) => {
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
      
      // Obter data atual e data limite (ontem)
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Primeiro dia do mês atual
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Data limite: ontem (não incluir hoje)
      const endDate = yesterday;

      console.log('IncompleteRecordsProfile: Fetching records from', 
        firstDayOfMonth.toISOString().split('T')[0], 
        'to', 
        endDate.toISOString().split('T')[0]
      );

      // Se o primeiro dia do mês for depois de ontem, não há dias para verificar
      if (firstDayOfMonth > endDate) {
        console.log('IncompleteRecordsProfile: No days to check in current month yet');
        setIncompleteRecords([]);
        setLoading(false);
        return;
      }

      const { data: records, error: fetchError } = await supabase
        .from('time_records')
        .select('date, clock_in, lunch_start, lunch_end, clock_out')
        .eq('user_id', user.id)
        .gte('date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]) // Até ontem apenas
        .eq('status', 'active')
        .order('date', { ascending: false });

      if (fetchError) {
        console.error('IncompleteRecordsProfile: Error fetching records:', fetchError);
        throw fetchError;
      }

      console.log('IncompleteRecordsProfile: Fetched records:', records?.length || 0);

      // Obter apenas dias úteis do mês até ontem
      const allWorkingDaysInMonth = getWorkingDaysInMonth(today.getFullYear(), today.getMonth());
      const workingDaysUntilYesterday = allWorkingDaysInMonth.filter(date => {
        const dayDate = new Date(date + 'T00:00:00');
        return dayDate <= endDate; // Apenas até ontem
      });

      console.log('IncompleteRecordsProfile: Working days until yesterday:', workingDaysUntilYesterday.length);

      // Processar registros incompletos
      const incomplete: IncompleteRecord[] = [];
      
      // Verificar cada dia útil até ontem
      const allDaysToCheck = [...workingDaysUntilYesterday];
      
      // Adicionar fins de semana que têm registros (também até ontem)
      for (let d = new Date(firstDayOfMonth); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];
        const isWeekendDay = !isWorkingDay(d);
        
        if (isWeekendDay && records?.find(r => r.date === dateString)) {
          allDaysToCheck.push(dateString);
        }
      }

      console.log('IncompleteRecordsProfile: Processing', allDaysToCheck.length, 'days (working days + weekends with records) until yesterday');

      // Verificar cada dia
      allDaysToCheck.forEach(date => {
        const record = records?.find(r => r.date === date);
        const dateObj = new Date(date + 'T00:00:00');
        const isWeekendDay = !isWorkingDay(dateObj);
        
        if (!record) {
          // Dia sem nenhum registro (apenas dias úteis aparecem aqui)
          if (!isWeekendDay) {
            incomplete.push({
              date,
              missingFields: ['Entrada', 'Início do Almoço', 'Fim do Almoço', 'Saída'],
              completedCount: 0,
              isWeekend: false
            });
          }
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
              completedCount,
              isWeekend: isWeekendDay
            });
          }
        }
      });

      console.log('IncompleteRecordsProfile: Found', incomplete.length, 'incomplete records until yesterday');
      setIncompleteRecords(incomplete);
    } catch (error) {
      console.error('IncompleteRecordsProfile: Error loading incomplete records:', error);
      setError('Erro ao carregar registros. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {
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
          <div className="text-sm text-gray-600">Verificando registros até ontem</div>
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

  const workingDayRecords = incompleteRecords.filter(record => !record.isWeekend);
  const weekendRecords = incompleteRecords.filter(record => record.isWeekend);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Registros Incompletos - Até Ontem
          </CardTitle>
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {incompleteRecords.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-lg text-green-600 font-medium">
              Parabéns! Todos os registros estão completos até ontem.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Você tem todos os 4 registros diários preenchidos nos dias úteis até o dia anterior.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-amber-800">
                Você tem {workingDayRecords.length} dia(s) úteis com registros incompletos até ontem
                {weekendRecords.length > 0 && ` e ${weekendRecords.length} dia(s) de fim de semana com registros incompletos`}.
              </AlertDescription>
            </Alert>

            {/* Registros de dias úteis */}
            {workingDayRecords.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Dias Úteis Incompletos:</h4>
                {workingDayRecords.map((record) => (
                  <div 
                    key={record.date}
                    className="border rounded-lg p-4 bg-red-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900">
                        {formatDate(record.date)}
                      </h5>
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
                    
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Para dias anteriores, você pode solicitar edição através da tela de registro de ponto.
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Registros de fins de semana */}
            {weekendRecords.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Fins de Semana com Registros Incompletos:</h4>
                {weekendRecords.map((record) => (
                  <div 
                    key={record.date}
                    className="border rounded-lg p-4 bg-blue-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900">
                        {formatDate(record.date)} <span className="text-sm text-blue-600">(Fim de semana)</span>
                      </h5>
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
                            className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IncompleteRecordsProfile;
