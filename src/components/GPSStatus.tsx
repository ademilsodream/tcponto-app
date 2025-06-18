
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  RefreshCw, 
  Target, 
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Compass,
  Loader2
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { validateGPSQuality } from '@/utils/enhancedLocationValidation';

interface GPSStatusProps {
  location: any;
  calibration: any;
  onCalibrate: () => void;
  onRefresh: () => void;
  isHighAccuracy: boolean;
  isMediumAccuracy: boolean;
  isLowAccuracy: boolean;
  gpsAccuracy?: number;
  distance?: number;
  adaptiveRange?: number;
  isCalibrating?: boolean;
}

export const GPSStatus: React.FC<GPSStatusProps> = ({
  location,
  calibration,
  onCalibrate,
  onRefresh,
  isHighAccuracy,
  isMediumAccuracy,
  isLowAccuracy,
  gpsAccuracy = 0,
  distance = 0,
  adaptiveRange = 0,
  isCalibrating = false
}) => {
  const getAccuracyColor = () => {
    if (isHighAccuracy) return 'text-green-600';
    if (isMediumAccuracy) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAccuracyIcon = () => {
    if (isCalibrating) return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    if (isHighAccuracy) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (isMediumAccuracy) return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    return <AlertTriangle className="w-5 h-5 text-red-600" />;
  };

  const getAccuracyText = () => {
    if (isCalibrating) return 'Calibrando...';
    const quality = validateGPSQuality(gpsAccuracy);
    return `${quality.quality} (${Math.round(gpsAccuracy)}m)`;
  };

  const getAccuracyDescription = () => {
    if (isCalibrating) return 'Coletando amostras para maior precisão';
    if (isHighAccuracy) return 'Excelente precisão para registro de ponto';
    if (isMediumAccuracy) return 'Precisão moderada - considere calibrar';
    return 'Baixa precisão - calibração recomendada';
  };

  const getDistanceStatus = () => {
    if (!distance || !adaptiveRange) return null;
    const percentage = Math.min((distance / adaptiveRange) * 100, 100);
    const isWithinRange = distance <= adaptiveRange;
    
    return (
      <div className="mt-3">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Distância do local permitido:</span>
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
            ? `✅ Dentro do range permitido (${Math.round(adaptiveRange - distance)}m de margem)`
            : `❌ Fora do range (${Math.round(distance - adaptiveRange)}m excedido)`
          }
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full border-2 border-blue-100">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-800">Status do GPS</span>
          </div>
          <div className="flex items-center space-x-2">
            {getAccuracyIcon()}
            <div className="text-right">
              <div className={`text-sm font-medium ${getAccuracyColor()}`}>
                {getAccuracyText()}
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-600 mb-3 text-center">
          {getAccuracyDescription()}
        </div>

        {/* Progresso da calibração */}
        {isCalibrating && calibration?.calibrationProgress !== undefined && (
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span>Calibrando GPS...</span>
              <span>{Math.round(calibration.calibrationProgress)}%</span>
            </div>
            <Progress value={calibration.calibrationProgress} className="h-2" />
            <div className="text-xs text-gray-500 mt-1 text-center">
              Amostras coletadas: {calibration.samples?.length || 0}/8
            </div>
          </div>
        )}

        {/* Informações de localização detalhadas */}
        {location && !isCalibrating && (
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
                <div className={getAccuracyColor()}>{Math.round(gpsAccuracy)}m</div>
              </div>
              <div>
                <span className="font-medium">Última atualização:</span>
                <div>{new Date(location.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          </div>
        )}

        {getDistanceStatus()}

        <div className="flex justify-between space-x-2 mt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCalibrate}
                  disabled={isCalibrating}
                  className="flex items-center space-x-1 flex-1"
                >
                  {isCalibrating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Compass className="w-4 h-4" />
                  )}
                  <span>{isCalibrating ? 'Calibrando...' : 'Calibrar GPS'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">Calibração de GPS</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Coleta 8 amostras em 12 segundos para máxima precisão
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isCalibrating}
            className="flex items-center space-x-1"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar</span>
          </Button>
        </div>

        {/* Dicas para melhorar precisão */}
        {isLowAccuracy && !isCalibrating && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <div className="font-medium text-yellow-800 mb-1">💡 Dicas para melhorar a precisão:</div>
            <ul className="text-yellow-700 space-y-1">
              <li>• Vá para um local aberto (longe de prédios)</li>
              <li>• Aguarde alguns segundos para o GPS se estabilizar</li>
              <li>• Use a calibração para obter maior precisão</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
