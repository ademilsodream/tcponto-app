
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

interface AllowedButtons {
  clock_in: boolean;
  lunch_start: boolean;
  lunch_end: boolean;
  clock_out: boolean;
}

interface ShiftScheduleData {
  start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  end_time: string | null;
}

interface ShiftTolerances {
  early_tolerance_minutes: number;
  late_tolerance_minutes: number;
  break_tolerance_minutes: number;
}

export const useWorkShiftValidation = () => {
  const { user } = useOptimizedAuth();
  const [hasShift, setHasShift] = useState<boolean>(false);
  const [currentShiftMessage, setCurrentShiftMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [shiftSchedule, setShiftSchedule] = useState<ShiftScheduleData | null>(null);
  const [shiftTolerances, setShiftTolerances] = useState<ShiftTolerances>({
    early_tolerance_minutes: 15,
    late_tolerance_minutes: 15,
    break_tolerance_minutes: 15
  });

  // Botões sempre habilitados - a tolerância agora é usada apenas para ajuste de horário
  const allowedButtons: AllowedButtons = {
    clock_in: true,
    lunch_start: true,
    lunch_end: true,
    clock_out: true
  };
  const canRegisterPoint = true;

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
          setCurrentShiftMessage('Modo livre - sem restrições de horário');
          setShiftSchedule(null);
          setLoading(false);
          return;
        }

        // Se não tem shift_id, modo livre
        if (!profileData?.shift_id) {
          console.log('👤 Usuário sem turno - modo livre');
          setHasShift(false);
          setCurrentShiftMessage('Modo livre - sem restrições de horário');
          setShiftSchedule(null);
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
          setCurrentShiftMessage('Modo livre - sem restrições de horário');
          setShiftSchedule(null);
          setLoading(false);
          return;
        }

        // Salvar tolerâncias do turno
        setShiftTolerances({
          early_tolerance_minutes: shiftData.early_tolerance_minutes || 15,
          late_tolerance_minutes: shiftData.late_tolerance_minutes || 15,
          break_tolerance_minutes: shiftData.break_tolerance_minutes || 15
        });

        // 3. Buscar horários do turno
        const { data: schedulesData, error: schedulesError } = await supabase
          .from('work_shift_schedules')
          .select('*')
          .eq('shift_id', profileData.shift_id)
          .eq('is_active', true);

        if (schedulesError || !schedulesData?.length) {
          console.warn('Horários não encontrados - modo livre');
          setHasShift(false);
          setCurrentShiftMessage('Modo livre - sem restrições de horário');
          setShiftSchedule(null);
          setLoading(false);
          return;
        }

        // 4. Salvar horários do turno
        setHasShift(true);
        
        const now = new Date();
        const dayOfWeek = now.getDay();
        
        const todaySchedule = schedulesData.find((s: any) => s.day_of_week === dayOfWeek);
        
        if (!todaySchedule) {
          setCurrentShiftMessage('Nenhum horário configurado para hoje');
          setShiftSchedule(null);
          setLoading(false);
          return;
        }

        // Salvar o schedule do dia
        setShiftSchedule({
          start_time: todaySchedule.start_time,
          break_start_time: todaySchedule.break_start_time,
          break_end_time: todaySchedule.break_end_time,
          end_time: todaySchedule.end_time
        });

        setCurrentShiftMessage(`Turno: ${shiftData.name}`);
        setLoading(false);

      } catch (err) {
        console.warn('Erro na validação de turno - modo livre:', err);
        setHasShift(false);
        setCurrentShiftMessage('Modo livre - sem restrições de horário');
        setShiftSchedule(null);
      } finally {
        setLoading(false);
      }
    };

    loadShiftData();
    
    // Atualizar a cada minuto
    const interval = setInterval(loadShiftData, 60000);
    return () => clearInterval(interval);
  }, [user]);

  return { 
    canRegisterPoint, 
    currentShiftMessage, 
    loading, 
    hasShift, 
    allowedButtons,
    shiftSchedule,
    shiftTolerances
  };
};
