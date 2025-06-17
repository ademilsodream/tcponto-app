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
  Compass
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const [showCalibrationTip, setShowCalibrationTip] = useState(false);

  const getAccuracyColor = () => {
    if (isHighAccuracy) return 'text-green-500';
    if (isMediumAccuracy) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getAccuracyIcon = () => {
    if (isHighAccuracy) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (isMediumAccuracy) return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  };

  const getAccuracyText = () => {
    if (gpsAccuracy <= 10) return 'Excelente';
    if (gpsAccuracy <= 30) return 'Muito Boa';
    if (gpsAccuracy <= 50) return 'Boa';
    if (gpsAccuracy <= 100) return 'Aceitável';
    if (gpsAccuracy <= 200) return 'Baixa';
    if (gpsAccuracy <= 500) return 'Muito Baixa';
    return 'Inaceitável';
  };

  const getDistanceStatus = () => {
    if (!distance || !adaptiveRange) return null;
    const percentage = (distance / adaptiveRange) * 100;
    return (
      <div className="mt-2">
        <div className="flex justify-between text-sm mb-1">
          <span>Distância: {Math.round(distance)}m</span>
          <span>Range: {Math.round(adaptiveRange)}m</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5" />
            <span className="font-medium">Status do GPS</span>
          </div>
          <div className="flex items-center space-x-2">
            {getAccuracyIcon()}
            <span className={`text-sm ${getAccuracyColor()}`}>
              {getAccuracyText()} ({gpsAccuracy}m)
            </span>
          </div>
        </div>

        {getDistanceStatus()}

        <div className="flex justify-end space-x-2 mt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCalibrate}
                  disabled={isCalibrating}
                  className="flex items-center space-x-1"
                >
                  <Compass className="w-4 h-4" />
                  <span>Calibrar GPS</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Calibre o GPS para melhorar a precisão</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="flex items-center space-x-1"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};