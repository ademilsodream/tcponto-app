
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

const CALIBRATION_SAMPLES = 8;
const CALIBRATION_INTERVAL = 1500;
const HIGH_ACCURACY_THRESHOLD = 10;
const MEDIUM_ACCURACY_THRESHOLD = 25;

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

  const highAccuracyOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0
  };

  const calculateWeightedAverage = (samples: LocationState[]): LocationState => {
    if (samples.length === 0) throw new Error('No samples available');
    
    let filteredSamples = [...samples].sort((a, b) => a.accuracy - b.accuracy);
    if (filteredSamples.length > 5) {
      filteredSamples = filteredSamples.slice(0, -2);
    }
    
    const bestSamples = filteredSamples.slice(0, Math.min(5, filteredSamples.length));
    
    const weights = bestSamples.map(s => 1 / (s.accuracy * s.accuracy));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
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

            if (locationData.accuracy <= 30) {
              resolve(locationData);
              return;
            }

            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(tryGetLocation, 2000);
              return;
            }

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

  const startCalibration = useCallback(async (): Promise<void> => {
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

      const calibratedLocation = calculateWeightedAverage(samples);
      
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

  const calibrateAndValidate = useCallback(async (): Promise<void> => {
    await startCalibration();
    
    if (location && location.accuracy > 50) {
      throw new Error(`GPS com baixa precisão (${Math.round(location.accuracy)}m). Tente novamente em local aberto.`);
    }
  }, [startCalibration, location]);

  const refreshLocation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const newLocation = await getHighAccuracyLocation();
      
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
