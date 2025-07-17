import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  MapPin, 
  Target, 
  RefreshCw, 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  ChevronDown,
  Settings,
  Navigation
} from 'lucide-react';

interface AdvancedLocationControlsProps {
  // Estado principal
  canRegister: boolean;
  currentLocation: string | null;
  hasLocationChanged: boolean;
  previousLocationName: string | null;
  validationMessage: string;
  needsCalibration: boolean;
  gpsAccuracy: number | null;
  appliedRange: number | null;
  
  // Estados de loading
  isValidating: boolean;
  isCalibrating: boolean;
  
  // Funções
  onValidateLocation: () => void;
  onCalibrateLocation: () => void;
  onForceRefresh: () => void;
  
  // Debug e informações avançadas
  debug?: any;
  hasDebugInfo: boolean;
  locationAccuracyText: string | null;
  appliedRangeText: string | null;
}

export const AdvancedLocationControls: React.FC<AdvancedLocationControlsProps> = ({
  canRegister,
  currentLocation,
  hasLocationChanged,
  previousLocationName,
  validationMessage,
  needsCalibration,
  gpsAccuracy,
  appliedRange,
  isValidating,
  isCalibrating,
  onValidateLocation,
  onCalibrateLocation,
  onForceRefresh,
  debug,
  hasDebugInfo,
  locationAccuracyText,
  appliedRangeText
}) => {
  const [showDebug, setShowDebug] = useState(false);

  const getStatusColor = () => {
    if (isValidating) return 'bg-blue-50 border-blue-200';
    if (canRegister) return 'bg-green-50 border-green-200';
    return 'bg-red-50 border-red-200';
  };

  const getStatusIcon = () => {
    if (isValidating) return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    if (canRegister) return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <AlertTriangle className="w-5 h-5 text-red-600" />;
  };

  const getStatusText = () => {
    if (isValidating) return 'Validando localização...';
    if (canRegister) return 'Localização autorizada';
    return 'Localização não autorizada';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Navigation className="w-5 h-5" />
          Sistema de Localização Avançado
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Principal */}
        <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
          <div className="flex items-center gap-3 mb-3">
            {getStatusIcon()}
            <div className="flex-1">
              <div className="font-medium">{getStatusText()}</div>
              {currentLocation && (
                <div className="text-sm text-gray-600">
                  📍 {currentLocation}
                </div>
              )}
            </div>
          </div>

          {/* Informações técnicas */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {locationAccuracyText && (
              <div className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                <span>GPS: {locationAccuracyText}</span>
              </div>
            )}
            {appliedRangeText && (
              <div className="flex items-center gap-1">
                <Settings className="w-3 h-3" />
                <span>Range: {appliedRangeText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Alerta de mudança de local */}
        {hasLocationChanged && (
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">Mudança de Local Detectada</div>
              <div className="text-sm">
                {previousLocationName && `De: ${previousLocationName}`}
                {currentLocation && ` → Para: ${currentLocation}`}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Mensagem de validação */}
        {validationMessage && !hasLocationChanged && (
          <Alert variant={canRegister ? "default" : "destructive"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {validationMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Recomendação de calibração */}
        {needsCalibration && currentLocation && (
          <Alert className="bg-amber-50 border-amber-200">
            <Target className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">Calibração Recomendada</div>
              <div className="text-sm">
                GPS com baixa precisão ({locationAccuracyText}). 
                Calibre para melhor precisão em {currentLocation}.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Controles principais */}
        <div className="grid grid-cols-3 gap-2">
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
                Validar
              </>
            )}
          </Button>

          <Button
            onClick={onCalibrateLocation}
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
                Calibrar
              </>
            )}
          </Button>

          <Button
            onClick={onForceRefresh}
            disabled={isValidating || isCalibrating}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Informações de sucesso */}
        {canRegister && hasLocationChanged && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-4 h-4" />
              <div className="text-sm">
                <div className="font-medium">✅ Pronto para Registrar</div>
                <div className="text-xs mt-1">
                  Sistema detectou mudança de local e autorizou o registro.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug avançado (colapsável) */}
        {hasDebugInfo && debug && (
          <Collapsible open={showDebug} onOpenChange={setShowDebug}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                <Info className="w-4 h-4 mr-2" />
                Informações Técnicas
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showDebug ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Badge variant="outline" className="mb-1">Tentativas</Badge>
                    <div>{debug.attempts || 0}</div>
                  </div>
                  <div>
                    <Badge variant="outline" className="mb-1">Ranges Testados</Badge>
                    <div>{debug.rangesUsed?.join(', ') || 'N/A'}m</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Badge variant="outline" className="mb-1">Calibração</Badge>
                    <div>{debug.calibrationApplied ? '✅ Aplicada' : '❌ Não aplicada'}</div>
                  </div>
                  <div>
                    <Badge variant="outline" className="mb-1">Mudança</Badge>
                    <div>{debug.changeDetected ? '🔄 Detectada' : '📍 Mesmo local'}</div>
                  </div>
                </div>

                {gpsAccuracy && (
                  <div>
                    <Badge variant="outline" className="mb-1">Precisão GPS</Badge>
                    <div className={gpsAccuracy > 50 ? 'text-red-600' : gpsAccuracy > 20 ? 'text-amber-600' : 'text-green-600'}>
                      {Math.round(gpsAccuracy)}m {gpsAccuracy > 50 ? '(Baixa)' : gpsAccuracy > 20 ? '(Média)' : '(Alta)'}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};