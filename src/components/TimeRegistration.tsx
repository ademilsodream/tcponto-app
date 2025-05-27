import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Coffee, LogIn, LogOut, Edit2, Check, X, AlertTriangle, MapPin, Lock, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import EmployeeMonthlySummary from './EmployeeMonthlySummary';
import EmployeeDetailedReport from './EmployeeDetailedReport';
import TimeRegistrationProgress from './TimeRegistrationProgress';
import IncompleteRecordsProfile from './IncompleteRecordsProfile';

interface TimeRecord {
  id: string;
  date: string;
  clockIn?: string;
  lunchStart?: string;
  lunchEnd?: string;
  clockOut?: string;
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  normalPay: number;
  overtimePay: number;
  totalPay: number;
  locations?: {
    clockIn?: { lat: number; lng: number; address: string; timestamp: string };
    lunchStart?: { lat: number; lng: number; address: string; timestamp: string };
    lunchEnd?: { lat: number; lng: number; address: string; timestamp: string };
    clockOut?: { lat: number; lng: number; address: string; timestamp: string };
  };
}

interface TimeRegistrationProps {
  selectedDate: string;
}

const TimeRegistration: React.FC<TimeRegistrationProps> = ({ selectedDate }) => {
  const [record, setRecord] = useState<TimeRecord>({
    id: `record_${selectedDate}`,
    date: selectedDate,
    totalHours: 0,
    normalHours: 0,
    overtimeHours: 0,
    normalPay: 0,
    overtimePay: 0,
    totalPay: 0
  });

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [message, setMessage] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [editRequestedFields, setEditRequestedFields] = useState<Set<string>>(new Set());
  const [approvedEditedFields, setApprovedEditedFields] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [showMonthlySummary, setShowMonthlySummary] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [showIncompleteRecords, setShowIncompleteRecords] = useState(false);
  
  // Estados para edição em lote (dias anteriores)
  const [batchEditValues, setBatchEditValues] = useState({
    clockIn: '',
    lunchStart: '',
    lunchEnd: '',
    clockOut: ''
  });
  const [batchEditReason, setBatchEditReason] = useState('');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();

  // Taxa horária padrão para funcionário
  const overtimeRate = hourlyRate;

  // Carregar dados do Supabase quando a data muda
  useEffect(() => {
    if (user) {
      loadTimeRecord();
      loadUserProfile();
    }
  }, [selectedDate, user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setHourlyRate(Number(data.hourly_rate));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadTimeRecord = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading time record:', error);
        return;
      }

      if (data) {
        const loadedRecord: TimeRecord = {
          id: data.id,
          date: data.date,
          clockIn: data.clock_in || undefined,
          lunchStart: data.lunch_start || undefined,
          lunchEnd: data.lunch_end || undefined,
          clockOut: data.clock_out || undefined,
          totalHours: Number(data.total_hours),
          normalHours: Number(data.normal_hours),
          overtimeHours: Number(data.overtime_hours),
          normalPay: Number(data.normal_pay),
          overtimePay: Number(data.overtime_pay),
          totalPay: Number(data.total_pay),
          locations: data.locations as any || undefined
        };
        setRecord(loadedRecord);
        
        // Preencher valores para edição em lote
        setBatchEditValues({
          clockIn: loadedRecord.clockIn || '',
          lunchStart: loadedRecord.lunchStart || '',
          lunchEnd: loadedRecord.lunchEnd || '',
          clockOut: loadedRecord.clockOut || ''
        });
      } else {
        // Registro não existe, manter o estado inicial
        setRecord({
          id: `record_${selectedDate}`,
          date: selectedDate,
          totalHours: 0,
          normalHours: 0,
          overtimeHours: 0,
          normalPay: 0,
          overtimePay: 0,
          totalPay: 0
        });
        
        setBatchEditValues({
          clockIn: '',
          lunchStart: '',
          lunchEnd: '',
          clockOut: ''
        });
      }

      // Carregar campos já solicitados para edição do localStorage
      const key = `tcponto_edit_requested_${user.id}_${selectedDate}`;
      const savedFields = localStorage.getItem(key);
      if (savedFields) {
        setEditRequestedFields(new Set(JSON.parse(savedFields)));
      } else {
        setEditRequestedFields(new Set());
      }

      // Carregar campos que já foram editados com aprovação do localStorage
      const approvedKey = `tcponto_approved_edits_${user.id}_${selectedDate}`;
      const savedApprovedFields = localStorage.getItem(approvedKey);
      if (savedApprovedFields) {
        setApprovedEditedFields(new Set(JSON.parse(savedApprovedFields)));
      } else {
        setApprovedEditedFields(new Set());
      }
    } catch (error) {
      console.error('Error loading time record:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTimeRecord = async (updatedRecord: TimeRecord, needsApproval = false) => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const isToday = selectedDate === today;

      const recordData = {
        user_id: user.id,
        date: updatedRecord.date,
        clock_in: updatedRecord.clockIn || null,
        lunch_start: updatedRecord.lunchStart || null,
        lunch_end: updatedRecord.lunchEnd || null,
        clock_out: updatedRecord.clockOut || null,
        total_hours: updatedRecord.totalHours,
        normal_hours: updatedRecord.normalHours,
        overtime_hours: updatedRecord.overtimeHours,
        normal_pay: updatedRecord.normalPay,
        overtime_pay: updatedRecord.overtimePay,
        total_pay: updatedRecord.totalPay,
        locations: updatedRecord.locations || null,
        is_pending_approval: needsApproval,
        status: 'active'
      };

      // Verificar se já existe um registro
      const { data: existingRecord } = await supabase
        .from('time_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .single();

      if (existingRecord) {
        // Atualizar registro existente
        const { error } = await supabase
          .from('time_records')
          .update(recordData)
          .eq('id', existingRecord.id);

        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('time_records')
          .insert(recordData);

        if (error) throw error;
      }

      console.log(`Time record ${needsApproval ? 'saved with pending approval' : 'saved directly'}`);
    } catch (error) {
      console.error('Error saving time record:', error);
      throw error;
    }
  };

  const isFieldEditRequested = (field: string): boolean => {
    return editRequestedFields.has(field);
  };

  const isFieldApprovedEdited = (field: string): boolean => {
    return approvedEditedFields.has(field);
  };

  const canEditField = (field: string): boolean => {
    return !isFieldEditRequested(field) && !isFieldApprovedEdited(field);
  };

  const markFieldAsRequested = (field: string) => {
    if (!user) return;
    
    const newSet = new Set(editRequestedFields);
    newSet.add(field);
    setEditRequestedFields(newSet);
    
    const key = `tcponto_edit_requested_${user.id}_${selectedDate}`;
    localStorage.setItem(key, JSON.stringify(Array.from(newSet)));
  };

  const getCurrentFieldToShow = () => {
    if (!record.clockIn) return 'clockIn';
    if (!record.lunchStart) return 'lunchStart';
    if (!record.lunchEnd) return 'lunchEnd';
    if (!record.clockOut) return 'clockOut';
    return 'completed';
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number; address: string }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não é suportada pelo navegador'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=pt`
            );
            const data = await response.json();
            
            const address = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            
            resolve({
              lat: latitude,
              lng: longitude,
              address
            });
          } catch (error) {
            resolve({
              lat: latitude,
              lng: longitude,
              address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            });
          }
        },
        (error) => {
          reject(new Error('Erro ao obter localização: ' + error.message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  const calculateHours = (clockIn?: string, lunchStart?: string, lunchEnd?: string, clockOut?: string) => {
    if (!clockIn || !clockOut) return { totalHours: 0, normalHours: 0, overtimeHours: 0 };

    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const clockInMinutes = parseTime(clockIn);
    const clockOutMinutes = parseTime(clockOut);
    const lunchStartMinutes = lunchStart ? parseTime(lunchStart) : 0;
    const lunchEndMinutes = lunchEnd ? parseTime(lunchEnd) : 0;

    let lunchBreakMinutes = 0;
    if (lunchStart && lunchEnd && lunchEndMinutes > lunchStartMinutes) {
      lunchBreakMinutes = lunchEndMinutes - lunchStartMinutes;
    }

    const totalWorkedMinutes = clockOutMinutes - clockInMinutes - lunchBreakMinutes;
    let effectiveWorkedMinutes = totalWorkedMinutes;

    const extraMinutes = totalWorkedMinutes - 480;
    if (extraMinutes > 0 && extraMinutes <= 15) {
      effectiveWorkedMinutes = 480;
    }

    const totalHours = Math.max(0, effectiveWorkedMinutes / 60);

    let normalHours = Math.min(totalHours, 8);
    let overtimeHours = 0;

    if (totalHours > 8) {
      overtimeHours = totalHours - 8;
      normalHours = 8;
    }

    return { totalHours, normalHours, overtimeHours };
  };

  // Função para envio em lote (dias anteriores)
  const handleBatchSubmit = async () => {
    if (!user) {
      setMessage('Erro: Usuário não autenticado');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Validar se todos os campos estão preenchidos
    if (!batchEditValues.clockIn || !batchEditValues.lunchStart || 
        !batchEditValues.lunchEnd || !batchEditValues.clockOut) {
      setMessage('Todos os 4 registros devem ser preenchidos');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!batchEditReason.trim()) {
      setMessage('Por favor, informe o motivo da alteração');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setIsSubmittingBatch(true);

    try {
      // Salvar cada solicitação de edição no banco
      const editRequests = [
        { field: 'clockIn', newValue: batchEditValues.clockIn, oldValue: record.clockIn || '' },
        { field: 'lunchStart', newValue: batchEditValues.lunchStart, oldValue: record.lunchStart || '' },
        { field: 'lunchEnd', newValue: batchEditValues.lunchEnd, oldValue: record.lunchEnd || '' },
        { field: 'clockOut', newValue: batchEditValues.clockOut, oldValue: record.clockOut || '' }
      ];

      for (const request of editRequests) {
        const editRequest = {
          employee_id: user.id,
          employee_name: user.name || user.email,
          date: record.date,
          field: request.field as 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut',
          old_value: request.oldValue,
          new_value: request.newValue,
          reason: batchEditReason,
          status: 'pending'
        };

        const { error } = await supabase
          .from('edit_requests')
          .insert(editRequest);

        if (error) throw error;

        // Marcar campo como solicitado
        markFieldAsRequested(request.field);
      }

      setMessage('Solicitação de alteração enviada para aprovação administrativa para todos os registros.');
      setTimeout(() => setMessage(''), 5000);
      
      // Limpar formulário
      setBatchEditReason('');
      
    } catch (error) {
      console.error('Error saving batch edit request:', error);
      setMessage('Erro ao enviar solicitação. Tente novamente.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleRegisterTime = async (field: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut') => {
    if (!user) {
      setMessage('Erro: Usuário não autenticado');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Verificar se já foram feitos 4 registros
    if (!canRegisterMore()) {
      setMessage('Limite de 4 registros por dia atingido. Todos os registros do dia foram concluídos.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Verificar se é o próximo campo na sequência
    const nextField = getNextAvailableField();
    if (field !== nextField) {
      setMessage(`Por favor, registre na sequência correta. Próximo registro: ${getFieldLabel(nextField || '')}`);
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const currentTime = getCurrentTime();
    setIsGettingLocation(true);

    try {
      const location = await getCurrentLocation();
      const locationData = {
        ...location,
        timestamp: new Date().toISOString()
      };

      const updatedRecord = { 
        ...record, 
        [field]: currentTime,
        locations: {
          ...record.locations,
          [field]: locationData
        }
      };
      
      const { totalHours, normalHours, overtimeHours } = calculateHours(
        updatedRecord.clockIn,
        updatedRecord.lunchStart,
        updatedRecord.lunchEnd,
        updatedRecord.clockOut
      );

      const normalPay = normalHours * hourlyRate;
      const overtimePay = overtimeHours * overtimeRate;
      const totalPay = normalPay + overtimePay;

      const finalRecord = {
        ...updatedRecord,
        totalHours,
        normalHours,
        overtimeHours,
        normalPay,
        overtimePay,
        totalPay
      };

      const today = new Date().toISOString().split('T')[0];
      const isToday = selectedDate === today;
      const needsApproval = !isToday;

      await saveTimeRecord(finalRecord, needsApproval);
      
      setRecord(finalRecord);
      
      const newRecordsCount = getRecordsCount(finalRecord);
      const isComplete = newRecordsCount === 4;
      
      setMessage(
        `${getFieldLabel(field)} registrado: ${currentTime}${needsApproval ? ' - Aguardando aprovação administrativa' : ''}${
          isComplete ? ' 🎉 Dia completo! Todos os 4 registros foram realizados.' : ` (${newRecordsCount}/4 registros)`
        }`
      );
      setTimeout(() => setMessage(''), isComplete ? 5000 : 3000);
    } catch (error) {
      console.error('Error registering time:', error);
      
      const updatedRecord = { ...record, [field]: currentTime };
      
      const { totalHours, normalHours, overtimeHours } = calculateHours(
        updatedRecord.clockIn,
        updatedRecord.lunchStart,
        updatedRecord.lunchEnd,
        updatedRecord.clockOut
      );

      const normalPay = normalHours * hourlyRate;
      const overtimePay = overtimeHours * overtimeRate;
      const totalPay = normalPay + overtimePay;

      const finalRecord = {
        ...updatedRecord,
        totalHours,
        normalHours,
        overtimeHours,
        normalPay,
        overtimePay,
        totalPay
      };

      setRecord(finalRecord);
      setMessage(`${getFieldLabel(field)} registrado: ${currentTime} (erro ao salvar no servidor)`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleEdit = (field: string, value?: string) => {
    if (isFieldApprovedEdited(field)) {
      setMessage('Este campo já foi editado com aprovação administrativa e não pode ser alterado novamente.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    if (isFieldEditRequested(field)) {
      setMessage('Este campo já foi solicitado para edição e aguarda aprovação administrativa.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }
    
    setEditingField(field);
    setEditValue(value || '');
    setEditReason('');
  };

  const handleSaveEdit = async () => {
    if (!editingField || !user) return;

    if (!editReason.trim()) {
      setMessage('Por favor, informe o motivo da alteração');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const currentValue = record[editingField as keyof TimeRecord] as string || '';
    
    if (currentValue === editValue) {
      setMessage('O novo valor deve ser diferente do atual');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!canEditField(editingField)) {
      setMessage('Este campo não pode mais ser editado');
      setTimeout(() => setMessage(''), 5000);
      setEditingField(null);
      setEditValue('');
      setEditReason('');
      return;
    }

    try {
      markFieldAsRequested(editingField);

      const editRequest = {
        employee_id: user.id,
        employee_name: user.name || user.email,
        date: record.date,
        field: editingField as 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut',
        old_value: currentValue,
        new_value: editValue,
        reason: editReason,
        status: 'pending'
      };

      const { error } = await supabase
        .from('edit_requests')
        .insert(editRequest);

      if (error) throw error;

      setEditingField(null);
      setEditValue('');
      setEditReason('');
      
      setMessage(`Solicitação de alteração enviada para aprovação administrativa. Este campo não pode mais ser editado.`);
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Error saving edit request:', error);
      
      const editRequest = {
        id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId: user.id,
        employeeName: user.name || user.email,
        date: record.date,
        field: editingField as 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut',
        oldValue: currentValue,
        newValue: editValue,
        reason: editReason,
        timestamp: new Date().toISOString(),
        status: 'pending' as const
      };

      const existingRequests = localStorage.getItem('tcponto_edit_requests');
      const requests = existingRequests ? JSON.parse(existingRequests) : [];
      requests.push(editRequest);
      localStorage.setItem('tcponto_edit_requests', JSON.stringify(requests));

      setEditingField(null);
      setEditValue('');
      setEditReason('');
      
      setMessage(`Solicitação de alteração enviada (salva localmente). Este campo não pode mais ser editado.`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setEditReason('');
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'clockIn': return 'Entrada';
      case 'lunchStart': return 'Início do Almoço';
      case 'lunchEnd': return 'Fim do Almoço';
      case 'clockOut': return 'Saída';
      default: return field;
    }
  };

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'clockIn': return LogIn;
      case 'lunchStart': return Coffee;
      case 'lunchEnd': return Coffee;
      case 'clockOut': return LogOut;
      default: return Clock;
    }
  };

  const getFieldColor = (field: string) => {
    switch (field) {
      case 'clockIn': return 'bg-green-500';
      case 'lunchStart': return 'bg-orange-500';
      case 'lunchEnd': return 'bg-orange-500';
      case 'clockOut': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getRecordsCount = (record: TimeRecord): number => {
    let count = 0;
    if (record.clockIn) count++;
    if (record.lunchStart) count++;
    if (record.lunchEnd) count++;
    if (record.clockOut) count++;
    return count;
  };

  const canRegisterMore = (): boolean => {
    const currentRecordsCount = getRecordsCount(record);
    return currentRecordsCount < 4;
  };

  const getNextAvailableField = (): string | null => {
    if (!record.clockIn) return 'clockIn';
    if (!record.lunchStart) return 'lunchStart';
    if (!record.lunchEnd) return 'lunchEnd';
    if (!record.clockOut) return 'clockOut';
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-red-600">Por favor, faça login para acessar o sistema de ponto.</div>
      </div>
    );
  }

  // Se está visualizando o relatório detalhado
  if (showDetailedReport) {
    return (
      <EmployeeDetailedReport
        selectedMonth={new Date(selectedDate)}
        onBack={() => setShowDetailedReport(false)}
      />
    );
  }

  // Se está visualizando registros incompletos
  if (showIncompleteRecords) {
    return (
      <div className="space-y-4">
        <Button 
          onClick={() => setShowIncompleteRecords(false)}
          variant="outline"
          size="sm"
        >
          ← Voltar ao Registro
        </Button>
        <IncompleteRecordsProfile />
      </div>
    );
  }

  const today = new Date();
  const selectedDateObj = new Date(selectedDate);
  
  // Comparar apenas as datas (sem horário) para determinar se é dia anterior
  const todayDateString = today.toISOString().split('T')[0];
  const isHistoricalEntry = selectedDate < todayDateString;

  const currentRecordsCount = getRecordsCount(record);
  const nextField = getNextAvailableField();
  const isComplete = currentRecordsCount === 4;

  // Render para dias anteriores (edição em lote)
  const renderHistoricalEntry = () => {
    const fields = ['clockIn', 'lunchStart', 'lunchEnd', 'clockOut'];
    
    return (
      <div className="space-y-4">
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-amber-800">
            Você está registrando horários de um dia anterior. Preencha todos os 4 campos e envie uma solicitação única.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => {
            const Icon = getFieldIcon(field);
            const color = getFieldColor(field);
            const isRequested = isFieldEditRequested(field);
            const isApprovedEdited = isFieldApprovedEdited(field);
            
            return (
              <Card key={field} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium flex items-center gap-2 justify-center">
                    <div className={`w-4 h-4 rounded-full ${color}`} />
                    {getFieldLabel(field)}
                    {(isRequested || isApprovedEdited) && <Lock className="w-4 h-4 text-amber-600" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(isRequested || isApprovedEdited) ? (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary-900 mb-2">
                        {record[field as keyof TimeRecord] as string || '--:--'}
                      </div>
                      <div className="text-sm text-amber-600 flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3" />
                        {isApprovedEdited ? 'Campo editado - bloqueado' : 'Aguardando aprovação'}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-center text-sm text-gray-600 mb-2">
                        Valor atual: {record[field as keyof TimeRecord] as string || 'Não registrado'}
                      </div>
                      <Input
                        type="time"
                        value={batchEditValues[field as keyof typeof batchEditValues]}
                        onChange={(e) => setBatchEditValues(prev => ({
                          ...prev,
                          [field]: e.target.value
                        }))}
                        className="text-center"
                        disabled={isRequested || isApprovedEdited}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!editRequestedFields.has('clockIn') && !editRequestedFields.has('lunchStart') && 
         !editRequestedFields.has('lunchEnd') && !editRequestedFields.has('clockOut') && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Textarea
                  placeholder="Motivo da alteração (obrigatório para todos os registros)"
                  value={batchEditReason}
                  onChange={(e) => setBatchEditReason(e.target.value)}
                  className="text-sm"
                  rows={3}
                />
                <Button
                  onClick={handleBatchSubmit}
                  disabled={isSubmittingBatch || 
                    !batchEditValues.clockIn || !batchEditValues.lunchStart || 
                    !batchEditValues.lunchEnd || !batchEditValues.clockOut ||
                    !batchEditReason.trim()}
                  className="w-full bg-primary-600 hover:bg-primary-700"
                  size="lg"
                >
                  {isSubmittingBatch ? 'Enviando...' : 'Enviar Solicitação de Ajustes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(editRequestedFields.has('clockIn') || editRequestedFields.has('lunchStart') || 
          editRequestedFields.has('lunchEnd') || editRequestedFields.has('clockOut')) && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-amber-800">
              Solicitação de alteração enviada. Aguardando aprovação administrativa.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  const renderCurrentField = () => {
    if (isComplete) {
      return (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="text-center">
            <CardTitle className="text-green-700">
              ✅ Registro do Dia Completo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-green-600">
              Todos os 4 registros do dia foram preenchidos com sucesso!
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Limite diário de registros atingido.
            </p>
          </CardContent>
        </Card>
      );
    }

    if (!nextField) return null;

    const field = nextField;
    const Icon = getFieldIcon(field);
    const value = record[field as keyof TimeRecord] as string;
    const location = record.locations?.[field as keyof typeof record.locations];
    const isRequested = isFieldEditRequested(field);
    const isApprovedEdited = isFieldApprovedEdited(field);
    const canEdit = canEditField(field);
    const color = getFieldColor(field);

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2 justify-center">
            <div className={`w-4 h-4 rounded-full ${color}`} />
            {getFieldLabel(field)}
            {location && <MapPin className="w-4 h-4 text-green-600" />}
            {(isRequested || isApprovedEdited) && <Lock className="w-4 h-4 text-amber-600" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingField === field ? (
            <div className="space-y-3">
              <Input
                type="time"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="text-center"
              />
              <Textarea
                placeholder="Motivo da alteração (obrigatório)"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="flex-1 bg-accent-600 hover:bg-accent-700"
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="flex-1"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-900 mb-2">
                  {value || '--:--'}
                </div>
                {location && (
                  <div className="text-sm text-gray-500 mb-2 truncate">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    {location.address}
                  </div>
                )}
                
                {isApprovedEdited && (
                  <div className="text-sm text-red-600 mb-2 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" />
                    Campo editado - bloqueado
                  </div>
                )}
                
                {isRequested && !isApprovedEdited && (
                  <div className="text-sm text-amber-600 mb-2 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" />
                    Aguardando aprovação
                  </div>
                )}
              </div>
              
              {!value && !isHistoricalEntry && canRegisterMore() && (
                <Button
                  onClick={() => handleRegisterTime(field as any)}
                  disabled={isGettingLocation}
                  className={`w-full ${color} hover:opacity-90 text-white`}
                  size="lg"
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {isGettingLocation ? 'Obtendo localização...' : `Registrar ${getFieldLabel(field)}`}
                </Button>
              )}

              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(field, value)}
                  className="w-full"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Solicitar Edição
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderCompletedFields = () => {
    const completedFields = [];
    const allFields = ['clockIn', 'lunchStart', 'lunchEnd', 'clockOut'];
    
    for (const field of allFields) {
      const value = record[field as keyof TimeRecord] as string;
      if (value && field !== currentFieldToShow) {
        const Icon = getFieldIcon(field);
        const location = record.locations?.[field as keyof typeof record.locations];
        
        completedFields.push(
          <div key={field} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                {getFieldLabel(field)}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">{value}</div>
              {location && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Localização registrada
                </div>
              )}
            </div>
          </div>
        );
      }
    }

    return completedFields.length > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700">
            Registros Já Realizados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {completedFields}
        </CardContent>
      </Card>
    ) : null;
  };

  return (
    <div className="space-y-6">
      {message && (
        <Alert className="border-accent-200 bg-accent-50">
          <Clock className="h-4 w-4" />
          <AlertDescription className="text-accent-800">
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* Progresso do Dia */}
      <TimeRegistrationProgress record={record} />

      {/* Botão para ver registros incompletos */}
      <Card className="bg-gradient-to-r from-amber-50 to-amber-100">
        <CardContent className="p-4">
          <Button
            onClick={() => setShowIncompleteRecords(true)}
            variant="outline"
            className="w-full"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Ver Registros Incompletos do Mês
          </Button>
        </CardContent>
      </Card>

      {/* Resumo Mensal */}
      {!showMonthlySummary && (
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <Button
              onClick={() => setShowMonthlySummary(true)}
              variant="outline"
              className="w-full"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Ver Resumo Mensal
            </Button>
          </CardContent>
        </Card>
      )}

      {showMonthlySummary && (
        <div>
          <EmployeeMonthlySummary
            selectedMonth={new Date(selectedDate)}
            onShowDetailedReport={() => setShowDetailedReport(true)}
          />
          <div className="mt-4">
            <Button
              onClick={() => setShowMonthlySummary(false)}
              variant="outline"
              size="sm"
            >
              Ocultar Resumo Mensal
            </Button>
          </div>
        </div>
      )}

      {/* Se for dia anterior, mostrar interface de edição em lote */}
      {isHistoricalEntry ? (
        renderHistoricalEntry()
      ) : (
        <>
          <div className="max-w-md mx-auto">
            {renderCurrentField()}
          </div>
          {renderCompletedFields()}
        </>
      )}

      {/* Resumo do Dia */}
      <Card className="bg-gradient-to-r from-primary-50 to-accent-50">
        <CardHeader>
          <CardTitle className="text-primary-900">Resumo do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Horas Normais</p>
              <p className="text-xl font-bold text-primary-900">
                {record.normalHours.toFixed(1)}h
              </p>
              <p className="text-sm text-accent-600">
                {formatCurrency(record.normalPay)}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Horas Extras</p>
              <p className="text-xl font-bold text-orange-600">
                {record.overtimeHours.toFixed(1)}h
              </p>
              <p className="text-sm text-accent-600">
                {formatCurrency(record.overtimePay)}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Total Horas</p>
              <p className="text-xl font-bold text-primary-900">
                {record.totalHours.toFixed(1)}h
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Total Ganho</p>
              <p className="text-xl font-bold text-accent-600">
                {formatCurrency(record.totalPay)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeRegistration;
