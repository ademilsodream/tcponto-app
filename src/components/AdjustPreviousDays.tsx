import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Calendar as CalendarIcon, AlertTriangle, Clock, Save, Edit3, MapPin } from 'lucide-react';
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
  // locations?: Json | null; // Removido, pois não usamos a localização existente para a edição
}


interface EditForm {
  clock_in: string;
  lunch_start: string;
  lunch_end: string;
  clock_out: string;
  reason: string;
  locationName: string; // Adicionado para a localização da solicitação (nome)
}


// Interface para as localizações permitidas (agora com todos os campos necessários)
interface AllowedLocation {
  id: string;
  name: string;
  address: string | null; // Pode ser nulo dependendo da sua estrutura
  latitude: number | null; // Pode ser nulo
  longitude: number | null; // Pode ser nulo
  range_meters: number | null; // Pode ser nulo
  is_active: boolean;
}


// Interface para o objeto JSON de localização que será salvo DENTRO da chave do campo (ex: "clock_in": {...})
interface LocationDetailsForEdit {
  address: string | null;
  distance: number | null; // Para edição manual, pode ser null ou 0
  latitude: number | null;
  longitude: number | null;
  timestamp: string; // Timestamp da solicitação de edição
  locationName: string;
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
    reason: '',
    locationName: '' // Inicializa o campo de localização
  });
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]); // Estado para localizações
  const { user } = useAuth();
  const { toast } = useToast();


  // Carregar datas disponíveis e localizações ao montar o componente
  useEffect(() => {
    if (user) {
      loadAvailableDates();
      loadAllowedLocations(); // Carregar localizações
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
        locationName: '' // Limpar seleção de localização ao carregar novo registro
      });
    } else {
      // Limpar formulário e seleção de localização se timeRecord for null
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


      // Buscar registros do mês atual (apenas para saber quais dias existem)
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


  // Função para carregar localizações permitidas (agora buscando todos os campos relevantes)
  const loadAllowedLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('id, name, address, latitude, longitude, range_meters, is_active') // Seleciona todos os campos
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
          has_been_edited: false // Este campo parece não ser usado na interface, mas mantido
        });
      } else {
        // Criar registro vazio para o dia (para exibir o formulário)
        setTimeRecord({
          id: '', // ID vazio indica que é um dia sem registro existente
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
    // Limpar a seleção de localização ao mudar de data
    setEditForm(prev => ({ ...prev, locationName: '' }));


    if (!date) {
      setSelectedDate(undefined);
      setTimeRecord(null); // Limpar registro e formulário
      return;
    }


    const dateString = format(date, 'yyyy-MM-dd');


    // Verificar se já foi editado
    if (editedDates.has(dateString)) {
      toast({
        title: "Dia já editado",
        description: "Este dia já possui uma solicitação de edição pendente.",
        variant: "destructive",
      });
      // Não selecionar a data se já foi editada
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
      console.log('Erro: Dados básicos faltando', { selectedDate, timeRecord: !!timeRecord, user: !!user });
      return;
    }


    // Validar se pelo menos um campo de horário foi preenchido
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


    // Validar localização
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
      // --- Lógica para obter os detalhes da localização selecionada ---
      const selectedLocationDetails = allowedLocations.find(loc => loc.name === editForm.locationName);


      if (!selectedLocationDetails) {
        toast({
          title: "Erro Interno",
          description: "Detalhes da localização selecionada não encontrados.",
          variant: "destructive",
        });
        setSubmitting(false); // Garantir que o estado de submissão seja resetado
        return;
      }


      // Construir o objeto de detalhes da localização para a edição
      const locationDetailsForEdit: LocationDetailsForEdit = {
        address: selectedLocationDetails.address,
        distance: null, // Para edição manual, a distância não é aplicável/conhecida
        latitude: selectedLocationDetails.latitude,
        longitude: selectedLocationDetails.longitude,
        timestamp: new Date().toISOString(), // Usar o timestamp da solicitação de edição
        locationName: selectedLocationDetails.name,
      };
      // --- Fim da construção dos detalhes da localização ---


      const requests = [];
      const fieldMapping = {
        clock_in: 'clockIn',
        lunch_start: 'lunchStart',
        lunch_end: 'lunchEnd',
        clock_out: 'clockOut',
      };


      const baseRequest = {
        employee_id: user.id,
        date: format(selectedDate, 'yyyy-MM-dd'),
        reason: editForm.reason.trim(),
        status: 'pending',
        // A coluna 'location' será adicionada individualmente para cada campo abaixo
        // com a estrutura {"campo": {...detalhes_localizacao...}}
      };


      if (editForm.clock_in && editForm.clock_in !== (timeRecord.clock_in || '')) {
        requests.push({
          ...baseRequest,
          field: fieldMapping.clock_in, // 'clockIn'
          old_value: timeRecord.clock_in || null,
          new_value: editForm.clock_in,
          // --- NOVO: Estrutura da localização para este campo específico ---
          location: { [fieldMapping.clock_in]: locationDetailsForEdit },
          // -------------------------------------------------------------
        });
      }


      if (editForm.lunch_start && editForm.lunch_start !== (timeRecord.lunch_start || '')) {
        requests.push({
          ...baseRequest,
          field: fieldMapping.lunch_start, // 'lunchStart'
          old_value: timeRecord.lunch_start || null,
          new_value: editForm.lunch_start,
          // --- NOVO: Estrutura da localização para este campo específico ---
          location: { [fieldMapping.lunch_start]: locationDetailsForEdit },
          // -------------------------------------------------------------
        });
      }


      if (editForm.lunch_end && editForm.lunch_end !== (timeRecord.lunch_end || '')) {
        requests.push({
          ...baseRequest,
          field: fieldMapping.lunch_end, // 'lunchEnd'
          old_value: timeRecord.lunch_end || null,
          new_value: editForm.lunch_end,
          // --- NOVO: Estrutura da localização para este campo específico ---
          location: { [fieldMapping.lunch_end]: locationDetailsForEdit },
          // -------------------------------------------------------------
        });
      }


      if (editForm.clock_out && editForm.clock_out !== (timeRecord.clock_out || '')) {
        requests.push({
          ...baseRequest,
          field: fieldMapping.clock_out, // 'clockOut'
          old_value: timeRecord.clock_out || null,
          new_value: editForm.clock_out,
          // --- NOVO: Estrutura da localização para este campo específico ---
          location: { [fieldMapping.clock_out]: locationDetailsForEdit },
          // -------------------------------------------------------------
        });
      }


      if (requests.length === 0) {
        toast({
          title: "Aviso",
          description: "Nenhuma alteração foi detectada nos horários.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }


      // --- NOVO LOG PARA VERIFICAR A ESTRUTURA ANTES DE ENVIAR ---
      console.log('📤 Estrutura das solicitações a serem enviadas (com localização por campo):', JSON.stringify(requests, null, 2));
      // --- FIM DO NOVO LOG ---


      // Inserir todas as solicitações
      // Certifique-se de que a coluna 'location' na tabela 'edit_requests' é do tipo JSONB
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


      // Atualizar lista de datas editadas
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      setEditedDates(prev => new Set([...prev, dateString]));


      // Limpar seleção e formulário
      setSelectedDate(undefined);
      setTimeRecord(null);
      setEditForm({
        clock_in: '',
        lunch_start: '',
        lunch_end: '',
        clock_out: '',
        reason: '',
        locationName: '' // Limpar seleção de localização
      });


    } catch (error: any) {
      console.error('💥 ERRO CRÍTICO ao enviar solicitação:', error);


      let errorMessage = 'Não foi possível enviar a solicitação de edição.';


      if (error.code === '23505') {
        errorMessage = 'Já existe uma solicitação para este dia. Aguarde a aprovação.';
      } else if (error.code === '42501') {
        errorMessage = 'Sem permissão para criar solicitação. Contate o administrador.';
      } else if (error.code === '23502') {
        errorMessage = 'Dados obrigatórios faltando. Verifique se todos os campos estão preenchidos.';
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
                    {/* Campo de Localização */}
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
                      disabled={submitting || !editForm.reason.trim() || !editForm.locationName || allowedLocations.length === 0}
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


              {/* Mensagem se não houver localizações */}
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
