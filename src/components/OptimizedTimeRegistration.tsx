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
  // Adiciona uma assinatura de índice para compatibilidade mais ampla com Json,
  // embora o cast 'as Json' seja a solução direta para o erro.
  // [key: string]: LocationDetails | undefined;
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
        localStorage.removeItem('timeRegistrationCooldown'); // Limpa o storage quando o cooldown termina
      }
    }, 1000); // Atualiza a cada segundo


    return () => clearInterval(timer); // Limpa o timer ao desmontar ou se cooldownEndTime mudar
  }, [cooldownEndTime]);


  // Efeito para refetchar o registro ao focar na janela (opcional, pode ser agressivo)
  // useEffect(() => {
    // Descomente se quiser refetchar o registro de hoje sempre que a janela ganhar foco
    // Pode ser útil para garantir dados atualizados se o usuário alternar entre abas/apps
    // Mas pode gerar muitas requisições se o usuário alternar frequentemente
    // Considere o trade-off entre frescor dos dados e carga no backend/Supabase
    // const handleFocus = () => refetchRecord();
    // window.addEventListener('focus', handleFocus);
    // return () => window.removeEventListener('focus', handleFocus);
  // }, [refetchRecord]); // Dependência: refetchRecord


  // Efeito para verificar a mudança de data e refetchar o registro
  useEffect(() => {
    const checkDateChange = () => {
      const now = new Date();
      const currentLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (currentLocalDate !== localDate) {
        console.log('🗓️ Data mudou. Refetching registro de hoje.');
        // A data mudou, precisamos refetchar o registro para obter o de HOJE (que será null ou um novo)
        // O useOptimizedQuery com a key [today-record, user?.id, localDate] já fará isso automaticamente
        // quando localDate mudar (o que acontece no próximo render após esta verificação).
        // No entanto, chamar refetchRecord() aqui garante a busca imediata.
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


  // Função para registrar o ponto
  // actionKey agora é TimeRecordKey
  const handleTimeAction = useCallback(async (actionKey: TimeRecordKey) => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado.',
        variant: 'destructive',
      });
      return;
    }
    if (submitting) return;


    setSubmitting(true);
    const now = new Date();
    const currentTimeString = format(now, 'HH:mm');
    const currentTimestamp = now.toISOString();


    try {
      // 1. Obter localização
      const location: Location | null = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              gps_accuracy: position.coords.accuracy,
              timestamp: new Date(position.timestamp).toISOString(),
            });
          },
          (error) => {
            console.error('Erro ao obter localização:', error);
            resolve(null); // Resolve com null em caso de erro
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });


      if (!location) {
        toast({
          title: 'Erro de Localização',
          description: 'Não foi possível obter sua localização. Por favor, verifique as permissões do navegador.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }


      // 2. Validar localização
      const validationResult = await validateLocationForTimeRecord(location, allowedLocations);


      if (!validationResult.isValid) {
        toast({
          title: 'Fora da Localização Permitida',
          description: `Você está ${validationResult.distance?.toFixed(2) || '??'} metros de distância de ${validationResult.closestLocationName || 'a localização permitida mais próxima'}.`,
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }


      // 3. Preparar dados de localização para salvar
      const locationDetails: LocationDetails = {
        address: validationResult.address || 'Endereço não encontrado',
        distance: validationResult.distance || -1,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp,
        locationName: validationResult.closestLocationName || 'Localização Validada',
        // gps_accuracy: location.gps_accuracy, // Não salvar accuracy na coluna locations
      };


      // 4. Buscar ou criar registro de hoje
      let record = timeRecord;


      if (!record) {
        console.log('Criando novo registro...');
        const { data, error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: localDate,
            [actionKey]: currentTimeString, // Define o horário da ação
            // CORRIGIDO: Converte o objeto locations para Json
            locations: { [actionKey]: locationDetails } as Json, // Salva detalhes da localização
            total_hours: 0, // Inicializa com 0
            status: 'open', // Define status inicial
          })
          .select()
          .single();


        if (error) {
          console.error('Erro ao criar registro:', error);
          throw new Error('Erro ao criar registro de ponto.');
        }
        record = data;
        console.log('Novo registro criado:', record);


      } else {
        console.log(`Atualizando registro existente para ${actionKey}...`);
        // Atualiza o objeto locations existente ou cria um novo se for null
        const existingLocations = (record.locations || {}) as LocationsData;
        const updatedLocations: LocationsData = {
          ...existingLocations,
          [actionKey]: locationDetails,
        };


        const { data, error } = await supabase
          .from('time_records')
          .update({
            [actionKey]: currentTimeString, // Define o horário da ação
            // CORRIGIDO: Converte o objeto locations para Json
            locations: updatedLocations as Json, // Salva ou atualiza detalhes da localização
            updated_at: new Date().toISOString(), // Atualiza timestamp
          })
          .eq('id', record.id)
          .select()
          .single();


        if (error) {
          console.error('Erro ao atualizar registro:', error);
          throw new Error('Erro ao atualizar registro de ponto.');
        }
        record = data;
        console.log('Registro atualizado:', record);
      }


      // Atualiza o estado local com o novo registro
      setTimeRecord(record);


      toast({
        title: 'Sucesso!',
        description: `${fieldNames[actionKey]} registrado com sucesso às ${currentTimeString}.`, // fieldNames usado aqui
        variant: 'default',
      });


      // ✨ Inicia o cooldown
      const newCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
      setCooldownEndTime(newCooldownEndTime);
      localStorage.setItem('timeRegistrationCooldown', newCooldownEndTime.toString());


    } catch (error) {
      console.error('Erro geral no registro de ponto:', error);
      toast({
        title: 'Erro ao Registrar Ponto',
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      // O refetchRecord() é importante para garantir que o estado do useOptimizedQuery
      // seja atualizado após a mutação, mantendo a consistência.
      // Ele invalidará o cache para a key ['today-record', user?.id, localDate]
      // e buscará os dados mais recentes do Supabase.
      refetchRecord();
      // Limpa o cache de localização para forçar uma nova validação no próximo registro
      clearLocationCache();
    }
  }, [user, localDate, timeRecord, allowedLocations, toast, fieldNames, refetchRecord, submitting]); // Adicionado 'submitting' às dependências


  // Função para enviar solicitação de edição
  const handleEditSubmit = useCallback(async () => {
    if (!user || !timeRecord || !editField || !editValue || !editReason) {
      toast({
        title: 'Erro',
        description: 'Dados incompletos para a solicitação de edição.',
        variant: 'destructive',
      });
      return;
    }
    if (submitting) return;


    setSubmitting(true);


    try {
      // Opcional: Capturar localização atual para a solicitação de edição
      const currentLocation: Location | null = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              gps_accuracy: position.coords.accuracy,
              timestamp: new Date(position.timestamp).toISOString(),
            });
          },
          (error) => {
            console.warn('Não foi possível obter localização para solicitação de edição:', error);
            resolve(null); // Não impede a solicitação se a localização falhar
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      });


      // Prepara os detalhes da localização atual para salvar no JSON, se obtida
      const locationDetails: LocationDetails | null = currentLocation ? {
        address: 'Localização atual (aproximada)', // Ou tente geocodificar se necessário
        distance: -1, // Distância não aplicável aqui
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        timestamp: currentLocation.timestamp,
        locationName: 'Localização na solicitação',
      } : null;


      // CORRIGIDO: Adicionado 'as any' no nome da tabela e corrigido 'record_id' para 'time_record_id'
      const { data, error } = await supabase
        .from('time_record_edit_requests' as any) // Usar 'as any' se o tipo não for gerado
        .insert({
          time_record_id: timeRecord.id, // Assumindo que a coluna é time_record_id
          user_id: user.id,
          date: timeRecord.date,
          field: editField,
          old_value: timeRecord[editField], // Acessa o valor antigo corretamente
          new_value: editValue,
          reason: editReason,
          status: 'pending', // Status inicial da solicitação
          requested_at: new Date().toISOString(),
          // Opcional: Salvar a localização atual na solicitação
          location_at_request: locationDetails ? (locationDetails as Json) : null, // CORRIGIDO: Converte para Json
        })
        .select()
        .single();


      if (error) {
        console.error('Erro ao enviar solicitação de edição:', error);
        throw new Error('Erro ao enviar solicitação de edição.');
      }


      console.log('Solicitação de edição enviada:', data);


      toast({
        title: 'Solicitação Enviada!',
        description: 'Sua solicitação de alteração foi enviada para aprovação.',
        variant: 'default',
      });


      setIsEditDialogOpen(false);
      setEditField(null);
      setEditValue('');
      setEditReason('');


    } catch (error) {
      console.error('Erro geral na solicitação de edição:', error);
      toast({
        title: 'Erro na Solicitação',
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado ao enviar a solicitação.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [user, timeRecord, editField, editValue, editReason, toast, submitting]); // Adicionado 'submitting' às dependências


  // Determina se o botão de registro deve estar desabilitado
  // ✨ Já estava memoizado, apenas mantendo a estrutura
  const isRegistrationButtonDisabled = useMemo(() => {
      return submitting || (cooldownEndTime !== null && remainingCooldown !== null && remainingCooldown > 0);
  }, [submitting, cooldownEndTime, remainingCooldown]);


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
          {/* CORRIGIDO: Adicionado 'as any' para contornar erro de tipagem do format com locale */}
          {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR }) as any}
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
                  </div> {/* CORRIGIDO: Tag de fechamento adicionada aqui */}
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
             <div className="text-sm text-gray-500 mt-1">
               Horário atual: {editField && timeRecord ? timeRecord[editField] : '-'}
             </div>
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
