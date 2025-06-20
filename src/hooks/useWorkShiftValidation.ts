
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

export const useWorkShiftValidation = () => {
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
