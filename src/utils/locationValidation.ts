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
    console.log(` Coordenadas cadastradas: ${locationLat}, ${locationLon}`);
    console.log(` Coordenadas atuais GPS: ${currentLocation.latitude}, ${currentLocation.longitude}`);
    console.log(` Range base: ${baseRange}m | Range adaptativo: ${adaptiveRange}m`);
    console.log(` Precisão GPS: ${gpsAccuracy}m`);

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
      console.log(` Distância: ${Math.round(distance)}m / Range adaptativo: ${adaptiveRange}m`);
      console.log(` 🔍 COORDENADAS - Diferença lat: ${Math.abs(currentLocation.latitude - locationLat).toFixed(6)}`);
      console.log(` 🔍 COORDENADAS - Diferença lon: ${Math.abs(currentLocation.longitude - locationLon).toFixed(6)}`);
      console.log(` 📊 QUALIDADE GPS - Precisão: ${gpsAccuracy}m (${gpsAccuracy <= 50 ? 'Excelente' : gpsAccuracy <= 100 ? 'Boa' : gpsAccuracy <= 200 ? 'Aceitável' : 'Baixa'})`);
      
      return { 
        allowed: true, 
        closestLocation: location, 
        distance: distance,
        adaptiveRange: adaptiveRange
      };
    }

    console.log(`❌ Fora do range adaptativo de ${location.name}`);
    console.log(` Distância: ${Math.round(distance)}m / Range adaptativo: ${adaptiveRange}m`);
  }

  console.log(`🚫 NEGADO! Fora do range adaptativo de todas as localizações`);
  if (closestLocation) {
    console.log(`📍 Mais próximo: ${closestLocation.name} (${Math.round(minDistance)}m)`);
    console.log(`🔍 ANÁLISE DETALHADA - Para ${closestLocation.name}:`);
    console.log(` GPS atual: ${currentLocation.latitude}, ${currentLocation.longitude}`);
    console.log(` Cadastrado: ${closestLocation.latitude}, ${closestLocation.longitude}`);
    console.log(` Distância: ${Math.round(minDistance)}m`);
    console.log(` Range adaptativo usado: ${usedRange}m`);
    console.log(` Precisão GPS: ${gpsAccuracy}m`);
    console.log(` 📊 DIAGNÓSTICO: ${minDistance <= 50 ? 'Muito próximo - possível problema de coordenadas' : minDistance <= 150 ? 'Próximo - GPS pode ser impreciso' : 'Distante - verificar localização'}`);
  }

  return { 
    allowed: false, 
    closestLocation, 
    distance: minDistance,
    adaptiveRange: usedRange
  };
};

// ✨ NOVA: Detectar se está em APK/App nativo ou navegador
const isNativeApp = (): boolean => {
  // Verifica se está em Capacitor (APK)
  return !!(window as any)?.Capacitor?.isNativePlatform?.() || 
         // Verifica se está em Cordova
         !!(window as any)?.cordova ||
         // Verifica user agent para detectar WebView Android
         /Android.*wv/.test(navigator.userAgent) ||
         // Verifica se não tem window.chrome (indicativo de WebView)
         (navigator.userAgent.includes('Android') && !(window as any).chrome);
};

// ✨ NOVA: Verificar e solicitar permissões (especialmente para APK)
const requestLocationPermissions = async (): Promise<boolean> => {
  console.log('🔐 Verificando permissões de localização...');
  
  try {
    // Se é app nativo (APK), tentar usar Capacitor Geolocation
    if (isNativeApp() && (window as any)?.Capacitor?.Plugins?.Geolocation) {
      console.log('📱 Detectado APK - usando Capacitor Geolocation');
      const { Geolocation } = (window as any).Capacitor.Plugins;
      
      const permissions = await Geolocation.requestPermissions();
      console.log('🔐 Permissões Capacitor:', permissions);
      
      return permissions.location === 'granted';
    }
    
    // Para navegador web
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      console.log('🔐 Status da permissão (navegador):', permission.state);
      return permission.state === 'granted' || permission.state === 'prompt';
    }
    
    return true; // Assumir que está ok se não conseguir verificar
  } catch (error) {
    console.warn('⚠️ Erro ao verificar permissões:', error);
    return true; // Continuar tentando mesmo assim
  }
};

// ✨ MELHORADA: Obter localização com suporte robusto para APK
const getCurrentLocationRobust = async (timeout: number = 30000): Promise<{ location: Location; accuracy: number }> => {
  console.log('📡 Iniciando obtenção de localização robusta...');
  console.log('📱 Ambiente detectado:', isNativeApp() ? 'APK/App Nativo' : 'Navegador Web');
  
  // Verificar permissões primeiro
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) {
    throw new Error('Permissão de localização negada. Ative nas configurações do dispositivo.');
  }

  return new Promise((resolve, reject) => {
    // Timeout global
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout ao obter localização (${timeout/1000}s). Verifique se o GPS está ativo.`));
    }, timeout);

    // ✨ PRIORIDADE 1: Tentar Capacitor se disponível (APK)
    if (isNativeApp() && (window as any)?.Capacitor?.Plugins?.Geolocation) {
      console.log('🚀 Usando Capacitor Geolocation (APK)...');
      const { Geolocation } = (window as any).Capacitor.Plugins;
      
      Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeout - 5000, // 5s a menos que o timeout global
        maximumAge: 10000 // 10s de cache
      }).then((position: any) => {
        clearTimeout(timeoutId);
        
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        const accuracy = position.coords.accuracy || 999;
        
        console.log('✅ Localização obtida via Capacitor:', { location, accuracy });
        resolve({ location, accuracy });
      }).catch((error: any) => {
        console.warn('⚠️ Capacitor falhou, tentando navigator.geolocation...', error);
        // Fallback para navigator.geolocation
        getCurrentLocationFallback(timeout - 10000, timeoutId, resolve, reject);
      });
    } else {
      // ✨ PRIORIDADE 2: Navigator.geolocation (navegador)
      console.log('🌐 Usando navigator.geolocation (navegador)...');
      getCurrentLocationFallback(timeout, timeoutId, resolve, reject);
    }
  });
};

// Fallback para navigator.geolocation
const getCurrentLocationFallback = (
  timeout: number,
  timeoutId: NodeJS.Timeout,
  resolve: (value: { location: Location; accuracy: number }) => void,
  reject: (reason: Error) => void
) => {
  if (!navigator.geolocation) {
    clearTimeout(timeoutId);
    reject(new Error('Geolocalização não suportada neste dispositivo'));
    return;
  }

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: Math.max(15000, timeout - 5000), // Mínimo 15s, máximo timeout-5s
    maximumAge: isNativeApp() ? 5000 : 10000 // Cache menor para APK
  };

  console.log('⚙️ Configurações GPS:', options);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      clearTimeout(timeoutId);
      
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      const accuracy = position.coords.accuracy || 999;
      
      console.log('✅ Localização obtida via navigator:', { 
        location, 
        accuracy,
        timestamp: new Date(position.timestamp).toLocaleString(),
        altitude: position.coords.altitude,
        speed: position.coords.speed
      });
      
      resolve({ location, accuracy });
    },
    (error) => {
      clearTimeout(timeoutId);
      
      console.error('❌ Erro do navigator.geolocation:', {
        code: error.code,
        message: error.message
      });
      
      let errorMessage = 'Erro ao obter localização';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permissão de localização negada. Ative nas configurações do dispositivo/navegador.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Localização indisponível. Verifique se o GPS está ativo e você está em área aberta.';
          break;
        case error.TIMEOUT:
          errorMessage = `Timeout ao obter localização (${options.timeout/1000}s). Tente novamente.`;
          break;
        default:
          errorMessage = `Erro desconhecido: ${error.message}`;
      }
      
      reject(new Error(errorMessage));
    },
    options
  );
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
  } else if (accuracy <= 500) {
    return { quality: 'Muito Baixa', acceptable: true, message: 'GPS muito impreciso - usando range de emergência' };
  } else {
    return { quality: 'Inaceitável', acceptable: false, message: 'GPS extremamente impreciso - tente novamente' };
  }
};

// ✨ MELHORADA: Obter localização com múltiplas tentativas e configurações adaptáveis
export const getCurrentLocation = (retryCount = 0): Promise<{ location: Location; accuracy: number }> => {
  return new Promise(async (resolve, reject) => {
    try {
      let timeoutMs;
      let attemptType;
      
      // Configurar timeout baseado na tentativa e ambiente
      if (isNativeApp()) {
        // APK: timeouts maiores pois GPS pode demorar mais
        timeoutMs = retryCount === 0 ? 40000 : retryCount === 1 ? 30000 : 20000;
        attemptType = `APK-${retryCount === 0 ? 'ALTA' : retryCount === 1 ? 'MÉDIA' : 'BAIXA'}`;
      } else {
        // Navegador: timeouts menores
        timeoutMs = retryCount === 0 ? 30000 : retryCount === 1 ? 20000 : 15000;
        attemptType = `WEB-${retryCount === 0 ? 'ALTA' : retryCount === 1 ? 'MÉDIA' : 'BAIXA'}`;
      }
      
      console.log(`🔄 GPS - Tentativa ${retryCount + 1}/3 (${attemptType}) - Timeout: ${timeoutMs/1000}s`);
      
      const result = await getCurrentLocationRobust(timeoutMs);
      const { location, accuracy } = result;
      
      const gpsQuality = validateGPSQuality(accuracy);
      
      console.log(`✅ GPS - Localização obtida (${attemptType}):`);
      console.log(` Latitude: ${location.latitude.toFixed(6)}`);
      console.log(` Longitude: ${location.longitude.toFixed(6)}`);
      console.log(` Precisão: ${accuracy}m (${gpsQuality.quality})`);
      console.log(` Qualidade: ${gpsQuality.message}`);
      
      // Para APK, ser mais tolerante com a precisão
      const maxAcceptableAccuracy = isNativeApp() ? 500 : 300;
      
      // Se precisão for inaceitável e ainda temos tentativas, retry
      if (!gpsQuality.acceptable && accuracy > maxAcceptableAccuracy && retryCount < 2) {
        console.warn(`⚠️ GPS com precisão inaceitável (${accuracy}m > ${maxAcceptableAccuracy}m), tentando novamente...`);
        setTimeout(() => {
          getCurrentLocation(retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, 3000); // 3s entre tentativas
        return;
      }
      
      // Aceitar resultado
      resolve({ location, accuracy });
      
    } catch (error: any) {
      console.error(`❌ GPS - Erro na tentativa ${retryCount + 1}:`, error);
      
      if (retryCount < 2) {
        console.log(`🔄 Tentando novamente em 3 segundos... (${retryCount + 1}/2)`);
        setTimeout(() => {
          getCurrentLocation(retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, 3000);
      } else {
        console.error('🚫 GPS - Todas as tentativas falharam');
        reject(error);
      }
    }
  });
};

// ✨ MELHORADA: Validação completa com suporte robusto para APK
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
    console.log('🎯 INICIANDO VALIDAÇÃO COMPLETA COM SUPORTE APK');
    console.log('📅 Data/Hora:', new Date().toLocaleString());
    console.log('📱 Ambiente:', isNativeApp() ? 'APK/App Nativo' : 'Navegador Web');
    console.log('🌐 User Agent:', navigator.userAgent);
    console.log('⚡ Capacitor disponível:', !!(window as any)?.Capacitor?.Plugins?.Geolocation);
    
    if (!allowedLocations || allowedLocations.length === 0) {
      console.warn('⚠️ Sistema sem localizações permitidas configuradas');
      return {
        valid: false,
        message: 'Sistema sem localizações permitidas configuradas'
      };
    }

    console.log(`🏢 Encontradas ${allowedLocations.length} localizações configuradas:`);
    allowedLocations.forEach((loc, i) => {
      console.log(` ${i + 1}. ${loc.name} - ${loc.address} (Range base: ${loc.range_meters}m)`);
    });

    console.log('📡 Iniciando obtenção da localização GPS robusta...');
    const gpsResult = await getCurrentLocation();
    const { location, accuracy } = gpsResult;
    
    console.log('✅ Localização GPS obtida, iniciando validação com range adaptativo...');
    console.log(`📊 Qualidade do GPS: ${accuracy}m de precisão`);
    
    const validation = isLocationAllowed(location, allowedLocations, accuracy);
    
    if (validation.allowed) {
      const successMessage = `Localização autorizada em ${validation.closestLocation?.name}`;
      console.log(`🎉 SUCESSO: ${successMessage}`);
      console.log(`📊 RESUMO FINAL - AUTORIZADO:`);
      console.log(` Local: ${validation.closestLocation?.name}`);
      console.log(` Distância: ${Math.round(validation.distance || 0)}m`);
      console.log(` Range base: ${validation.closestLocation?.range_meters}m`);
      console.log(` Range adaptativo usado: ${validation.adaptiveRange}m`);
      console.log(` Precisão GPS: ${accuracy}m`);
      console.log(` Ambiente: ${isNativeApp() ? 'APK' : 'Navegador'}`);
      
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
        ? `Você está a ${Math.round(validation.distance || 0)}m de ${validation.closestLocation.name}. Aproxime-se para registrar o ponto.`
        : 'Nenhuma localização permitida encontrada próxima';
      
      console.log(`❌ FALHA: ${message}`);
      console.log(`📊 RESUMO FINAL - NEGADO:`);
      if (validation.closestLocation) {
        console.log(` Local mais próximo: ${validation.closestLocation.name}`);
        console.log(` Distância: ${Math.round(validation.distance || 0)}m`);
        console.log(` Range base: ${validation.closestLocation.range_meters}m`);
        console.log(` Range adaptativo: ${validation.adaptiveRange}m`);
        console.log(` Precisão GPS: ${accuracy}m`);
        console.log(` Ambiente: ${isNativeApp() ? 'APK' : 'Navegador'}`);
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
    console.error('📱 Ambiente durante erro:', isNativeApp() ? 'APK' : 'Navegador');
    
    return {
      valid: false,
      message: error.message || 'Erro ao validar localização. Verifique se o GPS está ativo e as permissões estão concedidas.'
    };
  }
};
