
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

// Calcular distância entre duas coordenadas usando a fórmula de Haversine
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
};

// Verificar se a localização atual está dentro do range de algum endereço permitido
export const isLocationAllowed = (
  currentLocation: Location,
  allowedLocations: AllowedLocation[]
): { allowed: boolean; closestLocation?: AllowedLocation; distance?: number } => {
  console.log('Validando localização:', currentLocation);
  console.log('Localizações permitidas:', allowedLocations);

  if (!allowedLocations || allowedLocations.length === 0) {
    console.warn('Nenhuma localização permitida configurada no sistema');
    return { allowed: false };
  }

  let closestLocation: AllowedLocation | undefined;
  let minDistance = Infinity;

  for (const location of allowedLocations) {
    if (!location.is_active) {
      console.log(`Localização ${location.name} está inativa`);
      continue;
    }

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      location.latitude,
      location.longitude
    );

    console.log(`Distância para ${location.name}: ${Math.round(distance)}m (permitido: ${location.range_meters}m)`);

    if (distance < minDistance) {
      minDistance = distance;
      closestLocation = location;
    }

    // Se está dentro do range de alguma localização, pode registrar
    if (distance <= location.range_meters) {
      console.log(`✅ Localização autorizada em ${location.name}`);
      return { 
        allowed: true, 
        closestLocation: location, 
        distance: distance 
      };
    }
  }

  console.log(`❌ Fora do range permitido. Mais próximo: ${closestLocation?.name} (${Math.round(minDistance)}m)`);
  return { 
    allowed: false, 
    closestLocation, 
    distance: minDistance 
  };
};

// Configurações otimizadas para GPS
const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 8000, // 8 segundos - aumentado para dar mais tempo
  maximumAge: 60000 // 1 minuto - cache válido por mais tempo
};

// Obter localização atual do usuário com retry
export const getCurrentLocation = (retryCount = 0): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador'));
      return;
    }

    console.log(`Tentativa ${retryCount + 1} de obter localização GPS...`);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        console.log('✅ Localização GPS obtida:', location);
        console.log(`Precisão: ${position.coords.accuracy}m`);
        resolve(location);
      },
      (error) => {
        console.error('Erro ao obter localização GPS:', error);
        
        // Implementar retry automático até 2 tentativas
        if (retryCount < 2) {
          console.log(`Tentando novamente... (${retryCount + 1}/2)`);
          setTimeout(() => {
            getCurrentLocation(retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 2000); // Aguarda 2 segundos antes de tentar novamente
        } else {
          let errorMessage = 'Erro ao obter localização';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada. Ative a localização nas configurações do navegador';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível. Verifique se o GPS está ativado';
              break;
            case error.TIMEOUT:
              errorMessage = 'Timeout ao obter localização. Tente novamente';
              break;
            default:
              errorMessage = `Erro desconhecido: ${error.message}`;
          }
          
          reject(new Error(errorMessage));
        }
      },
      GPS_OPTIONS
    );
  });
};

// Validação completa com logs detalhados
export const validateLocationForTimeRecord = async (allowedLocations: AllowedLocation[]): Promise<{
  valid: boolean;
  location?: Location;
  message: string;
  closestLocation?: AllowedLocation;
  distance?: number;
}> => {
  try {
    console.log('🔍 Iniciando validação de localização para registro de ponto...');
    
    // Verificar se há localizações configuradas
    if (!allowedLocations || allowedLocations.length === 0) {
      console.warn('⚠️ Sistema sem localizações permitidas configuradas');
      return {
        valid: false,
        message: 'Sistema sem localizações permitidas configuradas'
      };
    }

    // Obter localização atual
    const location = await getCurrentLocation();
    
    // Validar contra localizações permitidas
    const validation = isLocationAllowed(location, allowedLocations);
    
    if (validation.allowed) {
      return {
        valid: true,
        location,
        message: `Localização autorizada em ${validation.closestLocation?.name}`,
        closestLocation: validation.closestLocation,
        distance: validation.distance
      };
    } else {
      const message = validation.closestLocation 
        ? `Você está a ${Math.round(validation.distance || 0)}m de ${validation.closestLocation.name}. Range permitido: ${validation.closestLocation.range_meters}m`
        : 'Nenhuma localização permitida encontrada próxima';
      
      return {
        valid: false,
        location,
        message,
        closestLocation: validation.closestLocation,
        distance: validation.distance
      };
    }
  } catch (error: any) {
    console.error('❌ Erro na validação de localização:', error);
    return {
      valid: false,
      message: error.message || 'Erro ao validar localização'
    };
  }
};
