import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  RefreshCw, 
  Target, 
  AlertCircle,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface GPSStatusProps {
  location: any;
  calibration: any;
  onCalibrate: () => void;
  onRefresh: () => void;
  isHighAccuracy: boolean;
  isMediumAccuracy: boolean;
  isLowAccuracy: boolean;
}

export const GPSStatus: React.FC<GPSStatusProps> = ({
  location,
  calibration,
  onCalibrate,
  onRefresh,
  isHighAccuracy,
  isMediumAccuracy,
  isLowAccuracy
}) => {
  const getAccuracyColor = () => {
    if (isHighAccuracy) return 'text-green-600';
    if (isMediumAccuracy) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAccuracyIcon = () => {
    if (isHighAccuracy) return <CheckCircle className="w-5 h-5" />;
    if (isMediumAccuracy) return <AlertTriangle className="w-5 h-5" />;
    return <AlertCircle className="w-5 h-5" />;
  };

  const getAccuracyText = () => {
    if (isHighAccuracy) return 'Excelente';
    if (isMediumAccuracy) return 'Média';
    return 'Baixa';
  };

  return (
    <Card className="w-full max-w-md mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <MapPin className={`w-5 h-5 ${getAccuracyColor()}`} />
            <span className="text-sm font-medium">Status GPS</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={calibration.isCalibrating}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={isLowAccuracy ? 'default' : 'outline'}
              onClick={onCalibrate}
              disabled={calibration.isCalibrating}
            >
              <Target className="w-4 h-4 mr-1" />
              Calibrar
            </Button>
          </div>
        </div>

        {location && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Precisão:</span>
              <div className={`flex items-center space-x-1 ${getAccuracyColor()}`}>
                {getAccuracyIcon()}
                <span className="font-medium">
                  {location.accuracy.toFixed(1)}m ({getAccuracyText()})
                </span>
              </div>
            </div>

            {calibration.isCalibrating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Calibrando...</span>
                  <span className="text-sm font-medium">
                    {calibration.calibrationProgress.toFixed(0)}%
                  </span>
                </div>
                <Progress value={calibration.calibrationProgress} />
                <p className="text-xs text-gray-500">
                  Coletando amostras para melhorar precisão...
                </p>
              </div>
            )}

            {!calibration.isCalibrating && calibration.samples.length > 0 && (
              <div className="text-xs text-gray-500">
                Última calibração: {calibration.samples.length} amostras coletadas
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};