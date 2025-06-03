
interface Location {
  latitude: number;
  longitude: number;
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

// Cache global para localização válida
let locationCache: {
  location: Location;
  timestamp: number;
  accuracy: number;
} | null = null;

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos
const GPS_TIMEOUT = 15000; // 15 segundos máximo
let pendingLocationRequest: Promise<{ location: Location; accuracy: number }> | null = null;

// Calcular distância otimizada
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Range adaptativo otimizado
const calculateAdaptiveRange = (baseRange: number, gpsAccuracy: number): number => {
  if (gpsAccuracy <= 50) return baseRange;
  if (gpsAccuracy <= 100) return baseRange + gpsAccuracy;
  if (gpsAccuracy <= 200) return baseRange + (gpsAccuracy * 1.5);
  return Math.min(500, baseRange + (gpsAccuracy * 2));
};

// Verificar se localização está permitida (otimizada)
export const isLocationAllowed = (
  currentLocation: Location,
  allowedLocations: AllowedLocation[],
  gpsAccuracy: number = 100
): { allowed: boolean; closestLocation?: AllowedLocation; distance?: number; adaptiveRange?: number } => {
  
  if (!allowedLocations || allowedLocations.length === 0) {
    return { allowed: false };
  }

  let closestLocation: AllowedLocation | undefined;
  let minDistance = Infinity;
  let usedRange = 0;

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
    
    if (distance <= adaptiveRange) {
      return { 
        allowed: true, 
        closestLocation: location, 
        distance: distance,
        adaptiveRange: adaptiveRange
      };
    }
  }

  return { 
    allowed: false, 
    closestLocation, 
    distance: minDistance,
    adaptiveRange: usedRange
  };
};

// Detectar ambiente nativo otimizado
const isNativeApp = (): boolean => {
  return !!(window as any)?.Capacitor?.isNativePlatform?.() || 
         !!(window as any)?.cordova ||
         /Android.*wv/.test(navigator.userAgent) ||
         (navigator.userAgent.includes('Android') && !(window as any).chrome);
};

// Obter localização com cache e timeout otimizado
const getCurrentLocationOptimized = async (): Promise<{ location: Location; accuracy: number }> => {
  // Verificar cache primeiro
  if (locationCache && (Date.now() - locationCache.timestamp) < CACHE_DURATION) {
    console.log('✅ Usando localização do cache');
    return {
      location: locationCache.location,
      accuracy: locationCache.accuracy
    };
  }

  // Se já há uma requisição pendente, aguardar ela
  if (pendingLocationRequest) {
    console.log('⏳ Aguardando requisição GPS existente...');
    return pendingLocationRequest;
  }

  // Criar nova requisição
  pendingLocationRequest = new Promise(async (resolve, reject) => {
    try {
      // Timeout global
      const timeoutId = setTimeout(() => {
        pendingLocationRequest = null;
        reject(new Error('Timeout ao obter localização (15s). Verifique se o GPS está ativo.'));
      }, GPS_TIMEOUT);

      // Tentar Capacitor primeiro se disponível
      if (isNativeApp() && (window as any)?.Capacitor?.Plugins?.Geolocation) {
        const { Geolocation } = (window as any).Capacitor.Plugins;
        
        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: GPS_TIMEOUT - 2000,
            maximumAge: 30000
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

          // Atualizar cache
          locationCache = {
            location: result.location,
            accuracy: result.accuracy,
            timestamp: Date.now()
          };

          resolve(result);
          return;
        } catch (capacitorError) {
          console.warn('Capacitor GPS falhou, tentando navigator...');
        }
      }

      // Fallback para navigator.geolocation
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

          // Atualizar cache
          locationCache = {
            location: result.location,
            accuracy: result.accuracy,
            timestamp: Date.now()
          };

          resolve(result);
        },
        (error) => {
          clearTimeout(timeoutId);
          pendingLocationRequest = null;
          
          let errorMessage = 'Erro ao obter localização';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada. Ative nas configurações.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível. Verifique se o GPS está ativo.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Timeout ao obter localização. Tente novamente.';
              break;
          }
          
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: GPS_TIMEOUT - 2000,
          maximumAge: isNativeApp() ? 30000 : 60000
        }
      );

    } catch (error) {
      pendingLocationRequest = null;
      reject(error);
    }
  });

  return pendingLocationRequest;
};

// Validação principal otimizada
export const validateLocationForTimeRecord = async (allowedLocations: AllowedLocation[]): Promise<{
  valid: boolean;
  location?: Location;
  message: string;
  closestLocation?: AllowedLocation;
  distance?: number;
  gpsAccuracy?: number;
  adaptiveRange?: number;
}> => {
  try {
    console.log('🎯 Iniciando validação otimizada de localização');
    
    if (!allowedLocations || allowedLocations.length === 0) {
      return {
        valid: false,
        message: 'Sistema sem localizações permitidas configuradas'
      };
    }

    console.log(`🏢 Validando contra ${allowedLocations.length} localizações`);
    
    const gpsResult = await getCurrentLocationOptimized();
    const { location, accuracy } = gpsResult;
    
    console.log(`📊 GPS obtido - Precisão: ${accuracy}m`);
    
    const validation = isLocationAllowed(location, allowedLocations, accuracy);
    
    if (validation.allowed) {
      const successMessage = `Localização autorizada em ${validation.closestLocation?.name}`;
      console.log(`✅ ${successMessage}`);
      
      return {
        valid: true,
        location,
        message: successMessage,
        closestLocation: validation.closestLocation,
        distance: validation.distance,
        gpsAccuracy: accuracy,
        adaptiveRange: validation.adaptiveRange
      };
    } else {
      const message = validation.closestLocation 
        ? `Você está a ${Math.round(validation.distance || 0)}m de ${validation.closestLocation.name}. Aproxime-se para registrar.`
        : 'Nenhuma localização permitida próxima';
      
      console.log(`❌ ${message}`);
      
      return {
        valid: false,
        location,
        message,
        closestLocation: validation.closestLocation,
        distance: validation.distance,
        gpsAccuracy: accuracy,
        adaptiveRange: validation.adaptiveRange
      };
    }
  } catch (error: any) {
    console.error('💥 Erro na validação:', error);
    
    return {
      valid: false,
      message: error.message || 'Erro ao validar localização. Verifique se o GPS está ativo.'
    };
  }
};

// Limpar cache quando necessário
export const clearLocationCache = () => {
  locationCache = null;
  pendingLocationRequest = null;
};
