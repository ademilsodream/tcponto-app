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
import { reverseGeocode } from '@/utils/geocoding';
import { TimeRegistrationProgress } from './TimeRegistrationProgress';

const COOLDOWN_MS = 20 * 60 * 1000; // 20 minutos

const UnifiedTimeRegistration: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [lastRegistration, setLastRegistration] = useState<TimeRegistration | null>(null);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  const [remainingCooldown, setRemainingCooldown] = useState<number | null>(null);
  const { user, profile } = useOptimizedAuth();
  const { toast } = useToast();

  const isRemote = profile?.use_location_tracking === false;

  // Carregar localizações ativas
  useEffect(() => {
    const loadAllowed = async () => {
      try {
        setLoadingLocations(true);
        const { data, error } = await supabase
          .from('allowed_locations')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        const formatted = (data || []).map((loc: any) => ({
          ...loc,
          latitude: Number(loc.latitude),
          longitude: Number(loc.longitude),
          range_meters: Number(loc.range_meters)
        }));
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

  // Cooldown: carregar de storage e cronômetro
  useEffect(() => {
    const stored = localStorage.getItem('timeRegistrationCooldown');
    if (stored) {
      const end = Number(stored);
      if (!Number.isNaN(end) && end > Date.now()) {
        setCooldownEndTime(end);
        setRemainingCooldown(end - Date.now());
      } else {
        localStorage.removeItem('timeRegistrationCooldown');
      }
    }
    const interval = setInterval(() => {
      setRemainingCooldown(prev => {
        if (cooldownEndTime === null) return null;
        const left = cooldownEndTime - Date.now();
        if (left <= 0) {
          setCooldownEndTime(null);
          localStorage.removeItem('timeRegistrationCooldown');
          return null;
        }
        return left;
      });
      return undefined as any;
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownEndTime]);

  const formatRemaining = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const { location, loading, error, validationResult, canRegister, calibration, validateLocation, calibrateForCurrentLocation, refreshLocation, clearCalibration, gpsQuality, debug } = useUnifiedLocation(allowedLocations, true);

  const fetchLastRegistration = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', profile.id)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) setLastRegistration(data as TimeRegistration);
    } catch (err) {
      console.error('Erro ao buscar último registro:', err);
    }
  }, [profile?.id]);

  useEffect(() => { fetchLastRegistration(); }, [fetchLastRegistration]);

  const handleTimeRegistration = async () => {
    if (!profile) {
      toast({ title: 'Erro', description: 'Perfil não disponível.', variant: 'destructive' });
      return;
    }
    const now = new Date();

    // Modo REMOTO
    if (isRemote) {
      try {
        setIsRegistering(true);
        let loc = location;
        if (!loc) {
          try { await validateLocation(); } catch {}
          loc = location;
        }
        const lat = loc?.latitude ?? 0;
        const lon = loc?.longitude ?? 0;
        let address = 'Remoto';
        try {
          if (lat && lon) {
            const geo = await reverseGeocode(lat, lon);
            address = geo.address || 'Remoto';
          }
        } catch {}
        const payload: any = {
          user_id: profile.id,
          date: now.toISOString().split('T')[0],
          clock_in: now.toTimeString().split(' ')[0],
          locations: {
            clock_in: {
              address,
              distance: 10,
              latitude: lat || null,
              longitude: lon || null,
              timestamp: (loc ? new Date(loc.timestamp) : now).toISOString(),
              locationName: 'Remoto'
            }
          }
        };
        const { data, error } = await supabase.from('time_records').insert([payload]).select('*').maybeSingle();
        if (error) { toast({ title: 'Erro', description: 'Falha ao registrar o ponto.', variant: 'destructive' }); return; }
        if (data) {
          setLastRegistration(data as TimeRegistration);
          toast({ title: 'Sucesso', description: 'Ponto registrado (Remoto).' });
          fetchLastRegistration();
          const end = Date.now() + COOLDOWN_MS;
          setCooldownEndTime(end);
          localStorage.setItem('timeRegistrationCooldown', String(end));
        }
      } catch {
        toast({ title: 'Erro', description: 'Erro inesperado ao registrar.', variant: 'destructive' });
      } finally {
        setIsRegistering(false);
      }
      return;
    }

    // Modo padrão
    if (!location) {
      toast({ title: 'Erro', description: 'Localização não disponível. Tente novamente.', variant: 'destructive' });
      return;
    }
    setIsRegistering(true);
    try {
      const addr = (await reverseGeocode(location.latitude, location.longitude)).address;
      const payload: any = {
        user_id: profile.id,
        date: now.toISOString().split('T')[0],
        clock_in: now.toTimeString().split(' ')[0],
        locations: {
          clock_in: {
            address: addr,
            distance: Math.round(validationResult?.distance ?? 0) || undefined,
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: new Date(location.timestamp).toISOString(),
            locationName: validationResult?.closestLocation?.name || 'Desconhecido'
          }
        }
      };
      const { data, error } = await supabase.from('time_records').insert([payload]).select('*').maybeSingle();
      if (error) { toast({ title: 'Erro', description: 'Falha ao registrar o ponto. Tente novamente.', variant: 'destructive' }); return; }
      if (data) {
        setLastRegistration(data as TimeRegistration);
        toast({ title: 'Sucesso', description: 'Ponto registrado com sucesso!' });
        fetchLastRegistration();
        const end = Date.now() + COOLDOWN_MS;
        setCooldownEndTime(end);
        localStorage.setItem('timeRegistrationCooldown', String(end));
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro inesperado ao registrar o ponto.', variant: 'destructive' });
    } finally {
      setIsRegistering(false);
    }
  };

  const buttonDisabled = isRegistering || (!isRemote && !canRegister) || (cooldownEndTime !== null && cooldownEndTime > Date.now());

  return (
    <div className="flex flex-col min-h-[100dvh] p-3 sm:p-4">
      {/* Header */}
      <div className="text-center mb-2 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold leading-tight">Registro de Ponto</h2>
        <p className="text-xs sm:text-sm text-gray-500 truncate">{profile?.name} - {profile?.departments?.name}</p>
      </div>

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
              validateLocation={validateLocation}
              calibrateForCurrentLocation={calibrateForCurrentLocation}
              refreshLocation={refreshLocation}
              clearCalibration={clearCalibration}
              debug={debug}
            />
          </CardContent>
        </Card>

        {/* Progresso dos registros do dia */}
        <Card>
          <CardContent className="p-3 sm:p-6">
            <TimeRegistrationProgress timeRecord={lastRegistration as any} onEditRequest={() => {}} />
          </CardContent>
        </Card>

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

        <div className="h-20 sm:h-0" />
      </div>

      <div className="sticky bottom-3 sm:static sm:bottom-auto">
        <Card className="shadow-lg">
          <CardContent className="p-2 sm:p-6">
            <Button onClick={handleTimeRegistration} disabled={buttonDisabled} size="lg" variant="default" className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold">
              {isRegistering ? (
                <>Registrando...</>
              ) : (
                <>
                  <Clock className="mr-2 h-5 w-5" />
                  Registrar Ponto{isRemote ? ' (Remoto)' : ''}
                </>
              )}
            </Button>
            {remainingCooldown !== null && (
              <div className="mt-2 text-center text-xs sm:text-sm text-gray-600">Aguarde {formatRemaining(remainingCooldown)} para novo registro</div>
            )}
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
