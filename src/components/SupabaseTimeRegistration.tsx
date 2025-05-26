
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Coffee, LogIn, LogOut, Edit2, Check, X, AlertTriangle, MapPin } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface TimeRecord {
  id?: string;
  user_id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  normal_hours: number;
  overtime_hours: number;
  normal_pay: number;
  overtime_pay: number;
  total_pay: number;
  locations?: any;
}

interface SupabaseTimeRegistrationProps {
  selectedDate?: string;
}

const SupabaseTimeRegistration: React.FC<SupabaseTimeRegistrationProps> = ({ 
  selectedDate = new Date().toISOString().split('T')[0]
}) => {
  const [record, setRecord] = useState<TimeRecord | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [message, setMessage] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();
  const { user, profile } = useSupabaseAuth();

  useEffect(() => {
    if (user && selectedDate) {
      loadTimeRecord();
    }
  }, [user, selectedDate]);

  const loadTimeRecord = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('time_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', selectedDate)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar registro:', error);
      setMessage('Erro ao carregar registro do dia');
    } else if (data) {
      setRecord(data);
    } else {
      // Criar novo registro para o dia
      const newRecord: TimeRecord = {
        user_id: user.id,
        date: selectedDate,
        total_hours: 0,
        normal_hours: 0,
        overtime_hours: 0,
        normal_pay: 0,
        overtime_pay: 0,
        total_pay: 0,
      };
      setRecord(newRecord);
    }
    setLoading(false);
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

  const saveRecord = async (updatedRecord: TimeRecord) => {
    if (!user || !profile) return;

    const { totalHours, normalHours, overtimeHours } = calculateHours(
      updatedRecord.clock_in,
      updatedRecord.lunch_start,
      updatedRecord.lunch_end,
      updatedRecord.clock_out
    );

    const normalPay = normalHours * profile.hourly_rate;
    const overtimePay = overtimeHours * profile.hourly_rate * 1.5;
    const totalPay = normalPay + overtimePay;

    const finalRecord = {
      ...updatedRecord,
      total_hours: totalHours,
      normal_hours: normalHours,
      overtime_hours: overtimeHours,
      normal_pay: normalPay,
      overtime_pay: overtimePay,
      total_pay: totalPay,
    };

    if (finalRecord.id) {
      // Atualizar registro existente
      const { error } = await supabase
        .from('time_records')
        .update(finalRecord)
        .eq('id', finalRecord.id);

      if (error) {
        console.error('Erro ao atualizar registro:', error);
        setMessage('Erro ao salvar registro');
        return;
      }
    } else {
      // Inserir novo registro
      const { data, error } = await supabase
        .from('time_records')
        .insert([finalRecord])
        .select()
        .single();

      if (error) {
        console.error('Erro ao inserir registro:', error);
        setMessage('Erro ao salvar registro');
        return;
      }
      
      finalRecord.id = data.id;
    }

    setRecord(finalRecord);
  };

  const handleRegisterTime = async (field: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    if (!record) return;

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
      
      await saveRecord(updatedRecord);
      setMessage(`${getFieldLabel(field)} registrado: ${currentTime} (${location.address})`);
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      const updatedRecord = { ...record, [field]: currentTime };
      await saveRecord(updatedRecord);
      setMessage(`${getFieldLabel(field)} registrado: ${currentTime} (sem localização)`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const getCurrentFieldToShow = () => {
    if (!record) return 'clock_in';
    if (!record.clock_in) return 'clock_in';
    if (!record.lunch_start) return 'lunch_start';
    if (!record.lunch_end) return 'lunch_end';
    if (!record.clock_out) return 'clock_out';
    return 'completed';
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'clock_in': return 'Entrada';
      case 'lunch_start': return 'Início do Almoço';
      case 'lunch_end': return 'Fim do Almoço';
      case 'clock_out': return 'Saída';
      default: return field;
    }
  };

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'clock_in': return LogIn;
      case 'lunch_start': return Coffee;
      case 'lunch_end': return Coffee;
      case 'clock_out': return LogOut;
      default: return Clock;
    }
  };

  const getFieldColor = (field: string) => {
    switch (field) {
      case 'clock_in': return 'bg-green-500';
      case 'lunch_start': return 'bg-orange-500';
      case 'lunch_end': return 'bg-orange-500';
      case 'clock_out': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  if (!user || !record) {
    return <div className="text-center py-8">Faça login para registrar o ponto</div>;
  }

  const currentFieldToShow = getCurrentFieldToShow();

  const renderCurrentField = () => {
    if (currentFieldToShow === 'completed') {
      return (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="text-center">
            <CardTitle className="text-green-700">
              ✅ Registro do Dia Completo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-green-600">
              Todos os registros do dia foram preenchidos com sucesso!
            </p>
          </CardContent>
        </Card>
      );
    }

    const field = currentFieldToShow;
    const Icon = getFieldIcon(field);
    const value = record[field as keyof TimeRecord] as string;
    const location = record.locations?.[field as keyof typeof record.locations];
    const color = getFieldColor(field);

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2 justify-center">
            <div className={`w-4 h-4 rounded-full ${color}`} />
            {getFieldLabel(field)}
            {location && <MapPin className="w-4 h-4 text-green-600" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          </div>
          
          {!value && (
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
        </CardContent>
      </Card>
    );
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

      {/* Campo Atual para Registro */}
      <div className="max-w-md mx-auto">
        {renderCurrentField()}
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
                {record.normal_hours.toFixed(1)}h
              </p>
              <p className="text-sm text-accent-600">
                {formatCurrency(record.normal_pay)}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Horas Extras</p>
              <p className="text-xl font-bold text-orange-600">
                {record.overtime_hours.toFixed(1)}h
              </p>
              <p className="text-sm text-accent-600">
                {formatCurrency(record.overtime_pay)}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Total Horas</p>
              <p className="text-xl font-bold text-primary-900">
                {record.total_hours.toFixed(1)}h
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Total Ganho</p>
              <p className="text-xl font-bold text-accent-600">
                {formatCurrency(record.total_pay)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseTimeRegistration;
