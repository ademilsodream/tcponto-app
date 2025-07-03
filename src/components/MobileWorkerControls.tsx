
import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Target, Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MobileWorkerControlsProps {
  canRegister: boolean;
  currentLocation: string | null;
  hasLocationChanged: boolean;
  previousLocationName: string | null;
  validationMessage: string;
  needsCalibration: boolean;
  isCalibrating: boolean;
  isValidating: boolean;
  onCalibrateForLocation: () => void;
  onValidateLocation: () => void;
}

export const MobileWorkerControls: React.FC<MobileWorkerControlsProps> = ({
  canRegister,
  currentLocation,
  hasLocationChanged,
  previousLocationName,
  validationMessage,
  needsCalibration,
  isCalibrating,
  isValidating,
  onCalibrateForLocation,
  onValidateLocation
}) => {
  return (
    <div className="space-y-3">
      {/* Status da localização atual */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">Status da Localização</span>
        </div>
        
        {isValidating ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Validando localização...
          </div>
        ) : currentLocation ? (
          <div className="text-sm">
            <div className={`font-medium ${canRegister ? 'text-green-600' : 'text-red-600'}`}>
              📍 {currentLocation}
            </div>
            {hasLocationChanged && previousLocationName && (
              <div className="text-amber-600 text-xs mt-1">
                ⚠️ Local alterado de: {previousLocationName}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Nenhum local identificado
          </div>
        )}
      </div>

      {/* Alerta se não pode registrar */}
      {!canRegister && validationMessage && (
        <Alert variant={hasLocationChanged ? "default" : "destructive"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {validationMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Recomendação de calibração */}
      {needsCalibration && currentLocation && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertDescription className="text-sm">
            GPS com baixa precisão. Recomendamos calibrar para melhor precisão em {currentLocation}.
          </AlertDescription>
        </Alert>
      )}

      {/* Controles de ação */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={onValidateLocation}
          disabled={isValidating || isCalibrating}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {isValidating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 mr-2" />
              Atualizar Local
            </>
          )}
        </Button>

        <Button
          onClick={onCalibrateForLocation}
          disabled={!currentLocation || isCalibrating || isValidating}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {isCalibrating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calibrando...
            </>
          ) : (
            <>
              <Target className="w-4 h-4 mr-2" />
              Calibrar GPS
            </>
          )}
        </Button>
      </div>

      {/* Informação sobre mudança de local */}
      {hasLocationChanged && canRegister && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <div className="text-sm text-blue-800">
            <div className="font-medium mb-1">✅ Mudança de Local Detectada</div>
            <div className="text-xs">
              Você pode registrar o ponto normalmente. O sistema detectou que você mudou de local e autorizou o registro.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
