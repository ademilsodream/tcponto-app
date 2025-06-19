// COMPONENTE PRINCIPAL COMPLETO COM TODAS AS INTEGRAÇÕES
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, LogIn, Coffee, LogOut, Loader2, MapPin } from 'lucide-react';
import { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useEnhancedLocation } from '@/hooks/useEnhancedLocation';
import { GPSStatus } from '@/components/GPSStatus';
import { PushNotificationService } from '@/services/PushNotificationService';
import { validateLocationWithConfidence, clearLocationCache } from '@/utils/enhancedLocationValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';

// Cache para localizações permitidas
const allowedLocationsCache = new Map<string, { data: any; timestamp: number }>();
const LOCATIONS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

// Cache para registros de tempo
const timeRecordsCache = new Map<string, { data: any; timestamp: number }>();
const TIME_RECORDS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

type TimeRecordKey = 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';

interface LocationDetails {
  address: string;
  distance: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  locationName: string;
  gpsAccuracy?: number;
  confidence?: number;
}

interface LocationsData {
  clock_in?: LocationDetails;
  lunch_start?: LocationDetails;
  lunch_end?: LocationDetails;
  clock_out?: LocationDetails;
}

interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  normal_hours?: number;
  overtime_hours?: number;
  normal_pay?: number;
  overtime_pay?: number;
  total_pay?: number;
  locations?: Json | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_pending_approval?: boolean;
  approved_by?: string;
  approved_at?: string;
}

interface AllowedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  is_active: boolean;
}

// Hook de validação de turno (mantendo o existente)
const useWorkShiftValidation = () => {
  const { user } = useOptimizedAuth();
  const [hasShift, setHasShift] = useState<boolean>(false);
  const [canRegisterPoint, setCanRegisterPoint] = useState<boolean>(true);
  const [currentShiftMessage, setCurrentShiftMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadShiftData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // 1. Buscar perfil do usuário
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('shift_id')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.warn('Erro ao buscar perfil:', profileError);
          setHasShift(false);
          setCanRegisterPoint(true);
          setCurrentShiftMessage('Modo livre - sem restrições de horário');
          setLoading(false);
          return;
        }

        // Se não tem shift_id, modo livre
        if (!profileData?.shift_id) {
          console.log('👤 Usuário sem turno - modo livre');
          setHasShift(false);
          setCanRegisterPoint(true);
          setCurrentShiftMessage('Modo livre - sem restrições de horário');
          setLoading(false);
          return;
        }

        // 2. Buscar dados do turno
        const { data: shiftData, error: shiftError } = await supabase
          .from('work_shifts')
          .select('*')
          .eq('id', profileData.shift_id)
          .eq('is_active', true)
          .single();

        if (shiftError) {
          console.warn('Turno não encontrado ou inativo - modo livre');
          setHasShift(false);
          setCanRegisterPoint(true);
          setCurrentShiftMessage('Modo livre - sem restrições de horário');
          setLoading(false);
          return;
        }

        // 3. Buscar horários do turno
        const { data: schedulesData, error: schedulesError } = await supabase
          .from('work_shift_schedules')
          .select('*')
          .eq('shift_id', profileData.shift_id)
          .eq('is_active', true);

        if (schedulesError || !schedulesData?.length) {
          console.warn('Horários não encontrados - modo livre');
          setHasShift(false);
          setCanRegisterPoint(true);
          setCurrentShiftMessage('Modo livre - sem restrições de horário');
          setLoading(false);
          return;
        }

        // 4. Validar janelas de registro
        setHasShift(true);
        
        const now = new Date();
        const dayOfWeek = now.getDay();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const todaySchedule = schedulesData.find((s: any) => s.day_of_week === dayOfWeek);
        
        if (!todaySchedule) {
          setCanRegisterPoint(false);
          setCurrentShiftMessage('Nenhum horário configurado para hoje');
          setLoading(false);
          return;
        }

        // Calcular janelas com tolerância
        const tolerance = shiftData.early_tolerance_minutes || 15;
        const windows = [
          { time: todaySchedule.start_time, type: 'Entrada' },
          { time: todaySchedule.break_start_time, type: 'Início do Almoço' },
          { time: todaySchedule.break_end_time, type: 'Fim do Almoço' },
          { time: todaySchedule.end_time, type: 'Saída' }
        ].filter(w => w.time);

        let inWindow = false;
        let message = '';

        for (const window of windows) {
          const [h, m] = window.time.split(':').map(Number);
          const windowMinutes = h * 60 + m;
          const startWindow = windowMinutes - tolerance;
          const endWindow = windowMinutes + tolerance;
          
          const [ch, cm] = currentTime.split(':').map(Number);
          const currentMinutes = ch * 60 + cm;

          if (currentMinutes >= startWindow && currentMinutes <= endWindow) {
            inWindow = true;
            const startTime = `${String(Math.floor(startWindow / 60)).padStart(2, '0')}:${String(startWindow % 60).padStart(2, '0')}`;
            const endTime = `${String(Math.floor(endWindow / 60)).padStart(2, '0')}:${String(endWindow % 60).padStart(2, '0')}`;
            message = `Janela de ${window.type} ativa (${startTime} - ${endTime})`;
            break;
          }
        }

        setCanRegisterPoint(inWindow);
        setCurrentShiftMessage(inWindow ? message : 'Fora das janelas de registro permitidas');

      } catch (err) {
        console.warn('Erro na validação de turno - modo livre:', err);
        setHasShift(false);
        setCanRegisterPoint(true);
        setCurrentShiftMessage('Modo livre - sem restrições de horário');
      } finally {
        setLoading(false);
      }
    };

    loadShiftData();
    
    // Atualizar a cada minuto
    const interval = setInterval(loadShiftData, 60000);
    return () => clearInterval(interval);
  }, [user]);

  return { canRegisterPoint, currentShiftMessage, loading, hasShift };
};

const COOLDOWN_DURATION_MS = 20 * 60 * 1000;

const formatRemainingTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const OptimizedTimeRegistrationComponent = React.memo(() => {
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editField, setEditField] = useState<TimeRecordKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userProfile, setUserProfile] = useState<{ name?: string } | null>(null);
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  const [remainingCooldown, setRemainingCooldown] = useState<number | null>(null);

  const { user, profile, refreshProfile } = useOptimizedAuth();
  
  // Usar o hook aprimorado de localização
  const { 
    location, 
    loading: locationLoading, 
    error: locationError,
    calibration,
    startCalibration,
    refreshLocation,
    isHighAccuracy,
    isMediumAccuracy,
    isLowAccuracy
  } = useEnhancedLocation();
  
  const { canRegisterPoint, currentShiftMessage, loading: shiftLoading, hasShift } = useWorkShiftValidation();
  const { toast } = useToast();

  // Memoização de valores computados
  const localDate = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const localTime = useMemo(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }, [currentTime]);

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, [currentTime.getHours()]);

  const userDisplayName = useMemo(() => {
    if (userProfile?.name) {
      return userProfile.name.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Usuário';
  }, [userProfile?.name, user?.email]);

  const fieldNames: Record<TimeRecordKey, string> = useMemo(() => ({
    clock_in: 'Entrada',
    lunch_start: 'Início do Almoço',
    lunch_end: 'Fim do Almoço',
    clock_out: 'Saída'
  }), []);

  // Query otimizada para localizações permitidas com cache
  const { data: allowedLocations = [] } = useOptimizedQuery<AllowedLocation[]>({
    queryKey: ['allowed-locations'],
    queryFn: async () => {
      // Verificar cache
      const cachedData = allowedLocationsCache.get('allowed-locations');
      if (cachedData && Date.now() - cachedData.timestamp < LOCATIONS_CACHE_DURATION) {
        return cachedData.data;
      }

      const { data, error } = await supabase
        .from('allowed_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        throw error;
      }

      const formattedData = (data || []).map(location => ({
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        range_meters: Number(location.range_meters)
      }));

      // Atualizar cache
      allowedLocationsCache.set('allowed-locations', {
        data: formattedData,
        timestamp: Date.now()
      });

      return formattedData;
    },
    staleTime: LOCATIONS_CACHE_DURATION,
    refetchInterval: false
  });

  // Query otimizada para perfil do usuário
  const { data: profileData } = useOptimizedQuery<{ name?: string } | null>({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (error && error.code === 'PGRST116') {
        return null;
      }

      return data;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!user
  });

  // Query otimizada para registro do dia com cache
  const {
    data: todayRecord,
    refetch: refetchRecord,
    isLoading: loadingRecord
  } = useOptimizedQuery<TimeRecord | null>({
    queryKey: ['today-record', user?.id, localDate],
    queryFn: async () => {
      if (!user) return null;

      // Verificar cache
      const cacheKey = `${user.id}-${localDate}`;
      const cachedData = timeRecordsCache.get(cacheKey);
      if (cachedData && Date.now() - cachedData.timestamp < TIME_RECORDS_CACHE_DURATION) {
        return cachedData.data;
      }

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', localDate)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (error && error.code === 'PGRST116') {
        return null;
      }

      // Atualizar cache
      timeRecordsCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    },
    staleTime: TIME_RECORDS_CACHE_DURATION,
    enabled: !!user
  });

  // Atualizar estado do perfil
  useEffect(() => {
    if (profileData !== undefined) {
      setUserProfile(profileData);
    }
  }, [profileData]);

  // Atualizar estado do registro com controle de versão
  useEffect(() => {
    if (todayRecord !== undefined) {
      setTimeRecord(prevRecord => {
        if (prevRecord && todayRecord && prevRecord.updated_at && todayRecord.updated_at) {
          const prevTime = new Date(prevRecord.updated_at).getTime();
          const newTime = new Date(todayRecord.updated_at).getTime();
          return newTime > prevTime ? todayRecord : prevRecord;
        }
        return todayRecord;
      });
    }
  }, [todayRecord]);

  // Timer do relógio - atualizado a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Gerenciamento do cooldown
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const updateCooldown = () => {
      const storedCooldown = localStorage.getItem('timeRegistrationCooldown');
      if (storedCooldown) {
        const endTime = Number(storedCooldown);
        const now = Date.now();
        
        if (endTime > now) {
          setCooldownEndTime(endTime);
          setRemainingCooldown(endTime - now);
        } else {
          localStorage.removeItem('timeRegistrationCooldown');
          setCooldownEndTime(null);
          setRemainingCooldown(null);
        }
      } else {
        setCooldownEndTime(null);
        setRemainingCooldown(null);
      }
    };

    // Verificar imediatamente
    updateCooldown();

    // Atualizar a cada segundo
    intervalId = setInterval(updateCooldown, 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Função para validar localização corrigida
  const validateLocationRequest = useCallback(async (
    action: string,
    onSuccess: (locationValidationResult: any) => void,
    onError: (message: string) => void
  ) => {
    if (!allowedLocations || allowedLocations.length === 0) {
      onError('Nenhuma localização permitida configurada');
      return;
    }

    try {
      // Usar a nova função de validação com confiança
      const locationValidation = await validateLocationWithConfidence(
        allowedLocations,
        location,
        {
          minAccuracy: isLowAccuracy ? 100 : 50,
          requireCalibration: isLowAccuracy
        }
      );

      if (!locationValidation.valid) {
        onError(locationValidation.message);
        return;
      }

      onSuccess(locationValidation);

    } catch (error: any) {
      onError(error.message || 'Erro ao validar localização');
    }
  }, [allowedLocations, location, isLowAccuracy]);

  // Função principal de registro com validação de GPS aprimorada
  const handleTimeAction = useCallback(async (action: TimeRecordKey) => {
    if (!user || submitting) return;

    // Verificação de ponto já registrado (apenas se tem turno)
    if (hasShift && timeRecord?.[action]) {
      toast({
        title: "Já registrado",
        description: `${fieldNames[action]} já foi registrado hoje`,
        variant: "destructive"
      });
      return;
    }

    // Verificação de turno (apenas se tem turno vinculado)
    if (hasShift && !canRegisterPoint) {
      toast({
        title: "Horário não permitido",
        description: "O registro de ponto está restrito aos horários do seu turno de trabalho",
        variant: "destructive"
      });
      return;
    }

    // Verificação de cooldown
    if (cooldownEndTime && cooldownEndTime > Date.now()) {
      toast({
        title: "Aguarde",
        description: `Você só pode registrar o próximo ponto após ${formatRemainingTime(cooldownEndTime - Date.now())}.`,
        variant: "default"
      });
      return;
    }

    // Nova verificação de precisão do GPS
    if (location && location.accuracy > 100) {
      const shouldProceed = await new Promise<boolean>((resolve) => {
        toast({
          title: "Precisão GPS baixa",
          description: `Precisão atual: ${location.accuracy.toFixed(1)}m. Deseja calibrar antes de registrar?`,
          action: (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  // Fechar o toast
                  resolve(true);
                }}
              >
                Continuar assim
              </Button>
              <Button 
                size="sm" 
                onClick={() => {
                  startCalibration();
                  resolve(false);
                }}
              >
                Calibrar GPS
              </Button>
            </div>
          ),
          duration: 10000 // 10 segundos para decidir
        });
      });

      if (!shouldProceed) return;
    }

    setSubmitting(true);

    // Validação de localização
    if (allowedLocations.length > 0) {
      await validateLocationRequest(
        action,
        async (locationValidationResult) => {
          await processTimeRegistration(action, locationValidationResult);
        },
        (message) => {
          toast({
            title: "Localização não autorizada",
            description: message,
            variant: "destructive"
          });
          setSubmitting(false);
        }
      );
    } else {
      if (!location) {
        toast({
          title: "Erro",
          description: "Localização não encontrada.",
          variant: "destructive"
        });
        setSubmitting(false);
        return;
      }

      const simpleLocationResult = {
        valid: true,
        location: location,
        message: "Localização validada",
        closestLocation: {
          name: "Localização Atual",
          address: "Endereço não disponível",
          id: "current",
          latitude: location.latitude,
          longitude: location.longitude,
          range_meters: 100,
          is_active: true
        },
        distance: 0,
        gpsAccuracy: location.accuracy,
        confidence: 100
      };

      await processTimeRegistration(action, simpleLocationResult);
    }

  }, [user, submitting, timeRecord, localDate, allowedLocations, validateLocationRequest, location, canRegisterPoint, hasShift, cooldownEndTime, toast, fieldNames, isLowAccuracy, startCalibration]);

  // Função para processar registro com dados aprimorados
  const processTimeRegistration = async (action: TimeRecordKey, locationValidationResult: any) => {
    try {
      const now = new Date();
      
      // Determinar qual horário usar
      let currentTimeString: string;
      
      if (hasShift) {
        // Modo turno: usar horário oficial (seria necessário implementar a lógica de obter horário oficial)
        currentTimeString = format(now, 'HH:mm:ss');
        console.log('📝 Modo TURNO - registrando horário atual (implementar horário oficial):', currentTimeString);
      } else {
        // Modo livre: usar horário atual
        currentTimeString = format(now, 'HH:mm:ss');
        console.log('📝 Modo LIVRE - registrando horário atual:', currentTimeString);
      }
      
      const currentDateString = localDate;

      // Dados de localização aprimorados
      const locationData: LocationDetails = {
        address: locationValidationResult.closestLocation?.address || 'Endereço não disponível',
        distance: locationValidationResult.distance || 0,
        latitude: locationValidationResult.location?.latitude || 0,
        longitude: locationValidationResult.location?.longitude || 0,
        timestamp: now.toISOString(),
        locationName: locationValidationResult.closestLocation?.name || 'Localização Desconhecida',
        gpsAccuracy: locationValidationResult.gpsAccuracy,
        confidence: locationValidationResult.confidence
      };

      const locationsJson = timeRecord?.locations ? { ...timeRecord.locations as LocationsData } : {};
      locationsJson[action] = locationData;

      // Dados para upsert
      const upsertData = {
        user_id: user!.id,
        date: currentDateString,
        [action]: currentTimeString,
        locations: locationsJson as Json,
      };

      const { data: updatedRecord, error: updateError } = await supabase
        .from('time_records')
        .upsert(upsertData, { onConflict: 'date, user_id' })
        .select('*')
        .single();

      if (updateError) {
        throw new Error(`Erro ao salvar registro: ${updateError.message}`);
      }

      // Atualizar estado local
      setTimeRecord(updatedRecord);

      // Cooldown
      const newCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
      setCooldownEndTime(newCooldownEndTime);
      setRemainingCooldown(COOLDOWN_DURATION_MS);
      localStorage.setItem('timeRegistrationCooldown', newCooldownEndTime.toString());

      // Push notification
      try {
        const pushService = PushNotificationService.getInstance();
        await pushService.sendNotification({
          userId: user!.id,
          title: 'Ponto Registrado',
          body: `${fieldNames[action]} registrado às ${currentTimeString.slice(0, 5)}`
        });
      } catch (pushError) {
        console.warn('Erro ao enviar notificação push:', pushError);
      }

      // Limpar cache de localização
      clearLocationCache();

      toast({
        title: "Sucesso",
        description: `${fieldNames[action]} registrado em ${currentTimeString.slice(0, 5)}!`,
      });

      // Atualizar profile
      await refreshProfile();

      // Refetch em background
      setTimeout(() => {
        refetchRecord();
      }, 1000);

    } catch (error: any) {
      console.error('Erro capturado no fluxo de registro:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao registrar horário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = useCallback(async () => {
    if (!user || !editField || !editValue || !editReason) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('edit_requests')
        .insert({
          employee_id: user.id,
          employee_name: userProfile?.name || user.email || 'Usuário',
          date: localDate,
          field: editField,
          old_value: timeRecord?.[editField] || null,
          new_value: editValue,
          reason: editReason,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Solicitação de alteração enviada para aprovação",
      });

      setIsEditDialogOpen(false);
      setEditField(null);
      setEditValue('');
      setEditReason('');

    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar solicitação de alteração",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  }, [user, userProfile?.name, editField, editValue, editReason, timeRecord, localDate, toast]);

  // Verificação de mudança de data
  useEffect(() => {
    const checkDateChange = () => {
      const currentDate = localDate;
      const recordDate = timeRecord?.date;

      if (recordDate && recordDate !== currentDate) {
        setTimeRecord(null);
        refetchRecord();
      }
    };

    const interval = setInterval(checkDateChange, 60000);
    return () => clearInterval(interval);
  }, [timeRecord?.date, localDate, refetchRecord]);

  // Layout e componentes visuais
  const steps = useMemo(() => [
    { key: 'clock_in' as TimeRecordKey, label: 'Entrada', icon: LogIn, color: 'bg-green-500' },
    { key: 'lunch_start' as TimeRecordKey, label: 'Início Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'lunch_end' as TimeRecordKey, label: 'Volta Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'clock_out' as TimeRecordKey, label: 'Saída', icon: LogOut, color: 'bg-red-500' },
  ], []);

  const getValue = useCallback((key: TimeRecordKey) => {
    return timeRecord?.[key];
  }, [timeRecord]);

  const completedCount = useMemo(() => {
    return steps.filter(step => getValue(step.key)).length;
  }, [steps, getValue]);

  const nextAction = useMemo<TimeRecordKey | null>(() => {
    if (!timeRecord?.clock_in) return 'clock_in';
    if (!timeRecord?.lunch_start) return 'lunch_start';
    if (!timeRecord?.lunch_end) return 'lunch_end';
    if (!timeRecord?.clock_out) return 'clock_out';
    return null;
  }, [timeRecord]);

  const isRegistrationButtonDisabled = useMemo(() => {
    return submitting || 
           (cooldownEndTime !== null && cooldownEndTime > Date.now()) ||
           shiftLoading ||
           (hasShift && !canRegisterPoint) ||
           locationLoading ||
           calibration.isCalibrating;
  }, [submitting, cooldownEndTime, shiftLoading, hasShift, canRegisterPoint, locationLoading, calibration.isCalibrating]);

  const isInCooldown = useMemo(() => {
    return cooldownEndTime !== null && remainingCooldown !== null && remainingCooldown > 0;
  }, [cooldownEndTime, remainingCooldown]);

  // Tratamento de erros
  if (locationError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <MapPin className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Erro de Localização</h3>
            <p className="text-gray-600 mb-4">
              Erro ao obter localização. Verifique as permissões do navegador.
            </p>
            <Button onClick={() => window.location.reload()}>
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingRecord) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  // Layout principal
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8">
      <div className="w-full max-w-md mb-6 pl-20 sm:pl-16">
      </div>

      <div className="text-center mb-4">
        <div className="text-blue-600 text-xl sm:text-2xl font-semibold mb-1">
          {greeting}, {userDisplayName}! 👋
        </div>
        <div className="text-gray-500 text-sm sm:text-base">
          Pronto para registrar seu ponto?
        </div>
        {/* Mensagem do turno */}
        {currentShiftMessage && (
          <div className="text-xs text-blue-600 mt-1 bg-blue-50 p-2 rounded">
            {currentShiftMessage}
          </div>
        )}
      </div>

      <div className="text-center mb-6">
        <div className="text-gray-600 text-base sm:text-lg mb-2">
          {format(currentTime, "EEEE, dd 'de' MMMM")}
        </div>
        <div className="text-gray-900 text-4xl sm:text-6xl font-bold tracking-wider mb-4">
          {format(currentTime, 'HH:mm:ss')}
        </div>
      </div>

      {/* Componente de Status GPS */}
      <GPSStatus
        location={location}
        calibration={calibration}
        onCalibrate={startCalibration}
        onRefresh={refreshLocation}
        isHighAccuracy={isHighAccuracy}
        isMediumAccuracy={isMediumAccuracy}
        isLowAccuracy={isLowAccuracy}
      />

      <Card className="w-full max-w-md bg-white shadow-lg">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = !!getValue(step.key);
                const isNext = !isCompleted && completedCount === index;

                return (
                  <div key={step.key} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 transition-all ${
                        isCompleted
                          ? `${step.color} text-white`
                          : isNext
                            ? 'bg-blue-100 border-2 border-blue-600 text-blue-600'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className={`text-xs text-center ${
                      isCompleted ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                    {isCompleted && (
                      <span className="text-xs text-blue-600 mt-1 font-medium">
                        {getValue(step.key)}
                      </span>
                    )}
                    {isCompleted && (
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs text-blue-500 hover:text-blue-700 p-0 h-auto"
                        onClick={() => {
                          setEditField(step.key);
                          setEditValue(getValue(step.key) || '');
                          setEditReason('');
                          setIsEditDialogOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(completedCount / 4) * 100}%`,
                  background: completedCount > 0 ? 'linear-gradient(to right, #22c55e, #f97316, #f97316, #ef4444)' : '#3b82f6'
                }}
              />
            </div>
          </div>

          {/* Estado de carregamento */}
          {(locationLoading || calibration.isCalibrating) && (
            <div className="text-center py-4 text-blue-600">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <div className="text-sm">
                {calibration.isCalibrating ? 'Calibrando GPS...' : 'Obtendo localização...'}
              </div>
            </div>
          )}

          {nextAction && !locationLoading && !calibration.isCalibrating && (
            <>
              <Button
                onClick={() => handleTimeAction(nextAction)}
                disabled={isRegistrationButtonDisabled}
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-[#10C6B4] hover:bg-[#10C6B4]/90 text-white touch-manipulation disabled:bg-gray-400"
              >
                <Clock className="w-5 h-5 mr-2" />
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (hasShift && !canRegisterPoint) ? (
                  'Fora do horário permitido'
                ) : isInCooldown ? (
                  'Aguarde...'
                ) : (
                  'Registrar'
                )}
              </Button>
              
              {/* Contador de cooldown */}
              {isInCooldown && (
                <div className="text-center text-sm mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-yellow-800 font-medium mb-1">
                    ⏱️ Aguarde para o próximo registro
                  </div>
                  <div className="text-yellow-700">
                    Disponível em: <span className="font-mono font-bold">{formatRemainingTime(remainingCooldown!)}</span>
                  </div>
                </div>
              )}

              {/* Mensagem de turno restrito */}
              {hasShift && !canRegisterPoint && !shiftLoading && (
                <div className="text-center text-sm mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-800 font-medium mb-1">
                    🚫 Registro restrito
                  </div>
                  <div className="text-red-700 text-xs">
                    O registro de ponto está limitado aos horários do seu turno de trabalho
                  </div>
                </div>
              )}
            </>
          )}

          {!nextAction && (
            <div className="text-center py-4">
              <div className="text-green-600 font-semibold mb-2">
                ✅ Todos os registros concluídos!
              </div>
              <div className="text-sm text-gray-500">
                Tenha um ótimo resto do dia, {userDisplayName}!
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Solicitar Alteração - {editField ? fieldNames[editField] : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-value">Novo Horário</Label>
              <Input
                id="edit-value"
                type="time"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-reason">Motivo da Alteração *</Label>
              <Textarea
                id="edit-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Descreva o motivo da solicitação de alteração..."
                required
                disabled={submitting}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEditSubmit}
                disabled={submitting || !editValue || !editReason}
              >
                {submitting ? 'Enviando...' : 'Enviar Solicitação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

OptimizedTimeRegistrationComponent.displayName = 'OptimizedTimeRegistration';

export default OptimizedTimeRegistrationComponent;
