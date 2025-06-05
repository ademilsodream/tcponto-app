import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, LogIn, Coffee, LogOut } from 'lucide-react';
// CORRIGIDO: Importa Json do arquivo de tipos do Supabase
import { Json } from '@/integrations/supabase/types';
// Importa o cliente supabase do seu arquivo local
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { validateLocationForTimeRecord, Location } from '@/utils/optimizedLocationValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { clearLocationCache } from '@/utils/optimizedLocationValidation';


// Define um tipo de união literal para as chaves de horário
type TimeRecordKey = 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';


// Interface para a estrutura de cada registro de localização dentro do JSON
interface LocationDetails {
  address: string;
  distance: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  locationName: string;
  // gps_accuracy não é salvo na coluna locations, mas pode ser útil aqui se precisar
  // gps_accuracy?: number;
}


// Interface para a estrutura completa da coluna 'locations' (o objeto JSON)
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
  // Tipagem da coluna locations para aceitar Json do Supabase
  locations?: Json | null; // Supabase retorna Json, que pode ser qualquer tipo JSON válido
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_pending_approval?: boolean;
  approved_by?: string;
  approved_at?: string;
  // Removido latitude, longitude, gps_accuracy pois não são colunas separadas
  // latitude?: number | null;
  // longitude?: number | null;
  // gps_accuracy?: number | null;
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


// ✨ Constante para a duração do cooldown (20 minutos)
const COOLDOWN_DURATION_MS = 20 * 60 * 1000;


// ✨ Função auxiliar para formatar o tempo restante (MM:SS)
const formatRemainingTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};




const OptimizedTimeRegistration = React.memo(() => {
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  // Usar TimeRecordKey para tipar editField
  const [editField, setEditField] = useState<TimeRecordKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userProfile, setUserProfile] = useState<{ name?: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();


  // ✨ Novo estado para o fim do cooldown (timestamp em ms)
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  // ✨ Novo estado para o tempo restante do cooldown (em ms)
  const [remainingCooldown, setRemainingCooldown] = useState<number | null>(null);


  // Memoizar data local para evitar recálculos
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


  // Função de saudação memoizada
  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, [currentTime.getHours]);


  // Nome do usuário memoizado
  const userDisplayName = useMemo(() => {
    if (userProfile?.name) {
      return userProfile.name.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Usuário';
  }, [userProfile?.name, user?.email]);


  // Usar TimeRecordKey para tipar as chaves de fieldNames
  const fieldNames: Record<TimeRecordKey, string> = useMemo(() => ({
    clock_in: 'Entrada',
    lunch_start: 'Início do Almoço',
    lunch_end: 'Fim do Almoço',
    clock_out: 'Saída'
  }), []);


  // Query otimizada para localizações permitidas - cache longo pois raramente mudam
  const { data: allowedLocations = [] } = useOptimizedQuery<AllowedLocation[]>({
    queryKey: ['allowed-locations'],
    queryFn: async () => {
      console.log('📍 Carregando localizações permitidas...');
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');


      if (error) {
        console.error('Erro ao carregar localizações permitidas:', error);
        throw error;
      }


      return (data || []).map(location => ({
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        range_meters: Number(location.range_meters)
      }));
    },
    staleTime: 30 * 60 * 1000, // 30 minutos - raramente mudam
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


      if (error && error.code !== 'PGRST116') { // PGRST116 é "nenhuma linha encontrada"
        console.error('Erro ao buscar perfil do usuário:', error);
        throw error; // Lança outros erros
      }
       if (error && error.code === 'PGRST116') {
           console.warn('Perfil não encontrado para o usuário logado.');
           return null; // Retorna null se o perfil não for encontrado
       }


      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    enabled: !!user // Só executa se o usuário estiver logado
  });


  // Query otimizada para registro de hoje
  const {
    data: todayRecord,
    refetch: refetchRecord,
    isLoading: loadingRecord
  } = useOptimizedQuery<TimeRecord | null>({
    queryKey: ['today-record', user?.id, localDate],
    queryFn: async () => {
      if (!user) return null;


      console.log('📅 Buscando registros para:', localDate);


      const { data, error } = await supabase
        .from('time_records')
        .select('*') // Seleciona todas as colunas conforme a interface TimeRecord
        .eq('user_id', user.id)
        .eq('date', localDate)
        .single();


      if (error && error.code !== 'PGRST116') { // PGRST116 é "nenhuma linha encontrada"
         console.error('Erro ao buscar registro de hoje:', error);
        throw error; // Lança outros erros
      }
      if (error && error.code === 'PGRST116') {
         console.log('Nenhum registro encontrado para hoje.');
         return null; // Retorna null se nenhum registro for encontrado
      }


      console.log('✅ Registro de hoje encontrado:', data);
      // O Supabase retorna 'locations' como Json.
      // A tipagem TimeRecord agora aceita Json | null.
      // Não precisamos fazer nada especial aqui, a tipagem já está mais flexível.
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos para dados atuais
    enabled: !!user // Só executa se o usuário estiver logado
  });


  // Atualizar estados quando dados chegam
  useEffect(() => {
    if (profileData !== undefined) { // Verificar explicitamente undefined para permitir null
      setUserProfile(profileData);
    }
  }, [profileData]);

  useEffect(() => {
    if (todayRecord !== undefined) { // Verificar explicitamente undefined para permitir null
      setTimeRecord(todayRecord);
    }
  }, [todayRecord]);


  // Efeito para o relógio em tempo real
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);


    return () => clearInterval(intervalId); // Limpa o intervalo ao desmontar
  }, []);


  // ✨ Efeito para gerenciar o cooldown
  useEffect(() => {
    const storedCooldownEnd = localStorage.getItem('timeRegistrationCooldown');
    if (storedCooldownEnd) {
      const endTime = parseInt(storedCooldownEnd, 10);
      if (endTime > Date.now()) {
        setCooldownEndTime(endTime);
      } else {
        localStorage.removeItem('timeRegistrationCooldown');
        setCooldownEndTime(null);
        setRemainingCooldown(null);
      }
    }
  }, []);


  // ✨ Efeito para atualizar o tempo restante do cooldown
  useEffect(() => {
    if (cooldownEndTime === null) {
      setRemainingCooldown(null);
      return;
    }


    const timer = setInterval(() => {
      const remaining = cooldownEndTime - Date.now();
      setRemainingCooldown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        setCooldownEndTime(null);
        setRemainingCooldown(null);
        localStorage.removeItem('timeRegistrationCooldown');
        toast({
          title: "Pronto!",
          description: "Você já pode registrar o próximo ponto.",
          variant: "default"
        });
      }
    }, 1000);


    return () => clearInterval(timer);
  }, [cooldownEndTime, toast]);


  // Hook para solicitar localização de forma otimizada e com debounce
  const debouncedLocationRequest = useDebouncedCallback(
    async (action: string, onSuccess: (result: any) => void, onError: (message: string) => void) => {
      console.log(`🌍 Solicitando localização para ${action}...`);
      try {
        const locationResult = await validateLocationForTimeRecord(allowedLocations);
        console.log('✅ Validação de localização concluída:', locationResult);
        onSuccess(locationResult);
      } catch (error: any) {
        console.error('❌ Erro na validação de localização:', error);
        onError(error.message || "Não foi possível obter sua localização ou ela não é permitida.");
      }
    },
    1000, // debounce time
    [allowedLocations] // dependencies
  );


  // Handle time action otimizado
  // Usar TimeRecordKey para tipar o parâmetro action
  const handleTimeAction = useCallback(async (action: TimeRecordKey) => {
    if (!user || submitting) return;

    // ✨ Verifica se há cooldown ativo
    if (cooldownEndTime && cooldownEndTime > Date.now()) {
        toast({
            title: "Aguarde",
            description: `Você só pode registrar o próximo ponto após ${formatRemainingTime(cooldownEndTime - Date.now())}.`,
            variant: "default" // Use default ou info para não parecer um erro
        });
        return;
    }

    setSubmitting(true);
    console.log(`⚡️ Acionando handleTimeAction para: ${action}`);

    // Usar debounced GPS request
    debouncedLocationRequest(
      action, // Passa a action como string para debouncedLocationRequest
      // O callback onSuccess agora recebe o resultado da validação
      async (locationValidationResult) => {
        console.log('➡️ Callback onSuccess do debouncedLocationRequest iniciado.');
        try {
          const currentTimeStr = format(currentTime, 'HH:mm');
          const actionKey = action as TimeRecordKey; // Garante que action é TimeRecordKey

          // Prepara os dados de localização para salvar no JSON
          const locationData: LocationDetails = {
            address: locationValidationResult.location?.address || 'N/A',
            distance: locationValidationResult.distance || -1,
            latitude: locationValidationResult.location?.latitude || 0,
            longitude: locationValidationResult.location?.longitude || 0,
            timestamp: new Date().toISOString(),
            locationName: locationValidationResult.closestLocation?.name || 'Unknown',
            // gps_accuracy: locationValidationResult.gpsAccuracy, // Se precisar salvar a acurácia
          };

          let updateError = null;
          let newTimeRecord = null;

          if (timeRecord) {
            // Se já existe um registro para hoje, atualiza
            const updatedLocations: LocationsData = {
              ...(timeRecord.locations as LocationsData || {}), // Pega locations existentes, garante que é objeto
              [actionKey]: locationData, // Adiciona/atualiza a localização para o ponto registrado
            };
            const updatePayload = {
              [actionKey]: currentTimeStr, // Adiciona o horário registrado
              locations: updatedLocations, // Salva o objeto JSON de localizações atualizado
              updated_at: new Date().toISOString(),
            };
            console.log('Attempting to update record:', timeRecord.id, updatePayload);
            const { data, error } = await supabase
              .from('time_records')
              .update(updatePayload)
              .eq('id', timeRecord.id)
              .select('*') // Seleciona a linha atualizada
              .single();
            updateError = error;
            newTimeRecord = data;

          } else {
            // Se não existe registro para hoje, cria um novo
            const insertPayload = {
              user_id: user.id,
              date: localDate,
              [actionKey]: currentTimeStr, // Adiciona o primeiro horário registrado
              locations: { [actionKey]: locationData }, // Cria o objeto JSON de localizações
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'completed', // Defina o status inicial apropriado
              is_pending_approval: false, // Defina o status de aprovação inicial
            };
            console.log('Attempting to insert new record:', insertPayload);
            const { data, error } = await supabase
              .from('time_records')
              .insert(insertPayload)
              .select('*') // Seleciona a linha inserida
              .single();
            updateError = error;
            newTimeRecord = data;
          }

          if (updateError) throw updateError;

          // Atualiza o estado local com os dados mais recentes do banco
          setTimeRecord(newTimeRecord);
          console.log('✅ Registro atualizado/inserido no Supabase e estado local.');

          // 2. Exibir toast de sucesso
          toast({
            title: "Sucesso!",
            description: `${fieldNames[actionKey]} registrada às ${currentTimeStr}`,
          });
          console.log('🎉 Toast de sucesso exibido.');

          // ✨ 3. Configurar o cooldown
          const newCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
          setCooldownEndTime(newCooldownEndTime);
          localStorage.setItem('timeRegistrationCooldown', newCooldownEndTime.toString());
          console.log('⏳ Cooldown iniciado.');

          // 4. Refetch dados para garantir a UI atualizada
          console.log('🔄 Iniciando refetchRecord...');
          await refetchRecord(); // <-- ESSA LINHA FOI DESCOMENTADA
          console.log('✅ RefetchRecord concluído.');

          // 5. Limpar cache de localização para futuras validações
          clearLocationCache();
          console.log('🧹 Cache de localização limpo.');

        } catch (error: any) {
          console.error('❌ Erro capturado no fluxo de registro (após validação):', error);
          toast({
            title: "Erro",
            description: error.message || "Erro ao registrar horário",
            variant: "destructive"
          });
        } finally {
            console.log('➡️ Fim do callback onSuccess do debouncedLocationRequest.');
            setSubmitting(false);
        }
      },
      (message) => { // onError callback do debouncedLocationRequest
        console.warn('Validação de localização falhou:', message);
        toast({
          title: "Localização não autorizada",
          description: message,
          variant: "destructive"
        });
        console.log('➡️ Fim do callback onError do debouncedLocationRequest.');
        setSubmitting(false);
      }
    );

  }, [user, submitting, timeRecord, localDate, currentTime, allowedLocations, debouncedLocationRequest, refetchRecord, toast, fieldNames, cooldownEndTime]);


  // Handle edit submission
  const handleEditSubmit = useCallback(async () => {
    if (!user || !timeRecord || !editField || !editValue || !editReason || submitting) {
      toast({
        title: "Erro",
        description: "Dados incompletos para solicitar alteração.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Inserir a solicitação de alteração na tabela 'time_record_edit_requests'
      const { data, error } = await supabase
        .from('time_record_edit_requests')
        .insert({
          record_id: timeRecord.id,
          user_id: user.id,
          field_to_edit: editField,
          old_value: timeRecord[editField],
          new_value: editValue,
          reason: editReason,
          requested_at: new Date().toISOString(),
          status: 'pending', // Status inicial
        })
        .select()
        .single();

      if (error) throw error;

      // Opcional: Atualizar o status do registro principal para 'pending_approval'
      // Depende da sua lógica de negócio
      // const { error: updateStatusError } = await supabase
      //   .from('time_records')
      //   .update({ is_pending_approval: true, updated_at: new Date().toISOString() })
      //   .eq('id', timeRecord.id);

      // if (updateStatusError) {
      //   console.error('Erro ao atualizar status do registro principal:', updateStatusError);
      //   // Decida se isso deve impedir o sucesso da solicitação de edição
      // }

      toast({
        title: "Sucesso!",
        description: "Solicitação de alteração enviada para aprovação.",
      });

      setIsEditDialogOpen(false);
      setEditField(null);
      setEditValue('');
      setEditReason('');

      // Opcional: Refetch o registro principal para mostrar o status de pendente (se implementado)
      // await refetchRecord();

    } catch (error: any) {
      console.error('Erro ao enviar solicitação de alteração:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar solicitação de alteração.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  }, [user, timeRecord, editField, editValue, editReason, toast, refetchRecord]);


  // Efeito para verificar mudança de data e refetch
  useEffect(() => {
    const checkDateChange = () => {
      const now = new Date();
      const currentLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Se a data atual for diferente da data do registro carregado OU se não houver registro carregado
      // e a data atual for diferente da data local memoizada (que é calculada uma vez)
      // Isso cobre o cenário de virar o dia enquanto o app está aberto ou se o app foi aberto em um novo dia
      if ((timeRecord && timeRecord.date !== currentLocalDate) || (!timeRecord && localDate !== currentLocalDate)) {
        console.log('📅 Mudança de data detectada. Refetching registros...');
        // Força o recálculo de localDate para a data atual
        // Nota: O hook useOptimizedQuery já tem localDate como dependencyKey,
        // então o refetch automático acontecerá quando localDate mudar.
        // Mas chamar refetchRecord() aqui garante a busca imediata.
        refetchRecord();
      }
    };

    // Verifica a cada minuto se a data mudou
    // Isso é importante se o usuário deixar a tela aberta por muito tempo e virar o dia
    // O useOptimizedQuery com staleTime e refetchInterval=false não refetcharia automaticamente nesse caso.
    // Este intervalo garante que o registro de HOJE seja carregado assim que a data mudar.
    // A dependência [timeRecord, localDate, refetchRecord] garante que o intervalo seja reconfigurado
    // se qualquer uma dessas variáveis mudar, embora timeRecord e localDate só mudem após o refetch.
    // A principal razão para este intervalo é capturar a mudança de data autônoma se o app ficar aberto.
    const interval = setInterval(checkDateChange, 60000);
    // Limpa o intervalo quando o componente desmonta ou timeRecord/localDate/refetchRecord mudam
    return () => clearInterval(interval);
  }, [timeRecord, localDate, refetchRecord]);




  // Memoizar steps para evitar recálculo
  const steps = useMemo(() => [
    // Tipar key como TimeRecordKey
    { key: 'clock_in' as TimeRecordKey, label: 'Entrada', icon: LogIn, color: 'bg-green-500' },
    { key: 'lunch_start' as TimeRecordKey, label: 'Início do Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'lunch_end' as TimeRecordKey, label: 'Volta Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'clock_out' as TimeRecordKey, label: 'Saída', icon: LogOut, color: 'bg-red-500' },
  ], []);


  // getValue agora aceita TimeRecordKey
  const getValue = useCallback((key: TimeRecordKey) => {
    // Acessa diretamente a propriedade do timeRecord que corresponde ao horário
    return timeRecord?.[key];
  }, [timeRecord]);


  const completedCount = useMemo(() => {
    return steps.filter(step => getValue(step.key)).length;
  }, [steps, getValue]);


  // nextAction retorna TimeRecordKey | null
  const nextAction = useMemo<TimeRecordKey | null>(() => {
    if (!timeRecord?.clock_in) return 'clock_in';
    if (!timeRecord?.lunch_start) return 'lunch_start';
    if (!timeRecord?.lunch_end) return 'lunch_end';
    if (!timeRecord?.clock_out) return 'clock_out';
    return null;
  }, [timeRecord]);


  // ✨ Determina se o botão de registro deve estar desabilitado
  const isRegistrationButtonDisabled = useMemo(() => {
      return submitting || (cooldownEndTime !== null && cooldownEndTime > Date.now());
  }, [submitting, cooldownEndTime]);




  if (loadingRecord) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8">
      {/* Header com logo - otimizado para mobile */}
      <div className="w-full max-w-md mb-6 pl-20 sm:pl-16">
        {/* Espaço reservado para o logo */}
      </div>


      {/* Saudação com nome do usuário */}
      <div className="text-center mb-4">
        <div className="text-blue-600 text-xl sm:text-2xl font-semibold mb-1">
          {greeting}, {userDisplayName}! 👋
        </div>
        <div className="text-gray-500 text-sm sm:text-base">
          Pronto para registrar seu ponto?
        </div>
      </div>


      {/* Relógio Principal */}
      <div className="text-center mb-6">
        <div className="text-gray-600 text-base sm:text-lg mb-2">
          {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
        <div className="text-gray-900 text-4xl sm:text-6xl font-bold tracking-wider mb-4">
          {format(currentTime, 'HH:mm:ss')}
        </div>
      </div>


      {/* Card Principal */}
      <Card className="w-full max-w-md bg-white shadow-lg">
        <CardContent className="p-4 sm:p-6">
          {/* Progresso Horizontal */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                // Usar getValue com a chave tipada corretamente
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
                      <Icon className="w-4 h-4 sm:w-5 h-5" />
                    </div>
                    <span className={`text-xs text-center ${
                      isCompleted ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                    {/* Chamar getValue com a chave correta para exibir o horário */}
                    {isCompleted && (
                      <span className="text-xs text-blue-600 mt-1 font-medium">
                        {getValue(step.key)}
                      </span>
                    )}
                     {/* Botão de editar - aparece apenas se o horário já foi registrado */}
                    {isCompleted && (
                        <Button
                            variant="link"
                            size="sm"
                            className="text-xs text-blue-500 hover:text-blue-700 p-0 h-auto"
                            onClick={() => {
                                setEditField(step.key);
                                setEditValue(getValue(step.key) || ''); // Preenche com valor atual se existir
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


            {/* Barra de progresso */}
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


          {/* Botão Registrar */}
          {nextAction && (
            <>
              <Button
                onClick={() => handleTimeAction(nextAction)} // nextAction já é TimeRecordKey
                // ✨ Usa a nova variável de estado para desabilitar o botão
                disabled={isRegistrationButtonDisabled}
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
              >
                <Clock className="w-5 h-5 mr-2" />
                {submitting ? 'Registrando...' : 'Registrar'}
              </Button>
              {/* ✨ Exibe o tempo restante do cooldown */}
              {cooldownEndTime !== null && remainingCooldown !== null && remainingCooldown > 0 && (
                  <div className="text-center text-sm text-gray-600 mt-4">
                      Próximo registro disponível em: {formatRemainingTime(remainingCooldown)}
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


      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Solicitar Alteração - {editField ? fieldNames[editField] : ''} {/* fieldNames usado aqui */}
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


OptimizedTimeRegistration.displayName = 'OptimizedTimeRegistration';


export default OptimizedTimeRegistration;
