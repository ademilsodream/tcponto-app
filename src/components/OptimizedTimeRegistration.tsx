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




// ✨ Constante para a duração do cooldown (20 segundos para teste, mude para 20 * 60 * 1000 para 20 minutos)
const COOLDOWN_DURATION_MS = 20 * 1000; // 20 segundos para teste




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
    enabled: !!user, // Só executa se o usuário estiver logado
    // ✨ Adicionado para refetchar quando a janela/aba ganhar foco
    refetchOnWindowFocus: true
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




  // Timer otimizado - apenas atualiza a cada segundo e com cleanup
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);




    return () => clearInterval(timer);
  }, []);




  // ✨ Efeito para carregar cooldown do localStorage e configurar timers
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;




    const storedCooldown = localStorage.getItem('timeRegistrationCooldown');
    if (storedCooldown) {
      const endTime = Number(storedCooldown);
      if (endTime > Date.now()) {
        setCooldownEndTime(endTime);
        setRemainingCooldown(endTime - Date.now());




        // Timer para finalizar o cooldown
        timeoutId = setTimeout(() => {
          setCooldownEndTime(null);
          setRemainingCooldown(null);
          localStorage.removeItem('timeRegistrationCooldown');
          toast({
            title: "Pronto!",
            description: "Você já pode registrar o próximo ponto.",
          });
        }, endTime - Date.now());




        // Intervalo para atualizar o tempo restante na UI
        intervalId = setInterval(() => {
          setRemainingCooldown(Math.max(0, endTime - Date.now()));
        }, 1000);




      } else {
        // Cooldown expirou enquanto o app estava fechado
        localStorage.removeItem('timeRegistrationCooldown');
        setCooldownEndTime(null);
        setRemainingCooldown(null);
      }
    } else {
      // Sem cooldown no storage
      setCooldownEndTime(null);
      setRemainingCooldown(null);
    }




    // Função de limpeza para os timers
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [toast]); // Depende de toast para garantir que a função clearCooldown tenha acesso a ele








  // Debounced GPS request e validação
  // CORRIGIDO: Ajustada a estrutura try...catch...finally
  const debouncedLocationRequest = useDebouncedCallback(
    async (action: TimeRecordKey,
      onSuccess: (locationValidationResult: { valid: boolean; location: Location; message: string; closestLocation?: AllowedLocation; distance?: number; gpsAccuracy?: number; adaptiveRange?: number; }) => Promise<void>, // onSuccess é agora async
      onError: (message: string) => void
    ) => {
      console.log(`🕐 Iniciando validação de localização para ${action}...`);




      if (!allowedLocations || allowedLocations.length === 0) {
        onError('Nenhuma localização permitida configurada');
        return;
      }




      try {
        const locationValidation = await validateLocationForTimeRecord(allowedLocations);




        if (!locationValidation.valid) {
          // Validação de localização falhou, chama o callback onError
          onError(locationValidation.message);
        } else {
          // Validação de localização bem-sucedida, chama o callback onSuccess
          await onSuccess(locationValidation); // Aguarda o onSuccess assíncrono
        }
      } catch (error) {
        // Ocorreu um erro durante a validação de localização
        console.error('Erro durante a validação de localização:', error);
        onError('Erro ao obter localização. Tente novamente.');
      } finally {
        // Este bloco finally será executado após o try ou catch blocks
        // Este é o local correto para definir submitting como false
        setSubmitting(false);
        console.log('➡️ Fim da execução do debouncedLocationRequest.');
      }
    },
    300 // Debounce delay
  );




  // Handle time action (clock in/out, lunch)
  // action agora é tipado como TimeRecordKey
  const handleTimeAction = useCallback(async (action: TimeRecordKey) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }




    // ✨ Verifica o cooldown antes de iniciar a ação
    if (cooldownEndTime !== null && cooldownEndTime > Date.now()) {
      toast({
        title: "Aguarde",
        description: `Você precisa esperar um pouco antes do próximo registro. Tempo restante: ${formatRemainingTime(cooldownEndTime - Date.now())}`,
        variant: "default", // ou "warning" se preferir
      });
      return;
    }




    setSubmitting(true); // Define submitting como true no início da ação




    // Passa a action e os callbacks onSuccess/onError para a função debounced
    debouncedLocationRequest(
      action, // Passa a action
      // callback onSuccess - contém a lógica do Supabase
      async (locationValidationResult) => {
        console.log('✅ Validação de localização bem-sucedida.', locationValidationResult);




        // Extrai detalhes de localização do resultado da validação
        const { location, closestLocation, distance } = locationValidationResult; // gpsAccuracy e adaptiveRange não são usados no JSON locations
        const locationDetails: LocationDetails = {
          address: location.address,
          distance: distance ?? -1, // Usa -1 ou trata undefined se distance não estiver sempre presente
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString(),
          locationName: closestLocation?.name || 'Localização Próxima', // Usa o nome da localização mais próxima se disponível
        };




        // Prepara os dados para atualizar/inserir
        const updateData: Partial<TimeRecord> = {
          [action]: localTime, // Usa localTime para o timestamp
          // Adiciona detalhes de localização à coluna JSON 'locations'
          // Precisamos mesclar com localizações existentes se o registro existir
          locations: {
            ...(timeRecord?.locations as LocationsData || {}), // Espalha localizações existentes, trata null/undefined
            [action]: locationDetails // Adiciona/sobrescreve os detalhes de localização para a action atual
          } as Json // Converte para o tipo Json
        };




        try {
          let updatedRecord: TimeRecord | null = null;




          if (timeRecord) {
            // Atualiza registro existente
            const { data, error } = await supabase
              .from('time_records')
              .update(updateData)
              .eq('id', timeRecord.id)
              .select('*')
              .single();




            if (error) throw error;
            updatedRecord = data;
            console.log(`✅ Registro de ${action} atualizado com sucesso!`, updatedRecord);




          } else {
            // Insere novo registro
            const { data, error } = await supabase
              .from('time_records')
              .insert({
                user_id: user.id,
                date: localDate,
                ...updateData // Inclui o horário da action e as localizações
              })
              .select('*')
              .single();




            if (error) throw error;
            updatedRecord = data;
            console.log(`✅ Novo registro de ${action} criado com sucesso!`, updatedRecord);
          }




          // Atualiza o estado local com o registro novo/atualizado
          // CORRIGIDO: Descomentar e garantir que o estado local seja atualizado
          setTimeRecord(updatedRecord);




          // Dispara refetch para atualizar o cache da query
          // CORRIGIDO: Chamar refetchRecord para invalidar o cache e buscar dados frescos
          refetchRecord();




          toast({
            title: "Sucesso",
            description: `${fieldNames[action]} registrado com sucesso!`,
          });




          // ✨ Inicia o cooldown após o registro bem-sucedido
          const newCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
          setCooldownEndTime(newCooldownEndTime);
          localStorage.setItem('timeRegistrationCooldown', newCooldownEndTime.toString());
          setRemainingCooldown(COOLDOWN_DURATION_MS); // Define o tempo restante inicial




          // Limpa o cache de localização para garantir que a próxima validação seja fresca
          clearLocationCache();




        } catch (dbError) {
          console.error(`Erro ao salvar registro de ${action} no Supabase:`, dbError);
          toast({
            title: "Erro ao salvar",
            description: `Ocorreu um erro ao salvar seu registro de ${fieldNames[action]}.`,
            variant: "destructive"
          });
        }
      },
      // callback onError - trata falha na validação de localização
      (message) => {
        console.warn('Validação de localização falhou:', message);
        toast({
          title: "Localização não autorizada",
          description: message,
          variant: "destructive"
        });
      }
    );
  }, [user, timeRecord, localDate, localTime, allowedLocations, debouncedLocationRequest, refetchRecord, toast, fieldNames, cooldownEndTime]); // Adicionado cooldownEndTime às dependências








  // Handle edit submit otimizado
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
          employee_name: userProfile?.name || user.email || 'Usuário', // Usar nome do perfil se disponível
          date: localDate,
          field: editField, // editField já é TimeRecordKey
          old_value: timeRecord?.[editField] || null, // Acessa o valor antigo corretamente
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




  // Verificar mudança de data otimizada
  useEffect(() => {
    const checkDateChange = () => {
      const currentDate = localDate;
      const recordDate = timeRecord?.date;




      if (recordDate && recordDate !== currentDate) {
        console.log('🗓️ Nova data detectada, recarregando...');
        // Forçar um refetch quando a data muda
        refetchRecord();
        // Opcional: limpar timeRecord para mostrar estado de loading/sem registro imediatamente
        setTimeRecord(null);
      }
    };




    // Verifica a cada minuto se a data mudou
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
        </DialogContent>
      </Dialog>
    </div>
  );
});




OptimizedTimeRegistration.displayName = 'OptimizedTimeRegistration';




export default OptimizedTimeRegistration;
