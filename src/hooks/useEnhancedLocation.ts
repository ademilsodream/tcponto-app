import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

interface CalibrationState {
  isCalibrating: boolean;
  calibrationProgress: number;
  samples: LocationState[];
  bestAccuracy: number;
}

export const useEnhancedLocation = () => {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<CalibrationState>({
    isCalibrating: false,
    calibrationProgress: 0,
    samples: [],
    bestAccuracy: Infinity
  });
  
  const watchIdRef = useRef<number | null>(null);
  const calibrationWatchRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Configurações aprimoradas de geolocalização
  const geoOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 0 // Sempre obter localização fresca
  };

  // Função para calcular média ponderada das localizações
  const calculateWeightedAverage = (samples: LocationState[]): LocationState => {
    if (samples.length === 0) throw new Error('No samples available');
    
    // Ordenar por precisão (menor accuracy = melhor)
    const sortedSamples = [...samples].sort((a, b) => a.accuracy - b.accuracy);
    
    // Usar apenas as 5 melhores amostras
    const bestSamples = sortedSamples.slice(0, Math.min(5, sortedSamples.length));
    
    // Calcular pesos baseados na precisão
    const weights = bestSamples.map(s => 1 / s.accuracy);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    // Calcular média ponderada
    const weightedLat = bestSamples.reduce((sum, sample, i) => 
      sum + (sample.latitude * weights[i] / totalWeight), 0
    );
    const weightedLng = bestSamples.reduce((sum, sample, i) => 
      sum + (sample.longitude * weights[i] / totalWeight), 0
    );
    
    // Retornar localização com melhor precisão
    return {
      latitude: weightedLat,
      longitude: weightedLng,
      accuracy: bestSamples[0].accuracy,
      timestamp: Date.now()
    };
  };

  // Função de calibração
  const startCalibration = useCallback(() => {
    // Limpar calibração anterior se existir
    if (calibrationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(calibrationWatchRef.current);
    }

    setCalibration(prev => ({
      ...prev,
      isCalibrating: true,
      calibrationProgress: 0,
      samples: [],
      bestAccuracy: Infinity
    }));

    toast({
      title: "Calibrando GPS",
      description: "Por favor, aguarde enquanto melhoramos a precisão...",
    });

    let sampleCount = 0;
    const targetSamples = 10;
    const samples: LocationState[] = [];

    // Coletar múltiplas amostras
    calibrationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newSample: LocationState = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp
        };

        samples.push(newSample);
        sampleCount++;

        const progress = (sampleCount / targetSamples) * 100;
        const bestAccuracy = Math.min(...samples.map(s => s.accuracy));

        setCalibration(prev => ({
          ...prev,
          calibrationProgress: progress,
          samples: samples,
          bestAccuracy: bestAccuracy
        }));

        // Quando atingir o número alvo de amostras
        if (sampleCount >= targetSamples) {
          if (calibrationWatchRef.current !== null) {
            navigator.geolocation.clearWatch(calibrationWatchRef.current);
            calibrationWatchRef.current = null;
          }
          
          try {
            const calibratedLocation = calculateWeightedAverage(samples);
            setLocation(calibratedLocation);
            
            toast({
              title: "Calibração concluída",
              description: `Precisão melhorada para ${calibratedLocation.accuracy.toFixed(1)}m`,
              variant: "default"
            });
          } catch (error) {
            toast({
              title: "Erro na calibração",
              description: "Não foi possível melhorar a precisão",
              variant: "destructive"
            });
          }

          setCalibration(prev => ({
            ...prev,
            isCalibrating: false,
            calibrationProgress: 100
          }));
        }
      },
      (error) => {
        setError(`Erro durante calibração: ${error.message}`);
        setCalibration(prev => ({
          ...prev,
          isCalibrating: false
        }));
        if (calibrationWatchRef.current !== null) {
          navigator.geolocation.clearWatch(calibrationWatchRef.current);
          calibrationWatchRef.current = null;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    // Timeout de segurança
    setTimeout(() => {
      if (calibration.isCalibrating && calibrationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(calibrationWatchRef.current);
        calibrationWatchRef.current = null;
        setCalibration(prev => ({
          ...prev,
          isCalibrating: false
        }));
        
        if (samples.length > 0) {
          try {
            const calibratedLocation = calculateWeightedAverage(samples);
            setLocation(calibratedLocation);
          } catch (error) {
            console.error('Erro ao calcular média:', error);
          }
        }
      }
    }, 30000);
  }, [toast]);

  // Função para forçar atualização de localização
  const refreshLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation: LocationState = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp
        };

        setLocation(newLocation);
        setLoading(false);

        // Sugerir calibração se precisão for ruim
        if (position.coords.accuracy > 50) {
          toast({
            title: "Precisão baixa detectada",
            description: `Precisão atual: ${position.coords.accuracy.toFixed(1)}m. Considere calibrar o GPS.`,
            action: (
              <Button size="sm" onClick={startCalibration}>
                Calibrar
              </Button>
            )
          });
        }
      },
      (error) => {
        setError(error.message);
        setLoading(false);
      },
      geoOptions
    );
  }, [startCalibration, toast]);

  // Monitoramento contínuo com alta precisão
  useEffect(() => {
    let mounted = true;

    const startWatching = () => {
      if (!mounted) return;

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (!mounted) return;

          const newLocation: LocationState = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          };

          setLocation(newLocation);
          setLoading(false);
          setError(null);
        },
        (error) => {
          if (!mounted) return;
          
          setError(error.message);
          setLoading(false);
          
          // Tentar novamente em caso de erro
          if (error.code === 1) { // PERMISSION_DENIED
            toast({
              title: "Permissão negada",
              description: "Por favor, permita o acesso à localização nas configurações do navegador",
              variant: "destructive"
            });
          }
        },
        geoOptions
      );
    };

    startWatching();

    return () => {
      mounted = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (calibrationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(calibrationWatchRef.current);
      }
    };
  }, [toast]);

  return {
    location,
    loading,
    error,
    calibration,
    startCalibration,
    refreshLocation,
    isHighAccuracy: location ? location.accuracy <= 20 : false,
    isMediumAccuracy: location ? location.accuracy > 20 && location.accuracy <= 50 : false,
    isLowAccuracy: location ? location.accuracy > 50 : false
  };
};