import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, MapPin } from 'lucide-react';
import { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useEnhancedLocation } from '@/hooks/useEnhancedLocation';
import { GPSStatus } from '@/components/GPSStatus';
import { PushNotificationService } from '@/services/PushNotificationService';
import { AdvancedLocationControls } from './AdvancedLocationControls';
import { useAdvancedLocationSystem } from '@/hooks/useAdvancedLocationSystem';
import { format } from 'date-fns';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { AllowedLocation } from '@/types/index';
import { TimeDisplay } from './TimeDisplay';
import { TimeRegistrationProgress } from './TimeRegistrationProgress';
import { EditRequestDialog } from './EditRequestDialog';
import { useWorkShiftValidation } from '../hooks/useWorkShiftValidation';
import { 
  COOLDOWN_DURATION_MS, 
  formatRemainingTime,
  allowedLocationsCache,
  LOCATIONS_CACHE_DURATION,
  timeRecordsCache,
  TIME_RECORDS_CACHE_DURATION
} from '../utils/timeRegistrationUtils';
import { TimeRecord, TimeRecordKey, LocationDetails, LocationsData } from '../types/timeRegistration';

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

  const { user, refreshProfile } = useOptimizedAuth();
  
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

  // Query otimizada para localizações permitidas com cache
  const { data: allowedLocations = [] } = useOptimizedQuery<AllowedLocation[]>({
    queryKey: ['allowed-locations'],
    queryFn: async () => {
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

    updateCooldown();
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
      const { AdvancedLocationSystem } = await import('@/utils/advancedLocationSystem');
      const locationValidation = await AdvancedLocationSystem.validateLocation(
        allowedLocations,
        isLowAccuracy ? 0.5 : 0.7
      );

      if (!locationValidation.valid) {
        onError(locationValidation.message);
        return;
      }

      onSuccess(locationValidation);

    } catch (error: any) {
      onError(error.message || 'Erro ao validar localização');
    }
  }, [allowedLocations, isLowAccuracy]);

  // Função principal de registro com validação de GPS aprimorada
  const handleTimeAction = useCallback(async (action: TimeRecordKey) => {
    if (!user || submitting) return;

    if (hasShift && timeRecord?.[action]) {
      toast({
        title: "Já registrado",
        description: `${action === 'clock_in' ? 'Entrada' : action === 'lunch_start' ? 'Início do Almoço' : action === 'lunch_end' ? 'Fim do Almoço' : 'Saída'} já foi registrado hoje`,
        variant: "destructive"
      });
      return;
    }

    if (hasShift && !canRegisterPoint) {
      toast({
        title: "Horário não permitido",
        description: "O registro de ponto está restrito aos horários do seu turno de trabalho",
        variant: "destructive"
      });
      return;
    }

    if (cooldownEndTime && cooldownEndTime > Date.now()) {
      toast({
        title: "Aguarde",
        description: `Você só pode registrar o próximo ponto após ${formatRemainingTime(cooldownEndTime - Date.now())}.`,
        variant: "default"
      });
      return;
    }

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
                onClick={() => resolve(true)}
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
          duration: 10000
        });
      });

      if (!shouldProceed) return;
    }

    setSubmitting(true);

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

  }, [user, submitting, timeRecord, allowedLocations, validateLocationRequest, location, canRegisterPoint, hasShift, cooldownEndTime, toast, isLowAccuracy, startCalibration]);

  // Função para processar registro com dados aprimorados
  const processTimeRegistration = async (action: TimeRecordKey, locationValidationResult: any) => {
    try {
      const now = new Date();
      
      let currentTimeString: string;
      
      if (hasShift) {
        currentTimeString = format(now, 'HH:mm:ss');
        console.log('📝 Modo TURNO - registrando horário atual (implementar horário oficial):', currentTimeString);
      } else {
        currentTimeString = format(now, 'HH:mm:ss');
        console.log('📝 Modo LIVRE - registrando horário atual:', currentTimeString);
      }
      
      const currentDateString = localDate;

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

      setTimeRecord(updatedRecord);

      const newCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
      setCooldownEndTime(newCooldownEndTime);
      setRemainingCooldown(COOLDOWN_DURATION_MS);
      localStorage.setItem('timeRegistrationCooldown', newCooldownEndTime.toString());

      try {
        const pushService = PushNotificationService.getInstance();
        await pushService.sendNotification({
          userId: user!.id,
          title: 'Ponto Registrado',
          body: `${action === 'clock_in' ? 'Entrada' : action === 'lunch_start' ? 'Início do Almoço' : action === 'lunch_end' ? 'Fim do Almoço' : 'Saída'} registrado às ${currentTimeString.slice(0, 5)}`
        });
      } catch (pushError) {
        console.warn('Erro ao enviar notificação push:', pushError);
      }

      const { AdvancedLocationSystem } = await import('@/utils/advancedLocationSystem');
      AdvancedLocationSystem.resetForNewRegistration();

      toast({
        title: "Sucesso",
        description: `${action === 'clock_in' ? 'Entrada' : action === 'lunch_start' ? 'Início do Almoço' : action === 'lunch_end' ? 'Fim do Almoço' : 'Saída'} registrado em ${currentTimeString.slice(0, 5)}!`,
      });

      await refreshProfile();

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

  const handleEditRequest = (field: TimeRecordKey, value: string) => {
    setEditField(field);
    setEditValue(value);
    setEditReason('');
    setIsEditDialogOpen(true);
  };

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

      <TimeDisplay
        currentTime={currentTime}
        greeting={greeting}
        userDisplayName={userDisplayName}
        currentShiftMessage={currentShiftMessage}
      />

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
          <TimeRegistrationProgress
            timeRecord={timeRecord}
            onEditRequest={handleEditRequest}
          />

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

      <EditRequestDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        editField={editField}
        editValue={editValue}
        editReason={editReason}
        submitting={submitting}
        onValueChange={setEditValue}
        onReasonChange={setEditReason}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
});

OptimizedTimeRegistrationComponent.displayName = 'OptimizedTimeRegistration';

export default OptimizedTimeRegistrationComponent;
