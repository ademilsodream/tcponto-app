import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useUnifiedLocation } from '@/hooks/useUnifiedLocation';
import { supabase } from '@/integrations/supabase/client';
import { Clock } from 'lucide-react';
import { UnifiedGPSStatus } from './UnifiedGPSStatus';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimeRegistration } from '@/types/timeRegistration';
import { AllowedLocation } from '@/types/index';

const UnifiedTimeRegistration: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [lastRegistration, setLastRegistration] = useState<TimeRegistration | null>(null);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const { user, profile } = useOptimizedAuth();
  const isRemote = profile?.use_location_tracking === false;
  const { toast } = useToast();

  useEffect(() => {
    const loadAllowed = async () => {
      try {
        setLoadingLocations(true);
        const { data, error } = await supabase.from('allowed_locations').select('*').eq('is_active', true).order('name');
        if (error) throw error;
        const formatted = (data || []).map((loc: any) => ({ ...loc, latitude: Number(loc.latitude), longitude: Number(loc.longitude), range_meters: Number(loc.range_meters) }));
        setAllowedLocations(formatted);
      } catch (err) {
        console.error('Erro ao carregar localizações permitidas:', err);
        toast({ title: 'Erro', description: 'Falha ao carregar localizações permitidas.', variant: 'destructive' });
        setAllowedLocations([]);
      } finally {
        setLoadingLocations(false);
      }
    };
    loadAllowed();
  }, [toast]);

  const { location, loading, error, validationResult, canRegister, calibration, validateLocation, calibrateForCurrentLocation, refreshLocation, clearCalibration, gpsQuality, debug } = useUnifiedLocation(allowedLocations, true);

  const fetchLastRegistration = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase.from('time_records').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) return;
      if (data) setLastRegistration(data as TimeRegistration);
    } catch {}
  }, [profile?.id]);

  useEffect(() => { fetchLastRegistration(); }, [fetchLastRegistration]);

  const handleTimeRegistration = async () => {
    if (!profile) {
      toast({ title: 'Erro', description: 'Perfil não disponível.', variant: 'destructive' });
      return;
    }

    // Modo REMOTO: não comparar com localizações permitidas, apenas gravar
    if (profile && profile.use_location_tracking === false) {
      try {
        setIsRegistering(true);
        const now = new Date();
        const { data, error } = await supabase
          .from('time_records')
          .insert([
            {
              user_id: profile.id,
              date: now.toISOString().split('T')[0],
              clock_in: now.toTimeString().split(' ')[0],
              locations: {
                clock_in: {
                  latitude: location?.latitude ?? null,
                  longitude: location?.longitude ?? null,
                  accuracy: location?.accuracy ?? null,
                  timestamp: location ? new Date(location.timestamp).toISOString() : new Date().toISOString(),
                  locationName: 'Remoto'
                }
              }
            }
          ])
          .select('*')
          .maybeSingle();

        if (error) {
          toast({ title: 'Erro', description: 'Falha ao registrar o ponto.', variant: 'destructive' });
          return;
        }
        if (data) {
          setLastRegistration(data as TimeRegistration);
          toast({ title: 'Sucesso', description: 'Ponto registrado (Remoto).' });
          fetchLastRegistration();
        }
      } catch {
        toast({ title: 'Erro', description: 'Erro inesperado ao registrar.', variant: 'destructive' });
      } finally {
        setIsRegistering(false);
      }
      return;
    }

    // Modo padrão: comparar com localizações permitidas
    if (!location) {
      toast({ title: 'Erro', description: 'Localização não disponível. Tente novamente.', variant: 'destructive' });
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
        toast({ title: 'Erro', description: 'Falha ao registrar o ponto. Tente novamente.', variant: 'destructive' });
        return;
      }
      if (data) {
        setLastRegistration(data as TimeRegistration);
        toast({ title: 'Sucesso', description: 'Ponto registrado com sucesso!' });
        fetchLastRegistration();
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro inesperado ao registrar o ponto.', variant: 'destructive' });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleValidateLocation = () => validateLocation();
  const handleClearCalibration = () => clearCalibration('any');

  return (
    <div className="flex flex-col min-h-[100dvh] p-3 sm:p-4">
      {/* Header */}
      <div className="text-center mb-2 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold leading-tight">Registro de Ponto</h2>
        <p className="text-xs sm:text-sm text-gray-500 truncate">{profile?.name} - {profile?.departments?.name}</p>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-auto space-y-3 sm:space-y-6">
        <Card>
          <CardHeader className="py-3 sm:py-4">
            <CardTitle className="text-base sm:text-lg">Status do GPS</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <UnifiedGPSStatus
              loading={loading || loadingLocations}
              error={error}
              location={location}
              gpsQuality={gpsQuality}
              validationResult={validationResult}
              canRegister={isRemote ? true : canRegister}
              calibration={calibration}
              validateLocation={handleValidateLocation}
              calibrateForCurrentLocation={calibrateForCurrentLocation}
              refreshLocation={refreshLocation}
              clearCalibration={handleClearCalibration}
              debug={debug}
            />
          </CardContent>
        </Card>

        {/* Último registro */}
        {lastRegistration && (
          <Card>
            <CardContent className="p-3 sm:p-6">
              <Separator className="my-2" />
              <p className="text-xs sm:text-sm text-gray-500">
                Último registro: {format(new Date(lastRegistration.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">Local: {lastRegistration.locations ? 'Registrado' : 'Sem localização'}</p>
            </CardContent>
          </Card>
        )}

        {/* Espaço para o botão sticky não sobrepor conteúdo */}
        <div className="h-20 sm:h-0" />
      </div>

      {/* Botão sticky no rodapé para mobile */}
      <div className="sticky bottom-3 sm:static sm:bottom-auto">
        <Card className="shadow-lg">
          <CardContent className="p-2 sm:p-6">
            <Button
              onClick={handleTimeRegistration}
              disabled={isRegistering || (!isRemote && !canRegister)}
              size="lg"
              variant="default"
              className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold"
            >
              {isRegistering ? (
                <>Registrando...</>
              ) : (
                <>
                  <Clock className="mr-2 h-5 w-5" />
                  Registrar Ponto{isRemote ? ' (Remoto)' : ''}
                </>
              )}
            </Button>
            {!isRemote && validationResult && !canRegister && (
              <div className="mt-2 sm:mt-4 text-red-500 text-xs sm:text-sm">{validationResult.message}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UnifiedTimeRegistration;
