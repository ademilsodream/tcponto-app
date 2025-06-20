
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

interface AllowedButtons {
  clock_in: boolean;
  lunch_start: boolean;
  lunch_end: boolean;
  clock_out: boolean;
}

export const useWorkShiftValidation = () => {
  const { user } = useOptimizedAuth();
  const [hasShift, setHasShift] = useState<boolean>(false);
  const [canRegisterPoint, setCanRegisterPoint] = useState<boolean>(true);
  const [currentShiftMessage, setCurrentShiftMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [allowedButtons, setAllowedButtons] = useState<AllowedButtons>({
    clock_in: true,
    lunch_start: true,
    lunch_end: true,
    clock_out: true
  });
  const [nextButtonAvailable, setNextButtonAvailable] = useState<boolean>(false);
  const [timeUntilNext, setTimeUntilNext] = useState<number>(0);

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
          setAllowedButtons({
            clock_in: true,
            lunch_start: true,
            lunch_end: true,
            clock_out: true
          });
          setLoading(false);
          return;
        }

        // Se não tem shift_id, modo livre
        if (!profileData?.shift_id) {
          console.log('👤 Usuário sem turno - modo livre');
          setHasShift(false);
          setCanRegisterPoint(true);
          setCurrentShiftMessage('Modo livre - sem restrições de horário');
          setAllowedButtons({
            clock_in: true,
            lunch_start: true,
            lunch_end: true,
            clock_out: true
          });
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
          setAllowedButtons({
            clock_in: true,
            lunch_start: true,
            lunch_end: true,
            clock_out: true
          });
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
          setAllowedButtons({
            clock_in: true,
            lunch_start: true,
            lunch_end: true,
            clock_out: true
          });
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
          setAllowedButtons({
            clock_in: false,
            lunch_start: false,
            lunch_end: false,
            clock_out: false
          });
          setLoading(false);
          return;
        }

        // Calcular janelas com tolerância
        const tolerance = shiftData.early_tolerance_minutes || 15;
        const windows = [
          { time: todaySchedule.start_time, type: 'clock_in', label: 'Entrada' },
          { time: todaySchedule.break_start_time, type: 'lunch_start', label: 'Início do Almoço' },
          { time: todaySchedule.break_end_time, type: 'lunch_end', label: 'Fim do Almoço' },
          { time: todaySchedule.end_time, type: 'clock_out', label: 'Saída' }
        ].filter(w => w.time);

        let inWindow = false;
        let message = '';
        let nextWindow = null;
        let currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        
        // Reset allowed buttons
        const newAllowedButtons = {
          clock_in: false,
          lunch_start: false,
          lunch_end: false,
          clock_out: false
        };

        for (const window of windows) {
          const [h, m] = window.time.split(':').map(Number);
          const windowMinutes = h * 60 + m;
          const startWindow = windowMinutes - tolerance;
          const endWindow = windowMinutes + tolerance;

          if (currentMinutes >= startWindow && currentMinutes <= endWindow) {
            inWindow = true;
            newAllowedButtons[window.type as keyof AllowedButtons] = true;
            const startTime = `${String(Math.floor(startWindow / 60)).padStart(2, '0')}:${String(startWindow % 60).padStart(2, '0')}`;
            const endTime = `${String(Math.floor(endWindow / 60)).padStart(2, '0')}:${String(endWindow % 60).padStart(2, '0')}`;
            message = `Janela de ${window.label} ativa (${startTime} - ${endTime})`;
            break;
          }

          // Find next available window
          if (!nextWindow && windowMinutes > currentMinutes) {
            nextWindow = {
              ...window,
              windowMinutes: windowMinutes - tolerance,
              minutesUntil: (windowMinutes - tolerance) - currentMinutes
            };
          }
        }

        setCanRegisterPoint(inWindow);
        setAllowedButtons(newAllowedButtons);
        setCurrentShiftMessage(inWindow ? message : 'Fora das janelas de registro permitidas');
        
        if (nextWindow) {
          setNextButtonAvailable(true);
          setTimeUntilNext(nextWindow.minutesUntil);
        } else {
          setNextButtonAvailable(false);
          setTimeUntilNext(0);
        }

      } catch (err) {
        console.warn('Erro na validação de turno - modo livre:', err);
        setHasShift(false);
        setCanRegisterPoint(true);
        setCurrentShiftMessage('Modo livre - sem restrições de horário');
        setAllowedButtons({
          clock_in: true,
          lunch_start: true,
          lunch_end: true,
          clock_out: true
        });
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
    nextButtonAvailable, 
    timeUntilNext 
  };
};
