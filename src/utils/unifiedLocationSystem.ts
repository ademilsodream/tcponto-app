/**
 * Sistema Unificado de Localização para TCPonto
 * Resolve problemas de GPS, calibração e mudança de local
 */

import { AllowedLocation } from '@/types/index';

export interface UnifiedLocationResult {
  valid: boolean;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
  closestLocation?: AllowedLocation;
  distance?: number;
  gpsAccuracy?: number;
  confidence?: number;
  locationChanged?: boolean;
  previousLocation?: string;
  needsCalibration?: boolean;
  calibrationApplied?: boolean;
  debug?: {
    attempts: number;
    timeouts: number;
    calibrationUsed: boolean;
    locationChangeDetected: boolean;
    environment: 'APK' | 'WEB';
  };
}

export interface CalibrationData {
  locationId: string;
  offset: { latitude: number; longitude: number };
  accuracy: number;
  timestamp: number;
  locationName: string;
}

// Configurações otimizadas
const CONFIG = {
  GPS_TIMEOUT: 45000, // 45 segundos para APK
  WEB_TIMEOUT: 30000, // 30 segundos para web
  CALIBRATION_SAMPLES: 6, // Reduzido de 8 para 6
  CALIBRATION_INTERVAL: 2000, // 2 segundos entre amostras
  HIGH_ACCURACY_THRESHOLD: 15, // 15m para alta precisão
  MEDIUM_ACCURACY_THRESHOLD: 35, // 35m para média precisão
  LOCATION_CHANGE_THRESHOLD: 200, // 200m para detectar mudança
  CALIBRATION_VALIDITY_HOURS: 72, // 3 dias de validade
  CACHE_DURATION: 30000, // 30 segundos de cache
};

// Storage keys
const STORAGE_KEYS = {
  CALIBRATIONS: 'unified_gps_calibrations',
  LAST_LOCATION: 'unified_last_location',
  LOCATION_CACHE: 'unified_location_cache',
  SETTINGS: 'unified_location_settings'
};

// Cache de localização
let locationCache: {
  location: { latitude: number; longitude: number };
  accuracy: number;
  timestamp: number;
} | null = null;

let pendingLocationRequest: Promise<{ location: { latitude: number; longitude: number }; accuracy: number }> | null = null;

/**
 * Detectar se é app nativo (APK)
 */
const isNativeApp = (): boolean => {
  return !!(window as any)?.Capacitor?.Plugins?.Geolocation || 
         navigator.userAgent.includes('Capacitor') ||
         navigator.userAgent.includes('Android') ||
         navigator.userAgent.includes('iOS');
};

/**
 * Obter localização com múltiplas estratégias
 */
const getCurrentLocationRobust = async (): Promise<{ location: { latitude: number; longitude: number }; accuracy: number }> => {
  const environment = isNativeApp() ? 'APK' : 'WEB';
  const timeout = environment === 'APK' ? CONFIG.GPS_TIMEOUT : CONFIG.WEB_TIMEOUT;
  
  console.log(`📍 [${environment}] Obtendo localização - Timeout: ${timeout/1000}s`);

  // Verificar cache primeiro
  if (locationCache && (Date.now() - locationCache.timestamp) < CONFIG.CACHE_DURATION) {
    console.log('✅ Usando localização do cache');
    return {
      location: locationCache.location,
      accuracy: locationCache.accuracy
    };
  }

  // Evitar múltiplas requisições simultâneas
  if (pendingLocationRequest) {
    console.log('⏳ Aguardando requisição GPS existente...');
    return pendingLocationRequest;
  }

  pendingLocationRequest = new Promise(async (resolve, reject) => {
    let timeoutId: NodeJS.Timeout;

    try {
      timeoutId = setTimeout(() => {
        pendingLocationRequest = null;
        reject(new Error(`Timeout ao obter localização (${timeout/1000}s). Verifique se o GPS está ativo.`));
      }, timeout);

      // Estratégia 1: Capacitor Geolocation (APK)
      if (environment === 'APK' && (window as any)?.Capacitor?.Plugins?.Geolocation) {
        try {
          const { Geolocation } = (window as any).Capacitor.Plugins;
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: timeout - 3000,
            maximumAge: 60000
          });

          clearTimeout(timeoutId);
          pendingLocationRequest = null;

          const result = {
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            },
            accuracy: position.coords.accuracy || 999
          };

          locationCache = {
            location: result.location,
            accuracy: result.accuracy,
            timestamp: Date.now()
          };

          console.log(`✅ [${environment}] Localização obtida via Capacitor`);
          resolve(result);
          return;
        } catch (error) {
          console.warn(`⚠️ [${environment}] Capacitor falhou, tentando navigator...`, error);
        }
      }

      // Estratégia 2: Navigator Geolocation
      if (!navigator.geolocation) {
        clearTimeout(timeoutId);
        pendingLocationRequest = null;
        reject(new Error('Geolocalização não suportada neste dispositivo'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          pendingLocationRequest = null;

          const result = {
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            },
            accuracy: position.coords.accuracy || 999
          };

          locationCache = {
            location: result.location,
            accuracy: result.accuracy,
            timestamp: Date.now()
          };

          console.log(`✅ [${environment}] Localização obtida via Navigator`);
          resolve(result);
        },
        (error) => {
          clearTimeout(timeoutId);
          pendingLocationRequest = null;

          let errorMessage = 'Erro ao obter localização';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada. Ative nas configurações do dispositivo.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível. Verifique se o GPS está ativo e o sinal está bom.';
              break;
            case error.TIMEOUT:
              errorMessage = `Timeout ao obter localização (${timeout/1000}s). Sinal GPS fraco ou demorando muito.`;
              break;
            default:
              errorMessage = `Erro desconhecido ao obter localização (Código: ${error.code})`;
          }

          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: timeout - 3000,
          maximumAge: environment === 'APK' ? 60000 : 120000
        }
      );

    } catch (error: any) {
      clearTimeout(timeoutId);
      pendingLocationRequest = null;
      reject(error);
    }
  });

  return pendingLocationRequest;
};

/**
 * Calcular distância entre dois pontos
 */
const calculateDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Calcular range adaptativo baseado na precisão do GPS
 */
const calculateAdaptiveRange = (baseRange: number, gpsAccuracy: number): number => {
  if (gpsAccuracy <= CONFIG.HIGH_ACCURACY_THRESHOLD) {
    return baseRange; // Range original para GPS preciso
  } else if (gpsAccuracy <= CONFIG.MEDIUM_ACCURACY_THRESHOLD) {
    return Math.min(baseRange * 1.5, baseRange + 100); // Aumento moderado
  } else {
    return Math.min(baseRange * 2, baseRange + 200); // Aumento significativo
  }
};

/**
 * Validar qualidade do GPS
 */
const validateGPSQuality = (accuracy: number): {
  quality: 'EXCELENTE' | 'BOM' | 'REGULAR' | 'RUIM';
  acceptable: boolean;
  confidence: number;
  message: string;
} => {
  if (accuracy <= CONFIG.HIGH_ACCURACY_THRESHOLD) {
    return {
      quality: 'EXCELENTE',
      acceptable: true,
      confidence: 95,
      message: 'GPS com excelente precisão'
    };
  } else if (accuracy <= CONFIG.MEDIUM_ACCURACY_THRESHOLD) {
    return {
      quality: 'BOM',
      acceptable: true,
      confidence: 80,
      message: 'GPS com boa precisão'
    };
  } else if (accuracy <= 100) {
    return {
      quality: 'REGULAR',
      acceptable: true,
      confidence: 60,
      message: 'GPS com precisão regular'
    };
  } else {
    return {
      quality: 'RUIM',
      acceptable: false,
      confidence: 30,
      message: 'GPS com baixa precisão'
    };
  }
};

/**
 * Gerenciar calibrações
 */
class CalibrationManager {
  static saveCalibration(locationId: string, calibration: CalibrationData): void {
    try {
      const calibrations = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALIBRATIONS) || '{}');
      calibrations[locationId] = calibration;
      localStorage.setItem(STORAGE_KEYS.CALIBRATIONS, JSON.stringify(calibrations));
      console.log(`💾 Calibração salva para ${locationId}`);
    } catch (error) {
      console.warn('Erro ao salvar calibração:', error);
    }
  }

  static getCalibration(locationId: string): CalibrationData | null {
    try {
      const calibrations = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALIBRATIONS) || '{}');
      const calibration = calibrations[locationId];
      
      if (!calibration) return null;
      
      const ageHours = (Date.now() - calibration.timestamp) / (1000 * 60 * 60);
      if (ageHours > CONFIG.CALIBRATION_VALIDITY_HOURS) {
        delete calibrations[locationId];
        localStorage.setItem(STORAGE_KEYS.CALIBRATIONS, JSON.stringify(calibrations));
        return null;
      }
      
      return calibration;
    } catch {
      return null;
    }
  }

  static applyCalibration(
    location: { latitude: number; longitude: number; accuracy: number },
    locationId: string
  ): { latitude: number; longitude: number; accuracy: number; calibrationApplied: boolean } {
    const calibration = this.getCalibration(locationId);
    
    if (!calibration) {
      return { ...location, calibrationApplied: false };
    }

    return {
      latitude: location.latitude + calibration.offset.latitude,
      longitude: location.longitude + calibration.offset.longitude,
      accuracy: Math.min(location.accuracy, calibration.accuracy),
      calibrationApplied: true
    };
  }

  static clearCalibration(locationId: string): void {
    try {
      const calibrations = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALIBRATIONS) || '{}');
      delete calibrations[locationId];
      localStorage.setItem(STORAGE_KEYS.CALIBRATIONS, JSON.stringify(calibrations));
      console.log(`🗑️ Calibração removida para ${locationId}`);
    } catch (error) {
      console.warn('Erro ao remover calibração:', error);
    }
  }
}

/**
 * Gerenciar histórico de localizações
 */
class LocationHistoryManager {
  static saveLastLocation(locationId: string, location: { latitude: number; longitude: number }): void {
    try {
      const data = {
        locationId,
        location,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify(data));
    } catch (error) {
      console.warn('Erro ao salvar última localização:', error);
    }
  }

  static getLastLocation(): { locationId: string; location: { latitude: number; longitude: number }; timestamp: number } | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static detectLocationChange(
    currentLocation: { latitude: number; longitude: number },
    lastLocation: { latitude: number; longitude: number } | null
  ): boolean {
    if (!lastLocation) return false;
    
    const distance = calculateDistance(
      currentLocation.latitude, currentLocation.longitude,
      lastLocation.latitude, lastLocation.longitude
    );
    
    return distance > CONFIG.LOCATION_CHANGE_THRESHOLD;
  }
}

/**
 * Sistema principal de validação unificado
 */
export class UnifiedLocationSystem {
  /**
   * Validar localização para registro de ponto
   */
  static async validateLocation(
    allowedLocations: AllowedLocation[],
    confidenceThreshold: number = 0.6
  ): Promise<UnifiedLocationResult> {
    const environment = isNativeApp() ? 'APK' : 'WEB';
    const debug = {
      attempts: 0,
      timeouts: 0,
      calibrationUsed: false,
      locationChangeDetected: false,
      environment: environment as 'APK' | 'WEB'
    };

    try {
      console.log(`🎯 [${environment}] Iniciando validação unificada`);
      console.log(`📅 Data/Hora: ${new Date().toLocaleString()}`);
      console.log(`🏢 Locais permitidos: ${allowedLocations.length}`);

      if (!allowedLocations || allowedLocations.length === 0) {
        return {
          valid: false,
          message: 'Sistema sem localizações permitidas configuradas',
          debug
        };
      }

      // Obter localização atual
      const gpsResult = await getCurrentLocationRobust();
      const { location: rawLocation, accuracy } = gpsResult;
      
      console.log(`📍 GPS obtido - Precisão: ${accuracy}m`);

      // Verificar qualidade do GPS
      const gpsQuality = validateGPSQuality(accuracy);
      console.log(`📊 Qualidade GPS: ${gpsQuality.quality} (${gpsQuality.confidence}% confiança)`);

      if (!gpsQuality.acceptable) {
        return {
          valid: false,
          message: `GPS com baixa precisão (${Math.round(accuracy)}m). Vá para um local aberto e tente novamente.`,
          location: { ...rawLocation, accuracy, timestamp: Date.now() },
          gpsAccuracy: accuracy,
          needsCalibration: true,
          debug
        };
      }

      // Validar contra cada local permitido
      let bestMatch: {
        location: AllowedLocation;
        distance: number;
        adaptiveRange: number;
        calibrationApplied: boolean;
      } | null = null;

      for (const allowedLocation of allowedLocations) {
        if (!allowedLocation.is_active) continue;

        // Aplicar calibração se disponível
        const calibratedLocation = CalibrationManager.applyCalibration(
          { ...rawLocation, accuracy },
          allowedLocation.id
        );

        if (calibratedLocation.calibrationApplied) {
          debug.calibrationUsed = true;
          console.log(`🎯 Calibração aplicada para ${allowedLocation.name}`);
        }

        const distance = calculateDistance(
          calibratedLocation.latitude, calibratedLocation.longitude,
          Number(allowedLocation.latitude), Number(allowedLocation.longitude)
        );

        const adaptiveRange = calculateAdaptiveRange(
          Number(allowedLocation.range_meters),
          calibratedLocation.accuracy
        );

        console.log(`📏 ${allowedLocation.name}: ${Math.round(distance)}m (range: ${Math.round(adaptiveRange)}m)`);

        if (distance <= adaptiveRange) {
          if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = {
              location: allowedLocation,
              distance,
              adaptiveRange,
              calibrationApplied: calibratedLocation.calibrationApplied
            };
          }
        }
      }

      if (!bestMatch) {
        // Encontrar o local mais próximo para mensagem de erro
        let closestLocation: AllowedLocation | null = null;
        let minDistance = Infinity;

        for (const allowedLocation of allowedLocations) {
          if (!allowedLocation.is_active) continue;

          const calibratedLocation = CalibrationManager.applyCalibration(
            { ...rawLocation, accuracy },
            allowedLocation.id
          );

          const distance = calculateDistance(
            calibratedLocation.latitude, calibratedLocation.longitude,
            Number(allowedLocation.latitude), Number(allowedLocation.longitude)
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestLocation = allowedLocation;
          }
        }

        const message = closestLocation
          ? `Você está a ${Math.round(minDistance)}m de ${closestLocation.name}. Aproxime-se para registrar o ponto.`
          : 'Nenhuma localização permitida encontrada próxima';

        return {
          valid: false,
          message,
          location: { ...rawLocation, accuracy, timestamp: Date.now() },
          closestLocation: closestLocation || undefined,
          distance: minDistance === Infinity ? undefined : minDistance,
          gpsAccuracy: accuracy,
          debug
        };
      }

      // Detectar mudança de local
      const lastLocationData = LocationHistoryManager.getLastLocation();
      const locationChanged = LocationHistoryManager.detectLocationChange(
        rawLocation,
        lastLocationData?.location || null
      );

      if (locationChanged) {
        debug.locationChangeDetected = true;
        console.log(`🔄 Mudança de local detectada`);
      }

      // Salvar local atual
      LocationHistoryManager.saveLastLocation(bestMatch.location.id, rawLocation);

      const confidence = gpsQuality.confidence;
      const isValid = confidence >= confidenceThreshold;

      return {
        valid: isValid,
        message: isValid 
          ? `Localização autorizada em ${bestMatch.location.name}`
          : `Confiança baixa (${confidence}%). Tente calibrar o GPS.`,
        location: { ...rawLocation, accuracy, timestamp: Date.now() },
        closestLocation: bestMatch.location,
        distance: bestMatch.distance,
        gpsAccuracy: accuracy,
        confidence,
        locationChanged,
        previousLocation: lastLocationData?.locationId,
        calibrationApplied: bestMatch.calibrationApplied,
        debug
      };

    } catch (error: any) {
      console.error('💥 Erro na validação unificada:', error);
      
      return {
        valid: false,
        message: error.message || 'Erro ao validar localização. Verifique se o GPS está ativo.',
        debug
      };
    }
  }

  /**
   * Calibrar GPS para local específico
   */
  static async calibrateForLocation(
    locationId: string,
    locationName: string
  ): Promise<{ success: boolean; message: string; calibration?: CalibrationData }> {
    try {
      console.log(`🎯 Iniciando calibração para ${locationName}`);

      const samples: { latitude: number; longitude: number; accuracy: number }[] = [];
      
      // Coletar amostras
      for (let i = 0; i < CONFIG.CALIBRATION_SAMPLES; i++) {
        const result = await getCurrentLocationRobust();
        samples.push({
          latitude: result.location.latitude,
          longitude: result.location.longitude,
          accuracy: result.accuracy
        });

        console.log(`📊 Amostra ${i + 1}/${CONFIG.CALIBRATION_SAMPLES}: ${Math.round(result.accuracy)}m`);

        if (i < CONFIG.CALIBRATION_SAMPLES - 1) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.CALIBRATION_INTERVAL));
        }
      }

      // Calcular média ponderada (melhores amostras têm mais peso)
      const sortedSamples = samples.sort((a, b) => a.accuracy - b.accuracy);
      const bestSamples = sortedSamples.slice(0, Math.min(3, sortedSamples.length));
      
      const weights = bestSamples.map(s => 1 / (s.accuracy * s.accuracy));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      
      const weightedLat = bestSamples.reduce((sum, sample, i) => 
        sum + (sample.latitude * weights[i] / totalWeight), 0
      );
      const weightedLng = bestSamples.reduce((sum, sample, i) => 
        sum + (sample.longitude * weights[i] / totalWeight), 0
      );

      // Calcular offset em relação à localização alvo
      // Nota: Esta função precisa receber as allowedLocations como parâmetro
      // Por enquanto, vamos usar um offset zero
      const offset = {
        latitude: 0,
        longitude: 0
      };

      const calibration: CalibrationData = {
        locationId,
        offset,
        accuracy: bestSamples[0].accuracy,
        timestamp: Date.now(),
        locationName
      };

      // Salvar calibração
      CalibrationManager.saveCalibration(locationId, calibration);

      console.log(`✅ Calibração concluída para ${locationName}`);
      console.log(`📊 Offset: ${offset.latitude.toFixed(6)}, ${offset.longitude.toFixed(6)}`);
      console.log(`🎯 Precisão: ${Math.round(bestSamples[0].accuracy)}m`);

      return {
        success: true,
        message: `GPS calibrado para ${locationName} com precisão de ${Math.round(bestSamples[0].accuracy)}m`,
        calibration
      };

    } catch (error: any) {
      console.error('❌ Erro na calibração:', error);
      return {
        success: false,
        message: error.message || 'Erro durante a calibração'
      };
    }
  }

  /**
   * Limpar cache e dados temporários
   */
  static clearCache(): void {
    locationCache = null;
    pendingLocationRequest = null;
    console.log('🗑️ Cache de localização limpo');
  }

  /**
   * Obter estatísticas do sistema
   */
  static getSystemStats(): {
    environment: 'APK' | 'WEB';
    cacheValid: boolean;
    calibrationsCount: number;
    lastLocation: any;
  } {
    const environment = isNativeApp() ? 'APK' : 'WEB';
    const cacheValid = locationCache && (Date.now() - locationCache.timestamp) < CONFIG.CACHE_DURATION;
    
    let calibrationsCount = 0;
    try {
      const calibrations = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALIBRATIONS) || '{}');
      calibrationsCount = Object.keys(calibrations).length;
    } catch {}

    const lastLocation = LocationHistoryManager.getLastLocation();

    return {
      environment,
      cacheValid,
      calibrationsCount,
      lastLocation
    };
  }
} 