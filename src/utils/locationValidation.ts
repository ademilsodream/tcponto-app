
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
  console.log('📍 Localização atual GPS:', {
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
    let rangeMeters = Number(location.range_meters);

    // Aumentar range temporariamente para teste (200m mínimo)
    rangeMeters = Math.max(rangeMeters, 200);

    console.log(`🧮 Calculando distância para ${location.name}:`);
    console.log(`   Coordenadas cadastradas: ${locationLat}, ${locationLon}`);
    console.log(`   Coordenadas atuais GPS: ${currentLocation.latitude}, ${currentLocation.longitude}`);
    console.log(`   Range original: ${location.range_meters}m / Range teste: ${rangeMeters}m`);

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      locationLat,
      locationLon
    );

    console.log(`📏 Distância calculada: ${Math.round(distance)}m (${distance.toFixed(2)}m exato)`);

    if (distance < minDistance) {
      minDistance = distance;
      closestLocation = location;
      console.log(`🎯 Nova localização mais próxima: ${location.name}`);
    }

    // Validação escalonada - múltiplas tentativas com tolerância crescente
    const tolerances = [rangeMeters, rangeMeters + 50, rangeMeters + 100];
    
    for (let i = 0; i < tolerances.length; i++) {
      const currentTolerance = tolerances[i];
      if (distance <= currentTolerance) {
        console.log(`✅ AUTORIZADO! Dentro do range de ${location.name} (tentativa ${i + 1})`);
        console.log(`   Distância: ${Math.round(distance)}m / Tolerância: ${currentTolerance}m`);
        console.log(`   🔍 DEBUG - Diferença lat: ${Math.abs(currentLocation.latitude - locationLat).toFixed(6)}`);
        console.log(`   🔍 DEBUG - Diferença lon: ${Math.abs(currentLocation.longitude - locationLon).toFixed(6)}`);
        return { 
          allowed: true, 
          closestLocation: location, 
          distance: distance 
        };
      }
    }

    console.log(`❌ Fora do range de ${location.name} em todas as tentativas`);
    console.log(`   Distância: ${Math.round(distance)}m / Range máximo testado: ${tolerances[tolerances.length - 1]}m`);
  }

  console.log(`🚫 NEGADO! Fora do range de todas as localizações`);
  if (closestLocation) {
    console.log(`📍 Mais próximo: ${closestLocation.name} (${Math.round(minDistance)}m)`);
    console.log(`🔍 DEBUG - Para ${closestLocation.name}:`);
    console.log(`   GPS atual: ${currentLocation.latitude}, ${currentLocation.longitude}`);
    console.log(`   Cadastrado: ${closestLocation.latitude}, ${closestLocation.longitude}`);
    console.log(`   Diferença: ${Math.round(minDistance)}m`);
  }

  return { 
    allowed: false, 
    closestLocation, 
    distance: minDistance 
  };
};

// Configurações otimizadas para GPS - melhoradas com fallback
const GPS_OPTIONS_HIGH_ACCURACY = {
  enableHighAccuracy: true,
  timeout: 20000, // 20 segundos
  maximumAge: 10000 // 10 segundos - forçar GPS mais atual
};

const GPS_OPTIONS_MEDIUM_ACCURACY = {
  enableHighAccuracy: true,
  timeout: 15000, // 15 segundos
  maximumAge: 30000 // 30 segundos
};

const GPS_OPTIONS_LOW_ACCURACY = {
  enableHighAccuracy: false,
  timeout: 10000, // 10 segundos
  maximumAge: 60000 // 1 minuto
};

// Obter localização atual do usuário com validação escalonada
export const getCurrentLocation = (retryCount = 0): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador'));
      return;
    }

    // Selecionar configuração baseada na tentativa
    let gpsOptions;
    let accuracyLevel;
    
    if (retryCount === 0) {
      gpsOptions = GPS_OPTIONS_HIGH_ACCURACY;
      accuracyLevel = 'ALTA';
    } else if (retryCount === 1) {
      gpsOptions = GPS_OPTIONS_MEDIUM_ACCURACY;
      accuracyLevel = 'MÉDIA';
    } else {
      gpsOptions = GPS_OPTIONS_LOW_ACCURACY;
      accuracyLevel = 'BAIXA';
    }

    console.log(`🔄 GPS - Tentativa ${retryCount + 1} com precisão ${accuracyLevel}...`);
    console.log('⚙️ Configurações GPS:', gpsOptions);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        console.log(`✅ GPS - Localização obtida com precisão ${accuracyLevel}:`);
        console.log(`   Latitude: ${location.latitude} (${location.latitude.toFixed(6)})`);
        console.log(`   Longitude: ${location.longitude} (${location.longitude.toFixed(6)})`);
        console.log(`   Precisão: ${position.coords.accuracy}m`);
        console.log(`   Timestamp: ${new Date(position.timestamp).toLocaleString()}`);
        console.log(`   Altitude: ${position.coords.altitude}m`);
        console.log(`   Velocidade: ${position.coords.speed}m/s`);
        
        // Verificar se a precisão é aceitável
        if (position.coords.accuracy > 500 && retryCount < 2) {
          console.warn(`⚠️ GPS com baixa precisão (${position.coords.accuracy}m), tentando novamente...`);
          setTimeout(() => {
            getCurrentLocation(retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 2000);
          return;
        }
        
        resolve(location);
      },
      (error) => {
        console.error(`❌ GPS - Erro na tentativa ${retryCount + 1} (precisão ${accuracyLevel}):`, {
          code: error.code,
          message: error.message
        });
        
        // Implementar retry automático com configurações menos restritivas
        if (retryCount < 2) {
          console.log(`🔄 Tentando novamente em 2 segundos com precisão ${retryCount === 0 ? 'MÉDIA' : 'BAIXA'}... (${retryCount + 1}/2)`);
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
      gpsOptions
    );
  });
};

// Validação completa com logs detalhados e tolerância aumentada
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
    console.log('🌐 User Agent:', navigator.userAgent);
    
    // Verificar se há localizações configuradas
    if (!allowedLocations || allowedLocations.length === 0) {
      console.warn('⚠️ Sistema sem localizações permitidas configuradas');
      return {
        valid: false,
        message: 'Sistema sem localizações permitidas configuradas'
      };
    }

    console.log(`🏢 Encontradas ${allowedLocations.length} localizações configuradas:`);
    allowedLocations.forEach((loc, i) => {
      console.log(`   ${i + 1}. ${loc.name} - ${loc.address} (Range: ${loc.range_meters}m)`);
    });

    // Obter localização atual com retry
    console.log('📡 Iniciando obtenção da localização GPS...');
    const location = await getCurrentLocation();
    console.log('✅ Localização GPS obtida, iniciando validação...');
    
    // Validar contra localizações permitidas
    const validation = isLocationAllowed(location, allowedLocations);
    
    if (validation.allowed) {
      const successMessage = `Localização autorizada em ${validation.closestLocation?.name}`;
      console.log(`🎉 SUCESSO: ${successMessage}`);
      console.log(`📊 RESUMO FINAL:`);
      console.log(`   Local: ${validation.closestLocation?.name}`);
      console.log(`   Distância: ${Math.round(validation.distance || 0)}m`);
      console.log(`   Range: ${validation.closestLocation?.range_meters}m`);
      return {
        valid: true,
        location,
        message: successMessage,
        closestLocation: validation.closestLocation,
        distance: validation.distance
      };
    } else {
      const message = validation.closestLocation 
        ? `Você está a ${Math.round(validation.distance || 0)}m de ${validation.closestLocation.name}. Range permitido: ${validation.closestLocation.range_meters}m (teste com ${Math.max(validation.closestLocation.range_meters, 200)}m)`
        : 'Nenhuma localização permitida encontrada próxima';
      
      console.log(`❌ FALHA: ${message}`);
      console.log(`📊 RESUMO FINAL:`);
      if (validation.closestLocation) {
        console.log(`   Local mais próximo: ${validation.closestLocation.name}`);
        console.log(`   Distância: ${Math.round(validation.distance || 0)}m`);
        console.log(`   Range original: ${validation.closestLocation.range_meters}m`);
        console.log(`   Range teste: ${Math.max(validation.closestLocation.range_meters, 200)}m`);
      }
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
    console.error('📊 Stack trace:', error.stack);
    return {
      valid: false,
      message: error.message || 'Erro ao validar localização'
    };
  }
};
