/**
 * Componente de Registro de Ponto Unificado
 * Usa o UnifiedLocationSystem para resolver problemas de GPS e localização
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Coffee, 
  LogOut, 
  LogIn,
  AlertCircle,
  CheckCircle,
  Loader2,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedLocation } from '@/hooks/useUnifiedLocation';
import { UnifiedGPSStatus } from '@/components/UnifiedGPSStatus';
import { supabase } from '@/integrations/supabase/client';
import { AllowedLocation } from '@/types/index';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UnifiedTimeRegistrationProps {
  user: any;
  allowedLocations: AllowedLocation[];
  timeRecord?: any;
  onTimeRecordUpdate?: (record: any) => void;
}

export const UnifiedTimeRegistration: React.FC<UnifiedTimeRegistrationProps> = ({
  user,
  allowedLocations,
  timeRecord,
  onTimeRecordUpdate
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const { toast } = useToast();

  // Usar o hook unificado de localização
  const {
    location,
    loading: locationLoading,
    error: locationError,
    validationResult,
    isValidating,
    canRegister,
    calibration,
    gpsQuality,
    debug,
    validateLocation,
    calibrateForCurrentLocation,
    refreshLocation,
    clearCalibration
  } = useUnifiedLocation(allowedLocations, true);

  // Verificar se pode registrar ponto
  const canRegisterPoint = canRegister && !submitting && !locationLoading && !isValidating;

  // Obter data atual
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentTime = format(new Date(), 'HH:mm:ss');

  // Função para registrar ponto
  const handleTimeAction = async (action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    if (!canRegisterPoint) {
      toast({
        title: "Não é possível registrar",
        description: "Aguarde a validação de localização ou verifique se está em um local permitido.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    setLastAction(action);

    try {
      // Validar localização novamente antes de registrar
      await validateLocation();

      if (!validationResult?.valid) {
        toast({
          title: "Localização não autorizada",
          description: validationResult?.message || "Você precisa estar em uma localização permitida.",
          variant: "destructive"
        });
        return;
      }

      // Preparar dados do registro
      const now = new Date();
      const locationData = {
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        accuracy: location?.accuracy || 0,
        timestamp: now.toISOString(),
        address: validationResult?.closestLocation?.address || 'Endereço não disponível',
        locationName: validationResult?.closestLocation?.name || 'Localização Desconhecida',
        distance: validationResult?.distance || 0,
        gpsQuality: gpsQuality?.quality || 'DESCONHECIDA',
        confidence: gpsQuality?.confidence || 0,
        calibrationApplied: validationResult?.calibrationApplied || false,
        locationChanged: validationResult?.locationChanged || false,
        previousLocation: validationResult?.previousLocation || null,
        environment: debug.environment
      };

      // Preparar dados para salvar
      const updateData: any = {
        [action]: currentTime,
        locations: {
          ...(timeRecord?.locations || {}),
          [action]: locationData
        }
      };

      console.log(`📝 Registrando ${action}:`, {
        time: currentTime,
        location: locationData.locationName,
        distance: locationData.distance,
        accuracy: locationData.accuracy,
        quality: locationData.gpsQuality
      });

      // Salvar no banco
      let result;
      if (timeRecord) {
        result = await supabase
          .from('time_records')
          .update(updateData)
          .eq('id', timeRecord.id)
          .select('*')
          .single();
      } else {
        result = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: today,
            ...updateData
          })
          .select('*')
          .single();
      }

      if (result.error) {
        throw new Error(`Erro ao salvar registro: ${result.error.message}`);
      }

      // Notificar sucesso
      const actionNames = {
        clock_in: 'Entrada',
        lunch_start: 'Início do Almoço',
        lunch_end: 'Fim do Almoço',
        clock_out: 'Saída'
      };

      toast({
        title: `${actionNames[action]} Registrada`,
        description: `Ponto registrado com sucesso em ${locationData.locationName}`,
        duration: 4000
      });

      // Atualizar estado local
      if (onTimeRecordUpdate) {
        onTimeRecordUpdate(result.data);
      }

      // Limpar cache após registro bem-sucedido
      setTimeout(() => {
        clearCalibration('all');
      }, 2000);

    } catch (error: any) {
      console.error('Erro ao registrar ponto:', error);
      toast({
        title: "Erro ao Registrar",
        description: error.message || "Falha ao registrar o ponto. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
      setLastAction(null);
    }
  };

  // Função para calibrar e registrar
  const handleCalibrateAndRegister = async (action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    try {
      setSubmitting(true);
      
      toast({
        title: 'Calibrando GPS',
        description: 'Calibrando localização para maior precisão...',
        duration: 3000
      });

      // Calibrar GPS
      await calibrateForCurrentLocation();
      
      // Aguardar um pouco para estabilizar
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Registrar ponto
      await handleTimeAction(action);
      
    } catch (error: any) {
      toast({
        title: 'Erro na Calibração',
        description: error.message || 'Falha ao calibrar GPS',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Obter status dos botões
  const getButtonStatus = (action: string) => {
    const hasRecord = timeRecord && timeRecord[action];
    const isProcessing = submitting && lastAction === action;
    const isDisabled = !canRegisterPoint || isProcessing;
    
    return {
      hasRecord,
      isProcessing,
      isDisabled,
      variant: hasRecord ? 'secondary' : 'default' as const
    };
  };

  // Obter ícone da ação
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'clock_in': return <LogIn className="w-4 h-4" />;
      case 'lunch_start': return <Coffee className="w-4 h-4" />;
      case 'lunch_end': return <Coffee className="w-4 h-4" />;
      case 'clock_out': return <LogOut className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Obter texto da ação
  const getActionText = (action: string) => {
    switch (action) {
      case 'clock_in': return 'Entrada';
      case 'lunch_start': return 'Início Almoço';
      case 'lunch_end': return 'Fim Almoço';
      case 'clock_out': return 'Saída';
      default: return action;
    }
  };

  return (
    <div className="space-y-4">
      {/* Status do GPS */}
      <UnifiedGPSStatus
        location={location}
        validationResult={validationResult}
        gpsQuality={gpsQuality}
        calibration={calibration}
        debug={debug}
        onCalibrate={calibrateForCurrentLocation}
        onRefresh={refreshLocation}
        onClearCache={() => clearCalibration('all')}
        loading={locationLoading || isValidating}
        error={locationError}
      />

      {/* Alertas de status */}
      {locationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{locationError}</AlertDescription>
        </Alert>
      )}

      {gpsQuality && gpsQuality.quality === 'RUIM' && !calibration.isCalibrating && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            GPS com baixa precisão ({Math.round(location?.accuracy || 0)}m). 
            Recomendamos calibrar para melhor precisão.
          </AlertDescription>
        </Alert>
      )}

      {validationResult && !validationResult.valid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationResult.message}</AlertDescription>
        </Alert>
      )}

      {/* Botões de registro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Registro de Ponto</span>
            {canRegister && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Pronto
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {(['clock_in', 'lunch_start', 'lunch_end', 'clock_out'] as const).map((action) => {
              const status = getButtonStatus(action);
              
              return (
                <div key={action} className="space-y-2">
                  <Button
                    variant={status.variant}
                    size="lg"
                    className="w-full h-16 text-sm"
                    onClick={() => handleTimeAction(action)}
                    disabled={status.isDisabled}
                  >
                    {status.isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      getActionIcon(action)
                    )}
                    <span className="ml-2">{getActionText(action)}</span>
                  </Button>
                  
                  {status.hasRecord && (
                    <div className="text-xs text-center text-gray-600">
                      Registrado: {timeRecord[action]}
                    </div>
                  )}
                  
                  {/* Botão de calibração para GPS ruim */}
                  {gpsQuality && gpsQuality.quality === 'RUIM' && !status.hasRecord && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleCalibrateAndRegister(action)}
                      disabled={status.isDisabled || calibration.isCalibrating}
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      Calibrar e Registrar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Informações de debug */}
          {debug.environment === 'APK' && (
            <div className="mt-4 p-2 bg-blue-50 rounded text-xs">
              <div className="font-medium text-blue-800">📱 App Nativo Detectado</div>
              <div className="text-blue-700">
                Usando GPS nativo para maior precisão
              </div>
            </div>
          )}

          {/* Status de processamento */}
          {(locationLoading || isValidating || submitting) && (
            <div className="mt-4 p-2 bg-yellow-50 rounded text-xs">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>
                  {locationLoading ? 'Obtendo localização...' :
                   isValidating ? 'Validando localização...' :
                   submitting ? 'Registrando ponto...' : 'Processando...'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações do registro atual */}
      {timeRecord && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Registro de Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(['clock_in', 'lunch_start', 'lunch_end', 'clock_out'] as const).map((action) => (
                <div key={action} className="flex justify-between">
                  <span className="text-gray-600">{getActionText(action)}:</span>
                  <span className="font-medium">
                    {timeRecord[action] || '--:--'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 