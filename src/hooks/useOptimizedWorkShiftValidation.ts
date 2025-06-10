
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

interface WorkShiftValidation {
  isWithinShiftTime: boolean;
  canRegisterPoint: boolean;
  nextAllowedTime: Date | null;
  currentShiftMessage: string;
}

const SETTINGS_CACHE_KEY = 'optimized_work_shifts_settings';
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

export const useOptimizedWorkShiftValidation = () => {
  const { profile } = useOptimizedAuth();
  const [validation, setValidation] = useState<WorkShiftValidation>({
    isWithinShiftTime: true,
    canRegisterPoint: true,
    nextAllowedTime: null,
    currentShiftMessage: ''
  });
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const checkShiftValidation = useCallback(async () => {
    if (!profile || !mountedRef.current) return;

    try {
      setLoading(true);

      // Cache otimizado
      const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
      const cacheExpiry = sessionStorage.getItem(`${SETTINGS_CACHE_KEY}_expiry`);
      
      let enableWorkShifts = false;
      let toleranceMinutes = 15;

      if (cached && cacheExpiry && Date.now() < parseInt(cacheExpiry)) {
        const cachedData = JSON.parse(cached);
        enableWorkShifts = cachedData.enableWorkShifts;
        toleranceMinutes = cachedData.toleranceMinutes;
      } else {
        const { data: settingsData } = await supabase
          .from('system_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['enable_work_shifts', 'work_shift_tolerance_minutes']);

        enableWorkShifts = settingsData?.find(s => s.setting_key === 'enable_work_shifts')?.setting_value === 'true';
        toleranceMinutes = parseInt(settingsData?.find(s => s.setting_key === 'work_shift_tolerance_minutes')?.setting_value || '15');
        
        // Cache reduzido
        sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ enableWorkShifts, toleranceMinutes }));
        sessionStorage.setItem(`${SETTINGS_CACHE_KEY}_expiry`, (Date.now() + CACHE_DURATION).toString());
      }

      if (!enableWorkShifts || !profile.shift_id) {
        if (mountedRef.current) {
          setValidation({
            isWithinShiftTime: true,
            canRegisterPoint: true,
            nextAllowedTime: null,
            currentShiftMessage: !enableWorkShifts ? '' : 'Sem turno definido - registro liberado'
          });
        }
        return;
      }

      const now = new Date();
      const dayOfWeek = now.getDay();

      const { data: scheduleData } = await supabase
        .from('work_shift_schedules')
        .select('*')
        .eq('shift_id', profile.shift_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single();

      if (!scheduleData) {
        if (mountedRef.current) {
          setValidation({
            isWithinShiftTime: false,
            canRegisterPoint: false,
            nextAllowedTime: null,
            currentShiftMessage: 'Não há expediente hoje'
          });
        }
        return;
      }

      const startTime = new Date(now);
      const [startHour, startMinute] = scheduleData.start_time.split(':').map(Number);
      startTime.setHours(startHour, startMinute - toleranceMinutes, 0, 0);

      const endTime = new Date(now);
      endTime.setHours(startHour, startMinute + toleranceMinutes, 0, 0);

      const isWithinTime = now >= startTime && now <= endTime;

      if (mountedRef.current) {
        setValidation({
          isWithinShiftTime: isWithinTime,
          canRegisterPoint: isWithinTime,
          nextAllowedTime: isWithinTime ? null : startTime,
          currentShiftMessage: isWithinTime 
            ? `Horário de entrada: ${scheduleData.start_time.substring(0, 5)} (tolerância: ±${toleranceMinutes}min)`
            : `Fora do horário permitido. Registro liberado às ${startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        });
      }

    } catch (error) {
      console.error('Erro ao validar turno:', error);
      if (mountedRef.current) {
        setValidation({
          isWithinShiftTime: true,
          canRegisterPoint: true,
          nextAllowedTime: null,
          currentShiftMessage: 'Erro ao verificar turno - registro liberado'
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [profile]);

  useEffect(() => {
    mountedRef.current = true;
    
    checkShiftValidation();
    
    // Interval otimizado - apenas 5 minutos
    intervalRef.current = setInterval(checkShiftValidation, 5 * 60 * 1000);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkShiftValidation]);

  return {
    ...validation,
    loading,
    recheckValidation: checkShiftValidation
  };
};
