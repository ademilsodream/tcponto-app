
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

interface WorkShiftValidation {
  isWithinShiftTime: boolean;
  canRegisterPoint: boolean;
  nextAllowedTime: Date | null;
  currentShiftMessage: string;
  allowedButtons: {
    clock_in: boolean;
    lunch_start: boolean;
    lunch_end: boolean;
    clock_out: boolean;
  };
  nextButtonAvailable: string | null;
  timeUntilNext: number; // em minutos
}

interface ShiftSchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start_time?: string;
  break_end_time?: string;
}

interface ShiftTolerances {
  early_tolerance_minutes: number;
  late_tolerance_minutes: number;
  break_tolerance_minutes: number;
}

const SETTINGS_CACHE_KEY = 'work_shifts_settings';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const useWorkShiftValidation = () => {
  const { profile } = useOptimizedAuth();
  const [validation, setValidation] = useState<WorkShiftValidation>({
    isWithinShiftTime: true,
    canRegisterPoint: true,
    nextAllowedTime: null,
    currentShiftMessage: '',
    allowedButtons: {
      clock_in: true,
      lunch_start: false,
      lunch_end: false,
      clock_out: false
    },
    nextButtonAvailable: null,
    timeUntilNext: 0
  });
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const calculateTimeWindows = useCallback((
    schedule: ShiftSchedule,
    tolerances: ShiftTolerances,
    now: Date
  ) => {
    const today = new Date(now);
    
    // Função para criar um Date com horário específico
    const createTimeDate = (timeString: string, tolerance: number = 0) => {
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date(today);
      date.setHours(hours, minutes + tolerance, 0, 0);
      return date;
    };

    // Janelas de tempo permitidas
    const windows = {
      clock_in: {
        start: createTimeDate(schedule.start_time, -tolerances.early_tolerance_minutes),
        end: createTimeDate(schedule.start_time, tolerances.late_tolerance_minutes),
        label: 'Entrada'
      },
      lunch_start: schedule.break_start_time ? {
        start: createTimeDate(schedule.break_start_time, -tolerances.break_tolerance_minutes),
        end: createTimeDate(schedule.break_start_time, tolerances.break_tolerance_minutes),
        label: 'Início do Almoço'
      } : null,
      lunch_end: schedule.break_end_time ? {
        start: createTimeDate(schedule.break_end_time, -tolerances.break_tolerance_minutes),
        end: createTimeDate(schedule.break_end_time, tolerances.break_tolerance_minutes),
        label: 'Fim do Almoço'
      } : null,
      clock_out: {
        start: createTimeDate(schedule.end_time, -tolerances.late_tolerance_minutes),
        end: createTimeDate(schedule.end_time, tolerances.early_tolerance_minutes),
        label: 'Saída'
      }
    };

    return windows;
  }, []);

  const checkShiftValidation = useCallback(async () => {
    if (!profile || !mountedRef.current) return;

    try {
      setLoading(true);

      // Cache otimizado para configurações
      const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
      const cacheExpiry = sessionStorage.getItem(`${SETTINGS_CACHE_KEY}_expiry`);
      
      let enableWorkShifts = false;

      if (cached && cacheExpiry && Date.now() < parseInt(cacheExpiry)) {
        const cachedData = JSON.parse(cached);
        enableWorkShifts = cachedData.enableWorkShifts;
      } else {
        const { data: settingsData } = await supabase
          .from('system_settings')
          .select('setting_key, setting_value')
          .eq('setting_key', 'enable_work_shifts');

        enableWorkShifts = settingsData?.find(s => s.setting_key === 'enable_work_shifts')?.setting_value === 'true';
        
        sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ enableWorkShifts }));
        sessionStorage.setItem(`${SETTINGS_CACHE_KEY}_expiry`, (Date.now() + CACHE_DURATION).toString());
      }

      // Se turnos não estão habilitados, liberar todos os registros
      if (!enableWorkShifts) {
        if (mountedRef.current) {
          setValidation({
            isWithinShiftTime: true,
            canRegisterPoint: true,
            nextAllowedTime: null,
            currentShiftMessage: 'Controle de turnos desabilitado',
            allowedButtons: {
              clock_in: true,
              lunch_start: true,
              lunch_end: true,
              clock_out: true
            },
            nextButtonAvailable: null,
            timeUntilNext: 0
          });
        }
        return;
      }

      // Se funcionário não tem turno, liberar registros
      if (!profile.shift_id) {
        if (mountedRef.current) {
          setValidation({
            isWithinShiftTime: true,
            canRegisterPoint: true,
            nextAllowedTime: null,
            currentShiftMessage: 'Sem turno definido - registro liberado',
            allowedButtons: {
              clock_in: true,
              lunch_start: true,
              lunch_end: true,
              clock_out: true
            },
            nextButtonAvailable: null,
            timeUntilNext: 0
          });
        }
        return;
      }

      const now = new Date();
      const dayOfWeek = now.getDay();

      // Buscar configurações do turno
      const [scheduleResult, shiftResult] = await Promise.all([
        supabase
          .from('work_shift_schedules')
          .select('*')
          .eq('shift_id', profile.shift_id)
          .eq('day_of_week', dayOfWeek)
          .eq('is_active', true)
          .single(),
        supabase
          .from('work_shifts')
          .select('early_tolerance_minutes, late_tolerance_minutes, break_tolerance_minutes')
          .eq('id', profile.shift_id)
          .single()
      ]);

      if (!scheduleResult.data) {
        if (mountedRef.current) {
          setValidation({
            isWithinShiftTime: false,
            canRegisterPoint: false,
            nextAllowedTime: null,
            currentShiftMessage: 'Não há expediente hoje',
            allowedButtons: {
              clock_in: false,
              lunch_start: false,
              lunch_end: false,
              clock_out: false
            },
            nextButtonAvailable: null,
            timeUntilNext: 0
          });
        }
        return;
      }

      const schedule = scheduleResult.data;
      const tolerances = shiftResult.data || {
        early_tolerance_minutes: 15,
        late_tolerance_minutes: 15,
        break_tolerance_minutes: 5
      };

      // Calcular janelas de tempo
      const windows = calculateTimeWindows(schedule, tolerances, now);

      // Verificar qual botão deve estar habilitado
      const allowedButtons = {
        clock_in: false,
        lunch_start: false,
        lunch_end: false,
        clock_out: false
      };

      let nextButtonAvailable = null;
      let timeUntilNext = 0;
      let currentMessage = '';

      // Verificar entrada
      if (windows.clock_in && now >= windows.clock_in.start && now <= windows.clock_in.end) {
        allowedButtons.clock_in = true;
        currentMessage = `Horário de entrada: ${schedule.start_time.substring(0, 5)} (±${tolerances.early_tolerance_minutes}min)`;
      }
      // Verificar início do almoço
      else if (windows.lunch_start && now >= windows.lunch_start.start && now <= windows.lunch_start.end) {
        allowedButtons.lunch_start = true;
        currentMessage = `Horário do almoço: ${schedule.break_start_time?.substring(0, 5)} (±${tolerances.break_tolerance_minutes}min)`;
      }
      // Verificar fim do almoço
      else if (windows.lunch_end && now >= windows.lunch_end.start && now <= windows.lunch_end.end) {
        allowedButtons.lunch_end = true;
        currentMessage = `Volta do almoço: ${schedule.break_end_time?.substring(0, 5)} (±${tolerances.break_tolerance_minutes}min)`;
      }
      // Verificar saída
      else if (windows.clock_out && now >= windows.clock_out.start && now <= windows.clock_out.end) {
        allowedButtons.clock_out = true;
        currentMessage = `Horário de saída: ${schedule.end_time.substring(0, 5)} (±${tolerances.late_tolerance_minutes}min)`;
      }
      // Fora de horário - calcular próxima janela
      else {
        const allWindows = [
          { type: 'clock_in', window: windows.clock_in },
          { type: 'lunch_start', window: windows.lunch_start },
          { type: 'lunch_end', window: windows.lunch_end },
          { type: 'clock_out', window: windows.clock_out }
        ].filter(w => w.window);

        // Encontrar próxima janela
        for (const { type, window } of allWindows) {
          if (window && now < window.start) {
            nextButtonAvailable = type;
            timeUntilNext = Math.ceil((window.start.getTime() - now.getTime()) / (1000 * 60));
            currentMessage = `Próximo registro: ${window.label} às ${window.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            break;
          }
        }

        if (!nextButtonAvailable) {
          currentMessage = 'Fora do horário de trabalho';
        }
      }

      if (mountedRef.current) {
        setValidation({
          isWithinShiftTime: Object.values(allowedButtons).some(Boolean),
          canRegisterPoint: Object.values(allowedButtons).some(Boolean),
          nextAllowedTime: nextButtonAvailable ? new Date(now.getTime() + timeUntilNext * 60 * 1000) : null,
          currentShiftMessage: currentMessage,
          allowedButtons,
          nextButtonAvailable,
          timeUntilNext
        });
      }

    } catch (error) {
      console.error('Erro ao validar turno:', error);
      if (mountedRef.current) {
        setValidation({
          isWithinShiftTime: true,
          canRegisterPoint: true,
          nextAllowedTime: null,
          currentShiftMessage: 'Erro ao verificar turno - registro liberado',
          allowedButtons: {
            clock_in: true,
            lunch_start: true,
            lunch_end: true,
            clock_out: true
          },
          nextButtonAvailable: null,
          timeUntilNext: 0
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [profile, calculateTimeWindows]);

  useEffect(() => {
    mountedRef.current = true;
    
    checkShiftValidation();
    
    // Verificar a cada minuto para precisão em tempo real
    intervalRef.current = setInterval(checkShiftValidation, 60 * 1000);

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
