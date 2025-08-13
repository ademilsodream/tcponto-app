import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Calendar as CalendarIcon, AlertTriangle, Clock, Save, Edit3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, isAfter, isBefore, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
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

interface BlockedPeriod {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
}

const getUserName = (user: any, profile: any): string => {
  const possibleNames = [
    profile?.name,
    user?.user_metadata?.name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.display_name,
    user?.user_metadata?.user_name,
    user?.user_metadata?.firstName,
    user?.user_metadata?.first_name,
    user?.name,
    user?.display_name,
    user?.email?.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, ' ').trim(),
  ];

  for (const name of possibleNames) {
    if (name && typeof name === 'string' && name.trim().length > 0) {
      return name.trim();
    }
  }

  return user?.email || 'Usuário';
};

const AdjustPreviousDays: React.FC<AdjustPreviousDaysProps> = ({ onBack }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    clock_in: '',
    lunch_start: '',
    lunch_end: '',
    clock_out: '',
    reason: '',
    locationName: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [editedDates, setEditedDates] = useState<Set<string>>(new Set());

  const { user, profile } = useOptimizedAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadAvailableDates();
      loadAllowedLocations();
      loadBlockedPeriods();
    }
  }, [user]);

  const loadAvailableDates = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const oneMonthAgo = subMonths(today, 1);
      const startDate = startOfMonth(oneMonthAgo);
      const endDate = subDays(today, 1);

      // Carregar solicitações de edição para verificar quais datas já foram editadas
      const { data: editRequests, error: editError } = await supabase
        .from('edit_requests')
        .select('date')
        .eq('employee_id', user?.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (editError) throw editError;

      const editedSet = new Set<string>();
      editRequests?.forEach(request => {
        editedSet.add(request.date);
      });

      setEditedDates(editedSet);

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

  const loadBlockedPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('blocked_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;

      setBlockedPeriods(data || []);

    } catch (error) {
      console.error('Erro ao carregar períodos bloqueados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os períodos bloqueados.",
        variant: "destructive",
      });
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
    if (!date) return;
    
    setSelectedDate(date);
    loadTimeRecord(date);
  };

  // Verificar se uma data está em período bloqueado
  const isDateInBlockedPeriod = (date: Date): boolean => {
    const dateString = format(date, 'yyyy-MM-dd');
    
    return blockedPeriods.some(period => {
      const startDate = new Date(period.start_date);
      const endDate = new Date(period.end_date);
      const checkDate = new Date(dateString);
      
      return isWithinInterval(checkDate, { start: startDate, end: endDate });
    });
  };

  // Verificar se um mês está bloqueado
  const isMonthBlocked = (date: Date): boolean => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    return blockedPeriods.some(period => {
      const periodStart = new Date(period.start_date);
      const periodEnd = new Date(period.end_date);
      
      // Verificar se o período bloqueado cobre todo o mês
      return periodStart <= monthStart && periodEnd >= monthEnd;
    });
  };

  // Verificar se uma data pode ser editada
  const canEditDate = (date: Date): { canEdit: boolean; reason: string } => {
    const today = new Date();
    const oneDayAgo = subDays(today, 1);
    const dateString = format(date, 'yyyy-MM-dd');
    
    // 1. Verificar se é hoje ou futuro
    if (isAfter(date, oneDayAgo)) {
      return { canEdit: false, reason: 'Não é possível editar dias atuais ou futuros' };
    }
    
    // 2. Verificar se já foi editado
    if (editedDates.has(dateString)) {
      return { canEdit: false, reason: 'Este dia já foi editado anteriormente' };
    }
    
    // 3. Verificar se está em período bloqueado
    if (isDateInBlockedPeriod(date)) {
      return { canEdit: false, reason: 'Este período está bloqueado para edições' };
    }
    
    // 4. Verificar se o mês está bloqueado
    if (isMonthBlocked(date)) {
      return { canEdit: false, reason: 'Este mês está bloqueado para edições' };
    }
    
    return { canEdit: true, reason: 'Data disponível para edição' };
  };

  const isDateDisabled = (date: Date) => {
    const { canEdit } = canEditDate(date);
    return !canEdit;
  };

  const handleInputChange = (field: keyof EditForm, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitEdit = async () => {
    if (!selectedDate || !timeRecord || !user) {
      toast({
        title: "Erro Interno",
        description: "Dados essenciais para a submissão estão faltando.",
        variant: "destructive",
      });
      return;
    }

    // Verificação de período bloqueado
    const { canEdit, reason } = canEditDate(selectedDate);
    if (!canEdit) {
      toast({
        title: "Período Bloqueado",
        description: reason,
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

      const baseRequest = {
        employee_id: user.id,
        employee_name: getUserName(user, profile),
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
        toast({
          title: "Nenhuma Alteração",
          description: "Nenhuma alteração foi feita nos horários.",
          variant: "default",
        });
        setSubmitting(false);
        return;
      }

      // Inserir todas as solicitações
      const { error: insertError } = await supabase
        .from('edit_requests')
        .insert(requests);

      if (insertError) throw insertError;

      // Marcar data como editada
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      setEditedDates(prev => new Set([...prev, dateString]));

      toast({
        title: "Sucesso",
        description: `${requests.length} solicitação(ões) de alteração enviada(s) para aprovação.`,
      });

      // Reset form
      setEditForm({
        clock_in: '',
        lunch_start: '',
        lunch_end: '',
        clock_out: '',
        reason: '',
        locationName: ''
      });

      setSelectedDate(undefined);
      setTimeRecord(null);

    } catch (error) {
      console.error('Erro ao enviar solicitações:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar solicitações de alteração.",
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="text-lg font-medium">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="p-2"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
            )}
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Ajuste de Registros</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Calendário */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-lg font-medium mb-4 text-center">Selecione o dia para ajustar</div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={isDateDisabled}
            locale={ptBR}
            className="rounded-md border w-full mx-auto"
          />
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-base">Dias disponíveis para edição</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
              <span className="text-base">Dias já editados ou não disponíveis</span>
            </div>
          </div>
        </div>

        {/* Formulário de Edição */}
        {selectedDate && timeRecord ? (
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="text-lg font-medium mb-4 flex items-center gap-2">
              <Edit3 className="w-5 h-5" /> Editar {format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
            </div>

            <div className="space-y-6">
              <div>
                <Label htmlFor="location" className="text-base font-medium">Localização *</Label>
                {allowedLocations.length > 0 ? (
                  <Select
                    value={editForm.locationName}
                    onValueChange={(value) => handleInputChange('locationName', value)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="location" className="h-12 text-base">
                      <SelectValue placeholder="Selecione a localização" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedLocations.map((location) => (
                        <SelectItem key={location.id} value={location.name} className="text-base">
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-base text-red-500">Nenhuma localização ativa disponível.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clock_in" className="text-base font-medium">Entrada</Label>
                  <Input
                    id="clock_in"
                    type="time"
                    value={editForm.clock_in}
                    onChange={(e) => handleInputChange('clock_in', e.target.value)}
                    disabled={submitting}
                    className="h-12 text-base"
                  />
                  <div className="text-sm text-gray-500 mt-1">
                    Atual: {timeRecord.clock_in || 'Não registrado'}
                  </div>
                </div>

                <div>
                  <Label htmlFor="lunch_start" className="text-base font-medium">Início Almoço</Label>
                  <Input
                    id="lunch_start"
                    type="time"
                    value={editForm.lunch_start}
                    onChange={(e) => handleInputChange('lunch_start', e.target.value)}
                    disabled={submitting}
                    className="h-12 text-base"
                  />
                  <div className="text-sm text-gray-500 mt-1">
                    Atual: {timeRecord.lunch_start || 'Não registrado'}
                  </div>
                </div>

                <div>
                  <Label htmlFor="lunch_end" className="text-base font-medium">Fim Almoço</Label>
                  <Input
                    id="lunch_end"
                    type="time"
                    value={editForm.lunch_end}
                    onChange={(e) => handleInputChange('lunch_end', e.target.value)}
                    disabled={submitting}
                    className="h-12 text-base"
                  />
                  <div className="text-sm text-gray-500 mt-1">
                    Atual: {timeRecord.lunch_end || 'Não registrado'}
                  </div>
                </div>

                <div>
                  <Label htmlFor="clock_out" className="text-base font-medium">Saída</Label>
                  <Input
                    id="clock_out"
                    type="time"
                    value={editForm.clock_out}
                    onChange={(e) => handleInputChange('clock_out', e.target.value)}
                    disabled={submitting}
                    className="h-12 text-base"
                  />
                  <div className="text-sm text-gray-500 mt-1">
                    Atual: {timeRecord.clock_out || 'Não registrado'}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="reason" className="text-base font-medium">Motivo da Alteração *</Label>
                <Textarea
                  id="reason"
                  value={editForm.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder="Descreva o motivo da solicitação de alteração..."
                  required
                  disabled={submitting}
                  className="min-h-[100px] text-base resize-none"
                />
              </div>

              <Button
                onClick={handleSubmitEdit}
                className="w-full h-14 text-lg font-semibold"
                disabled={submitting || !editForm.reason.trim() || !editForm.locationName || allowedLocations.length === 0 || !hasAnyTimeChanged}
              >
                {submitting ? (
                  <>
                    <Clock className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Enviar Solicitação
                  </>
                )}
              </Button>

              <p className="text-sm text-gray-500 text-center">
                * A solicitação será enviada para aprovação do RH.
                Você será notificado quando for processada.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-base">Selecione um dia no calendário para editar os registros</p>
          </div>
        )}

        {selectedDate && timeRecord && allowedLocations.length === 0 && (
          <Alert variant="destructive" className="border-2">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="text-base">
              Nenhuma localização ativa encontrada. Não é possível solicitar edição sem selecionar uma localização.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default AdjustPreviousDays;