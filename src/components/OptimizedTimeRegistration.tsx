import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Adicionado CardHeader, CardTitle
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, LogIn, Coffee, LogOut, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'; // Adicionado ícones de status e navegação
import { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { validateLocationForTimeRecord, Location } from '@/utils/optimizedLocationValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { clearLocationCache } from '@/utils/optimizedLocationValidation';
import { Badge } from '@/components/ui/badge'; // Adicionado Badge


type TimeRecordKey = 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';


interface LocationDetails {
  address: string;
  distance: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  locationName: string;
}


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
  locations?: Json | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_pending_approval?: boolean;
  approved_by?: string;
  approved_at?: string;
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


// Interface para as solicitações de edição (baseado no código de aprovação)
interface EditRequest {
  id: string;
  created_at: string;
  employee_id: string;
  employee_name: string;
  date: string;
  field: TimeRecordKey;
  old_value: string | null;
  new_value: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
}


const COOLDOWN_DURATION_MS = 20 * 60 * 1000;
const ITEMS_PER_PAGE = 5; // ✨ Define quantos cards de histórico por página


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
  const [editField, setEditField] = useState<TimeRecordKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userProfile, setUserProfile] = useState<{ name?: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();


  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  const [remainingCooldown, setRemainingCooldown] = useState<number | null>(null);


  // ✨ Estado para paginação do histórico
  const [historyPage, setHistoryPage] = useState(0);


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


  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, [currentTime.getHours]);


  const userDisplayName = useMemo(() => {
    if (userProfile?.name) {
      return userProfile.name.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Usuário';
  }, [userProfile?.name, user?.email]);


  const fieldNames: Record<TimeRecordKey, string> = useMemo(() => ({
    clock_in: 'Entrada',
    lunch_start: 'Início do Almoço',
    lunch_end: 'Fim do Almoço',
    clock_out: 'Saída'
  }), []);


  const { data: allowedLocations = [] } = useOptimizedQuery<AllowedLocation[]>({
    queryKey: ['allowed-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');


      if (error) {
        throw error;
      }


      return (data || []).map(location => ({
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        range_meters: Number(location.range_meters)
      }));
    },
    staleTime: 30 * 60 * 1000,
    refetchInterval: false
  });


  const { data: profileData } = useOptimizedQuery<{ name?: string } | null>({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;


      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();


      if (error && error.code !== 'PGRST116') {
        throw error;
      }
       if (error && error.code === 'PGRST116') {
          return null;
       }


      return data;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!user
  });


  const {
    data: todayRecord,
    refetch: refetchRecord,
    isLoading: loadingRecord
  } = useOptimizedQuery<TimeRecord | null>({
    queryKey: ['today-record', user?.id, localDate],
    queryFn: async () => {
      if (!user) return null;


      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', localDate)
        .single();


      if (error && error.code !== 'PGRST116') {
         throw error;
      }
      if (error && error.code === 'PGRST116') {
         return null;
      }


      return data;
    },
    staleTime: 5 * 60 * 1000, // ✨ Aumentei o staleTime para evitar refetch desnecessário
    enabled: !!user
  });


  // ✨ Novo hook para buscar o histórico de solicitações de edição do usuário
  const {
    data: editRequestsHistory,
    isLoading: loadingHistory,
    isError: historyError,
    refetch: refetchHistory
  } = useOptimizedQuery<EditRequest[]>({
    queryKey: ['user-edit-requests', user?.id, historyPage],
    queryFn: async () => {
      if (!user?.id) return [];
      const start = historyPage * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE - 1;


      const { data, error } = await supabase
        .from('edit_requests')
        .select('*', { count: 'exact' }) // ✨ Adiciona contagem total para paginação
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false })
        .range(start, end);


      if (error) {
        throw error;
      }


      // ✨ Retorna os dados e a contagem total
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
    keepPreviousData: true // ✨ Mantém dados anteriores ao mudar de página
  });


  // ✨ Hook separado para buscar a contagem total (para paginação)
  const { data: totalHistoryCount } = useOptimizedQuery<number>({
    queryKey: ['user-edit-requests-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('edit_requests')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', user.id);


      if (error) {
        throw error;
      }
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id
  });


  const totalPages = useMemo(() => {
    if (totalHistoryCount === undefined) return 0;
    return Math.ceil(totalHistoryCount / ITEMS_PER_PAGE);
  }, [totalHistoryCount]);


  useEffect(() => {
    if (profileData !== undefined) {
      setUserProfile(profileData);
    }
  }, [profileData]);


  // ✨ MELHORIA: Melhor gerenciamento do estado do timeRecord
  useEffect(() => {
    if (todayRecord !== undefined) {
      setTimeRecord(prevRecord => {
        // Se já temos um registro local mais recente, manter ele
        if (prevRecord && todayRecord && prevRecord.updated_at && todayRecord.updated_at) {
          const prevTime = new Date(prevRecord.updated_at).getTime();
          const newTime = new Date(todayRecord.updated_at).getTime();
          return prevTime >= newTime ? prevRecord : todayRecord;
        }
        return todayRecord;
      });
    }
  }, [todayRecord]);


  // ✨ Timer do relógio - atualizado a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);


    return () => clearInterval(timer);
  }, []);


  // ✨ MELHORIA: Gerenciamento do cooldown mais robusto
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;


    const updateCooldown = () => {
      const storedCooldown = localStorage.getItem('timeRegistrationCooldown');
      if (storedCooldown) {
        const endTime = Number(storedCooldown);
        const now = Date.now();
        
        if (endTime > now) {
          setCooldownEndTime(endTime);
          setRemainingCooldown(endTime - now);
        } else {
          localStorage.removeItem('timeRegistrationCooldown');
          setCooldownEndTime(null);
          setRemainingCooldown(null);
        }
      } else {
        setCooldownEndTime(null);
        setRemainingCooldown(null);
      }
    };


    // Verificar imediatamente
    updateCooldown();


    // Atualizar a cada segundo
    intervalId = setInterval(updateCooldown, 1000);


    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);


  const debouncedLocationRequest = useDebouncedCallback(
    async (action: string, onSuccess: (locationValidationResult: { valid: boolean; location?: Location; message: string; closestLocation?: AllowedLocation; distance?: number; gpsAccuracy?: number; adaptiveRange?: number; }) => void, onError: (message: string) => void) => {
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


        onSuccess(locationValidation);


      } catch (error: any) {
        onError(error.message || 'Erro ao validar localização');
      }
    },
    2000
  );


  const handleTimeAction = useCallback(async (action: TimeRecordKey) => {
    if (!user || submitting) return;


    if (cooldownEndTime && cooldownEndTime > Date.now()) {
        toast({
            title: "Aguarde",
            description: `Você só pode registrar o próximo ponto após ${formatRemainingTime(cooldownEndTime - Date.now())}.`,
            variant: "default"
        });
        return;
    }


    setSubmitting(true);


    debouncedLocationRequest(
      action,
      async (locationValidationResult) => {
        try {
          const now = new Date();
          const currentTimeString = format(now, 'HH:mm:ss');
          const currentDateString = localDate;


          const locationData: LocationDetails = {
            address: locationValidationResult.closestLocation?.address || 'Endereço não disponível',
            distance: locationValidationResult.distance || 0,
            latitude: locationValidationResult.location?.latitude || 0,
            longitude: locationValidationResult.location?.longitude || 0,
            timestamp: now.toISOString(),
            locationName: locationValidationResult.closestLocation?.name || 'Localização Desconhecida',
          };


          const locationsJson = timeRecord?.locations ? { ...timeRecord.locations as LocationsData } : {};
          locationsJson[action] = locationData;


          const upsertData = {
            user_id: user.id,
            date: currentDateString,
            [action]: currentTimeString,
            locations: locationsJson as Json,
          };


          const { data: updatedRecord, error: updateError } = await supabase
            .from('time_records')
            .upsert(upsertData, { onConflict: 'date, user_id' })
            .select('*')
            .single();


          if (updateError) {
            throw new Error(`Erro ao salvar registro: ${updateError.message}`);
          }


          // ✨ MELHORIA: Atualizar estado local imediatamente para feedback visual instantâneo
          setTimeRecord(updatedRecord);


          // ✨ MELHORIA: Iniciar cooldown imediatamente para feedback visual
          const newCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
          setCooldownEndTime(newCooldownEndTime);
          setRemainingCooldown(COOLDOWN_DURATION_MS);
          localStorage.setItem('timeRegistrationCooldown', newCooldownEndTime.toString());


          // Limpar cache de localização
          clearLocationCache();


          toast({
            title: "Sucesso",
            description: `${fieldNames[action]} registrado em ${currentTimeString.slice(0, 5)}!`,
          });


          // ✨ MELHORIA: Refetch em background, mas não substituir o estado local se mais recente
          setTimeout(() => {
            refetchRecord();
          }, 1000);


        } catch (error: any) {
          console.error('Erro capturado no fluxo de registro (após validação):', error);
          toast({
            title: "Erro",
            description: error.message || "Erro ao registrar horário",
            variant: "destructive"
          });
        } finally {
          setSubmitting(false);
        }
      },
      (message) => {
        toast({
          title: "Localização não autorizada",
          description: message,
          variant: "destructive"
        });
        setSubmitting(false);
      }
    );


  }, [user, submitting, timeRecord, localDate, allowedLocations, debouncedLocationRequest, refetchRecord, toast, fieldNames, cooldownEndTime]);


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
          employee_name: userProfile?.name || user.email || 'Usuário',
          date: localDate,
          field: editField,
          old_value: timeRecord?.[editField] || null,
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


      // ✨ Refetch o histórico após enviar uma nova solicitação
      refetchHistory();


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
  }, [user, userProfile?.name, editField, editValue, editReason, timeRecord, localDate, toast, refetchHistory]);


  // ✨ MELHORIA: Verificação de mudança de data mais eficiente
  useEffect(() => {
    const checkDateChange = () => {
      const currentDate = localDate;
      const recordDate = timeRecord?.date;


      if (recordDate && recordDate !== currentDate) {
        setTimeRecord(null);
        refetchRecord();
      }
    };


    const interval = setInterval(checkDateChange, 60000);
    return () => clearInterval(interval);
  }, [timeRecord?.date, localDate, refetchRecord]);


  const steps = useMemo(() => [
    { key: 'clock_in' as TimeRecordKey, label: 'Entrada', icon: LogIn, color: 'bg-green-500' },
    { key: 'lunch_start' as TimeRecordKey, label: 'Início Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'lunch_end' as TimeRecordKey, label: 'Volta Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'clock_out' as TimeRecordKey, label: 'Saída', icon: LogOut, color: 'bg-red-500' },
  ], []);


  const getValue = useCallback((key: TimeRecordKey) => {
    return timeRecord?.[key];
  }, [timeRecord]);


  const completedCount = useMemo(() => {
    return steps.filter(step => getValue(step.key)).length;
  }, [steps, getValue]);


  const nextAction = useMemo<TimeRecordKey | null>(() => {
    if (!timeRecord?.clock_in) return 'clock_in';
    if (!timeRecord?.lunch_start) return 'lunch_start';
    if (!timeRecord?.lunch_end) return 'lunch_end';
    if (!timeRecord?.clock_out) return 'clock_out';
    return null;
  }, [timeRecord]);


  const isRegistrationButtonDisabled = useMemo(() => {
      return submitting || (cooldownEndTime !== null && cooldownEndTime > Date.now());
  }, [submitting, cooldownEndTime]);


  // ✨ MELHORIA: Calcular se está em cooldown de forma mais dinâmica
  const isInCooldown = useMemo(() => {
    return cooldownEndTime !== null && remainingCooldown !== null && remainingCooldown > 0;
  }, [cooldownEndTime, remainingCooldown]);


  // ✨ Funções de paginação
  const handlePreviousPage = useCallback(() => {
    setHistoryPage(prev => Math.max(0, prev - 1));
  }, []);


  const handleNextPage = useCallback(() => {
    setHistoryPage(prev => Math.min(totalPages - 1, prev + 1));
  }, [totalPages]);


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
      <div className="w-full max-w-md mb-6 pl-20 sm:pl-16">
      </div>


      <div className="text-center mb-4">
        <div className="text-blue-600 text-xl sm:text-2xl font-semibold mb-1">
          {greeting}, {userDisplayName}! 👋
        </div>
        <div className="text-gray-500 text-sm sm:text-base">
          Pronto para registrar seu ponto?
        </div>
      </div>


      <div className="text-center mb-6">
        <div className="text-gray-600 text-base sm:text-lg mb-2">
          {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
        <div className="text-gray-900 text-4xl sm:text-6xl font-bold tracking-wider mb-4">
          {format(currentTime, 'HH:mm:ss')}
        </div>
      </div>


      <Card className="w-full max-w-md bg-white shadow-lg">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
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
                     {isCompleted && (
                        <span className="text-xs text-blue-600 mt-1 font-medium">
                          {getValue(step.key)}
                        </span>
                     )}
                  </div>
                );
              })}
            </div>


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


          {nextAction && (
            <>
              <Button
                onClick={() => handleTimeAction(nextAction)}
                disabled={isRegistrationButtonDisabled}
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white touch-manipulation disabled:bg-gray-400"
              >
                <Clock className="w-5 h-5 mr-2" />
                {submitting ? 'Registrando...' : isInCooldown ? 'Aguarde...' : 'Registrar'}
              </Button>
              
              {/* ✨ MELHORIA: Contador sempre visível quando há cooldown */}
              {isInCooldown && (
                  <div className="text-center text-sm mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="text-yellow-800 font-medium mb-1">
                          ⏱️ Aguarde para o próximo registro
                      </div>
                      <div className="text-yellow-700">
                          Disponível em: <span className="font-mono font-bold">{formatRemainingTime(remainingCooldown!)}</span>
                      </div>
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


      {/* ✨ Nova Seção: Histórico de Solicitações de Alteração */}
      <Card className="w-full max-w-md bg-white shadow-lg mt-8">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Histórico de Solicitações</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Carregando histórico...</span>
            </div>
          ) : historyError ? (
            <div className="text-center text-red-600 py-4">
              Erro ao carregar histórico.
            </div>
          ) : (editRequestsHistory?.length || 0) === 0 ? (
            <div className="text-center text-gray-500 py-4 text-sm">
              Nenhuma solicitação de alteração encontrada.
            </div>
          ) : (
            <div className="space-y-4">
              {editRequestsHistory?.map((request) => (
                <Card key={request.id} className="p-3 border shadow-sm"> {/* Card mais compacto */}
                  <CardContent className="p-0 text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-gray-800">
                        {format(new Date(request.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })} - {fieldNames[request.field]}
                      </div>
                      <Badge
                        className={`text-xs px-2 py-0.5 ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}
                      >
                        {request.status === 'pending' ? (
                          <AlertCircle className="w-3 h-3 mr-1 inline-block" />
                        ) : request.status === 'approved' ? (
                          <CheckCircle className="w-3 h-3 mr-1 inline-block" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1 inline-block" />
                        )}
                        {request.status === 'pending' ? 'Pendente' : request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                      </Badge>
                    </div>
                    <div className="text-gray-600 mb-2">
                      De: <span className="font-medium">{request.old_value || 'Não registrado'}</span> para: <span className="font-medium">{request.new_value}</span>
                    </div>
                    <div className="text-gray-500 text-xs italic mb-2">
                      Motivo: {request.reason}
                    </div>
                    <div className="text-gray-400 text-xs text-right">
                      Solicitado em: {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </div>
                  </CardContent>
                </Card>
              ))}


              {/* Controles de Paginação */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <Button
                    variant="outline"
                    onClick={handlePreviousPage}
                    disabled={historyPage === 0 || loadingHistory}
                    size="sm"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {historyPage + 1} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={handleNextPage}
                    disabled={historyPage >= totalPages - 1 || loadingHistory}
                    size="sm"
                  >
                    Próxima <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>


      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Solicitar Alteração - {editField ? fieldNames[editField] : ''}
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
