import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { validateGPSQuality } from '@/utils/enhancedLocationValidation';

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
  offset?: {
    latitude: number;
    longitude: number;
  };
}

interface UseEnhancedLocationReturn {
  location: LocationState | null;
  loading: boolean;
  error: string | null;
  calibration: CalibrationState;
  startCalibration: () => Promise<void>;
  refreshLocation: () => Promise<void>;
  isHighAccuracy: boolean;
  isMediumAccuracy: boolean;
  isLowAccuracy: boolean;
  calibrateAndValidate: () => Promise<void>;
}

const CALIBRATION_SAMPLES = 8; // Aumentado para mais precisão
const CALIBRATION_INTERVAL = 1500; // Intervalo maior entre amostras
const HIGH_ACCURACY_THRESHOLD = 10; // Mais rigoroso
const MEDIUM_ACCURACY_THRESHOLD = 25; // Mais rigoroso

export const useEnhancedLocation = (): UseEnhancedLocationReturn => {
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
  const { toast } = useToast();

  // Configurações mais rigorosas para alta precisão
  const highAccuracyOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 20000, // Timeout maior para permitir maior precisão
    maximumAge: 0 // Sempre obter localização fresca
  };

  // Função para calcular média ponderada com filtro de outliers
  const calculateWeightedAverage = (samples: LocationState[]): LocationState => {
    if (samples.length === 0) throw new Error('No samples available');
    
    // Filtrar outliers (remover as 2 piores precisões se temos mais de 5 amostras)
    let filteredSamples = [...samples].sort((a, b) => a.accuracy - b.accuracy);
    if (filteredSamples.length > 5) {
      filteredSamples = filteredSamples.slice(0, -2);
    }
    
    // Usar apenas as 5 melhores amostras
    const bestSamples = filteredSamples.slice(0, Math.min(5, filteredSamples.length));
    
    // Calcular pesos baseados na precisão (inverso quadrático para dar mais peso às melhores)
    const weights = bestSamples.map(s => 1 / (s.accuracy * s.accuracy));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    // Calcular média ponderada
    const weightedLat = bestSamples.reduce((sum, sample, i) => 
      sum + (sample.latitude * weights[i] / totalWeight), 0
    );
    const weightedLng = bestSamples.reduce((sum, sample, i) => 
      sum + (sample.longitude * weights[i] / totalWeight), 0
    );
    
    return {
      latitude: weightedLat,
      longitude: weightedLng,
      accuracy: bestSamples[0].accuracy,
      timestamp: Date.now()
    };
  };

  // Função para obter localização com múltiplas tentativas
  const getHighAccuracyLocation = useCallback((): Promise<LocationState> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
        return;
      }

      let attempts = 0;
      const maxAttempts = 3;

      const tryGetLocation = () => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || 999,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp
            };

            // Se a precisão é boa o suficiente, aceitar
            if (locationData.accuracy <= 30) {
              resolve(locationData);
              return;
            }

            // Se ainda temos tentativas e a precisão não é boa, tentar novamente
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(tryGetLocation, 2000);
              return;
            }

            // Última tentativa - aceitar o que temos
            resolve(locationData);
          },
          (error) => {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(tryGetLocation, 2000);
              return;
            }
            reject(new Error(`Erro ao obter localização após ${maxAttempts} tentativas: ${error.message}`));
          },
          highAccuracyOptions
        );
      };

      tryGetLocation();
    });
  }, []);

  // Função de calibração avançada
  const startCalibration = useCallback(async () => {
    if (calibration.isCalibrating) return;

    setCalibration(prev => ({
      ...prev,
      isCalibrating: true,
      calibrationProgress: 0,
      samples: [],
      bestAccuracy: Infinity
    }));

    try {
      const samples: LocationState[] = [];
      
      toast({
        title: 'Calibrando GPS',
        description: 'Coletando amostras para maior precisão...',
        duration: 3000
      });

      for (let i = 0; i < CALIBRATION_SAMPLES; i++) {
        const location = await getHighAccuracyLocation();
        samples.push(location);
        
        setCalibration(prev => ({
          ...prev,
          calibrationProgress: ((i + 1) / CALIBRATION_SAMPLES) * 100,
          samples,
          bestAccuracy: Math.min(prev.bestAccuracy, location.accuracy)
        }));

        if (i < CALIBRATION_SAMPLES - 1) {
          await new Promise(resolve => setTimeout(resolve, CALIBRATION_INTERVAL));
        }
      }

      // Calcular posição calibrada
      const calibratedLocation = calculateWeightedAverage(samples);
      
      // Calcular offset se houver localização anterior
      if (location) {
        const offset = {
          latitude: calibratedLocation.latitude - location.latitude,
          longitude: calibratedLocation.longitude - location.longitude
        };
        
        setCalibration(prev => ({
          ...prev,
          offset
        }));
      }

      setLocation(calibratedLocation);
      
      const quality = validateGPSQuality(calibratedLocation.accuracy);
      toast({
        title: 'Calibração Concluída',
        description: `GPS ${quality.quality.toLowerCase()} - Precisão: ${Math.round(calibratedLocation.accuracy)}m`,
        variant: quality.acceptable ? 'default' : 'destructive'
      });

      return calibratedLocation;

    } catch (error: any) {
      toast({
        title: 'Erro na Calibração',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    } finally {
      setCalibration(prev => ({
        ...prev,
        isCalibrating: false
      }));
    }
  }, [getHighAccuracyLocation, location, toast]);

  // Nova função que calibra e retorna a localização validada
  const calibrateAndValidate = useCallback(async (): Promise<void> => {
    const calibratedLocation = await startCalibration();
    
    if (calibratedLocation.accuracy > 50) {
      throw new Error(`GPS com baixa precisão (${Math.round(calibratedLocation.accuracy)}m). Tente novamente em local aberto.`);
    }
    
    setLocation(calibratedLocation);
  }, [startCalibration]);

  // Função para atualizar localização
  const refreshLocation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const newLocation = await getHighAccuracyLocation();
      
      // Aplicar offset de calibração se existir
      if (calibration.offset) {
        newLocation.latitude += calibration.offset.latitude;
        newLocation.longitude += calibration.offset.longitude;
      }
      
      setLocation(newLocation);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [getHighAccuracyLocation, calibration.offset]);

  // Watch de localização com configurações aprimoradas
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      setLoading(false);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 999,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp
        };

        // Aplicar offset de calibração se existir
        if (calibration.offset) {
          newLocation.latitude += calibration.offset.latitude;
          newLocation.longitude += calibration.offset.longitude;
        }

        setLocation(newLocation);
        setLoading(false);
        setError(null);
      },
      (error) => {
        setError(`Erro ao obter localização: ${error.message}`);
        setLoading(false);
      },
      highAccuracyOptions
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [calibration.offset]);

  return {
    location,
    loading,
    error,
    calibration,
    startCalibration,
    refreshLocation,
    calibrateAndValidate,
    isHighAccuracy: location ? location.accuracy <= HIGH_ACCURACY_THRESHOLD : false,
    isMediumAccuracy: location ? location.accuracy > HIGH_ACCURACY_THRESHOLD && location.accuracy <= MEDIUM_ACCURACY_THRESHOLD : false,
    isLowAccuracy: location ? location.accuracy > MEDIUM_ACCURACY_THRESHOLD : false
  };
};
