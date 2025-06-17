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
}

const CALIBRATION_SAMPLES = 5;
const CALIBRATION_INTERVAL = 1000; // 1 segundo entre amostras

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
  const calibrationWatchRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Configurações aprimoradas de geolocalização
  const geoOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0 // Sempre obter localização fresca
  };

  // Função para calcular média ponderada das localizações
  const calculateWeightedAverage = (samples: LocationState[]): LocationState => {
    if (samples.length === 0) throw new Error('No samples available');
    
    // Ordenar por precisão (menor accuracy = melhor)
    const sortedSamples = [...samples].sort((a, b) => a.accuracy - b.accuracy);
    
    // Usar apenas as 3 melhores amostras
    const bestSamples = sortedSamples.slice(0, Math.min(3, sortedSamples.length));
    
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

  // Função para obter localização com alta precisão
  const getHighAccuracyLocation = useCallback((): Promise<LocationState> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 999,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          });
        },
        (error) => {
          reject(new Error(`Erro ao obter localização: ${error.message}`));
        },
        geoOptions
      );
    });
  }, []);

  // Função para iniciar calibração
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

      // Calcular posição média
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
        description: `GPS ${quality.quality.toLowerCase()} (${Math.round(calibratedLocation.accuracy)}m)`,
        variant: quality.acceptable ? 'default' : 'destructive'
      });

    } catch (error: any) {
      toast({
        title: 'Erro na Calibração',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setCalibration(prev => ({
        ...prev,
        isCalibrating: false
      }));
    }
  }, [getHighAccuracyLocation, location, toast]);

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

  // Iniciar watch de localização
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
      geoOptions
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
    isHighAccuracy: location ? location.accuracy <= 20 : false,
    isMediumAccuracy: location ? location.accuracy > 20 && location.accuracy <= 50 : false,
    isLowAccuracy: location ? location.accuracy > 50 : false
  };
};