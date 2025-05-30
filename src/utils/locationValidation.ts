
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
  console.log('🔍 VALIDAÇÃO DE LOCALIZAÇÃO - Iniciando validação...');
  console.log('📍 Localização atual:', {
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude
  });
  console.log('🏢 Localizações permitidas configuradas:', allowedLocations.length);

  if (!allowedLocations || allowedLocations.length === 0) {
    console.warn('⚠️ Nenhuma localização permitida configurada no sistema');
    return { allowed: false };
  }

  // Log detalhado de cada localização permitida
  allowedLocations.forEach((location, index) => {
    console.log(`📋 Localização ${index + 1}:`, {
      name: location.name,
      address: location.address,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      range_meters: Number(location.range_meters),
      is_active: location.is_active
    });
  });

  let closestLocation: AllowedLocation | undefined;
  let minDistance = Infinity;

  for (const location of allowedLocations) {
    if (!location.is_active) {
      console.log(`⏸️ Localização ${location.name} está inativa - pulando validação`);
      continue;
    }

    // Garantir conversão correta para number
    const locationLat = Number(location.latitude);
    const locationLon = Number(location.longitude);
    const rangeMeters = Number(location.range_meters);

    console.log(`🧮 Calculando distância para ${location.name}:`);
    console.log(`   Coordenadas: ${locationLat}, ${locationLon}`);
    console.log(`   Range permitido: ${rangeMeters}m`);

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      locationLat,
      locationLon
    );

    console.log(`📏 Distância calculada: ${Math.round(distance)}m`);

    if (distance < minDistance) {
      minDistance = distance;
      closestLocation = location;
      console.log(`🎯 Nova localização mais próxima: ${location.name}`);
    }

    // Se está dentro do range de alguma localização, pode registrar
    if (distance <= rangeMeters) {
      console.log(`✅ AUTORIZADO! Dentro do range de ${location.name}`);
      console.log(`   Distância: ${Math.round(distance)}m / Permitido: ${rangeMeters}m`);
      return { 
        allowed: true, 
        closestLocation: location, 
        distance: distance 
      };
    } else {
      console.log(`❌ Fora do range de ${location.name}`);
      console.log(`   Distância: ${Math.round(distance)}m / Permitido: ${rangeMeters}m`);
    }
  }

  console.log(`🚫 NEGADO! Fora do range de todas as localizações`);
  if (closestLocation) {
    console.log(`📍 Mais próximo: ${closestLocation.name} (${Math.round(minDistance)}m)`);
  }

  return { 
    allowed: false, 
    closestLocation, 
    distance: minDistance 
  };
};

// Configurações otimizadas para GPS - melhoradas
const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000, // 15 segundos - aumentado para dar mais tempo
  maximumAge: 30000 // 30 segundos - cache mais atual
};

// Obter localização atual do usuário com retry melhorado
export const getCurrentLocation = (retryCount = 0): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador'));
      return;
    }

    console.log(`🔄 GPS - Tentativa ${retryCount + 1} de obter localização...`);
    console.log('⚙️ Configurações GPS:', GPS_OPTIONS);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        console.log('✅ GPS - Localização obtida com sucesso:');
        console.log(`   Latitude: ${location.latitude}`);
        console.log(`   Longitude: ${location.longitude}`);
        console.log(`   Precisão: ${position.coords.accuracy}m`);
        console.log(`   Timestamp: ${new Date(position.timestamp).toLocaleString()}`);
        resolve(location);
      },
      (error) => {
        console.error(`❌ GPS - Erro na tentativa ${retryCount + 1}:`, {
          code: error.code,
          message: error.message
        });
        
        // Implementar retry automático até 3 tentativas
        if (retryCount < 2) {
          console.log(`🔄 Tentando novamente em 2 segundos... (${retryCount + 1}/2)`);
          setTimeout(() => {
            getCurrentLocation(retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 2000);
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
          
          console.error('🚫 GPS - Todas as tentativas falharam:', errorMessage);
          reject(new Error(errorMessage));
        }
      },
      GPS_OPTIONS
    );
  });
};

// Validação completa com logs detalhados melhorada
export const validateLocationForTimeRecord = async (allowedLocations: AllowedLocation[]): Promise<{
  valid: boolean;
  location?: Location;
  message: string;
  closestLocation?: AllowedLocation;
  distance?: number;
}> => {
  try {
    console.log('🎯 INICIANDO VALIDAÇÃO COMPLETA DE LOCALIZAÇÃO');
    console.log('📅 Data/Hora:', new Date().toLocaleString());
    
    // Verificar se há localizações configuradas
    if (!allowedLocations || allowedLocations.length === 0) {
      console.warn('⚠️ Sistema sem localizações permitidas configuradas');
      return {
        valid: false,
        message: 'Sistema sem localizações permitidas configuradas'
      };
    }

    console.log(`🏢 Encontradas ${allowedLocations.length} localizações configuradas`);

    // Obter localização atual
    console.log('📡 Iniciando obtenção da localização GPS...');
    const location = await getCurrentLocation();
    console.log('✅ Localização GPS obtida, iniciando validação...');
    
    // Validar contra localizações permitidas
    const validation = isLocationAllowed(location, allowedLocations);
    
    if (validation.allowed) {
      const successMessage = `Localização autorizada em ${validation.closestLocation?.name}`;
      console.log(`🎉 SUCESSO: ${successMessage}`);
      return {
        valid: true,
        location,
        message: successMessage,
        closestLocation: validation.closestLocation,
        distance: validation.distance
      };
    } else {
      const message = validation.closestLocation 
        ? `Você está a ${Math.round(validation.distance || 0)}m de ${validation.closestLocation.name}. Range permitido: ${validation.closestLocation.range_meters}m`
        : 'Nenhuma localização permitida encontrada próxima';
      
      console.log(`❌ FALHA: ${message}`);
      return {
        valid: false,
        location,
        message,
        closestLocation: validation.closestLocation,
        distance: validation.distance
      };
    }
  } catch (error: any) {
    console.error('💥 ERRO CRÍTICO na validação de localização:', error);
    return {
      valid: false,
      message: error.message || 'Erro ao validar localização'
    };
  }
};
