/**
 * Sistema Avançado de Geolocalização para Funcionários Móveis
 * Implementa reset de GPS por registro, calibração persistente e validação adaptativa
 */

import { AllowedLocation } from '@/types/index';

export interface LocationValidationResult {
  valid: boolean;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  closestLocation?: AllowedLocation;
  distance?: number;
  gpsAccuracy?: number;
  confidence?: number;
  locationChanged?: boolean;
  previousLocation?: string;
  appliedRange?: number;
  resetRequired?: boolean;
  debug?: {
    attempts: number;
    rangesUsed: number[];
    calibrationApplied: boolean;
    changeDetected: boolean;
  };
}

interface GPSCalibration {
  locationId: string;
  offset: { latitude: number; longitude: number };
  accuracy: number;
  timestamp: number;
  sessionsUsed: number;
  successRate: number;
}

interface LocationCache {
  lastRegistrationLocation: string | null;
  lastGPSPosition: GeolocationPosition | null;
  lastValidationTime: number;
  forceReset: boolean;
}

interface AdaptiveRange {
  base: number;
  expanded: number;
  emergency: number;
}

const STORAGE_KEYS = {
  CALIBRATIONS: 'advanced_gps_calibrations',
  LOCATION_CACHE: 'location_cache_v2',
  VALIDATION_LOG: 'location_validation_log',
  EMPLOYEE_SETTINGS: 'employee_location_settings'
};

const DEFAULT_RANGES: AdaptiveRange = {
  base: 100,      // Range inicial
  expanded: 300,  // Range expandido para GPS impreciso
  emergency: 500  // Range de emergência
};

const CALIBRATION_VALIDITY_HOURS = 48;
const LOCATION_CHANGE_THRESHOLD = 150; // Aumentado de 50m para 150m
const GPS_ACCURACY_THRESHOLD = 50;     // Limite para considerar GPS impreciso

/**
 * 1. RESET DE GPS POR REGISTRO
 */
class GPSResetManager {
  static clearLocationCache(): void {
    try {
      const cache: LocationCache = {
        lastRegistrationLocation: null,
        lastGPSPosition: null,
        lastValidationTime: 0,
        forceReset: true
      };
      localStorage.setItem(STORAGE_KEYS.LOCATION_CACHE, JSON.stringify(cache));
      console.log('🔄 GPS Cache resetado - nova validação necessária');
    } catch (error) {
      console.warn('Erro ao resetar cache GPS:', error);
    }
  }

  static shouldForceNewPosition(): boolean {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCATION_CACHE) || '{}');
      return cache.forceReset === true || !cache.lastGPSPosition;
    } catch {
      return true;
    }
  }

  static markPositionUsed(position: GeolocationPosition, locationId: string): void {
    try {
      const cache: LocationCache = {
        lastRegistrationLocation: locationId,
        lastGPSPosition: position,
        lastValidationTime: Date.now(),
        forceReset: false
      };
      localStorage.setItem(STORAGE_KEYS.LOCATION_CACHE, JSON.stringify(cache));
    } catch (error) {
      console.warn('Erro ao marcar posição como usada:', error);
    }
  }
}

/**
 * 2. CALIBRAÇÃO PERSISTENTE E INTELIGENTE
 */
class GPSCalibrationManager {
  static getCalibration(locationId: string): GPSCalibration | null {
    try {
      const calibrations = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALIBRATIONS) || '{}');
      const calibration = calibrations[locationId];
      
      if (!calibration) return null;
      
      const ageHours = (Date.now() - calibration.timestamp) / (1000 * 60 * 60);
      if (ageHours > CALIBRATION_VALIDITY_HOURS) {
        delete calibrations[locationId];
        localStorage.setItem(STORAGE_KEYS.CALIBRATIONS, JSON.stringify(calibrations));
        return null;
      }
      
      return calibration;
    } catch {
      return null;
    }
  }

  static saveCalibration(
    locationId: string,
    offset: { latitude: number; longitude: number },
    accuracy: number
  ): void {
    try {
      const calibrations = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALIBRATIONS) || '{}');
      const existing = calibrations[locationId];
      
      calibrations[locationId] = {
        locationId,
        offset,
        accuracy,
        timestamp: Date.now(),
        sessionsUsed: existing ? existing.sessionsUsed + 1 : 1,
        successRate: existing ? (existing.successRate + 1) / 2 : 1
      };
      
      localStorage.setItem(STORAGE_KEYS.CALIBRATIONS, JSON.stringify(calibrations));
      console.log(`🎯 Calibração salva para ${locationId}:`, calibrations[locationId]);
    } catch (error) {
      console.warn('Erro ao salvar calibração:', error);
    }
  }

  static applyCalibration(
    position: { latitude: number; longitude: number; accuracy: number },
    locationId: string
  ): { latitude: number; longitude: number; accuracy: number; calibrationApplied: boolean } {
    const calibration = this.getCalibration(locationId);
    
    if (!calibration) {
      return { ...position, calibrationApplied: false };
    }

    return {
      latitude: position.latitude + calibration.offset.latitude,
      longitude: position.longitude + calibration.offset.longitude,
      accuracy: Math.min(position.accuracy, calibration.accuracy),
      calibrationApplied: true
    };
  }
}

/**
 * 3. VALIDAÇÃO ADAPTATIVA COM RANGE DINÂMICO
 */
class AdaptiveLocationValidator {
  static async getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
        return;
      }

      // Sempre forçar nova posição se necessário
      const forceNew = GPSResetManager.shouldForceNewPosition();
      
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: forceNew ? 30000 : 15000,
          maximumAge: forceNew ? 0 : 5000 // Força nova posição se reset necessário
        }
      );
    });
  }

  static calculateDistance(
    lat1: number, lon1: number, lat2: number, lon2: number
  ): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  static determineAdaptiveRange(gpsAccuracy: number): AdaptiveRange {
    const settings = this.getEmployeeSettings();
    
    if (gpsAccuracy > GPS_ACCURACY_THRESHOLD) {
      // GPS impreciso - usar ranges expandidos
      return {
        base: settings.base * 1.5,
        expanded: settings.expanded,
        emergency: settings.emergency
      };
    }
    
    return settings;
  }

  static getEmployeeSettings(): AdaptiveRange {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_SETTINGS);
      return stored ? JSON.parse(stored) : DEFAULT_RANGES;
    } catch {
      return DEFAULT_RANGES;
    }
  }

  static async validateWithAdaptiveRange(
    allowedLocations: AllowedLocation[],
    confidenceThreshold: number = 0.7
  ): Promise<LocationValidationResult> {
    const debugInfo = {
      attempts: 0,
      rangesUsed: [] as number[],
      calibrationApplied: false,
      changeDetected: false
    };

    try {
      // 1. Obter posição atual (com reset se necessário)
      const position = await this.getCurrentPosition();
      debugInfo.attempts++;

      const currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || 100
      };

      // 2. Determinar range adaptativo baseado na precisão GPS
      const adaptiveRange = this.determineAdaptiveRange(currentLocation.accuracy);
      
      // 3. Detectar mudança de local
      const previousLocationId = this.getLastRegistrationLocation();
      const locationChange = this.detectLocationChange(
        currentLocation, 
        previousLocationId, 
        allowedLocations
      );
      
      if (locationChange.changed) {
        debugInfo.changeDetected = true;
        console.log('📍 Mudança de local detectada:', locationChange);
      }

      // 4. Tentar validação com diferentes ranges
      const rangesToTry = [
        adaptiveRange.base,
        adaptiveRange.expanded,
        adaptiveRange.emergency
      ];

      for (const range of rangesToTry) {
        debugInfo.rangesUsed.push(range);
        
        let bestMatch: AllowedLocation | null = null;
        let bestDistance = Infinity;
        let bestCalibratedPosition = currentLocation;

        // Testar cada local permitido
        for (const location of allowedLocations) {
          // Aplicar calibração específica do local se disponível
          const calibratedPosition = GPSCalibrationManager.applyCalibration(
            currentLocation,
            location.id
          );
          
          if (calibratedPosition.calibrationApplied) {
            debugInfo.calibrationApplied = true;
          }

          const distance = this.calculateDistance(
            calibratedPosition.latitude,
            calibratedPosition.longitude,
            location.latitude,
            location.longitude
          );

          // Usar range específico do local ou range adaptativo
          const effectiveRange = Math.max(location.range_meters, range);

          if (distance <= effectiveRange && distance < bestDistance) {
            bestMatch = location;
            bestDistance = distance;
            bestCalibratedPosition = calibratedPosition;
          }
        }

        // Se encontrou match válido
        if (bestMatch) {
          const confidence = Math.max(0, 1 - (bestDistance / adaptiveRange.emergency));
          
          if (confidence >= confidenceThreshold) {
            // Marcar posição como usada e registrar sucesso
            GPSResetManager.markPositionUsed(position, bestMatch.id);
            this.logValidationSuccess(bestMatch.id, bestDistance, range);

            let message = `Localização validada em ${bestMatch.name}`;
            if (locationChange.changed) {
              message = `Alterado de ${locationChange.previousLocation?.name} para ${bestMatch.name}`;
            }

            return {
              valid: true,
              message,
              location: bestCalibratedPosition,
              closestLocation: bestMatch,
              distance: bestDistance,
              gpsAccuracy: currentLocation.accuracy,
              confidence,
              locationChanged: locationChange.changed,
              previousLocation: locationChange.previousLocation?.name,
              appliedRange: range,
              debug: debugInfo
            };
          }
        }
      }

      // Nenhum range funcionou
      this.logValidationFailure(currentLocation, allowedLocations, debugInfo);
      
      return {
        valid: false,
        message: `Localização não autorizada. GPS: ${Math.round(currentLocation.accuracy)}m de precisão. Locais testados: ${allowedLocations.length}`,
        location: currentLocation,
        gpsAccuracy: currentLocation.accuracy,
        resetRequired: true,
        debug: debugInfo
      };

    } catch (error) {
      console.error('❌ Erro na validação adaptativa:', error);
      return {
        valid: false,
        message: 'Erro ao obter localização GPS',
        debug: debugInfo
      };
    }
  }

  private static getLastRegistrationLocation(): string | null {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCATION_CACHE) || '{}');
      return cache.lastRegistrationLocation;
    } catch {
      return null;
    }
  }

  private static detectLocationChange(
    currentLocation: { latitude: number; longitude: number },
    previousLocationId: string | null,
    allowedLocations: AllowedLocation[]
  ): { changed: boolean; previousLocation?: AllowedLocation } {
    if (!previousLocationId) return { changed: false };
    
    const previousLocation = allowedLocations.find(loc => loc.id === previousLocationId);
    if (!previousLocation) return { changed: false };
    
    const distance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      previousLocation.latitude,
      previousLocation.longitude
    );
    
    return {
      changed: distance > LOCATION_CHANGE_THRESHOLD,
      previousLocation
    };
  }

  private static logValidationSuccess(locationId: string, distance: number, range: number): void {
    try {
      const log = JSON.parse(localStorage.getItem(STORAGE_KEYS.VALIDATION_LOG) || '[]');
      log.push({
        timestamp: Date.now(),
        type: 'success',
        locationId,
        distance,
        range,
        date: new Date().toISOString()
      });
      
      // Manter apenas últimos 50 logs
      if (log.length > 50) {
        log.splice(0, log.length - 50);
      }
      
      localStorage.setItem(STORAGE_KEYS.VALIDATION_LOG, JSON.stringify(log));
    } catch (error) {
      console.warn('Erro ao salvar log de sucesso:', error);
    }
  }

  private static logValidationFailure(
    location: { latitude: number; longitude: number; accuracy: number },
    allowedLocations: AllowedLocation[],
    debug: any
  ): void {
    try {
      const log = JSON.parse(localStorage.getItem(STORAGE_KEYS.VALIDATION_LOG) || '[]');
      log.push({
        timestamp: Date.now(),
        type: 'failure',
        location,
        allowedLocationsCount: allowedLocations.length,
        debug,
        date: new Date().toISOString()
      });
      
      if (log.length > 50) {
        log.splice(0, log.length - 50);
      }
      
      localStorage.setItem(STORAGE_KEYS.VALIDATION_LOG, JSON.stringify(log));
    } catch (error) {
      console.warn('Erro ao salvar log de falha:', error);
    }
  }
}

/**
 * 4. INTERFACE PRINCIPAL PARA O SISTEMA
 */
export class AdvancedLocationSystem {
  /**
   * Reset completo do sistema - usar após cada registro bem-sucedido
   */
  static resetForNewRegistration(): void {
    GPSResetManager.clearLocationCache();
    console.log('🔄 Sistema resetado para novo registro');
  }

  /**
   * Forçar nova localização - botão manual no UI
   */
  static forceLocationRefresh(): void {
    GPSResetManager.clearLocationCache();
    // Limpar também calibrações antigas se necessário
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    try {
      const calibrations = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALIBRATIONS) || '{}');
      Object.keys(calibrations).forEach(key => {
        if (calibrations[key].timestamp < oneDayAgo) {
          delete calibrations[key];
        }
      });
      localStorage.setItem(STORAGE_KEYS.CALIBRATIONS, JSON.stringify(calibrations));
    } catch (error) {
      console.warn('Erro ao limpar calibrações antigas:', error);
    }
    console.log('🆕 Localização forçada a atualizar');
  }

  /**
   * Calibrar GPS para local específico
   */
  static async calibrateForLocation(
    locationId: string,
    targetLocation: { latitude: number; longitude: number }
  ): Promise<boolean> {
    try {
      const position = await AdaptiveLocationValidator.getCurrentPosition();
      
      const offset = {
        latitude: targetLocation.latitude - position.coords.latitude,
        longitude: targetLocation.longitude - position.coords.longitude
      };
      
      GPSCalibrationManager.saveCalibration(
        locationId,
        offset,
        position.coords.accuracy || 100
      );
      
      console.log(`🎯 GPS calibrado para local ${locationId}`);
      return true;
    } catch (error) {
      console.error('Erro na calibração:', error);
      return false;
    }
  }

  /**
   * Validação principal - usar em substituição ao sistema anterior
   */
  static async validateLocation(
    allowedLocations: AllowedLocation[],
    confidenceThreshold: number = 0.7
  ): Promise<LocationValidationResult> {
    return AdaptiveLocationValidator.validateWithAdaptiveRange(
      allowedLocations,
      confidenceThreshold
    );
  }

  /**
   * Obter logs de debug para análise
   */
  static getValidationLogs(): any[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.VALIDATION_LOG) || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Configurar ranges personalizados para funcionário
   */
  static configureEmployeeRanges(ranges: Partial<AdaptiveRange>): void {
    try {
      const current = AdaptiveLocationValidator.getEmployeeSettings();
      const updated = { ...current, ...ranges };
      localStorage.setItem(STORAGE_KEYS.EMPLOYEE_SETTINGS, JSON.stringify(updated));
    } catch (error) {
      console.warn('Erro ao configurar ranges:', error);
    }
  }
}

// Exportar tudo para compatibilidade
export {
  GPSResetManager,
  GPSCalibrationManager,
  AdaptiveLocationValidator
};