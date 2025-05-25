import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Coffee, LogIn, LogOut, Edit2, Check, X, AlertTriangle, MapPin } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

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
  record: TimeRecord;
  onUpdate: (record: TimeRecord) => void;
  user: User;
  isHistoricalEntry?: boolean;
}

const TimeRegistration: React.FC<TimeRegistrationProps> = ({ 
  record, 
  onUpdate, 
  user, 
  isHistoricalEntry = false 
}) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [message, setMessage] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

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
            // Usar Nominatim (OpenStreetMap) para reverse geocoding (gratuito)
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
            // Se falhar o reverse geocoding, usar apenas as coordenadas
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
          maximumAge: 300000 // 5 minutos
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

    // Calcular intervalo de almoço
    let lunchBreakMinutes = 0;
    if (lunchStart && lunchEnd && lunchEndMinutes > lunchStartMinutes) {
      lunchBreakMinutes = lunchEndMinutes - lunchStartMinutes;
    }

    // Total de minutos trabalhados
    const totalWorkedMinutes = clockOutMinutes - clockInMinutes - lunchBreakMinutes;
    let effectiveWorkedMinutes = totalWorkedMinutes;

    // Aplicar tolerância de 15 minutos apenas se for exatamente 15 minutos ou menos
    const extraMinutes = totalWorkedMinutes - 480; // 480 = 8 horas em minutos
    if (extraMinutes > 0 && extraMinutes <= 15) {
      // Se tiver entre 1 e 15 minutos extras, considerar como 8 horas exatas
      effectiveWorkedMinutes = 480;
    }

    const totalHours = Math.max(0, effectiveWorkedMinutes / 60);

    // Calcular horas normais e extras
    let normalHours = Math.min(totalHours, 8);
    let overtimeHours = 0;

    if (totalHours > 8) {
      overtimeHours = totalHours - 8;
      normalHours = 8;
    }

    return { totalHours, normalHours, overtimeHours };
  };

  const handleRegisterTime = async (field: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut') => {
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

      const normalPay = normalHours * user.hourlyRate;
      const overtimePay = overtimeHours * user.hourlyRate;
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

      onUpdate(finalRecord);
      setMessage(`${getFieldLabel(field)} registrado: ${currentTime} (${location.address})`);
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      // Registrar sem localização em caso de erro
      const updatedRecord = { ...record, [field]: currentTime };
      
      const { totalHours, normalHours, overtimeHours } = calculateHours(
        updatedRecord.clockIn,
        updatedRecord.lunchStart,
        updatedRecord.lunchEnd,
        updatedRecord.clockOut
      );

      const normalPay = normalHours * user.hourlyRate;
      const overtimePay = overtimeHours * user.hourlyRate;
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

      onUpdate(finalRecord);
      setMessage(`${getFieldLabel(field)} registrado: ${currentTime} (sem localização)`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleManualTimeEntry = (field: string, value: string) => {
    if (!value.trim()) {
      setMessage('Por favor, informe um horário válido');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const updatedRecord = { ...record, [field]: value };
    
    const { totalHours, normalHours, overtimeHours } = calculateHours(
      updatedRecord.clockIn,
      updatedRecord.lunchStart,
      updatedRecord.lunchEnd,
      updatedRecord.clockOut
    );

    const normalPay = normalHours * user.hourlyRate;
    const overtimePay = overtimeHours * user.hourlyRate;
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

    onUpdate(finalRecord);
    setEditingField(null);
    setEditValue('');
    setMessage(`${getFieldLabel(field)} definido: ${value}`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleEdit = (field: string, value?: string) => {
    if (isHistoricalEntry) {
      // Para registros históricos, permitir edição direta
      setEditingField(field);
      setEditValue(value || '');
      setEditReason('');
    } else {
      // Para registros do dia atual, criar solicitação de edição
      setEditingField(field);
      setEditValue(value || '');
      setEditReason('');
    }
  };

  const handleSaveEdit = () => {
    if (!editingField) return;

    if (isHistoricalEntry) {
      // Edição direta para registros históricos
      handleManualTimeEntry(editingField, editValue);
    } else {
      // Criar solicitação para registros do dia atual
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

      // Criar solicitação de edição
      const editRequest = {
        id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId: user.id,
        employeeName: user.name,
        date: record.date,
        field: editingField as 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut',
        oldValue: currentValue,
        newValue: editValue,
        reason: editReason,
        timestamp: new Date().toISOString(),
        status: 'pending' as const
      };

      // Salvar solicitação no localStorage
      const existingRequests = localStorage.getItem('tcponto_edit_requests');
      const requests = existingRequests ? JSON.parse(existingRequests) : [];
      requests.push(editRequest);
      localStorage.setItem('tcponto_edit_requests', JSON.stringify(requests));

      setEditingField(null);
      setEditValue('');
      setEditReason('');
      setMessage('Solicitação de alteração enviada para aprovação administrativa');
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

  const timeFields = [
    { key: 'clockIn', label: 'Entrada', value: record.clockIn, color: 'bg-green-500' },
    { key: 'lunchStart', label: 'Início Almoço', value: record.lunchStart, color: 'bg-orange-500' },
    { key: 'lunchEnd', label: 'Fim Almoço', value: record.lunchEnd, color: 'bg-orange-500' },
    { key: 'clockOut', label: 'Saída', value: record.clockOut, color: 'bg-red-500' }
  ];

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

      {isHistoricalEntry && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-amber-800">
            Você está registrando horários de um dia anterior. Os horários podem ser definidos manualmente.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {timeFields.map(({ key, label, value, color }) => {
          const Icon = getFieldIcon(key);
          const location = record.locations?.[key as keyof typeof record.locations];
          
          return (
            <Card key={key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  {label}
                  {location && (
                    <MapPin className="w-3 h-3 text-green-600" title="Localização registrada" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingField === key ? (
                  <div className="space-y-2">
                    <Input
                      type="time"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="text-center"
                    />
                    {!isHistoricalEntry && (
                      <Textarea
                        placeholder="Motivo da alteração (obrigatório)"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        className="text-sm"
                        rows={2}
                      />
                    )}
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
                      <div className="text-2xl font-bold text-primary-900">
                        {value || '--:--'}
                      </div>
                      {location && (
                        <div className="text-xs text-gray-500 mt-1 truncate" title={location.address}>
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {location.address}
                        </div>
                      )}
                      {(value || isHistoricalEntry) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(key, value)}
                          className="mt-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          {isHistoricalEntry ? 'Definir' : 'Solicitar Edição'}
                        </Button>
                      )}
                    </div>
                    
                    {!value && !isHistoricalEntry && (
                      <Button
                        onClick={() => handleRegisterTime(key as any)}
                        disabled={isGettingLocation}
                        className={`w-full ${color} hover:opacity-90 text-white`}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {isGettingLocation ? 'Obtendo localização...' : 'Registrar'}
                      </Button>
                    )}

                    {!value && isHistoricalEntry && (
                      <Button
                        onClick={() => handleEdit(key)}
                        variant="outline"
                        className="w-full"
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        Definir Horário
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                R$ {record.normalPay.toFixed(2)}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Horas Extras</p>
              <p className="text-xl font-bold text-orange-600">
                {record.overtimeHours.toFixed(1)}h
              </p>
              <p className="text-sm text-accent-600">
                R$ {record.overtimePay.toFixed(2)}
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
                R$ {record.totalPay.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeRegistration;
