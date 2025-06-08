
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WorkShiftValidation {
  isWithinShiftTime: boolean;
  canRegisterPoint: boolean;
  nextAllowedTime: Date | null;
  currentShiftMessage: string;
}

export const useWorkShiftValidation = () => {
  const { profile } = useAuth();
  const [validation, setValidation] = useState<WorkShiftValidation>({
    isWithinShiftTime: true,
    canRegisterPoint: true,
    nextAllowedTime: null,
    currentShiftMessage: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkShiftValidation();
    // Verificar a cada minuto
    const interval = setInterval(checkShiftValidation, 60000);
    return () => clearInterval(interval);
  }, [profile]);

  const checkShiftValidation = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      // Verificar se turnos estão habilitados
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['enable_work_shifts', 'shift_tolerance_minutes']);

      const enableWorkShifts = settingsData?.find(s => s.setting_key === 'enable_work_shifts')?.setting_value === 'true';
      const toleranceMinutes = parseInt(settingsData?.find(s => s.setting_key === 'shift_tolerance_minutes')?.setting_value || '15');

      // Se turnos não estão habilitados, liberar registro
      if (!enableWorkShifts) {
        setValidation({
          isWithinShiftTime: true,
          canRegisterPoint: true,
          nextAllowedTime: null,
          currentShiftMessage: ''
        });
        return;
      }

      // Se funcionário não tem turno vinculado, liberar registro
      if (!profile.shift_id) {
        setValidation({
          isWithinShiftTime: true,
          canRegisterPoint: true,
          nextAllowedTime: null,
          currentShiftMessage: 'Sem turno definido - registro liberado'
        });
        return;
      }

      // Buscar horários do turno para o dia atual
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=domingo, 1=segunda, etc.

      const { data: scheduleData } = await supabase
        .from('work_shift_schedules')
        .select('*')
        .eq('shift_id', profile.shift_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single();

      // Se não há horário para hoje, não permitir registro
      if (!scheduleData) {
        setValidation({
          isWithinShiftTime: false,
          canRegisterPoint: false,
          nextAllowedTime: null,
          currentShiftMessage: 'Não há expediente hoje'
        });
        return;
      }

      // Calcular horários com tolerância
      const startTime = new Date(now);
      const [startHour, startMinute] = scheduleData.start_time.split(':').map(Number);
      startTime.setHours(startHour, startMinute - toleranceMinutes, 0, 0);

      const endTime = new Date(now);
      endTime.setHours(startHour, startMinute + toleranceMinutes, 0, 0);

      const isWithinTime = now >= startTime && now <= endTime;

      setValidation({
        isWithinShiftTime: isWithinTime,
        canRegisterPoint: isWithinTime,
        nextAllowedTime: isWithinTime ? null : startTime,
        currentShiftMessage: isWithinTime 
          ? `Horário de entrada: ${scheduleData.start_time.substring(0, 5)} (tolerância: ±${toleranceMinutes}min)`
          : `Fora do horário permitido. Registro liberado às ${startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      });

    } catch (error) {
      console.error('Erro ao validar turno:', error);
      // Em caso de erro, liberar registro
      setValidation({
        isWithinShiftTime: true,
        canRegisterPoint: true,
        nextAllowedTime: null,
        currentShiftMessage: 'Erro ao verificar turno - registro liberado'
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    ...validation,
    loading,
    recheckValidation: checkShiftValidation
  };
};
