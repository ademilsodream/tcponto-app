
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
  if (!allowedLocations || allowedLocations.length === 0) {
    return { allowed: false };
  }

  let closestLocation: AllowedLocation | undefined;
  let minDistance = Infinity;

  for (const location of allowedLocations) {
    if (!location.is_active) continue;

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      location.latitude,
      location.longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestLocation = location;
    }

    // Se está dentro do range de alguma localização, pode registrar
    if (distance <= location.range_meters) {
      return { 
        allowed: true, 
        closestLocation: location, 
        distance: distance 
      };
    }
  }

  return { 
    allowed: false, 
    closestLocation, 
    distance: minDistance 
  };
};

// Obter localização atual do usuário
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(new Error(`Erro ao obter localização: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutos
      }
    );
  });
};
