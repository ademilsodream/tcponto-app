
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Clock, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { supabase } from '@/integrations/supabase/client';
import { PushNotificationService } from '@/services/PushNotificationService';
import { useWorkShiftValidation } from '@/hooks/useWorkShiftValidation';

interface TimeRegistration {
  id: string;
  user_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  lunch_start?: string;
  lunch_end?: string;
  total_hours: number;
  normal_hours: number;
  overtime_hours: number;
  locations?: any;
}

const OptimizedTimeRegistration = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [registering, setRegistering] = useState(false);
  const { user, profile, refreshProfile } = useAuth();
  const { location, loading: locationLoading, error: locationError } = useLocation();
  const { toast } = useToast();
  const [lastRegistration, setLastRegistration] = useState<TimeRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const { canRegisterPoint, currentShiftMessage, loading: shiftLoading } = useWorkShiftValidation();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadLastRegistration = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Erro ao carregar último registro:", error);
        return;
      }

      setLastRegistration(data || null);
    } catch (error) {
      console.error("Erro ao carregar último registro:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadLastRegistration();
  }, [loadLastRegistration]);

  const handleClockAction = async () => {
    if (!user || !location) {
      toast({
        title: "Erro",
        description: "Usuário ou localização não encontrados.",
        variant: "destructive",
      });
      return;
    }

    setRegistering(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

      // Verificar se já existe um registro para hoje
      const { data: existingRecord } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      let registrationType: 'clock_in' | 'clock_out' | 'lunch_start' | 'lunch_end' = 'clock_in';

      if (existingRecord) {
        if (!existingRecord.clock_in) {
          registrationType = 'clock_in';
        } else if (!existingRecord.lunch_start) {
          registrationType = 'lunch_start';
        } else if (!existingRecord.lunch_end) {
          registrationType = 'lunch_end';
        } else if (!existingRecord.clock_out) {
          registrationType = 'clock_out';
        }
      }

      // Preparar dados de localização de forma segura
      const existingLocations = existingRecord?.locations || {};
      const newLocationData = {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
      };

      const updateData = {
        [registrationType]: currentTime,
        locations: {
          ...existingLocations,
          [registrationType]: newLocationData
        }
      };

      if (existingRecord) {
        const { error } = await supabase
          .from('time_records')
          .update(updateData)
          .eq('id', existingRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: today,
            ...updateData
          });

        if (error) throw error;
      }

      // Tentar enviar notificação push (opcional)
      try {
        const pushService = PushNotificationService.getInstance();
        await pushService.sendNotification({
          userId: user.id,
          title: 'Ponto Registrado',
          body: `Ponto registrado com sucesso às ${new Date().toLocaleTimeString('pt-BR')}`
        });
      } catch (pushError) {
        console.warn('Erro ao enviar notificação push:', pushError);
        // Não interromper o fluxo por erro de push notification
      }

      toast({
        title: "Sucesso",
        description: `Ponto registrado com sucesso às ${new Date().toLocaleTimeString('pt-BR')}`,
      });

      await loadLastRegistration();
      await refreshProfile();
    } catch (error) {
      console.error("Erro ao registrar ponto:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar ponto.",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

  const getButtonText = () => {
    if (loading) {
      return "Carregando...";
    }

    if (!lastRegistration) {
      return "Registrar Entrada";
    }

    const today = new Date().toISOString().split('T')[0];
    if (lastRegistration.date !== today) {
      return "Registrar Entrada";
    }

    if (!lastRegistration.clock_in) {
      return "Registrar Entrada";
    } else if (!lastRegistration.lunch_start) {
      return "Registrar Início do Almoço";
    } else if (!lastRegistration.lunch_end) {
      return "Registrar Volta do Almoço";
    } else if (!lastRegistration.clock_out) {
      return "Registrar Saída";
    }
    
    return "Registros Completos";
  };

  if (locationError) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          Erro ao obter localização. Verifique as permissões do navegador.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Registro de Ponto
        </CardTitle>
        {currentShiftMessage && (
          <div className="text-sm text-muted-foreground">
            {currentShiftMessage}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Carregando...
          </div>
        ) : locationLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Obtendo localização...
          </div>
        ) : !location ? (
          <div className="text-center text-muted-foreground">
            <MapPin className="w-5 h-5 inline-block mr-1" />
            Localização não permitida.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">
                  Latitude: {location.latitude}
                </div>
                <div className="text-sm text-muted-foreground">
                  Longitude: {location.longitude}
                </div>
              </div>
              <div>
                {profile?.departments && (
                  <div className="text-sm text-muted-foreground">
                    Departamento: {profile?.departments?.name}
                  </div>
                )}
                {profile?.job_functions && (
                  <div className="text-sm text-muted-foreground">
                    Função: {profile?.job_functions?.name}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Botão de registro com validação de turno */}
        <div className="text-center space-y-4">
          <div className="text-2xl font-mono">
            {currentTime.toLocaleTimeString('pt-BR')}
          </div>
          
          <Button
            onClick={handleClockAction}
            disabled={registering || locationLoading || shiftLoading || !canRegisterPoint}
            size="lg"
            className="w-full"
          >
            {registering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : !canRegisterPoint ? (
              'Fora do horário permitido para registro de ponto'
            ) : (
              getButtonText()
            )}
          </Button>

          {!canRegisterPoint && (
            <div className="text-xs text-muted-foreground">
              O registro de ponto está restrito aos horários do seu turno de trabalho
            </div>
          )}
        </div>

        {lastRegistration && (
          <div className="border-t pt-4">
            <div className="text-sm font-medium">Último Registro:</div>
            <div className="text-sm text-muted-foreground">
              {lastRegistration.clock_out ? 'Saída' : 
               lastRegistration.lunch_end ? 'Volta do Almoço' :
               lastRegistration.lunch_start ? 'Início do Almoço' :
               lastRegistration.clock_in ? 'Entrada' : 'Nenhum'} em{' '}
              {lastRegistration.date}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OptimizedTimeRegistration;
