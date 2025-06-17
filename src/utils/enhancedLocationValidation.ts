import { AllowedLocation, Location } from './types';

interface ValidationResult {
  valid: boolean;
  location?: Location;
  message: string;
  closestLocation?: AllowedLocation;
  distance?: number;
  gpsAccuracy?: number;
  adaptiveRange?: number;
  confidence: number;
  calibration?: {
    isCalibrating: boolean;
    samples: Location[];
    calibrationProgress: number;
  };
}

interface CalibrationState {
  isCalibrating: boolean;
  samples: Location[];
  calibrationProgress: number;
  lastCalibration: number;
  offset: {
    latitude: number;
    longitude: number;
  };
}

// Cache global para calibração
let calibrationState: CalibrationState = {
  isCalibrating: false,
  samples: [],
  calibrationProgress: 0,
  lastCalibration: 0,
  offset: {
    latitude: 0,
    longitude: 0
  }
};

const CALIBRATION_SAMPLE_COUNT = 5;
const CALIBRATION_INTERVAL = 1000; // 1 segundo entre amostras
const CALIBRATION_VALIDITY = 30 * 60 * 1000; // 30 minutos

// Função para calcular a média de um array de números
const calculateAverage = (numbers: number[]): number => {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
};

// Função para calcular o desvio padrão
const calculateStandardDeviation = (numbers: number[]): number => {
  const avg = calculateAverage(numbers);
  const squareDiffs = numbers.map(value => {
    const diff = value - avg;
    return diff * diff;
  });
  return Math.sqrt(calculateAverage(squareDiffs));
};

// Função para iniciar a calibração
export const startCalibration = async (): Promise<void> => {
  if (calibrationState.isCalibrating) {
    return;
  }

  calibrationState = {
    isCalibrating: true,
    samples: [],
    calibrationProgress: 0,
    lastCalibration: Date.now(),
    offset: {
      latitude: 0,
      longitude: 0
    }
  };

  try {
    for (let i = 0; i < CALIBRATION_SAMPLE_COUNT; i++) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });

      calibrationState.samples.push({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });

      calibrationState.calibrationProgress = ((i + 1) / CALIBRATION_SAMPLE_COUNT) * 100;

      if (i < CALIBRATION_SAMPLE_COUNT - 1) {
        await new Promise(resolve => setTimeout(resolve, CALIBRATION_INTERVAL));
      }
    }

    // Calcular offset baseado nas amostras
    const latitudes = calibrationState.samples.map(s => s.latitude);
    const longitudes = calibrationState.samples.map(s => s.longitude);
    
    const avgLat = calculateAverage(latitudes);
    const avgLon = calculateAverage(longitudes);
    
    // Calcular desvio padrão para verificar consistência
    const latStdDev = calculateStandardDeviation(latitudes);
    const lonStdDev = calculateStandardDeviation(longitudes);

    // Se o desvio padrão for muito alto, a calibração não é confiável
    if (latStdDev > 0.0001 || lonStdDev > 0.0001) {
      throw new Error('Calibração imprecisa - muito movimento detectado');
    }

    calibrationState.offset = {
      latitude: avgLat,
      longitude: avgLon
    };

  } catch (error) {
    console.error('Erro durante calibração:', error);
    throw error;
  } finally {
    calibrationState.isCalibrating = false;
  }
};

// Função para aplicar offset de calibração
const applyCalibration = (location: Location): Location => {
  if (!calibrationState.offset || Date.now() - calibrationState.lastCalibration > CALIBRATION_VALIDITY) {
    return location;
  }

  return {
    latitude: location.latitude - calibrationState.offset.latitude,
    longitude: location.longitude - calibrationState.offset.longitude,
    accuracy: location.accuracy
  };
};

// Função para calcular distância entre dois pontos
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Função para calcular range adaptativo
const calculateAdaptiveRange = (baseRange: number, accuracy: number): number => {
  // Aumentar o range baseado na precisão do GPS
  const accuracyMultiplier = Math.max(1, accuracy / 50);
  // Adicionar um buffer de segurança
  const safetyBuffer = 20;
  return Math.round(baseRange * accuracyMultiplier + safetyBuffer);
};

export const validateLocationWithConfidence = async (
  allowedLocations: AllowedLocation[],
  currentLocation?: Location | null,
  options?: {
    minAccuracy?: number;
    requireCalibration?: boolean;
  }
): Promise<ValidationResult> => {
  const minAccuracy = options?.minAccuracy || 100;
  const requireCalibration = options?.requireCalibration || false;

  try {
    let userLocation: Location;

    if (currentLocation) {
      userLocation = currentLocation;
    } else {
      // Obter localização com alta precisão
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
          }
        );
      });

      userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
    }

    // Aplicar calibração se disponível
    userLocation = applyCalibration(userLocation);

    const accuracy = userLocation.accuracy || 50;

    // Verificar se precisa de calibração
    if (requireCalibration && (!calibrationState.offset || Date.now() - calibrationState.lastCalibration > CALIBRATION_VALIDITY)) {
      return {
        valid: false,
        location: userLocation,
        message: 'Calibração do GPS necessária',
        gpsAccuracy: accuracy,
        confidence: 0,
        calibration: {
          isCalibrating: calibrationState.isCalibrating,
          samples: calibrationState.samples,
          calibrationProgress: calibrationState.calibrationProgress
        }
      };
    }

    // Verificar se precisão atende ao mínimo
    if (accuracy > minAccuracy) {
      return {
        valid: false,
        location: userLocation,
        message: `Precisão GPS insuficiente (${accuracy.toFixed(1)}m). Mínimo requerido: ${minAccuracy}m`,
        gpsAccuracy: accuracy,
        confidence: Math.max(0, 100 - (accuracy / 2)),
        calibration: {
          isCalibrating: calibrationState.isCalibrating,
          samples: calibrationState.samples,
          calibrationProgress: calibrationState.calibrationProgress
        }
      };
    }

    // Calcular distâncias para todas as localizações permitidas
    const distances = allowedLocations.map(loc => ({
      location: loc,
      distance: calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        loc.latitude,
        loc.longitude
      )
    }));

    // Encontrar a localização mais próxima
    const closest = distances.reduce((prev, curr) => 
      curr.distance < prev.distance ? curr : prev
    );

    // Calcular range adaptativo baseado na precisão do GPS
    const adaptiveRange = calculateAdaptiveRange(
      closest.location.range_meters,
      accuracy
    );

    // Calcular confiança baseada em múltiplos fatores
    const distanceConfidence = Math.max(0, 100 - (closest.distance / adaptiveRange) * 100);
    const accuracyConfidence = Math.max(0, 100 - (accuracy / 20) * 100);
    const calibrationConfidence = calibrationState.offset ? 100 : 0;
    const overallConfidence = (distanceConfidence + accuracyConfidence + calibrationConfidence) / 3;

    const isValid = closest.distance <= adaptiveRange;

    return {
      valid: isValid,
      location: userLocation,
      message: isValid 
        ? `Localização válida (${closest.distance.toFixed(1)}m de ${closest.location.name})`
        : `Fora da área permitida. Distância: ${closest.distance.toFixed(1)}m`,
      closestLocation: closest.location,
      distance: closest.distance,
      gpsAccuracy: accuracy,
      adaptiveRange,
      confidence: overallConfidence,
      calibration: {
        isCalibrating: calibrationState.isCalibrating,
        samples: calibrationState.samples,
        calibrationProgress: calibrationState.calibrationProgress
      }
    };

  } catch (error: any) {
    throw new Error(`Erro ao obter localização: ${error.message}`);
  }
};

// Limpar cache (mantendo a função existente)
export const clearLocationCache = () => {
  // Implementação existente
};