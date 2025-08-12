
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Signal } from 'lucide-react';

export interface UnifiedGPSStatusProps {
  loading: boolean;
  error: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null;
  gpsQuality: {
    quality: 'EXCELENTE' | 'BOM' | 'REGULAR' | 'RUIM';
    acceptable: boolean;
    confidence: number;
    message: string;
  } | null;
  validationResult: any;
  canRegister: boolean;
  calibration: any;
  validateLocation: () => void;
  calibrateForCurrentLocation: () => void;
  refreshLocation: () => void;
  clearCalibration: () => void;
  debug?: any;
  hideDetails?: boolean;
  showCalibrate?: boolean;
  showStatus?: boolean;
}

export const UnifiedGPSStatus: React.FC<UnifiedGPSStatusProps> = ({
  loading,
  error,
  location,
  gpsQuality,
  validationResult,
  canRegister,
  calibration,
  validateLocation,
  calibrateForCurrentLocation,
  refreshLocation,
  clearCalibration,
  debug,
  hideDetails = false,
  showCalibrate = true,
  showStatus = true,
}) => {
  const getStatusColor = () => {
    if (loading) return 'bg-yellow-500';
    if (error) return 'bg-red-500';
    if (canRegister) return 'bg-green-500';
    return 'bg-orange-500';
  };

  const getStatusText = () => {
    if (loading) return 'Obtendo localização...';
    if (error) return 'Erro no GPS';
    if (canRegister) return 'GPS OK';
    return 'GPS Impreciso';
  };

  return (
    <div className="space-y-3">
      {/* Status Principal */}
      {showStatus && (
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          <span className="font-medium">{getStatusText()}</span>
          {gpsQuality && (
            <Badge variant="outline">{gpsQuality.quality}</Badge>
          )}
        </div>
      )}

      {/* Informações de Localização (opcional) */}
      {!hideDetails && location && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Latitude:</span>
            <span className="ml-2 font-mono">{location.latitude.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-gray-500">Longitude:</span>
            <span className="ml-2 font-mono">{location.longitude.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-gray-500">Precisão:</span>
            <span className="ml-2">{Math.round(location.accuracy)}m</span>
          </div>
          <div>
            <span className="text-gray-500">Atualizado:</span>
            <span className="ml-2">{new Date(location.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Mensagens de Erro ou Validação */}
      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>
      )}

      {validationResult && !canRegister && (
        <div className="text-orange-600 text-sm bg-orange-50 p-3 rounded">
          {validationResult.message}
        </div>
      )}

      {/* Botão Calibrar (opcional) */}
      {showCalibrate && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={calibrateForCurrentLocation}> 
            <Signal className="w-4 h-4 mr-2" />
            Calibrar GPS
          </Button>
        </div>
      )}

      {/* Debug Info (só em desenvolvimento) */}
      {debug && process.env.NODE_ENV === 'development' && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500">Debug Info</summary>
          <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
            {JSON.stringify(debug, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};
