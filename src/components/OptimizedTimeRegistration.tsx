import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, LogIn, Coffee, LogOut } from 'lucide-react';
// Importa Json do supabase-js
import { supabase, Json } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
// CORRIGIDO: Caminho do import do AuthContext (mantido o padrão @/)
import { useAuth } from '@/contexts/AuthContext';
// Importe validateLocationForTimeRecord e a interface Location
import { validateLocationForTimeRecord, Location } from '@/utils/optimizedLocationValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { clearLocationCache } from '@/utils/optimizedLocationValidation'; // Importe clearLocationCache


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
  total_pay?: number;
  // CORRIGIDO: Tipagem da coluna locations para aceitar Json do Supabase
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


const OptimizedTimeRegistration = React.memo(() => {
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  // CORRIGIDO: Usar TimeRecordKey para tipar editField
  const [editField, setEditField] = useState<TimeRecordKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userProfile, setUserProfile] = useState<{ name?: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();


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
  }, [currentTime.getHours]); // Dependência correta: currentTime.getHours


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


  // CORRIGIDO: Usar TimeRecordKey para tipar as chaves de fieldNames
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
      // CORRIGIDO: O Supabase retorna 'locations' como Json.
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


  // Timer otimizado - apenas atualiza a cada segundo e com cleanup
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);


    return () => clearInterval(timer);
  }, []);


  // Debounced GPS request para evitar múltiplas chamadas
  const debouncedLocationRequest = useDebouncedCallback(
    // onSuccess agora recebe o resultado completo da validação de localização
    async (action: string, onSuccess: (locationValidationResult: { valid: boolean; location?: Location; message: string; closestLocation?: AllowedLocation; distance?: number; gpsAccuracy?: number; adaptiveRange?: number; }) => void, onError: (message: string) => void) => {
      console.log(`🕐 Iniciando validação de localização para ${action}...`);


      if (!allowedLocations || allowedLocations.length === 0) {
        onError('Nenhuma localização permitida configurada');
        return;
      }


      try {
        const locationValidation = await validateLocationForTimeRecord(allowedLocations);


        if (!locationValidation.valid) {
          onError(locationValidation.message);
          return;
        }


        // Se a validação foi bem-sucedida, chama onSuccess com o resultado completo
        console.log('✅ Validação de localização bem-sucedida.');
        onSuccess(locationValidation);


      } catch (error: any) {
        console.error('Erro na validação de localização:', error);
        onError(error.message || 'Erro ao validar localização');
      }
    },
    2000 // 2 segundos de debounce
  );


  // Handle time action otimizado
  // CORRIGIDO: Usar TimeRecordKey para tipar o parâmetro action
  const handleTimeAction = useCallback(async (action: TimeRecordKey) => {
    if (!user || submitting) return;


    setSubmitting(true);
    console.log(`⚡️ Acionando handleTimeAction para: ${action}`);


    // Usar debounced GPS request
    debouncedLocationRequest(
      action, // Passa a action como string para debouncedLocationRequest
      // O callback onSuccess agora recebe o resultado da validação
      async (locationValidationResult) => {
        console.log('➡️ Callback onSuccess do debouncedLocationRequest iniciado.');
        // Este try block agora engloba a operação Supabase E as ações subsequentes
        try {
          const currentTimeStr = localTime; // Usar localTime memoizado
          const currentTimestampISO = new Date().toISOString(); // Timestamp ISO para o JSON


          // Extrai os dados necessários do resultado da validação
          const { location, closestLocation, distance } = locationValidationResult;


          if (!location || !closestLocation || distance === undefined) {
               console.error('⚠️ Dados de localização incompletos após validação bem-sucedida.');
               throw new Error('Erro interno: dados de localização incompletos para salvar.');
          }


          // Constrói o objeto de detalhes da localização para este ponto
          const newLocationDetail: LocationDetails = {
              address: closestLocation.address,
              distance: Math.round(distance), // Arredonda a distância para inteiro
              latitude: location.latitude,
              longitude: location.longitude,
              timestamp: currentTimestampISO,
              locationName: closestLocation.name,
              // gps_accuracy: location.gpsAccuracy // Não incluído no JSON final se não for necessário
          };


          // Obtém os dados de localização existentes.
          // CORRIGIDO: Verificar se timeRecord.locations é um objeto antes de usá-lo
          // e fazer type assertion para LocationsData. Se não for objeto ou for null, inicia com {}
          const existingLocations = (typeof timeRecord?.locations === 'object' && timeRecord.locations !== null
              ? timeRecord.locations as LocationsData // Type assertion
              : {}) as LocationsData; // Garante que sempre é tratado como LocationsData


          // Cria o objeto de locations atualizado
          const updatedLocations: LocationsData = {
              ...existingLocations,
              [action]: newLocationDetail // Adiciona/atualiza o detalhe para a ação atual
          };


          // Payload ajustado para incluir o horário E o objeto JSON de locations
          let payload: any = {
            [action]: currentTimeStr, // Ex: clock_in: "08:00"
            updated_at: currentTimestampISO,
            locations: updatedLocations // Ex: locations: { clock_in: { ... } }
            // Removido latitude, longitude, gps_accuracy como colunas separadas
          };


          console.log('➡️ Dados a serem enviados para Supabase:', payload); // <-- MANTENHA ESTE LOG PARA VERIFICAR


          let savedRecordData: TimeRecord | null = null;
          let supabaseError = null;


          if (timeRecord?.id) { // Verificar se timeRecord e timeRecord.id existem para UPDATE
            console.log(`🔄 Tentando atualizar registro existente com ID: ${timeRecord.id}`);
            const { data, error } = await supabase
              .from('time_records')
              .update(payload)
              .eq('id', timeRecord.id)
              .select() // Adiciona select() para retornar o registro atualizado
              .single(); // Espera um único registro


            // CORRIGIDO: O dado retornado pelo Supabase tem a tipagem Json para locations.
            // Precisamos garantir que o estado local timeRecord seja atualizado com a tipagem correta.
            // A tipagem TimeRecord agora aceita Json | null para locations, o que deve ser compatível.
            savedRecordData = data ? data as TimeRecord : null; // Type assertion para TimeRecord
            supabaseError = error;


          } else { // Se não houver timeRecord ou ID, INSERIR novo registro
            console.log('➕ Tentando inserir novo registro.');
            payload.user_id = user.id;
            payload.date = localDate;
            // Definir valores iniciais para colunas obrigatórias ou com default
            payload.total_hours = 0;
            payload.normal_hours = 0;
            payload.overtime_hours = 0;
            payload.normal_pay = 0;
            payload.overtime_pay = 0;
            payload.total_pay = 0;
            // payload.status = 'completed'; // Ou o status inicial apropriado
            // payload.is_pending_approval = false; // Ou o valor inicial apropriado


            const { data, error } = await supabase
              .from('time_records')
              .insert(payload)
              .select() // Adiciona select() para retornar o registro inserido
              .single(); // Espera um único registro


            // CORRIGIDO: O dado retornado pelo Supabase tem a tipagem Json para locations.
            // Precisamos garantir que o estado local timeRecord seja atualizado com a tipagem correta.
            // A tipagem TimeRecord agora aceita Json | null para locations, o que deve ser compatível.
            savedRecordData = data ? data as TimeRecord : null; // Type assertion para TimeRecord
            supabaseError = error;
          }


          if (supabaseError) {
            console.error('💥 Erro do Supabase ao salvar/atualizar registro:', supabaseError); // <-- LOG DETALHADO DO ERRO SUPABASE
            // Lança um novo erro com a mensagem do Supabase se disponível
            throw new Error(supabaseError.message || 'Erro desconhecido do Supabase ao registrar');
          }


          console.log('✅ Supabase salvou/atualizou registro com sucesso. Dados retornados:', savedRecordData); // Log sucesso Supabase


          // --- Ações que acontecem APÓS o sucesso do Supabase ---


          // 1. Atualizar estado local com o registro retornado pelo Supabase
          if (savedRecordData) {
               setTimeRecord(savedRecordData);
               console.log('✨ Estado local timeRecord atualizado com dados salvos.');
          } else {
               console.warn('Supabase retornou sucesso, mas nenhum dado foi retornado.');
          .');
          }


          // 2. Mostrar toast de sucesso
          const actionNames = fieldNames; // Usar fieldNames
          toast({
            title: "Sucesso",
            description: `${actionNames[action]} registrada às ${currentTimeStr}`,
          });
          console.log('🎉 Toast de sucesso exibido.');


          // 3. Refetch dados para garantir a UI atualizada (opcional, mas bom para sincronia)
          console.log('🔄 Iniciando refetchRecord...');
          // Não é estritamente necessário refetch aqui se setTimeRecord já atualizou o estado
          // mas pode ser útil para garantir consistência com o cache do useOptimizedQuery.
          // await refetchRecord();
          console.log('✅ RefetchRecord (opcional) concluído.');


          // 4. Limpar cache de localização
          clearLocationCache();
          console.log('🧹 Cache de localização limpo.');


        } catch (error: any) { // <-- Este catch agora pega erros do Supabase OU das ações subsequentes
          console.error('❌ Erro capturado no fluxo de registro (após validação):', error); // <-- LOG DETALHADO DO ERRO GERAL
          toast({
            title: "Erro",
            description: error.message || "Erro ao registrar horário", // Usa a mensagem do erro lançado
            variant: "destructive"
          });
        } finally {
            // O setSubmitting(false) final será chamado no finally dos callbacks
            console.log('➡️ Fim do callback onSuccess do debouncedLocationRequest.');
            setSubmitting(false); // Mover setSubmitting(false) para o finally aqui
        }
      },
      (message) => { // onError callback do debouncedLocationRequest
        console.warn('Validação de localização falhou:', message);
        toast({
          title: "Localização não autorizada",
          description: message,
          variant: "destructive"
        });
        // O setSubmitting(false) final será chamado no finally dos callbacks
        console.log('➡️ Fim do callback onError do debouncedLocationRequest.');
        setSubmitting(false); // Mover setSubmitting(false) para o finally aqui
      }
    );


  }, [user, submitting, timeRecord, localDate, localTime, allowedLocations, debouncedLocationRequest, refetchRecord, toast, fieldNames]);


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
    // CORRIGIDO: Tipar key como TimeRecordKey
    { key: 'clock_in' as TimeRecordKey, label: 'Entrada', icon: LogIn, color: 'bg-green-500' },
    { key: 'lunch_start' as TimeRecordKey, label: 'Início Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'lunch_end' as TimeRecordKey, label: 'Volta Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'clock_out' as TimeRecordKey, label: 'Saída', icon: LogOut, color: 'bg-red-500' },
  ], []);


  // CORRIGIDO: getValue agora aceita TimeRecordKey
  const getValue = useCallback((key: TimeRecordKey) => {
    // Acessa diretamente a propriedade do timeRecord que corresponde ao horário
    return timeRecord?.[key];
  }, [timeRecord]);


  const completedCount = useMemo(() => {
    return steps.filter(step => getValue(step.key)).length;
  }, [steps, getValue]);


  // CORRIGIDO: nextAction retorna TimeRecordKey | null
  const nextAction = useMemo<TimeRecordKey | null>(() => {
    if (!timeRecord?.clock_in) return 'clock_in';
    if (!timeRecord?.lunch_start) return 'lunch_start';
    if (!timeRecord?.lunch_end) return 'lunch_end';
    if (!timeRecord?.clock_out) return 'clock_out';
    return null;
  }, [timeRecord]);


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
                // CORRIGIDO: Usar getValue com a chave tipada corretamente
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
                    {/* CORRIGIDO: Chamar getValue com a chave correta para exibir o horário */}
                    {isCompleted && (
                      <span className="text-xs text-blue-600 mt-1 font-medium">
                        {getValue(step.key)}
                      </span>
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
            <Button
              onClick={() => handleTimeAction(nextAction)} // nextAction já é TimeRecordKey
              disabled={submitting}
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
            >
              <Clock className="w-5 h-5 mr-2" />
              {submitting ? 'Registrando...' : 'Registrar'}
            </Button>
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
