
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

// Calcular range adaptativo baseado na precisão do GPS
const calculateAdaptiveRange = (baseRange: number, gpsAccuracy: number): number => {
  console.log(`🎯 Calculando range adaptativo - Base: ${baseRange}m, Precisão GPS: ${gpsAccuracy}m`);
  
  if (gpsAccuracy <= 50) {
    console.log(`✅ GPS de alta precisão - usando range base: ${baseRange}m`);
    return baseRange;
  } else if (gpsAccuracy <= 100) {
    const adaptiveRange = baseRange + gpsAccuracy;
    console.log(`⚡ GPS de média precisão - usando range adaptativo: ${adaptiveRange}m`);
    return adaptiveRange;
  } else if (gpsAccuracy <= 200) {
    const adaptiveRange = baseRange + (gpsAccuracy * 1.5);
    console.log(`⚠️ GPS de baixa precisão - usando range aumentado: ${adaptiveRange}m`);
    return adaptiveRange;
  } else {
    const emergencyRange = Math.min(500, baseRange + (gpsAccuracy * 2));
    console.log(`🚨 GPS de precisão muito baixa - usando range de emergência: ${emergencyRange}m`);
    return emergencyRange;
  }
};

// Verificar se a localização atual está dentro do range de algum endereço permitido
export const isLocationAllowed = (
  currentLocation: Location,
  allowedLocations: AllowedLocation[],
  gpsAccuracy: number = 100
): { allowed: boolean; closestLocation?: AllowedLocation; distance?: number; adaptiveRange?: number } => {
  console.log('🔍 VALIDAÇÃO DE LOCALIZAÇÃO ADAPTATIVA - Iniciando...');
  console.log('📍 Localização atual GPS:', {
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    accuracy: `${gpsAccuracy}m`
  });
  console.log('🏢 Localizações permitidas configuradas:', allowedLocations.length);

  if (!allowedLocations || allowedLocations.length === 0) {
    console.warn('⚠️ Nenhuma localização permitida configurada no sistema');
    return { allowed: false };
  }

  let closestLocation: AllowedLocation | undefined;
  let minDistance = Infinity;
  let usedRange = 0;

  for (const location of allowedLocations) {
    if (!location.is_active) {
      console.log(`⏸️ Localização ${location.name} está inativa - pulando validação`);
      continue;
    }

    const locationLat = Number(location.latitude);
    const locationLon = Number(location.longitude);
    const baseRange = Number(location.range_meters);
    
    // Calcular range adaptativo baseado na precisão do GPS
    const adaptiveRange = calculateAdaptiveRange(baseRange, gpsAccuracy);

    console.log(`🧮 Validando ${location.name}:`);
    console.log(`   Coordenadas cadastradas: ${locationLat}, ${locationLon}`);
    console.log(`   Coordenadas atuais GPS: ${currentLocation.latitude}, ${currentLocation.longitude}`);
    console.log(`   Range base: ${baseRange}m | Range adaptativo: ${adaptiveRange}m`);
    console.log(`   Precisão GPS: ${gpsAccuracy}m`);

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
      usedRange = adaptiveRange;
      console.log(`🎯 Nova localização mais próxima: ${location.name} (${Math.round(distance)}m)`);
    }

    if (distance <= adaptiveRange) {
      console.log(`✅ AUTORIZADO! Dentro do range adaptativo de ${location.name}`);
      console.log(`   Distância: ${Math.round(distance)}m / Range adaptativo: ${adaptiveRange}m`);
      console.log(`   🔍 COORDENADAS - Diferença lat: ${Math.abs(currentLocation.latitude - locationLat).toFixed(6)}`);
      console.log(`   🔍 COORDENADAS - Diferença lon: ${Math.abs(currentLocation.longitude - locationLon).toFixed(6)}`);
      console.log(`   📊 QUALIDADE GPS - Precisão: ${gpsAccuracy}m (${gpsAccuracy <= 50 ? 'Excelente' : gpsAccuracy <= 100 ? 'Boa' : gpsAccuracy <= 200 ? 'Aceitável' : 'Baixa'})`);
      
      return { 
        allowed: true, 
        closestLocation: location, 
        distance: distance,
        adaptiveRange: adaptiveRange
      };
    }

    console.log(`❌ Fora do range adaptativo de ${location.name}`);
    console.log(`   Distância: ${Math.round(distance)}m / Range adaptativo: ${adaptiveRange}m`);
  }

  console.log(`🚫 NEGADO! Fora do range adaptativo de todas as localizações`);
  if (closestLocation) {
    console.log(`📍 Mais próximo: ${closestLocation.name} (${Math.round(minDistance)}m)`);
    console.log(`🔍 ANÁLISE DETALHADA - Para ${closestLocation.name}:`);
    console.log(`   GPS atual: ${currentLocation.latitude}, ${currentLocation.longitude}`);
    console.log(`   Cadastrado: ${closestLocation.latitude}, ${closestLocation.longitude}`);
    console.log(`   Distância: ${Math.round(minDistance)}m`);
    console.log(`   Range adaptativo usado: ${usedRange}m`);
    console.log(`   Precisão GPS: ${gpsAccuracy}m`);
    console.log(`   📊 DIAGNÓSTICO: ${minDistance <= 50 ? 'Muito próximo - possível problema de coordenadas' : minDistance <= 150 ? 'Próximo - GPS pode ser impreciso' : 'Distante - verificar localização'}`);
  }

  return { 
    allowed: false, 
    closestLocation, 
    distance: minDistance,
    adaptiveRange: usedRange
  };
};

// Configurações otimizadas para GPS com qualidade melhorada
const GPS_OPTIONS_HIGH_ACCURACY = {
  enableHighAccuracy: true,
  timeout: 30000, // 30 segundos - mais tempo para GPS preciso
  maximumAge: 0 // Sempre buscar posição atual, nunca usar cache
};

const GPS_OPTIONS_MEDIUM_ACCURACY = {
  enableHighAccuracy: true,
  timeout: 20000, // 20 segundos
  maximumAge: 5000 // 5 segundos de cache máximo
};

const GPS_OPTIONS_LOW_ACCURACY = {
  enableHighAccuracy: false,
  timeout: 15000, // 15 segundos
  maximumAge: 10000 // 10 segundos de cache
};

// Validar qualidade do GPS
const validateGPSQuality = (accuracy: number): { quality: string; acceptable: boolean; message: string } => {
  if (accuracy <= 10) {
    return { quality: 'Excelente', acceptable: true, message: 'GPS de alta precisão' };
  } else if (accuracy <= 30) {
    return { quality: 'Muito Boa', acceptable: true, message: 'GPS de boa precisão' };
  } else if (accuracy <= 50) {
    return { quality: 'Boa', acceptable: true, message: 'GPS de precisão aceitável' };
  } else if (accuracy <= 100) {
    return { quality: 'Aceitável', acceptable: true, message: 'GPS de precisão média - range adaptativo será usado' };
  } else if (accuracy <= 200) {
    return { quality: 'Baixa', acceptable: true, message: 'GPS de baixa precisão - usando range aumentado' };
  } else {
    return { quality: 'Muito Baixa', acceptable: false, message: 'GPS muito impreciso - tente novamente' };
  }
};

// Obter localização atual do usuário com validação de qualidade
export const getCurrentLocation = (retryCount = 0): Promise<{ location: Location; accuracy: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador'));
      return;
    }

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
        
        const accuracy = position.coords.accuracy || 999;
        const gpsQuality = validateGPSQuality(accuracy);
        
        console.log(`✅ GPS - Localização obtida com precisão ${accuracyLevel}:`);
        console.log(`   Latitude: ${location.latitude} (${location.latitude.toFixed(6)})`);
        console.log(`   Longitude: ${location.longitude} (${location.longitude.toFixed(6)})`);
        console.log(`   Precisão: ${accuracy}m (${gpsQuality.quality})`);
        console.log(`   Qualidade: ${gpsQuality.message}`);
        console.log(`   Timestamp: ${new Date(position.timestamp).toLocaleString()}`);
        console.log(`   Altitude: ${position.coords.altitude}m`);
        console.log(`   Velocidade: ${position.coords.speed}m/s`);
        
        // Se precisão for muito baixa e ainda temos tentativas, retry
        if (!gpsQuality.acceptable && retryCount < 2) {
          console.warn(`⚠️ GPS com precisão inaceitável (${accuracy}m), tentando novamente...`);
          setTimeout(() => {
            getCurrentLocation(retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 2000);
          return;
        }
        
        // Se ainda não temos boa precisão mas já tentamos muito, aceitar mesmo assim
        if (accuracy > 100 && retryCount < 2) {
          console.warn(`⚠️ GPS ainda com baixa precisão (${accuracy}m), mas continuando...`);
        }
        
        resolve({ location, accuracy });
      },
      (error) => {
        console.error(`❌ GPS - Erro na tentativa ${retryCount + 1} (precisão ${accuracyLevel}):`, {
          code: error.code,
          message: error.message
        });
        
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
      gpsOptions
    );
  });
};

// Validação completa com range adaptativo e logs detalhados
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
    console.log('🎯 INICIANDO VALIDAÇÃO COMPLETA COM RANGE ADAPTATIVO');
    console.log('📅 Data/Hora:', new Date().toLocaleString());
    console.log('🌐 User Agent:', navigator.userAgent);
    
    if (!allowedLocations || allowedLocations.length === 0) {
      console.warn('⚠️ Sistema sem localizações permitidas configuradas');
      return {
        valid: false,
        message: 'Sistema sem localizações permitidas configuradas'
      };
    }

    console.log(`🏢 Encontradas ${allowedLocations.length} localizações configuradas:`);
    allowedLocations.forEach((loc, i) => {
      console.log(`   ${i + 1}. ${loc.name} - ${loc.address} (Range base: ${loc.range_meters}m)`);
    });

    console.log('📡 Iniciando obtenção da localização GPS com validação de qualidade...');
    const gpsResult = await getCurrentLocation();
    const { location, accuracy } = gpsResult;
    
    console.log('✅ Localização GPS obtida, iniciando validação com range adaptativo...');
    console.log(`📊 Qualidade do GPS: ${accuracy}m de precisão`);
    
    const validation = isLocationAllowed(location, allowedLocations, accuracy);
    
    if (validation.allowed) {
      const successMessage = `Localização autorizada em ${validation.closestLocation?.name}`;
      console.log(`🎉 SUCESSO: ${successMessage}`);
      console.log(`📊 RESUMO FINAL - AUTORIZADO:`);
      console.log(`   Local: ${validation.closestLocation?.name}`);
      console.log(`   Distância: ${Math.round(validation.distance || 0)}m`);
      console.log(`   Range base: ${validation.closestLocation?.range_meters}m`);
      console.log(`   Range adaptativo usado: ${validation.adaptiveRange}m`);
      console.log(`   Precisão GPS: ${accuracy}m`);
      
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
        ? `Você está a ${Math.round(validation.distance || 0)}m de ${validation.closestLocation.name}. Range adaptativo: ${validation.adaptiveRange}m (GPS: ${accuracy}m precisão)`
        : 'Nenhuma localização permitida encontrada próxima';
      
      console.log(`❌ FALHA: ${message}`);
      console.log(`📊 RESUMO FINAL - NEGADO:`);
      if (validation.closestLocation) {
        console.log(`   Local mais próximo: ${validation.closestLocation.name}`);
        console.log(`   Distância: ${Math.round(validation.distance || 0)}m`);
        console.log(`   Range base: ${validation.closestLocation.range_meters}m`);
        console.log(`   Range adaptativo: ${validation.adaptiveRange}m`);
        console.log(`   Precisão GPS: ${accuracy}m`);
        console.log(`   🔍 DIAGNÓSTICO: Distância muito grande mesmo com range adaptativo`);
      }
      
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
    console.error('💥 ERRO CRÍTICO na validação de localização:', error);
    console.error('📊 Stack trace:', error.stack);
    return {
      valid: false,
      message: error.message || 'Erro ao validar localização'
    };
  }
};
