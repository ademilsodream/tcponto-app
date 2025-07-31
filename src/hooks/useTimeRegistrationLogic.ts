import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useWorkShiftValidation } from '@/hooks/useWorkShiftValidation';
import { validateLocationForTimeRecord } from '@/utils/locationValidation';
import { reverseGeocode } from '@/utils/geocoding';

import { AdvancedLocationSystem } from '@/utils/advancedLocationSystem';
import { useAdvancedLocationSystem } from './useAdvancedLocationSystem';

interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  locations?: any;
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

const COOLDOWN_DURATION_MS = 20 * 60 * 1000;

// Cache para geocodificação (evita chamadas repetidas)
const geocodeCache = new Map<string, string>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

// Função otimizada para obter posição atual do GPS
const getCurrentPosition = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation não é suportado pelo navegador'));
      return;
    }

    // Timeout mais agressivo para resposta rápida
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout ao obter localização GPS'));
    }, 8000); // Reduzido de 10s para 8s

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 100
        });
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 7000, // Reduzido para resposta mais rápida
        maximumAge: 30000 // 30 segundos - mais permissivo
      }
    );
  });
};

// Função otimizada para geocodificação com cache
const getCachedGeocode = async (latitude: number, longitude: number): Promise<string> => {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const now = Date.now();
  
  // Verificar cache
  const cached = geocodeCache.get(key);
  if (cached) {
    const [address, timestamp] = cached.split('|');
    if (now - parseInt(timestamp) < CACHE_DURATION) {
      console.log('📍 Usando endereço em cache:', address);
      return address;
    }
  }

  try {
    // Timeout para geocodificação
    const geocodePromise = reverseGeocode(latitude, longitude);
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Geocodificação timeout')), 3000);
    });

    const result = await Promise.race([geocodePromise, timeoutPromise]) as any;
    const address = result.address || `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
    
    // Salvar no cache
    geocodeCache.set(key, `${address}|${now}`);
    
    // Limpar cache antigo (manter apenas últimos 50)
    if (geocodeCache.size > 50) {
      const entries = Array.from(geocodeCache.entries());
      entries.sort((a, b) => parseInt(b[1].split('|')[1]) - parseInt(a[1].split('|')[1]));
      geocodeCache.clear();
      entries.slice(0, 50).forEach(([key, value]) => geocodeCache.set(key, value));
    }
    
    return address;
  } catch (error) {
    console.warn('⚠️ Erro na geocodificação, usando coordenadas:', error);
    const fallbackAddress = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
    geocodeCache.set(key, `${fallbackAddress}|${now}`);
    return fallbackAddress;
  }
};

export const useTimeRegistrationLogic = () => {
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [editField, setEditField] = useState<'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  const [remainingCooldown, setRemainingCooldown] = useState<number | null>(null);

  const { user, hasAccess, profile } = useOptimizedAuth();
  const { toast } = useToast();
  const shiftValidation = useWorkShiftValidation();
  
  // Sistema avançado de localização
  const advancedLocationSystem = useAdvancedLocationSystem(allowedLocations);

  const fieldNames = {
    clock_in: 'Entrada',
    lunch_start: 'Início do Almoço',
    lunch_end: 'Fim do Almoço',
    clock_out: 'Saída'
  };

  const steps = [
    { key: 'clock_in', label: 'Entrada', color: 'bg-green-500' },
    { key: 'lunch_start', label: 'Início Almoço', color: 'bg-orange-500' },
    { key: 'lunch_end', label: 'Volta Almoço', color: 'bg-orange-500' },
    { key: 'clock_out', label: 'Saída', color: 'bg-red-500' },
  ];

  useEffect(() => {
    if (!hasAccess) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para registrar ponto.",
        variant: "destructive"
      });
      return;
    }
  }, [hasAccess, toast]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const storedCooldown = localStorage.getItem('timeRegistrationCooldown');
    if (storedCooldown) {
      const endTime = Number(storedCooldown);
      if (endTime > Date.now()) {
        setCooldownEndTime(endTime);
        setRemainingCooldown(endTime - Date.now());

        timeoutId = setTimeout(() => {
          setCooldownEndTime(null);
          setRemainingCooldown(null);
          localStorage.removeItem('timeRegistrationCooldown');
          toast({
            title: "Pronto!",
            description: "Você já pode registrar o próximo ponto.",
          });
        }, endTime - Date.now());

        intervalId = setInterval(() => {
          setRemainingCooldown(Math.max(0, endTime - Date.now()));
        }, 1000);

      } else {
        localStorage.removeItem('timeRegistrationCooldown');
        setCooldownEndTime(null);
        setRemainingCooldown(null);
      }
    } else {
      setCooldownEndTime(null);
      setRemainingCooldown(null);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [toast]);

  useEffect(() => {
    if (user && hasAccess) {
      initializeData();
    }
  }, [user, hasAccess]);

  const initializeData = async () => {
    try {
      setLoading(true);
      await loadAllowedLocations();
      await loadTodayRecord();
    } catch (error) {
      console.error('Erro ao inicializar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados iniciais",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllowedLocations = async () => {
    try {
      console.log('📍 CARREGANDO LOCALIZAÇÕES PERMITIDAS...');
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const processedLocations = (data || []).map(location => ({
        id: location.id,
        name: location.name,
        address: location.address,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        range_meters: Number(location.range_meters),
        is_active: location.is_active
      }));

      setAllowedLocations(processedLocations);

      if (!processedLocations || processedLocations.length === 0) {
        console.warn('⚠️ Nenhuma localização permitida encontrada no banco de dados');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar localizações permitidas:', error);
      toast({
        title: "Erro",
        description: "Nenhuma localização permitida configurada. Entre em contato com o RH.",
        variant: "destructive"
      });
    }
  };

  const loadTodayRecord = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setTimeRecord(data);
    } catch (error) {
      console.error('Erro ao carregar registro:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar registro do dia",
        variant: "destructive"
      });
    }
  };

  const handleTimeAction = async (action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    if (!user || !hasAccess) return;

    if (cooldownEndTime && cooldownEndTime > Date.now()) {
        toast({
            title: "Aguarde",
            description: "Você só pode registrar o próximo ponto após o período de espera.",
            variant: "default"
        });
        return;
    }

    if (!shiftValidation.allowedButtons[action]) {
      toast({
        title: "Fora do Horário",
        description: shiftValidation.currentShiftMessage || "Este registro não está disponível no momento.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      
      // Logs otimizados
      const isRemoteWorker = profile?.use_location_tracking === false;
      console.log(`🕐 INICIANDO REGISTRO DE ${action.toUpperCase()}...`, {
        user: user.email,
        isRemote: isRemoteWorker,
        action
      });

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

      let updateData: any = {
        [action]: currentTime,
        updated_at: new Date().toISOString()
      };

      // 🔄 LÓGICA OTIMIZADA: Processamento paralelo quando possível
      if (isRemoteWorker) {
        // 🏠 MODO REMOTO OTIMIZADO
        console.log('🏠 FUNCIONÁRIO REMOTO - capturando GPS...');
        
        try {
          // Capturar GPS e geocodificar em paralelo
          const [currentPosition, geocodeResult] = await Promise.allSettled([
            getCurrentPosition(),
            getCurrentPosition().then(pos => getCachedGeocode(pos.latitude, pos.longitude))
          ]);

          if (currentPosition.status === 'rejected') {
            throw currentPosition.reason;
          }

          const position = currentPosition.value;
          const address = geocodeResult.status === 'fulfilled' ? geocodeResult.value : 
            `Lat: ${position.latitude.toFixed(6)}, Lng: ${position.longitude.toFixed(6)}`;

          console.log('📍 GPS capturado rapidamente:', { 
            lat: position.latitude, 
            lng: position.longitude, 
            accuracy: position.accuracy 
          });
          
          const locationData = {
            [action]: {
              latitude: position.latitude,
              longitude: position.longitude,
              timestamp: now.toISOString(),
              address: address,
              locationName: 'Remoto',
              distance: 0,
              locationChanged: false,
              isRemoteWork: true,
              gpsAccuracy: position.accuracy,
              geocoded: geocodeResult.status === 'fulfilled'
            }
          };

          if (timeRecord?.locations) {
            updateData.locations = { ...timeRecord.locations, ...locationData };
          } else {
            updateData.locations = locationData;
          }

          console.log('✅ Dados remotos preparados rapidamente');
          
        } catch (error) {
          console.error('❌ Erro ao capturar GPS:', error);
          
          // Fallback: continuar sem localização para funcionários remotos
          const locationData = {
            [action]: {
              latitude: 0,
              longitude: 0,
              timestamp: now.toISOString(),
              address: 'Localização não disponível',
              locationName: 'Remoto',
              distance: 0,
              locationChanged: false,
              isRemoteWork: true,
              gpsAccuracy: 0,
              error: 'GPS não disponível'
            }
          };

          if (timeRecord?.locations) {
            updateData.locations = { ...timeRecord.locations, ...locationData };
          } else {
            updateData.locations = locationData;
          }
          
          console.log('⚠️ Continuando sem GPS para funcionário remoto');
        }
        
      } else {
        // 🏢 MODO VALIDAÇÃO OTIMIZADO
        console.log('🏢 FUNCIONÁRIO COM VALIDAÇÃO - verificando localização...');
        
        if (!allowedLocations || allowedLocations.length === 0) {
          console.error('❌ Nenhuma localização permitida carregada');
          toast({
            title: "Erro de Configuração",
            description: "Nenhuma localização permitida configurada. Entre em contato com o RH.",
            variant: "destructive"
          });
          return;
        }

        console.log(`🏢 Validando contra ${allowedLocations.length} localizações...`);

        // Converter localizações uma vez só
        const fullAllowedLocations = allowedLocations.map(loc => ({
          ...loc,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        // Validação com timeout
        const validationPromise = AdvancedLocationSystem.validateLocation(fullAllowedLocations, 0.7);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout na validação de localização')), 10000);
        });

        const locationValidation = await Promise.race([validationPromise, timeoutPromise]) as any;

        if (!locationValidation.valid) {
          console.error('❌ Localização não autorizada:', locationValidation.message);
          
          let errorMessage = locationValidation.message;
          if (locationValidation.locationChanged) {
            errorMessage += '\n\nTente calibrar o GPS ou entre em contato com o RH se continuar com problemas.';
          }
          
          toast({
            title: "Localização não autorizada",
            description: errorMessage,
            variant: "destructive"
          });
          return;
        }

        // Notificar sobre mudança de local se detectada
        if (locationValidation.locationChanged) {
          console.log('📍 Mudança de local detectada:', locationValidation.message);
          toast({
            title: "Local Alterado",
            description: locationValidation.message,
            duration: 3000 // Reduzido para 3s
          });
        }

        console.log('✅ Localização validada rapidamente');

        if (locationValidation.location) {
          const locationData = {
            [action]: {
              latitude: locationValidation.location.latitude,
              longitude: locationValidation.location.longitude,
              timestamp: now.toISOString(),
              address: locationValidation.closestLocation?.address || 'Localização autorizada',
              locationName: locationValidation.closestLocation?.name || 'Local permitido',
              distance: Math.round(locationValidation.distance || 0),
              locationChanged: locationValidation.locationChanged || false,
              previousLocation: locationValidation.previousLocation,
              validated: true
            }
          };

          if (timeRecord?.locations) {
            updateData.locations = { ...timeRecord.locations, ...locationData };
          } else {
            updateData.locations = locationData;
          }
        }
      }

      // 💾 SALVAMENTO OTIMIZADO
      console.log('💾 Salvando registro no banco...');
      
      if (timeRecord) {
        const { error } = await supabase
          .from('time_records')
          .update(updateData)
          .eq('id', timeRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: today,
            ...updateData
          });

        if (error) throw error;
      }

      // Reset sistema apenas se necessário
      if (!isRemoteWorker) {
        AdvancedLocationSystem.resetForNewRegistration();
      }

      // Recarregar dados em background
      loadTodayRecord().catch(console.error);

      const actionNames = {
        clock_in: 'Entrada',
        lunch_start: 'Início do Almoço',
        lunch_end: 'Fim do Almoço',
        clock_out: 'Saída'
      };

      let successMessage = `${actionNames[action]} registrada às ${currentTime}`;
      if (isRemoteWorker) {
        successMessage += ' (Remoto)';
      }

      toast({
        title: "Sucesso",
        description: successMessage,
        duration: 2000 // Reduzido para 2s
      });

      const newCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
      setCooldownEndTime(newCooldownEndTime);
      localStorage.setItem('timeRegistrationCooldown', newCooldownEndTime.toString());

    } catch (error) {
      console.error('❌ Erro ao registrar:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar horário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
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

      const locationValidation = await validateLocationForTimeRecord(allowedLocations);

      let locationData = null;
      if (locationValidation.location) {
        locationData = {
          latitude: locationValidation.location.latitude,
          longitude: locationValidation.location.longitude,
          timestamp: new Date().toISOString(),
          address: locationValidation.closestLocation?.address || 'Localização no momento da solicitação',
          locationName: locationValidation.closestLocation?.name || 'Local da solicitação',
          distance: locationValidation.distance || 0
        };
      }

      const { error } = await supabase
        .from('edit_requests')
        .insert({
          employee_id: user.id,
          employee_name: user.email || 'Usuário',
          date: new Date().toISOString().split('T')[0],
          field: editField,
          old_value: timeRecord?.[editField] || null,
          new_value: editValue,
          reason: editReason,
          location: locationData,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Solicitação de alteração enviada para aprovação",
      });

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
  };

  const formatRemainingTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getValue = (key: string) => {
    return timeRecord?.[key as keyof TimeRecord];
  };

  const completedCount = steps.filter(step => !!getValue(step.key)).length;

  const getNextAction = () => {
    if (!timeRecord?.clock_in) return 'clock_in';
    if (!timeRecord?.lunch_start) return 'lunch_start';
    if (!timeRecord?.lunch_end) return 'lunch_end';
    if (!timeRecord?.clock_out) return 'clock_out';
    return null;
  };

  const nextAction = getNextAction();

  const isRegistrationButtonDisabled = submitting || 
    (cooldownEndTime !== null && cooldownEndTime > Date.now()) ||
    (nextAction && !shiftValidation.allowedButtons[nextAction as keyof typeof shiftValidation.allowedButtons]);

  return {
    timeRecord,
    loading,
    submitting,
    editField,
    editValue,
    editReason,
    cooldownEndTime,
    remainingCooldown,
    shiftValidation,
    fieldNames,
    steps,
    getValue,
    completedCount,
    nextAction,
    isRegistrationButtonDisabled,
    hasAccess,
    handleTimeAction,
    handleEditSubmit,
    formatRemainingTime,
    setEditField,
    setEditValue,
    setEditReason,
    advancedLocationSystem
  };
};
