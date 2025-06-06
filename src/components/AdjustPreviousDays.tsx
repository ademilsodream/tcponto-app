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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// ✨ Importar o tipo correto do Supabase
import type { User as SupabaseUser } from '@supabase/supabase-js';

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
  locationName: string;
}

interface AllowedLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  range_meters: number | null;
  is_active: boolean;
}

interface LocationDetailsForEdit {
  address: string | null;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  locationName: string;
}

// ✨ FUNÇÃO HELPER para obter nome do usuário de forma segura
const getUserName = (user: any): string => {
  console.log('🔍 DEBUG - Obtendo nome do usuário:', {
    'user': user,
    'user.user_metadata': user?.user_metadata,
    'user.user_metadata?.name': user?.user_metadata?.name,
    'user.user_metadata?.full_name': user?.user_metadata?.full_name,
    'user.email': user?.email,
  });

  // Lista de possíveis caminhos para o nome (em ordem de preferência)
  const possibleNames = [
    user?.user_metadata?.name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.display_name,
    user?.user_metadata?.user_name,
    user?.user_metadata?.firstName,
    user?.user_metadata?.first_name,
    user?.name,
    user?.display_name,
    // Como último recurso, extrair nome da parte do email
    user?.email?.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, ' ').trim(),
  ];

  // Encontrar o primeiro valor válido
  for (const name of possibleNames) {
    if (name && typeof name === 'string' && name.trim().length > 0) {
      console.log('✅ Nome encontrado:', name.trim());
      return name.trim();
    }
  }

  console.log('⚠️ Nenhum nome encontrado, usando fallback');
  return 'Nome Não Informado';
};

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
    reason: '',
    locationName: ''
  });
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const { user } = useAuth();

  const { toast } = useToast();

  // Carregar datas disponíveis e localizações ao montar o componente
  useEffect(() => {
    if (user) {
      loadAvailableDates();
      loadAllowedLocations();
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
        reason: '',
        locationName: ''
      });
    } else {
      setEditForm({
        clock_in: '',
        lunch_start: '',
        lunch_end: '',
        clock_out: '',
        reason: '',
        locationName: ''
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

      const { data: records, error } = await supabase
        .from('time_records')
        .select('date, id')
        .eq('user_id', user?.id)
        .gte('date', format(currentMonth, 'yyyy-MM-dd'))
        .lte('date', format(endOfCurrentMonth, 'yyyy-MM-dd'))
        .eq('status', 'active');

      if (error) throw error;

      const { data: editRequests, error: editError } = await supabase
        .from('edit_requests')
        .select('date')
        .eq('employee_id', user?.id)
        .gte('date', format(currentMonth, 'yyyy-MM-dd'))
        .lte('date', format(endOfCurrentMonth, 'yyyy-MM-dd'));

      if (editError) throw editError;

      const editedDatesSet = new Set(editRequests?.map(r => r.date) || []);

      const available: Date[] = [];
      for (let d = new Date(currentMonth); d <= oneDayAgo; d.setDate(d.getDate() + 1)) {
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

  const loadAllowedLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('id, name, address, latitude, longitude, range_meters, is_active')
        .eq('is_active', true);

      if (error) throw error;

      setAllowedLocations(data || []);
    } catch (error) {
      console.error('Erro ao carregar localizações permitidas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as localizações.",
        variant: "destructive",
      });
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
    setEditForm(prev => ({ ...prev, locationName: '' }));

    if (!date) {
      setSelectedDate(undefined);
      setTimeRecord(null);
      return;
    }

    const dateString = format(date, 'yyyy-MM-dd');

    if (editedDates.has(dateString)) {
      toast({
        title: "Dia já editado",
        description: "Este dia já possui uma solicitação de edição pendente.",
        variant: "destructive",
      });
      setSelectedDate(undefined);
      setTimeRecord(null);
      return;
    }

    setSelectedDate(date);
    loadTimeRecord(date);
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    const oneDayAgo = subDays(today, 1);
    const currentMonth = startOfMonth(today);
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
    if (!selectedDate || !timeRecord || !user) {
      console.log('Erro: Dados básicos faltando', { 
        selectedDate: !!selectedDate, 
        timeRecord: !!timeRecord, 
        user: !!user 
      });
      toast({
        title: "Erro Interno",
        description: "Dados essenciais para a submissão estão faltando.",
        variant: "destructive",
      });
      return;
    }

    if (!editForm.reason.trim()) {
      toast({
        title: "Erro",
        description: "O motivo da alteração é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!editForm.locationName) {
      toast({
        title: "Erro",
        description: "Selecione a localização para a solicitação.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const selectedLocationDetails = allowedLocations.find(loc => loc.name === editForm.locationName);

      if (!selectedLocationDetails) {
        toast({
          title: "Erro Interno",
          description: "Detalhes da localização selecionada não encontrados.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const locationDetailsForEdit: LocationDetailsForEdit = {
        address: selectedLocationDetails.address,
        distance: null,
        latitude: selectedLocationDetails.latitude,
        longitude: selectedLocationDetails.longitude,
        timestamp: new Date().toISOString(),
        locationName: selectedLocationDetails.name,
      };

      const requests = [];
      const fieldColumnMapping = {
        clock_in: 'clockIn',
        lunch_start: 'lunchStart',
        lunch_end: 'lunchEnd',
        clock_out: 'clockOut',
      };

      // ✨ CORREÇÃO: Usar a função getUserName para obter o nome de forma segura
      const baseRequest = {
        employee_id: user.id,
        employee_name: getUserName(user), // ← USANDO A FUNÇÃO SEGURA
        date: format(selectedDate, 'yyyy-MM-dd'),
        reason: editForm.reason.trim(),
        status: 'pending',
      };

      // Verificar alterações e criar solicitações
      if (editForm.clock_in !== (timeRecord.clock_in || '')) {
        requests.push({
          ...baseRequest,
          field: fieldColumnMapping.clock_in,
          old_value: timeRecord.clock_in || null,
          new_value: editForm.clock_in,
          location: { clock_in: locationDetailsForEdit },
        });
      }

      if (editForm.lunch_start !== (timeRecord.lunch_start || '')) {
        requests.push({
          ...baseRequest,
          field: fieldColumnMapping.lunch_start,
          old_value: timeRecord.lunch_start || null,
          new_value: editForm.lunch_start,
          location: { lunch_start: locationDetailsForEdit },
        });
      }

      if (editForm.lunch_end !== (timeRecord.lunch_end || '')) {
        requests.push({
          ...baseRequest,
          field: fieldColumnMapping.lunch_end,
          old_value: timeRecord.lunch_end || null,
          new_value: editForm.lunch_end,
          location: { lunch_end: locationDetailsForEdit },
        });
      }

      if (editForm.clock_out !== (timeRecord.clock_out || '')) {
        requests.push({
          ...baseRequest,
          field: fieldColumnMapping.clock_out,
          old_value: timeRecord.clock_out || null,
          new_value: editForm.clock_out,
          location: { clock_out: locationDetailsForEdit },
        });
      }

      if (requests.length === 0) {
        console.log('⚠️ Nenhuma alteração detectada ou válida para enviar.');
        toast({
          title: "Aviso",
          description: "Nenhuma alteração válida foi detectada nos horários para enviar.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      console.log('📤 Estrutura das solicitações a serem enviadas:', JSON.stringify(requests, null, 2));

      const { data, error } = await supabase
        .from('edit_requests')
        .insert(requests)
        .select();

      console.log('📥 Resposta do Supabase:', { data, error });

      if (error) {
        console.error('❌ Erro detalhado do Supabase:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ Solicitações inseridas com sucesso:', data);

      toast({
        title: "Sucesso",
        description: `${requests.length} solicitação(ões) de edição enviada(s) para aprovação.`,
      });

      const dateString = format(selectedDate, 'yyyy-MM-dd');
      setEditedDates(prev => new Set([...prev, dateString]));

      setSelectedDate(undefined);
      setTimeRecord(null);
      setEditForm({
        clock_in: '',
        lunch_start: '',
        lunch_end: '',
        clock_out: '',
        reason: '',
        locationName: ''
      });

    } catch (error: any) {
      console.error('💥 ERRO CRÍTICO ao enviar solicitação:', error);

      let errorMessage = 'Não foi possível enviar a solicitação de edição.';

      if (error.code === '23505') {
        errorMessage = 'Já existe uma solicitação para este dia. Aguarde a aprovação.';
      } else if (error.code === '42501') {
        errorMessage = 'Sem permissão para criar solicitação. Contate o administrador.';
      } else if (error.code === '23502') {
        errorMessage = `Erro: Dados obrigatórios faltando. Detalhes: ${error.details}`;
      } else if (error.message?.includes('check constraint')) {
        errorMessage = 'Valor inválido para o campo. Contate o administrador.';
      } else if (error.message) {
        errorMessage = `Erro: ${error.message}`;
      }

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hasAnyTimeChanged = timeRecord ? (
    editForm.clock_in !== (timeRecord.clock_in || '') ||
    editForm.lunch_start !== (timeRecord.lunch_start || '') ||
    editForm.lunch_end !== (timeRecord.lunch_end || '') ||
    editForm.clock_out !== (timeRecord.clock_out || '')
  ) : false;

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
    <div className="space-y-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Ajuste de Registros
            </CardTitle>
            {onBack && (
              <Button variant="outline" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
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
              Selecione a localização referente ao ajuste.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Selecione o dia para ajustar</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={isDateDisabled}
                locale={ptBR}
                className="rounded-md border w-full max-w-sm mx-auto md:mx-0"
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
                    <div>
                      <Label htmlFor="location">Localização *</Label>
                      {allowedLocations.length > 0 ? (
                        <Select
                          value={editForm.locationName}
                          onValueChange={(value) => handleInputChange('locationName', value)}
                          disabled={submitting}
                        >
                          <SelectTrigger id="location">
                            <SelectValue placeholder="Selecione a localização" />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedLocations.map((location) => (
                              <SelectItem key={location.id} value={location.name}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-red-500">Nenhuma localização ativa disponível.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <Button
                      onClick={handleSubmitEdit}
                      className="w-full"
                      disabled={submitting || !editForm.reason.trim() || !editForm.locationName || allowedLocations.length === 0 || !hasAnyTimeChanged}
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

              {selectedDate && timeRecord && allowedLocations.length === 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma localização ativa encontrada. Não é possível solicitar edição sem selecionar uma localização.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdjustPreviousDays;