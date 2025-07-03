import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, AlertTriangle, Clock, CheckCircle, RefreshCw, Edit3, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getWorkingDaysInMonth, isWorkingDay } from '@/utils/workingDays';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface IncompleteRecord {
  date: string;
  missingFields: string[];
  completedCount: number;
  isWeekend: boolean;
}

interface IncompleteRecordsProfileProps {
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

// Função helper para obter nome do usuário de forma segura
const getUserName = (user: any): string => {
  const possibleNames = [
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

  return 'Nome Não Informado';
};

const IncompleteRecordsProfile: React.FC<IncompleteRecordsProfileProps> = ({ onBack }) => {
  const [incompleteRecords, setIncompleteRecords] = useState<IncompleteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEditDate, setSelectedEditDate] = useState<string | null>(null);
  
  // Estados do modal de edição
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
  const [loadingModal, setLoadingModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // ✨ CORREÇÃO: Usar useOptimizedAuth consistentemente
  const { user } = useOptimizedAuth();
  const { toast } = useToast();

  useEffect(() => {
    console.log('IncompleteRecordsProfile: useEffect triggered, user:', user?.id);
    if (user) {
      loadIncompleteRecords();
    } else {
      console.log('IncompleteRecordsProfile: No user found');
      setLoading(false);
    }
  }, [user]);

  // Carregar dados quando o modal abrir
  useEffect(() => {
    if (showEditModal && selectedEditDate && user) {
      loadTimeRecord();
      loadAllowedLocations();
    }
  }, [showEditModal, selectedEditDate, user]);

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
    }
  }, [timeRecord]);

  const loadIncompleteRecords = async () => {
    if (!user) {
      console.log('IncompleteRecordsProfile: No user available for loading records');
      return;
    }

    try {
      console.log('IncompleteRecordsProfile: Starting to load records for user:', user.id);
      setLoading(true);
      setError(null);
      
      // Obter data atual
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      
      // Primeiro dia do mês atual
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      
      // Data limite: ontem OU último dia do mês atual (o que for menor)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
      const endDate = yesterday <= lastDayOfMonth ? yesterday : lastDayOfMonth;

      console.log('IncompleteRecordsProfile: Fetching records from', 
        firstDayOfMonth.toISOString().split('T')[0], 
        'to', 
        endDate.toISOString().split('T')[0]
      );

      // Se o primeiro dia do mês for depois da data limite, não há dias para verificar
      if (firstDayOfMonth > endDate) {
        console.log('IncompleteRecordsProfile: No days to check in current month yet');
        setIncompleteRecords([]);
        setLoading(false);
        return;
      }

      // Se estamos no dia 1º do mês e ontem era do mês anterior, não mostrar nada
      if (yesterday.getMonth() !== currentMonth) {
        console.log('IncompleteRecordsProfile: Yesterday was from previous month, showing no records');
        setIncompleteRecords([]);
        setLoading(false);
        return;
      }

      const { data: records, error: fetchError } = await supabase
        .from('time_records')
        .select('date, clock_in, lunch_start, lunch_end, clock_out')
        .eq('user_id', user.id)
        .gte('date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .eq('status', 'active')
        .order('date', { ascending: false });

      if (fetchError) {
        console.error('IncompleteRecordsProfile: Error fetching records:', fetchError);
        throw fetchError;
      }

      console.log('IncompleteRecordsProfile: Fetched records:', records?.length || 0);

      // Obter apenas dias úteis do mês atual até a data limite
      const allWorkingDaysInMonth = getWorkingDaysInMonth(currentYear, currentMonth);
      const workingDaysUntilEndDate = allWorkingDaysInMonth.filter(date => {
        const dayDate = new Date(date + 'T00:00:00');
        return dayDate <= endDate && dayDate.getMonth() === currentMonth; // Garantir que está no mês atual
      });

      console.log('IncompleteRecordsProfile: Working days in current month until end date:', workingDaysUntilEndDate.length);

      // Processar registros incompletos
      const incomplete: IncompleteRecord[] = [];
      
      // Verificar cada dia útil do mês atual
      const allDaysToCheck = [...workingDaysUntilEndDate];
      
      // Adicionar fins de semana que têm registros (apenas do mês atual)
      for (let d = new Date(firstDayOfMonth); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];
        const isWeekendDay = !isWorkingDay(d);
        
        // Garantir que a data está no mês atual
        if (d.getMonth() === currentMonth && isWeekendDay && records?.find(r => r.date === dateString)) {
          allDaysToCheck.push(dateString);
        }
      }

      console.log('IncompleteRecordsProfile: Processing', allDaysToCheck.length, 'days (working days + weekends with records) in current month');

      // Verificar cada dia
      allDaysToCheck.forEach(date => {
        const record = records?.find(r => r.date === date);
        const dateObj = new Date(date + 'T00:00:00');
        const isWeekendDay = !isWorkingDay(dateObj);
        
        // Verificar novamente se a data está no mês atual
        if (dateObj.getMonth() !== currentMonth) {
          return; // Pular se não for do mês atual
        }
        
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

      console.log('IncompleteRecordsProfile: Found', incomplete.length, 'incomplete records in current month');
      setIncompleteRecords(incomplete);
    } catch (error) {
      console.error('IncompleteRecordsProfile: Error loading incomplete records:', error);
      setError('Erro ao carregar registros. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeRecord = async () => {
    if (!selectedEditDate) return;
    
    try {
      setLoadingModal(true);

      const { data: record, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user?.id)
        .eq('date', selectedEditDate)
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
          date: selectedEditDate,
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
    } finally {
      setLoadingModal(false);
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

  const handleEditRecord = (date: string) => {
    setSelectedEditDate(date);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedEditDate(null);
    setTimeRecord(null);
    setEditForm({
      clock_in: '',
      lunch_start: '',
      lunch_end: '',
      clock_out: '',
      reason: '',
      locationName: ''
    });
    // Recarregar os registros para atualizar a lista
    loadIncompleteRecords();
  };

  const handleInputChange = (field: keyof EditForm, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitEdit = async () => {
    if (!timeRecord || !user || !selectedEditDate) {
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

      const baseRequest = {
        employee_id: user.id,
        employee_name: getUserName(user),
        date: selectedEditDate,
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

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: `${requests.length} solicitação(ões) de edição enviada(s) para aprovação.`,
      });

      handleCloseEditModal();

    } catch (error: any) {
      let errorMessage = 'Não foi possível enviar a solicitação de edição.';

      if (error.code === '23505') {
        errorMessage = 'Já existe uma solicitação para este dia. Aguarde a aprovação.';
      } else if (error.code === '42501') {
        errorMessage = 'Sem permissão para criar solicitação. Entre em contato com o RH.';
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

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTitle = (dateString: string) => {
    return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
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

  const hasAnyTimeChanged = timeRecord ? (
    editForm.clock_in !== (timeRecord.clock_in || '') ||
    editForm.lunch_start !== (timeRecord.lunch_start || '') ||
    editForm.lunch_end !== (timeRecord.lunch_end || '') ||
    editForm.clock_out !== (timeRecord.clock_out || '')
  ) : false;

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

  const workingDayRecords = incompleteRecords.filter(record => !record.isWeekend);
  const weekendRecords = incompleteRecords.filter(record => record.isWeekend);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Registros Incompletos - Mês Atual
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {incompleteRecords.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg text-green-600 font-medium">
                Parabéns! Todos os registros do mês atual estão completos.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Você tem todos os 4 registros diários preenchidos nos dias úteis do mês atual.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-amber-800">
                  Você tem {workingDayRecords.length} dia(s) úteis com registros incompletos no mês atual
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
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 ${getProgressColor(record.completedCount)}`}>
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {record.completedCount}/4 registros
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditRecord(record.date)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <Edit3 className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
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
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 ${getProgressColor(record.completedCount)}`}>
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {record.completedCount}/4 registros
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditRecord(record.date)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <Edit3 className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
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

      {/* Modal de Edição */}
      <Dialog open={showEditModal} onOpenChange={handleCloseEditModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Editar Registro - {selectedEditDate && formatDateTitle(selectedEditDate)}
            </DialogTitle>
          </DialogHeader>

          {loadingModal ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-amber-800 text-sm">
                  A solicitação será enviada para aprovação do RH.
                  Selecione a localização referente ao ajuste.
                </AlertDescription>
              </Alert>

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

              <div className="grid grid-cols-2 gap-3">
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
                    Atual: {timeRecord?.clock_in || 'Não registrado'}
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
                    Atual: {timeRecord?.lunch_start || 'Não registrado'}
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
                    Atual: {timeRecord?.lunch_end || 'Não registrado'}
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
                    Atual: {timeRecord?.clock_out || 'Não registrado'}
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
                  className="min-h-[60px] resize-none"
                />
              </div>

              {allowedLocations.length === 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma localização ativa encontrada. Não é possível solicitar edição sem selecionar uma localização.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleCloseEditModal}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitEdit}
                  disabled={submitting || !editForm.reason.trim() || !editForm.locationName || allowedLocations.length === 0 || !hasAnyTimeChanged}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                * A solicitação será enviada para aprovação do RH.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IncompleteRecordsProfile;
