import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useUnifiedLocation } from '@/hooks/useUnifiedLocation';
import { supabase } from '@/integrations/supabase/client';
import { Clock, MapPin, Wifi, WifiOff, Battery, Signal } from 'lucide-react';
import { UnifiedGPSStatus } from './UnifiedGPSStatus';
import { TimeDisplay } from './TimeDisplay';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimeRegistration } from '@/types/timeRegistration';

const UnifiedTimeRegistration: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [lastRegistration, setLastRegistration] = useState<TimeRegistration | null>(null);
  const { user, profile } = useOptimizedAuth();
  const { toast } = useToast();

  const {
    location,
    loading,
    error,
    validationResult,
    canRegister,
    calibration,
    validateLocation,
    calibrateForCurrentLocation,
    refreshLocation,
    clearCalibration,
    gpsQuality,
    debug
  } = useUnifiedLocation(profile?.departments ? [{
    id: profile.department_id || 'any',
    name: profile.departments?.name || 'Anywhere',
    address: 'Endereço padrão',
    latitude: 0,
    longitude: 0,
    range_meters: 500,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }] : []);

  const fetchLastRegistration = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar último registro:", error);
        return;
      }

      if (data) {
        setLastRegistration(data as TimeRegistration);
      }
    } catch (err) {
      console.error("Erro inesperado ao buscar último registro:", err);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchLastRegistration();
  }, [fetchLastRegistration]);

  const handleTimeRegistration = async () => {
    if (!location || !profile) {
      toast({
        title: "Erro",
        description: "Localização não disponível. Tente novamente.",
        variant: "destructive"
      });
      return;
    }

    setIsRegistering(true);

    try {
      const { data, error } = await supabase
        .from('time_records')
        .insert([
          {
            user_id: profile.id,
            date: new Date().toISOString().split('T')[0],
            clock_in: new Date().toTimeString().split(' ')[0],
            locations: {
              clock_in: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                timestamp: new Date(location.timestamp).toISOString(),
                locationName: validationResult?.closestLocation?.name || 'Desconhecido'
              }
            }
          }
        ])
        .select('*')
        .maybeSingle();

      if (error) {
        console.error("Erro ao registrar ponto:", error);
        toast({
          title: "Erro",
          description: "Falha ao registrar o ponto. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      if (data) {
        setLastRegistration(data as TimeRegistration);
        toast({
          title: "Sucesso",
          description: "Ponto registrado com sucesso!",
        });
        fetchLastRegistration();
      }
    } catch (err) {
      console.error("Erro inesperado ao registrar ponto:", err);
      toast({
        title: "Erro",
        description: "Erro inesperado ao registrar o ponto.",
        variant: "destructive"
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleValidateLocation = () => {
    validateLocation();
  };

  const handleClearCalibration = () => {
    clearCalibration('any'); // Provide a default locationId
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header and Status Section */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Registro de Ponto</h2>
        <p className="text-gray-500">
          {profile?.name} - {profile?.departments?.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status do GPS</CardTitle>
        </CardHeader>
        <CardContent>
          <UnifiedGPSStatus
            loading={loading}
            error={error}
            location={location}
            gpsQuality={gpsQuality}
            validationResult={validationResult}
            canRegister={canRegister}
            calibration={calibration}
            validateLocation={handleValidateLocation}
            calibrateForCurrentLocation={calibrateForCurrentLocation}
            refreshLocation={refreshLocation}
            clearCalibration={handleClearCalibration}
            debug={debug}
          />
        </CardContent>
      </Card>
      
      {/* Registration Button */}
      <Card>
        <CardContent className="p-6">
          <Button
            onClick={handleTimeRegistration}
            disabled={isRegistering || !canRegister}
            size="lg"
            variant="default"
            className="w-full h-16 text-lg font-semibold"
          >
            {isRegistering ? (
              <>
                Registrando...
              </>
            ) : (
              <>
                <Clock className="mr-2 h-5 w-5" />
                Registrar Ponto
              </>
            )}
          </Button>
          
          {/* Validation Messages */}
          {validationResult && !canRegister && (
            <div className="mt-4 text-red-500">
              {validationResult.message}
            </div>
          )}

          {/* Last Registration Info */}
          {lastRegistration && (
            <div className="mt-4">
              <Separator className="my-2" />
              <p className="text-sm text-gray-500">
                Último registro: {format(new Date(lastRegistration.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </p>
              <p className="text-sm text-gray-500">
                Local: {lastRegistration.locations ? 'Registrado' : 'Sem localização'}
              </p>
            </div>
          )}

          {/* Debug Info */}
          {debug && process.env.NODE_ENV === 'development' && (
            <div className="mt-4">
              <Separator className="my-2" />
              <details>
                <summary className="text-sm text-gray-500 cursor-pointer">
                  Informações de Debug
                </summary>
                <pre className="text-xs">{JSON.stringify(debug, null, 2)}</pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedTimeRegistration;
