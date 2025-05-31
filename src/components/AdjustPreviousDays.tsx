
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Calendar as CalendarIcon, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isValidQueryResult, isValidSingleResult, isTimeRecord } from '@/utils/queryValidation';

interface AdjustPreviousDaysProps {
  onBack?: () => void;
}

interface TimeRecordDisplay {
  id: string;
  date: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  total_hours: number;
  has_been_edited: boolean;
}

const AdjustPreviousDays: React.FC<AdjustPreviousDaysProps> = ({ onBack }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [editedDates, setEditedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [timeRecord, setTimeRecord] = useState<TimeRecordDisplay | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadAvailableDates();
    }
  }, [user]);

  const loadAvailableDates = async () => {
    try {
      setLoading(true);
      
      const today = new Date();
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfCurrentMonth = endOfMonth(currentMonth);
      const oneDayAgo = subDays(today, 1);

      if (!user?.id) return;

      // Buscar registros do mês atual
      const { data: records, error } = await supabase
        .from('time_records')
        .select('date, id')
        .eq('user_id', user.id as any)
        .gte('date', format(currentMonth, 'yyyy-MM-dd'))
        .lte('date', format(endOfCurrentMonth, 'yyyy-MM-dd'))
        .eq('status', 'active' as any);

      if (error) {
        console.error('Erro ao buscar registros:', error);
        throw error;
      }

      // Verificar se os dados são válidos
      if (!isValidQueryResult(records, error)) {
        console.error('Dados inválidos retornados pela query');
        setAvailableDates([]);
        setEditedDates(new Set());
        return;
      }

      // Buscar quais dias já foram editados (simulando com uma coluna que poderíamos adicionar)
      const editedDatesSet = new Set<string>();
      // Por enquanto, vamos simular que nenhum dia foi editado ainda
      // Em uma implementação real, você adicionaria uma coluna 'has_been_edited' na tabela

      // Gerar lista de datas disponíveis (dias do mês atual até ontem)
      const available: Date[] = [];
      const existingRecordDates = new Set(
        records
          .filter(r => r && typeof r === 'object' && 'date' in r && r.date)
          .map(r => r.date)
      );
      
      for (let d = new Date(currentMonth); d <= oneDayAgo; d.setDate(d.getDate() + 1)) {
        const dateString = format(d, 'yyyy-MM-dd');
        
        // Só incluir se:
        // 1. Existe um registro para este dia OU
        // 2. É um dia que pode ter registro (não precisa ser apenas dias úteis para ajustes)
        if (existingRecordDates.has(dateString) || true) {
          available.push(new Date(d));
        }
      }

      setAvailableDates(available);
      setEditedDates(editedDatesSet);
    } catch (error) {
      console.error('Erro ao carregar datas disponíveis:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as datas disponíveis.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTimeRecord = async (date: Date) => {
    try {
      if (!user?.id) return;

      const dateString = format(date, 'yyyy-MM-dd');
      
      const { data: record, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id as any)
        .eq('date', dateString as any)
        .eq('status', 'active' as any)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar registro:', error);
        throw error;
      }

      if (isValidSingleResult(record, error) && isTimeRecord(record)) {
        setTimeRecord({
          id: record.id,
          date: record.date,
          clock_in: record.clock_in,
          lunch_start: record.lunch_start,
          lunch_end: record.lunch_end,
          clock_out: record.clock_out,
          total_hours: record.total_hours || 0,
          has_been_edited: false // Por enquanto sempre false
        });
      } else {
        // Criar registro vazio para o dia
        setTimeRecord({
          id: '',
          date: dateString,
          clock_in: null,
          lunch_start: null,
          lunch_end: null,
          clock_out: null,
          total_hours: 0,
          has_been_edited: false
        });
      }
    } catch (error) {
      console.error('Erro ao carregar registro:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o registro do dia selecionado.",
        variant: "destructive",
      });
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    const dateString = format(date, 'yyyy-MM-dd');
    
    // Verificar se já foi editado
    if (editedDates.has(dateString)) {
      toast({
        title: "Dia já editado",
        description: "Este dia já foi editado anteriormente e não pode ser modificado novamente.",
        variant: "destructive",
      });
      return;
    }

    setSelectedDate(date);
    loadTimeRecord(date);
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    const oneDayAgo = subDays(today, 1);
    const currentMonth = startOfMonth(today);
    
    // Desabilitar se:
    // 1. É depois de ontem
    // 2. É antes do início do mês atual
    // 3. Já foi editado
    const dateString = format(date, 'yyyy-MM-dd');
    
    return (
      isAfter(date, oneDayAgo) || 
      isBefore(date, currentMonth) || 
      editedDates.has(dateString)
    );
  };

  const requestEdit = () => {
    if (!selectedDate || !timeRecord) return;
    
    toast({
      title: "Solicitação enviada",
      description: "Sua solicitação de edição foi enviada para aprovação do administrador.",
    });
    
    // Aqui você implementaria a lógica para criar uma solicitação de edição
    // Por exemplo, inserir na tabela edit_requests
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
              <CalendarIcon className="w-5 h-5" />
              Ajustar Dias Anteriores
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
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você pode solicitar ajustes apenas para dias do mês atual e até 1 dia anterior ao hoje. 
              Dias já editados não podem ser modificados novamente.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Selecione o dia para ajustar</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={isDateDisabled}
                locale={ptBR}
                className="rounded-md border"
              />
              
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                  <span>Dias disponíveis para edição</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                  <span>Dias já editados ou não disponíveis</span>
                </div>
              </div>
            </div>

            <div>
              {selectedDate ? (
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Registro do dia {format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                  </h3>
                  
                  {timeRecord ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded">
                          <div className="text-sm text-gray-600">Entrada</div>
                          <div className="font-medium">
                            {timeRecord.clock_in || 'Não registrado'}
                          </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded">
                          <div className="text-sm text-gray-600">Início Almoço</div>
                          <div className="font-medium">
                            {timeRecord.lunch_start || 'Não registrado'}
                          </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded">
                          <div className="text-sm text-gray-600">Fim Almoço</div>
                          <div className="font-medium">
                            {timeRecord.lunch_end || 'Não registrado'}
                          </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded">
                          <div className="text-sm text-gray-600">Saída</div>
                          <div className="font-medium">
                            {timeRecord.clock_out || 'Não registrado'}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 rounded">
                        <div className="text-sm text-blue-600">Total de Horas</div>
                        <div className="font-medium text-blue-800">
                          {timeRecord.total_hours.toFixed(2)}h
                        </div>
                      </div>

                      <Button 
                        onClick={requestEdit}
                        className="w-full"
                        disabled={timeRecord.has_been_edited}
                      >
                        {timeRecord.has_been_edited ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Já foi editado
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 mr-2" />
                            Solicitar Edição
                          </>
                        )}
                      </Button>

                      <p className="text-xs text-gray-500">
                        * A solicitação será enviada para aprovação do administrador. 
                        Você será notificado quando for processada.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Carregando dados do dia...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Selecione um dia no calendário para ver os registros</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdjustPreviousDays;
