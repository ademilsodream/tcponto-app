import { AllowedLocation } from '@/types';

interface Location {
  latitude: number;
  longitude: number;
}

interface ValidationResult {
  valid: boolean;
  location?: Location;
  message: string;
  closestLocation?: AllowedLocation;
  distance?: number;
  gpsAccuracy?: number;
  adaptiveRange?: number;
  confidence?: number;
}

// Constantes de configuração
const GPS_CONFIG = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
  minAccuracy: 50,
  adaptiveRangeFactor: 2.5,
  minAdaptiveRange: 50,
  calibrationSamples: 5,
  retryAttempts: 3
};

// Calcular distância entre dois pontos usando a fórmula de Haversine
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

// Calcular range adaptativo melhorado
export const calculateAdaptiveRange = (baseRange: number, accuracy: number): number => {
  // Range mínimo absoluto
  const minRange = GPS_CONFIG.minAdaptiveRange;
  
  // Fator adaptativo baseado na precisão
  const adaptiveFactor = accuracy > 50 ? GPS_CONFIG.adaptiveRangeFactor : 1.5;
  
  // Buffer extra para precisão muito baixa
  const extraBuffer = accuracy > 100 ? (accuracy - 100) * 0.3 : 0;
  
  // Calcular range final
  const adaptiveRange = Math.max(
    baseRange,
    accuracy * adaptiveFactor,
    minRange
  ) + extraBuffer;
  
  return Math.round(adaptiveRange);
};

// Validar qualidade do GPS
export const validateGPSQuality = (accuracy: number): { 
  quality: string; 
  acceptable: boolean; 
  message: string;
  confidence: number;
} => {
  if (accuracy <= 10) {
    return { 
      quality: 'Excelente', 
      acceptable: true, 
      message: 'GPS de alta precisão',
      confidence: 1.0
    };
  } else if (accuracy <= 30) {
    return { 
      quality: 'Muito Boa', 
      acceptable: true, 
      message: 'GPS de boa precisão',
      confidence: 0.9
    };
  } else if (accuracy <= 50) {
    return { 
      quality: 'Boa', 
      acceptable: true, 
      message: 'GPS de precisão aceitável',
      confidence: 0.8
    };
  } else if (accuracy <= 100) {
    return { 
      quality: 'Aceitável', 
      acceptable: true, 
      message: 'GPS de precisão média - range adaptativo será usado',
      confidence: 0.7
    };
  } else if (accuracy <= 200) {
    return { 
      quality: 'Baixa', 
      acceptable: true, 
      message: 'GPS de baixa precisão - usando range aumentado',
      confidence: 0.6
    };
  } else if (accuracy <= 500) {
    return { 
      quality: 'Muito Baixa', 
      acceptable: true, 
      message: 'GPS muito impreciso - usando range de emergência',
      confidence: 0.4
    };
  } else {
    return { 
      quality: 'Inaceitável', 
      acceptable: false, 
      message: 'GPS extremamente impreciso - tente novamente',
      confidence: 0.2
    };
  }
};

// Verificar se localização está permitida com range adaptativo
export const isLocationAllowed = (
  currentLocation: Location,
  allowedLocations: AllowedLocation[],
  gpsAccuracy: number = 100
): ValidationResult => {
  if (!allowedLocations || allowedLocations.length === 0) {
    return { 
      valid: false, 
      message: 'Sistema sem localizações permitidas configuradas' 
    };
  }

  let closestLocation: AllowedLocation | undefined;
  let minDistance = Infinity;
  let usedRange = 0;
  let bestConfidence = 0;

  for (const location of allowedLocations) {
    if (!location.is_active) continue;

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      Number(location.latitude),
      Number(location.longitude)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestLocation = location;
    }

    const adaptiveRange = calculateAdaptiveRange(Number(location.range_meters), gpsAccuracy);
    usedRange = adaptiveRange;

    if (distance <= adaptiveRange) {
      const gpsQuality = validateGPSQuality(gpsAccuracy);
      return {
        valid: true,
        closestLocation: location,
        distance: distance,
        adaptiveRange: adaptiveRange,
        message: `Localização autorizada em ${location.name}`,
        confidence: gpsQuality.confidence
      };
    }
  }

  const message = closestLocation
    ? `Você está a ${Math.round(minDistance)}m de ${closestLocation.name}. Aproxime-se para registrar.`
    : 'Nenhuma localização permitida próxima';

  return {
    valid: false,
    closestLocation,
    distance: minDistance === Infinity ? undefined : minDistance,
    adaptiveRange: usedRange,
    message,
    confidence: bestConfidence
  };
};

// Obter localização com retry
export const getLocationWithRetry = async (): Promise<{ location: Location; accuracy: number }> => {
  let bestAccuracy = Infinity;
  let bestLocation: Location | null = null;

  for (let i = 0; i < GPS_CONFIG.retryAttempts; i++) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: GPS_CONFIG.enableHighAccuracy,
            timeout: GPS_CONFIG.timeout,
            maximumAge: GPS_CONFIG.maximumAge
          }
        );
      });

      const accuracy = position.coords.accuracy || 999;
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      if (accuracy < bestAccuracy) {
        bestAccuracy = accuracy;
        bestLocation = location;
      }

      // Se encontrou uma localização com boa precisão, retornar imediatamente
      if (accuracy <= GPS_CONFIG.minAccuracy) {
        return { location, accuracy };
      }

      // Aguardar um pouco entre tentativas
      if (i < GPS_CONFIG.retryAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.warn(`Tentativa ${i + 1} falhou:`, error);
    }
  }

  if (!bestLocation) {
    throw new Error('Não foi possível obter localização após várias tentativas');
  }

  return { location: bestLocation, accuracy: bestAccuracy };
};

// Validação principal com retry
export const validateLocationForTimeRecord = async (
  allowedLocations: AllowedLocation[]
): Promise<ValidationResult> => {
  try {
    if (!allowedLocations || allowedLocations.length === 0) {
      return {
        valid: false,
        message: 'Sistema sem localizações permitidas configuradas'
      };
    }

    const { location, accuracy } = await getLocationWithRetry();
    const validation = isLocationAllowed(location, allowedLocations, accuracy);

    return {
      ...validation,
      location,
      gpsAccuracy: accuracy
    };
  } catch (error: any) {
    return {
      valid: false,
      message: error.message || 'Erro ao validar localização. Verifique se o GPS está ativo.'
    };
  }
};

// Função de retry inteligente para validação de localização
export const validateLocationWithRetry = async (
  allowedLocations: AllowedLocation[],
  maxRetries: number = 3
): Promise<ValidationResult> => {
  let bestResult: ValidationResult | null = null;
  let bestAccuracy = Infinity;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Aguardar um pouco entre tentativas
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const result = await validateLocationForTimeRecord(allowedLocations);
      
      // Se encontrou localização válida com boa precisão, retornar imediatamente
      if (result.valid && result.gpsAccuracy && result.gpsAccuracy <= 30) {
        return {
          ...result,
          message: `${result.message} (Precisão: ${Math.round(result.gpsAccuracy)}m)`
        };
      }

      // Guardar o melhor resultado
      if (result.gpsAccuracy && result.gpsAccuracy < bestAccuracy) {
        bestAccuracy = result.gpsAccuracy;
        bestResult = result;
      }

      // Se já tentou várias vezes e tem um resultado aceitável, retornar
      if (i === maxRetries - 1 && bestResult && bestResult.gpsAccuracy && bestResult.gpsAccuracy <= 100) {
        return {
          ...bestResult,
          message: `${bestResult.message} (Precisão: ${Math.round(bestResult.gpsAccuracy)}m)`
        };
      }
    } catch (error: any) {
      console.warn(`Tentativa ${i + 1} falhou:`, error);
    }
  }

  // Se chegou aqui, retornar o melhor resultado ou erro
  if (bestResult) {
    return {
      ...bestResult,
      message: `${bestResult.message} (Melhor precisão: ${Math.round(bestResult.gpsAccuracy || 0)}m)`
    };
  }

  return {
    valid: false,
    message: 'Não foi possível obter localização precisa após várias tentativas'
  };
}; 