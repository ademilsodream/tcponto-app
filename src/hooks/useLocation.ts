
import { useState, useEffect } from 'react';

interface LocationState {
  latitude: number;
  longitude: number;
}

interface UseLocationReturn {
  location: LocationState | null;
  loading: boolean;
  error: string | null;
}

export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const getCurrentLocation = () => {
      if (!navigator.geolocation) {
        setError('Geolocalização não suportada neste navegador');
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mounted) {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setLoading(false);
          }
        },
        (err) => {
          if (mounted) {
            setError(`Erro ao obter localização: ${err.message}`);
            setLoading(false);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutos
        }
      );
    };

    getCurrentLocation();

    return () => {
      mounted = false;
    };
  }, []);

  return { location, loading, error };
};
