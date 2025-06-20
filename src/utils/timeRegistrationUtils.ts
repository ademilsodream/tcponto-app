
export const COOLDOWN_DURATION_MS = 20 * 60 * 1000; // 20 minutos

export const formatRemainingTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Cache para localizações permitidas
export const allowedLocationsCache = new Map<string, { data: any; timestamp: number }>();
export const LOCATIONS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

// Cache para registros de tempo
export const timeRecordsCache = new Map<string, { data: any; timestamp: number }>();
export const TIME_RECORDS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
