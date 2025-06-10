
import { useState, useEffect, useCallback, useRef } from 'react';

interface LocationState {
  latitude: number;
  longitude: number;
}

interface UseOptimizedLocationReturn {
  location: LocationState | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<LocationState | null>;
}

// Cache global da localização
let locationCache: { location: LocationState; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 1000; // 30 segundos
let activeRequest: Promise<LocationState | null> | null = null;

export const useOptimizedLocation = (): UseOptimizedLocationReturn => {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const requestLocation = useCallback(async (): Promise<LocationState | null> => {
    // Verificar cache primeiro
    if (locationCache && Date.now() - locationCache.timestamp < CACHE_DURATION) {
      setLocation(locationCache.location);
      return locationCache.location;
    }

    // Se já existe uma request ativa, aguardar ela
    if (activeRequest) {
      return activeRequest;
    }

    if (!navigator.geolocation) {
      const errorMsg = 'Geolocalização não suportada';
      setError(errorMsg);
      return null;
    }

    setLoading(true);
    setError(null);

    activeRequest = new Promise<LocationState | null>((resolve) => {
      const timeoutId = setTimeout(() => {
        if (mountedRef.current) {
          setError('Timeout ao obter localização');
          setLoading(false);
        }
        activeRequest = null;
        resolve(null);
      }, 5000); // Timeout reduzido para 5 segundos

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          // Atualizar cache
          locationCache = {
            location: newLocation,
            timestamp: Date.now()
          };

          if (mountedRef.current) {
            setLocation(newLocation);
            setLoading(false);
            setError(null);
          }

          activeRequest = null;
          resolve(newLocation);
        },
        (err) => {
          clearTimeout(timeoutId);
          
          if (mountedRef.current) {
            setError(`Erro ao obter localização: ${err.message}`);
            setLoading(false);
          }
          
          activeRequest = null;
          resolve(null);
        },
        {
          enableHighAccuracy: false, // Reduzido para melhor performance
          timeout: 5000,
          maximumAge: CACHE_DURATION,
        }
      );
    });

    return activeRequest;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    // Verificar cache na inicialização
    if (locationCache && Date.now() - locationCache.timestamp < CACHE_DURATION) {
      setLocation(locationCache.location);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { location, loading, error, requestLocation };
};

// Função para limpar cache quando necessário
export const clearOptimizedLocationCache = () => {
  locationCache = null;
  activeRequest = null;
};
