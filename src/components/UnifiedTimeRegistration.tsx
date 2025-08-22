import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
import LocationMap from './LocationMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnnouncementNotification } from './AnnouncementNotification';

const COOLDOWN_MS = 20 * 60 * 1000; // 20 minutos

// Helper para obter GPS diretamente caso o hook não tenha fornecido
const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy?: number; timestamp: number } | null> => {
  if (!navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 }
    );
  });
};

// Determinar próxima ação baseado no registro do dia
const getNextActionFromRecord = (rec: any | null): 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out' | null => {
  if (!rec || !rec.clock_in) return 'clock_in';
  if (!rec.lunch_start) return 'lunch_start';
  if (!rec.lunch_end) return 'lunch_end';
  if (!rec.clock_out) return 'clock_out';
  return null;
};

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

  // Cooldown
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
      if (cooldownEndTime === null) return;
      const left = cooldownEndTime - Date.now();
      if (left <= 0) {
        setCooldownEndTime(null);
        setRemainingCooldown(null);
        localStorage.removeItem('timeRegistrationCooldown');
      } else {
        setRemainingCooldown(left);
      }
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

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // garantir que temos o registro do dia mais recente
    let existing = lastRegistration;
    if (!existing || existing.date !== today) {
      try {
        const { data } = await supabase
          .from('time_records')
          .select('*')
          .eq('user_id', profile.id)
          .eq('date', today)
          .eq('status', 'active')
          .maybeSingle();
        if (data) existing = data as any;
      } catch {}
    }

    const action = getNextActionFromRecord(existing);
    if (!action) {
      toast({ title: 'Concluído', description: 'Todas as marcações do dia já foram registradas.' });
      return;
    }

    // Coletar localização atual (resiliente)
    let lat = location?.latitude ?? 0;
    let lon = location?.longitude ?? 0;
    let ts = location ? new Date(location.timestamp) : now;
    if (!lat || !lon) {
      const gps = await getCurrentGPS();
      if (gps) {
        lat = gps.latitude; lon = gps.longitude; ts = new Date(gps.timestamp);
      }
    }

    setIsRegistering(true);

    try {
      // Montar entrada locations[action]
      let entry: any = {};
      if (isRemote) {
        let address = 'Remoto';
        try { if (lat && lon) { const geo = await reverseGeocode(lat, lon); address = geo.address || 'Remoto'; } } catch {}
        entry = { address, distance: 10, latitude: lat || null, longitude: lon || null, timestamp: ts.toISOString(), locationName: 'Remoto' };
      } else {
        if (!lat || !lon) { toast({ title: 'Erro', description: 'Localização não disponível. Tente novamente.', variant: 'destructive' }); setIsRegistering(false); return; }
        const addr = (await reverseGeocode(lat, lon)).address;
        const dist = Math.round(validationResult?.distance ?? 0);
        entry = {
          address: addr,
          distance: Number.isFinite(dist) ? dist : 0,
          latitude: lat,
          longitude: lon,
          timestamp: ts.toISOString(),
          locationName: validationResult?.closestLocation?.name || 'Desconhecido',
        };
      }

      // Construir objeto locations mesclado
      const mergedLocations = {
        ...(existing?.locations as Record<string, any> || {}),
        [action]: entry,
      };

      // Valor do campo de tempo
      const actionTime = now.toTimeString().split(' ')[0];

      if (existing?.id) {
        // UPDATE
        const updateData: any = { locations: mergedLocations, updated_at: now.toISOString() };
        updateData[action] = actionTime;
        const { error } = await supabase.from('time_records').update(updateData).eq('id', existing.id);
        if (error) throw error;
      } else {
        // INSERT novo registro do dia
        const insertData: any = {
          user_id: profile.id,
          date: today,
          status: 'active',
          locations: mergedLocations,
        };
        insertData[action] = actionTime;
        const { error } = await supabase.from('time_records').insert(insertData);
        if (error) throw error;
      }

      await fetchLastRegistration();
      toast({ title: 'Sucesso', description: `${{
        clock_in: 'Entrada',
        lunch_start: 'Início do almoço',
        lunch_end: 'Volta do almoço',
        clock_out: 'Saída'
      }[action]} registrada.` });

      const end = Date.now() + COOLDOWN_MS;
      setCooldownEndTime(end);
      localStorage.setItem('timeRegistrationCooldown', String(end));
    } catch (e: any) {
      console.error('Falha ao registrar:', e);
      toast({ title: 'Erro', description: 'Falha ao registrar o ponto.', variant: 'destructive' });
    } finally {
      setIsRegistering(false);
    }
  };

  const buttonDisabled = isRegistering || (!isRemote && !canRegister) || (cooldownEndTime !== null && cooldownEndTime > Date.now());

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Registro de Ponto</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Anúncios */}
        {user && <AnnouncementNotification userId={user.id} />}
        
        {/* Primeiro Card - Botões, Funcionário, Data/Hora, Mapa */}
        <div className="w-full bg-white/90 rounded-xl shadow-sm">
          <div className="px-4 py-4">
            {/* Botões no topo */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Button 
                onClick={handleTimeRegistration} 
                disabled={buttonDisabled} 
                size="lg" 
                className="h-16 text-lg font-semibold"
              >
                {isRegistering ? 'Registrando...' : 'Registrar'}
              </Button>
              <Button 
                variant="outline" 
                onClick={calibrateForCurrentLocation} 
                className="h-16 text-lg"
              >
                Calibrar GPS
              </Button>
            </div>
            
            {/* Nome do funcionário */}
            <div className="mb-3">
              <div className="uppercase text-xs text-gray-500 font-medium">Funcionário</div>
              <div className="text-base font-semibold text-gray-900">{profile?.name || user?.email}</div>
            </div>
            
            {/* Data e hora */}
            <div className="mb-4">
              <div className="text-base text-gray-600">{format(new Date(), "EEE, dd MMM yyyy", { locale: ptBR })}</div>
              <div className="text-3xl font-bold tracking-wide mt-1">{format(new Date(), 'HH:mm:ss')}</div>
            </div>
            
            {/* Cooldown */}
            {remainingCooldown !== null && (
              <div className="mb-4 text-center text-sm text-gray-600">
                Aguarde {formatRemaining(remainingCooldown)} para novo registro
              </div>
            )}
            
            {/* Status GPS */}
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
              hideDetails={true}
              showCalibrate={false}
              showStatus={false}
            />
          </div>
          
          {/* Mapa */}
          <LocationMap latitude={location?.latitude ?? 0} longitude={location?.longitude ?? 0} height={420} />
        </div>
 
        {/* Segundo Card - Linha dos registros */}
        <div className="w-full bg-white/90 rounded-xl shadow-sm p-4">
          <TimeRegistrationProgress timeRecord={lastRegistration as any} />
        </div>
      </div>
    </div>
  );
};

export default UnifiedTimeRegistration;
