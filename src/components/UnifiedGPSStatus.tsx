/**
 * Componente GPS Status Unificado
 * Usa o UnifiedLocationSystem para exibir informações claras sobre GPS e localização
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  RefreshCw, 
  Target, 
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Compass,
  Loader2,
  Info,
  Settings,
  Trash2
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface UnifiedGPSStatusProps {
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null;
  validationResult: any;
  gpsQuality: {
    quality: 'EXCELENTE' | 'BOM' | 'REGULAR' | 'RUIM';
    acceptable: boolean;
    confidence: number;
    message: string;
  } | null;
  calibration: {
    isCalibrating: boolean;
    calibrationProgress: number;
    currentLocation: any;
  };
  debug: {
    environment: 'APK' | 'WEB';
    cacheValid: boolean;
    calibrationsCount: number;
    lastLocation: any;
  };
  onCalibrate: () => void;
  onRefresh: () => void;
  onClearCache: () => void;
  loading?: boolean;
  error?: string | null;
}

export const UnifiedGPSStatus: React.FC<UnifiedGPSStatusProps> = ({
  location,
  validationResult,
  gpsQuality,
  calibration,
  debug,
  onCalibrate,
  onRefresh,
  onClearCache,
  loading = false,
  error = null
}) => {
  const getAccuracyColor = () => {
    if (!gpsQuality) return 'text-gray-600';
    switch (gpsQuality.quality) {
      case 'EXCELENTE': return 'text-green-600';
      case 'BOM': return 'text-blue-600';
      case 'REGULAR': return 'text-yellow-600';
      case 'RUIM': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getAccuracyIcon = () => {
    if (calibration.isCalibrating) return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    if (!gpsQuality) return <AlertCircle className="w-5 h-5 text-gray-500" />;
    
    switch (gpsQuality.quality) {
      case 'EXCELENTE': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'BOM': return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'REGULAR': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'RUIM': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getAccuracyText = () => {
    if (calibration.isCalibrating) return 'Calibrando...';
    if (!gpsQuality || !location) return 'GPS não disponível';
    return `${gpsQuality.quality} (${Math.round(location.accuracy)}m)`;
  };

  const getAccuracyDescription = () => {
    if (calibration.isCalibrating) return 'Coletando amostras para maior precisão';
    if (!gpsQuality) return 'Aguardando dados do GPS';
    return gpsQuality.message;
  };

  const getDistanceStatus = () => {
    if (!validationResult?.distance || !validationResult?.closestLocation) return null;
    
    const distance = validationResult.distance;
    const adaptiveRange = validationResult.adaptiveRange || validationResult.closestLocation.range_meters;
    const percentage = Math.min((distance / adaptiveRange) * 100, 100);
    const isWithinRange = distance <= adaptiveRange;
    
    return (
      <div className="mt-3">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Distância de {validationResult.closestLocation.name}:</span>
          <span className={isWithinRange ? 'text-green-600' : 'text-red-600'}>
            {Math.round(distance)}m
          </span>
        </div>
        <Progress 
          value={percentage} 
          className={`h-3 ${isWithinRange ? 'bg-green-100' : 'bg-red-100'}`}
        />
        <div className="text-xs text-gray-600 mt-1 text-center">
          {isWithinRange 
            ? `✅ Dentro do range (${Math.round(adaptiveRange - distance)}m de margem)`
            : `❌ Fora do range (${Math.round(distance - adaptiveRange)}m excedido)`
          }
        </div>
      </div>
    );
  };

  const getEnvironmentBadge = () => {
    return (
      <Badge variant={debug.environment === 'APK' ? 'default' : 'secondary'} className="text-xs">
        {debug.environment === 'APK' ? '📱 App Nativo' : '🌐 Navegador'}
      </Badge>
    );
  };

  const getCacheStatus = () => {
    return (
      <div className="flex items-center space-x-2 text-xs text-gray-500">
        <span>Cache: {debug.cacheValid ? '✅' : '❌'}</span>
        <span>Calibrações: {debug.calibrationsCount}</span>
      </div>
    );
  };

  return (
    <Card className="w-full border-2 border-blue-100">
      <CardContent className="p-4">
        {/* Header com status e ambiente */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-800">Status do GPS</span>
            {getEnvironmentBadge()}
          </div>
          <div className="flex items-center space-x-2">
            {getAccuracyIcon()}
            <div className="text-right">
              <div className={`text-sm font-medium ${getAccuracyColor()}`}>
                {getAccuracyText()}
              </div>
              {gpsQuality && (
                <div className="text-xs text-gray-500">
                  {gpsQuality.confidence}% confiança
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Descrição do status */}
        <div className="text-xs text-gray-600 mb-3 text-center">
          {getAccuracyDescription()}
        </div>

        {/* Informações de debug */}
        <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
          {getCacheStatus()}
        </div>

        {/* Progresso da calibração */}
        {calibration.isCalibrating && (
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span>Calibrando GPS...</span>
              <span>{Math.round(calibration.calibrationProgress)}%</span>
            </div>
            <Progress value={calibration.calibrationProgress} className="h-2" />
            <div className="text-xs text-gray-500 mt-1 text-center">
              Coletando amostras para {calibration.currentLocation?.name || 'local atual'}
            </div>
          </div>
        )}

        {/* Informações de localização detalhadas */}
        {location && !calibration.isCalibrating && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-medium">Latitude:</span>
                <div className="font-mono">{location.latitude.toFixed(6)}</div>
              </div>
              <div>
                <span className="font-medium">Longitude:</span>
                <div className="font-mono">{location.longitude.toFixed(6)}</div>
              </div>
              <div>
                <span className="font-medium">Precisão:</span>
                <div className={getAccuracyColor()}>{Math.round(location.accuracy)}m</div>
              </div>
              <div>
                <span className="font-medium">Atualizado:</span>
                <div>{new Date(location.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          </div>
        )}

        {/* Status da validação */}
        {validationResult && (
          <div className="mb-3">
            <div className={`p-2 rounded text-sm ${validationResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center space-x-2">
                {validationResult.valid ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span className={validationResult.valid ? 'text-green-800' : 'text-red-800'}>
                  {validationResult.message}
                </span>
              </div>
              
              {validationResult.calibrationApplied && (
                <div className="text-xs text-blue-600 mt-1">
                  ✨ Calibração aplicada
                </div>
              )}
              
              {validationResult.locationChanged && (
                <div className="text-xs text-orange-600 mt-1">
                  🔄 Mudança de local detectada
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status da distância */}
        {getDistanceStatus()}

        {/* Erro de GPS */}
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Botões de ação */}
        <div className="flex justify-between space-x-2 mt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCalibrate}
                  disabled={calibration.isCalibrating || loading}
                  className="flex items-center space-x-1 flex-1"
                >
                  {calibration.isCalibrating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Compass className="w-4 h-4" />
                  )}
                  <span>{calibration.isCalibrating ? 'Calibrando...' : 'Calibrar GPS'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">Calibração de GPS</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Coleta 6 amostras em 12 segundos para máxima precisão
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={calibration.isCalibrating || loading}
            className="flex items-center space-x-1"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar</span>
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearCache}
                  disabled={calibration.isCalibrating || loading}
                  className="flex items-center space-x-1"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">Limpar Cache</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Remove calibrações e cache de localização
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Dicas para melhorar precisão */}
        {gpsQuality && gpsQuality.quality === 'RUIM' && !calibration.isCalibrating && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <div className="font-medium text-yellow-800 mb-1">💡 Dicas para melhorar a precisão:</div>
            <ul className="text-yellow-700 space-y-1">
              <li>• Vá para um local aberto (longe de prédios)</li>
              <li>• Aguarde alguns segundos para o GPS se estabilizar</li>
              <li>• Use a calibração para obter maior precisão</li>
              <li>• Verifique se o GPS está ativo nas configurações</li>
            </ul>
          </div>
        )}

        {/* Informações de debug avançadas */}
        {debug.lastLocation && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
            <div className="font-medium text-blue-800 mb-1">📍 Último local registrado:</div>
            <div className="text-blue-700">
              {debug.lastLocation.locationId} - {new Date(debug.lastLocation.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 