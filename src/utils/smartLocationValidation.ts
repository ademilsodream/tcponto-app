
import { validateLocationWithConfidence } from './enhancedLocationValidation';
import { AllowedLocation } from '@/types/index';

interface LocationValidationResult {
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
}

interface StoredCalibration {
  offset: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
  locationId: string;
  accuracy: number;
}

const CALIBRATION_CACHE_KEY = 'gps_calibrations';
const LAST_LOCATION_KEY = 'last_registration_location';
const CALIBRATION_VALIDITY_HOURS = 24;
const LOCATION_CHANGE_THRESHOLD = 50; // metros

// Gerenciar calibrações por local
export const getLocationCalibration = (locationId: string): StoredCalibration | null => {
  try {
    const calibrations = JSON.parse(localStorage.getItem(CALIBRATION_CACHE_KEY) || '{}');
    const calibration = calibrations[locationId];
    
    if (!calibration) return null;
    
    const ageHours = (Date.now() - calibration.timestamp) / (1000 * 60 * 60);
    if (ageHours > CALIBRATION_VALIDITY_HOURS) {
      delete calibrations[locationId];
      localStorage.setItem(CALIBRATION_CACHE_KEY, JSON.stringify(calibrations));
      return null;
    }
    
    return calibration;
  } catch {
    return null;
  }
};

export const saveLocationCalibration = (locationId: string, offset: { latitude: number; longitude: number }, accuracy: number) => {
  try {
    const calibrations = JSON.parse(localStorage.getItem(CALIBRATION_CACHE_KEY) || '{}');
    calibrations[locationId] = {
      offset,
      timestamp: Date.now(),
      locationId,
      accuracy
    };
    localStorage.setItem(CALIBRATION_CACHE_KEY, JSON.stringify(calibrations));
  } catch (error) {
    console.warn('Erro ao salvar calibração:', error);
  }
};

export const getLastRegistrationLocation = (): string | null => {
  return localStorage.getItem(LAST_LOCATION_KEY);
};

export const saveLastRegistrationLocation = (locationId: string) => {
  localStorage.setItem(LAST_LOCATION_KEY, locationId);
};

// Detectar mudança significativa de local
export const detectLocationChange = (
  currentLocation: { latitude: number; longitude: number },
  previousLocationId: string | null,
  allowedLocations: AllowedLocation[]
): { changed: boolean; previousLocation?: AllowedLocation } => {
  if (!previousLocationId) return { changed: false };
  
  const previousLocation = allowedLocations.find(loc => loc.id === previousLocationId);
  if (!previousLocation) return { changed: false };
  
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    previousLocation.latitude,
    previousLocation.longitude
  );
  
  return {
    changed: distance > LOCATION_CHANGE_THRESHOLD,
    previousLocation
  };
};

// Validação inteligente que considera mudança de local
export const validateLocationForMobileWorker = async (
  allowedLocations: AllowedLocation[],
  confidenceThreshold: number = 0.7
): Promise<LocationValidationResult> => {
  try {
    const previousLocationId = getLastRegistrationLocation();
    
    // Usar validação padrão primeiro
    const baseResult = await validateLocationWithConfidence(allowedLocations, confidenceThreshold);
    
    if (!baseResult.valid) {
      // Se não passou na validação padrão, verificar se é mudança de local
      if (baseResult.location && previousLocationId) {
        const locationChange = detectLocationChange(
          baseResult.location,
          previousLocationId,
          allowedLocations
        );
        
        if (locationChange.changed) {
          // É uma mudança de local - tentar validação mais flexível
          const flexibleResult = await validateLocationWithConfidence(
            allowedLocations,
            Math.max(0.5, confidenceThreshold - 0.2) // Reduzir threshold
          );
          
          if (flexibleResult.valid) {
            return {
              valid: flexibleResult.valid,
              message: `Localização alterada de ${locationChange.previousLocation?.name} para ${flexibleResult.closestLocation?.name}`,
              location: flexibleResult.location,
              closestLocation: flexibleResult.closestLocation,
              distance: flexibleResult.distance,
              gpsAccuracy: flexibleResult.gpsAccuracy,
              confidence: flexibleResult.confidence,
              locationChanged: true,
              previousLocation: locationChange.previousLocation?.name
            };
          }
        }
      }
      
      return {
        valid: baseResult.valid,
        message: baseResult.message,
        location: baseResult.location,
        closestLocation: baseResult.closestLocation,
        distance: baseResult.distance,
        gpsAccuracy: baseResult.gpsAccuracy,
        confidence: baseResult.confidence
      };
    }
    
    // Passou na validação - verificar se houve mudança de local
    if (baseResult.location && baseResult.closestLocation && previousLocationId) {
      const locationChange = detectLocationChange(
        baseResult.location,
        previousLocationId,
        allowedLocations
      );
      
      if (locationChange.changed) {
        return {
          valid: baseResult.valid,
          message: `Localização alterada para ${baseResult.closestLocation.name}`,
          location: baseResult.location,
          closestLocation: baseResult.closestLocation,
          distance: baseResult.distance,
          gpsAccuracy: baseResult.gpsAccuracy,
          confidence: baseResult.confidence,
          locationChanged: true,
          previousLocation: locationChange.previousLocation?.name
        };
      }
    }
    
    return {
      valid: baseResult.valid,
      message: baseResult.message,
      location: baseResult.location,
      closestLocation: baseResult.closestLocation,
      distance: baseResult.distance,
      gpsAccuracy: baseResult.gpsAccuracy,
      confidence: baseResult.confidence
    };
    
  } catch (error) {
    console.error('Erro na validação inteligente:', error);
    return {
      valid: false,
      message: 'Erro ao validar localização'
    };
  }
};

// Aplicar calibração persistente se disponível
export const applyStoredCalibration = (
  location: { latitude: number; longitude: number; accuracy: number },
  locationId: string
): { latitude: number; longitude: number; accuracy: number } => {
  const calibration = getLocationCalibration(locationId);
  
  if (!calibration) return location;
  
  return {
    latitude: location.latitude + calibration.offset.latitude,
    longitude: location.longitude + calibration.offset.longitude,
    accuracy: Math.min(location.accuracy, calibration.accuracy)
  };
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
