
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, LogIn, Coffee, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useOptimizedLocation, clearOptimizedLocationCache } from '@/hooks/useOptimizedLocation';
import { useOptimizedWorkShiftValidation } from '@/hooks/useOptimizedWorkShiftValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';

type TimeRecordKey = 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';

interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  locations?: any;
  updated_at?: string;
}

const COOLDOWN_DURATION_MS = 5 * 60 * 1000; // Reduzido para 5 minutos

const UltraOptimizedTimeRegistration = React.memo(() => {
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);

  const { user, profile } = useOptimizedAuth();
  const { location, loading: locationLoading, requestLocation } = useOptimizedLocation();
  const { canRegisterPoint, currentShiftMessage, loading: shiftLoading } = useOptimizedWorkShiftValidation();
  const { toast } = useToast();

  // Data local memoizada
  const localDate = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  // Greeting memoizado
  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, [currentTime.getHours()]);

  // Nome do usuário memoizado
  const userDisplayName = useMemo(() => {
    if (profile?.name) return profile.name.split(' ')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'Usuário';
  }, [profile?.name, user?.email]);

  // Query otimizada para registro de hoje
  const { data: timeRecord, refetch: refetchRecord } = useQuery({
    queryKey: ['time-record', user?.id, localDate],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', localDate)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: true,
  });

  // Steps memoizados
  const steps = useMemo(() => [
    { key: 'clock_in' as TimeRecordKey, label: 'Entrada', icon: LogIn, color: 'bg-green-500' },
    { key: 'lunch_start' as TimeRecordKey, label: 'Início Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'lunch_end' as TimeRecordKey, label: 'Volta Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'clock_out' as TimeRecordKey, label: 'Saída', icon: LogOut, color: 'bg-red-500' },
  ], []);

  // Próxima ação memoizada
  const nextAction = useMemo<TimeRecordKey | null>(() => {
    if (!timeRecord?.clock_in) return 'clock_in';
    if (!timeRecord?.lunch_start) return 'lunch_start';
    if (!timeRecord?.lunch_end) return 'lunch_end';
    if (!timeRecord?.clock_out) return 'clock_out';
    return null;
  }, [timeRecord]);

  // Função para registrar ponto otimizada
  const handleTimeAction = useCallback(async (action: TimeRecordKey) => {
    if (!user || submitting) return;

    if (!canRegisterPoint) {
      toast({
        title: "Horário não permitido",
        description: "O registro de ponto está restrito aos horários do seu turno de trabalho",
        variant: "destructive"
      });
      return;
    }

    if (cooldownEndTime && cooldownEndTime > Date.now()) {
      const remaining = Math.ceil((cooldownEndTime - Date.now()) / 1000 / 60);
      toast({
        title: "Aguarde",
        description: `Você só pode registrar o próximo ponto em ${remaining} minutos.`,
        variant: "default"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Obter localização se necessário
      let userLocation = location;
      if (!userLocation) {
        userLocation = await requestLocation();
        if (!userLocation) {
          throw new Error('Localização não encontrada');
        }
      }

      const now = new Date();
      const currentTimeString = format(now, 'HH:mm:ss');

      const locationData = {
        address: 'Localização atual',
        distance: 0,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        timestamp: now.toISOString(),
        locationName: 'Localização Atual',
      };

      const locationsJson = timeRecord?.locations ? { ...timeRecord.locations } : {};
      locationsJson[action] = locationData;

      const upsertData = {
        user_id: user.id,
        date: localDate,
        [action]: currentTimeString,
        locations: locationsJson,
      };

      const { error } = await supabase
        .from('time_records')
        .upsert(upsertData, { onConflict: 'date, user_id' });

      if (error) throw error;

      // Definir cooldown
      const newCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
      setCooldownEndTime(newCooldownEndTime);
      localStorage.setItem('timeRegistrationCooldown', newCooldownEndTime.toString());

      clearOptimizedLocationCache();

      toast({
        title: "Sucesso",
        description: `Ponto registrado às ${currentTimeString.slice(0, 5)}!`,
      });

      // Refetch em background
      setTimeout(() => refetchRecord(), 1000);

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao registrar horário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  }, [user, submitting, canRegisterPoint, cooldownEndTime, location, timeRecord, requestLocation, localDate, toast, refetchRecord]);

  // Timer do relógio otimizado - apenas atualiza minutos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // A cada minuto

    return () => clearInterval(timer);
  }, []);

  // Gerenciamento do cooldown
  useEffect(() => {
    const storedCooldown = localStorage.getItem('timeRegistrationCooldown');
    if (storedCooldown) {
      const endTime = Number(storedCooldown);
      if (endTime > Date.now()) {
        setCooldownEndTime(endTime);
      } else {
        localStorage.removeItem('timeRegistrationCooldown');
      }
    }

    const cooldownTimer = setInterval(() => {
      if (cooldownEndTime && cooldownEndTime <= Date.now()) {
        setCooldownEndTime(null);
        localStorage.removeItem('timeRegistrationCooldown');
      }
    }, 30000); // Check a cada 30 segundos

    return () => clearInterval(cooldownTimer);
  }, [cooldownEndTime]);

  const isButtonDisabled = submitting || 
                          (cooldownEndTime !== null && cooldownEndTime > Date.now()) ||
                          shiftLoading ||
                          !canRegisterPoint;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8">
      <div className="text-center mb-4">
        <div className="text-blue-600 text-xl sm:text-2xl font-semibold mb-1">
          {greeting}, {userDisplayName}! 👋
        </div>
        <div className="text-gray-500 text-sm sm:text-base">
          Pronto para registrar seu ponto?
        </div>
        {currentShiftMessage && (
          <div className="text-xs text-blue-600 mt-1 bg-blue-50 p-2 rounded">
            {currentShiftMessage}
          </div>
        )}
      </div>

      <div className="text-center mb-6">
        <div className="text-gray-600 text-base sm:text-lg mb-2">
          {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
        <div className="text-gray-900 text-4xl sm:text-6xl font-bold tracking-wider mb-4">
          {format(currentTime, 'HH:mm')}
        </div>
      </div>

      <Card className="w-full max-w-md bg-white shadow-lg">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = !!timeRecord?.[step.key];
                const completedCount = steps.filter(s => timeRecord?.[s.key]).length;
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
                        {timeRecord?.[step.key]}
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
                  width: `${(steps.filter(s => timeRecord?.[s.key]).length / 4) * 100}%`,
                }}
              />
            </div>
          </div>

          {locationLoading && (
            <div className="text-center py-4 text-blue-600">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <div className="text-sm">Obtendo localização...</div>
            </div>
          )}

          {nextAction && !locationLoading && (
            <Button
              onClick={() => handleTimeAction(nextAction)}
              disabled={isButtonDisabled}
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Clock className="w-5 h-5 mr-2" />
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : !canRegisterPoint ? (
                'Fora do horário permitido'
              ) : (
                'Registrar'
              )}
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
    </div>
  );
});

UltraOptimizedTimeRegistration.displayName = 'UltraOptimizedTimeRegistration';

export default UltraOptimizedTimeRegistration;
