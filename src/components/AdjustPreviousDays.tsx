import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Calendar as CalendarIcon, AlertTriangle, Clock, Save, Edit3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdjustPreviousDaysProps {
  onBack?: () => void;
}

interface TimeRecord {
  id: string;
  date: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  total_hours: number;
  has_been_edited: boolean;
}

interface EditForm {
  clock_in: string;
  lunch_start: string;
  lunch_end: string;
  clock_out: string;
  reason: string;
}

const AdjustPreviousDays: React.FC<AdjustPreviousDaysProps> = ({ onBack }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [editedDates, setEditedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    clock_in: '',
    lunch_start: '',
    lunch_end: '',
    clock_out: '',
    reason: ''
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadAvailableDates();
    }
  }, [user]);

  // Atualizar formulário quando timeRecord mudar
  useEffect(() => {
    if (timeRecord) {
      setEditForm({
        clock_in: timeRecord.clock_in || '',
        lunch_start: timeRecord.lunch_start || '',
        lunch_end: timeRecord.lunch_end || '',
        clock_out: timeRecord.clock_out || '',
        reason: ''
      });
    }
  }, [timeRecord]);

  const loadAvailableDates = async () => {
    try {
      setLoading(true);
      
      const today = new Date();
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfCurrentMonth = endOfMonth(currentMonth);
      const oneDayAgo = subDays(today, 1);

      // Buscar registros do mês atual
      const { data: records, error } = await supabase
        .from('time_records')
        .select('date, id')
        .eq('user_id', user?.id)
        .gte('date', format(currentMonth, 'yyyy-MM-dd'))
        .lte('date', format(endOfCurrentMonth, 'yyyy-MM-dd'))
        .eq('status', 'active');

      if (error) throw error;

      // Buscar solicitações já enviadas para este usuário
      const { data: editRequests, error: editError } = await supabase
        .from('edit_requests')
        .select('date')
        .eq('employee_id', user?.id)
        .gte('date', format(currentMonth, 'yyyy-MM-dd'))
        .lte('date', format(endOfCurrentMonth, 'yyyy-MM-dd'));

      if (editError) throw editError;

      const editedDatesSet = new Set(editRequests?.map(r => r.date) || []);

      // Gerar lista de datas disponíveis (dias do mês atual até ontem)
      const available: Date[] = [];
      const existingRecordDates = new Set(records?.map(r => r.date) || []);
      
      for (let d = new Date(currentMonth); d <= oneDayAgo; d.setDate(d.getDate() + 1)) {
        const dateString = format(d, 'yyyy-MM-dd');
        
        // Incluir todos os dias do período (mesmo sem registro)
        available.push(new Date(d));
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
      const dateString = format(date, 'yyyy-MM-dd');
      
      const { data: record, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user?.id)
        .eq('date', dateString)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (record) {
        setTimeRecord({
          id: record.id,
          date: record.date,
          clock_in: record.clock_in,
          lunch_start: record.lunch_start,
          lunch_end: record.lunch_end,
          clock_out: record.clock_out,
          total_hours: record.total_hours || 0,
          has_been_edited: false
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
        description: "Este dia já possui uma solicitação de edição pendente.",
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

  const handleInputChange = (field: keyof EditForm, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitEdit = async () => {
    if (!selectedDate || !timeRecord || !user) return;

    // Validar se pelo menos um campo foi preenchido
    const hasAnyTime = editForm.clock_in || editForm.lunch_start || editForm.lunch_end || editForm.clock_out;
    if (!hasAnyTime) {
      toast({
        title: "Erro",
        description: "Preencha pelo menos um horário para solicitar a edição.",
        variant: "destructive",
      });
      return;
    }

    // Validar motivo
    if (!editForm.reason.trim()) {
      toast({
        title: "Erro",
        description: "O motivo da alteração é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Criar objeto com os valores alterados
      const editRequest = {
        employee_id: user.id,
        employee_name: user.email || 'Usuário',
        date: format(selectedDate, 'yyyy-MM-dd'),
        field: 'multiple', // Indica que é edição de múltiplos campos
        old_value: JSON.stringify({
          clock_in: timeRecord.clock_in,
          lunch_start: timeRecord.lunch_start,
          lunch_end: timeRecord.lunch_end,
          clock_out: timeRecord.clock_out
        }),
        new_value: JSON.stringify({
          clock_in: editForm.clock_in || null,
          lunch_start: editForm.lunch_start || null,
          lunch_end: editForm.lunch_end || null,
          clock_out: editForm.clock_out || null
        }),
        reason: editForm.reason,
        status: 'pending'
      };

      const { error } = await supabase
        .from('edit_requests')
        .insert(editRequest);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Solicitação de edição enviada para aprovação.",
      });

      // Atualizar lista de datas editadas
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      setEditedDates(prev => new Set([...prev, dateString]));

      // Limpar seleção
      setSelectedDate(undefined);
      setTimeRecord(null);
      setEditForm({
        clock_in: '',
        lunch_start: '',
        lunch_end: '',
        clock_out: '',
        reason: ''
      });

    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a solicitação de edição.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
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
              Você pode solicitar ajustes para dias do mês atual até ontem. 
              Dias com solicitações pendentes não podem ser editados novamente.
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
              {selectedDate && timeRecord ? (
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Edit3 className="w-5 h-5" />
                    Editar {format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Campos de horário */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="clock_in">Entrada</Label>
                        <Input
                          id="clock_in"
                          type="time"
                          value={editForm.clock_in}
                          onChange={(e) => handleInputChange('clock_in', e.target.value)}
                          disabled={submitting}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          Atual: {timeRecord.clock_in || 'Não registrado'}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="lunch_start">Início Almoço</Label>
                        <Input
                          id="lunch_start"
                          type="time"
                          value={editForm.lunch_start}
                          onChange={(e) => handleInputChange('lunch_start', e.target.value)}
                          disabled={submitting}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          Atual: {timeRecord.lunch_start || 'Não registrado'}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="lunch_end">Fim Almoço</Label>
                        <Input
                          id="lunch_end"
                          type="time"
                          value={editForm.lunch_end}
                          onChange={(e) => handleInputChange('lunch_end', e.target.value)}
                          disabled={submitting}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          Atual: {timeRecord.lunch_end || 'Não registrado'}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="clock_out">Saída</Label>
                        <Input
                          id="clock_out"
                          type="time"
                          value={editForm.clock_out}
                          onChange={(e) => handleInputChange('clock_out', e.target.value)}
                          disabled={submitting}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          Atual: {timeRecord.clock_out || 'Não registrado'}
                        </div>
                      </div>
                    </div>

                    {/* Motivo */}
                    <div>
                      <Label htmlFor="reason">Motivo da Alteração *</Label>
                      <Textarea
                        id="reason"
                        value={editForm.reason}
                        onChange={(e) => handleInputChange('reason', e.target.value)}
                        placeholder="Descreva o motivo da solicitação de alteração..."
                        required
                        disabled={submitting}
                        className="min-h-[80px]"
                      />
                    </div>

                    {/* Botão de envio */}
                    <Button 
                      onClick={handleSubmitEdit}
                      className="w-full"
                      disabled={submitting || !editForm.reason.trim()}
                    >
                      {submitting ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Enviar Solicitação
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-gray-500">
                      * A solicitação será enviada para aprovação do administrador. 
                      Você será notificado quando for processada.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Selecione um dia no calendário para editar os registros</p>
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
