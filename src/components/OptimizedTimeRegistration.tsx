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
  timestamp: string;
  latitude: number;
  longitude: number;
  user_id: string;
  type: 'clock_in' | 'clock_out';
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
        .from('time_registrations')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error) {
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
      const registrationType =
        lastRegistration?.type === 'clock_in' ? 'clock_out' : 'clock_in';

      const { data, error } = await supabase
        .from('time_registrations')
        .insert([
          {
            timestamp: new Date().toISOString(),
            latitude: location.latitude,
            longitude: location.longitude,
            user_id: user.id,
            type: registrationType,
          },
        ])
        .select('*')
        .single();

      if (error) {
        console.error("Erro ao registrar ponto:", error);
        toast({
          title: "Erro",
          description: "Erro ao registrar ponto.",
          variant: "destructive",
        });
        setRegistering(false);
        return;
      }

      setLastRegistration(data);

      // ✨ Enviar notificação push
      const pushService = PushNotificationService.getInstance();
      await pushService.sendNotification({
        userId: user.id,
        title: 'Novo Registro de Ponto',
        body: `Você registrou ${registrationType === 'clock_in' ? 'entrada' : 'saída'} às ${currentTime.toLocaleTimeString('pt-BR')}`,
      });

      toast({
        title: "Sucesso",
        description: `Ponto registrado com sucesso às ${currentTime.toLocaleTimeString('pt-BR')}`,
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

    if (lastRegistration?.type === 'clock_in') {
      return "Registrar Saída";
    }
    return "Registrar Entrada";
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
              {lastRegistration.type === 'clock_in' ? 'Entrada' : 'Saída'} em{' '}
              {new Date(lastRegistration.timestamp).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OptimizedTimeRegistration;
