interface Location {
    latitude: number;
    longitude: number;
    accuracy?: number;
  }
  
  interface AllowedLocation {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    range_meters: number;
    is_active: boolean;
  }
  
  interface ValidationResult {
    valid: boolean;
    location?: Location;
    message: string;
    closestLocation?: AllowedLocation;
    distance?: number;
    gpsAccuracy?: number;
    adaptiveRange?: number;
    confidence: number;
  }
  
  export const validateLocationWithConfidence = async (
    allowedLocations: AllowedLocation[],
    currentLocation?: Location | null,
    options?: {
      minAccuracy?: number;
      requireCalibration?: boolean;
    }
  ): Promise<ValidationResult> => {
    const minAccuracy = options?.minAccuracy || 100;
  
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
  
      const accuracy = userLocation.accuracy || 50;
  
      // Verificar se precisão atende ao mínimo
      if (accuracy > minAccuracy) {
        return {
          valid: false,
          location: userLocation,
          message: `Precisão GPS insuficiente (${accuracy.toFixed(1)}m). Mínimo requerido: ${minAccuracy}m`,
          gpsAccuracy: accuracy,
          confidence: Math.max(0, 100 - (accuracy / 2))
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
      const adaptiveRange = Math.max(
        closest.location.range_meters,
        accuracy * 1.5 // Compensar imprecisão do GPS
      );
  
      // Calcular confiança baseada em múltiplos fatores
      const distanceConfidence = Math.max(0, 100 - (closest.distance / adaptiveRange) * 100);
      const accuracyConfidence = Math.max(0, 100 - (accuracy / 20) * 100);
      const overallConfidence = (distanceConfidence + accuracyConfidence) / 2;
  
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
        confidence: overallConfidence
      };
  
    } catch (error: any) {
      throw new Error(`Erro ao obter localização: ${error.message}`);
    }
  };
  
  // Função auxiliar para calcular distância
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
  
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
    return R * c;
  }
  
  // Limpar cache (mantendo a função existente)
  export const clearLocationCache = () => {
    // Implementação existente
  };