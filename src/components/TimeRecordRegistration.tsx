
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Clock, MapPin, Target, Loader2 } from 'lucide-react';
import { GPSStatus } from './GPSStatus';
import { validateLocationWithRetry, validateGPSQuality } from '@/utils/locationValidationEnhanced';
import { AllowedLocation } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { useEnhancedLocation } from '@/hooks/useEnhancedLocation';

interface TimeRecordRegistrationProps {
  allowedLocations: AllowedLocation[];
  onRegister: (type: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => Promise<void>;
  isLoading?: boolean;
}

export const TimeRecordRegistration: React.FC<TimeRecordRegistrationProps> = ({
  allowedLocations,
  onRegister,
  isLoading = false
}) => {
  const [validationResult, setValidationResult] = useState<any>(null);
  const [calibrating, setCalibrating] = useState(false);
  const { toast } = useToast();
  const {
    location,
    loading: locationLoading,
    error: locationError,
    calibration,
    startCalibration,
    refreshLocation,
    calibrateAndValidate,
    isHighAccuracy,
    isMediumAccuracy,
    isLowAccuracy
  } = useEnhancedLocation();

  const validateLocation = async () => {
    try {
      const result = await validateLocationWithRetry(allowedLocations);
      setValidationResult(result);
      return result.valid;
    } catch (error: any) {
      toast({
        title: 'Erro na validação',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  const handleCalibrate = async () => {
    try {
      await startCalibration();
      // Revalidar localização após calibração
      await validateLocation();
    } catch (error: any) {
      toast({
        title: 'Erro na calibração',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshLocation();
      await validateLocation();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Nova função para registrar com calibração automática
  const handleRegisterWithCalibration = async (type: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    try {
      setCalibrating(true);
      
      toast({
        title: 'Calibrando GPS',
        description: 'Calibrando localização para maior precisão...',
        duration: 3000
      });

      // Calibrar GPS primeiro
      await calibrateAndValidate();
      
      // Validar localização com GPS calibrado
      const isValid = await validateLocation();
      if (!isValid) {
        toast({
          title: 'Localização inválida',
          description: validationResult?.message || 'Você precisa estar em uma localização permitida para registrar o ponto.',
          variant: 'destructive'
        });
        return;
      }

      // Registrar o ponto
      await onRegister(type);
      
      toast({
        title: 'Ponto registrado',
        description: 'Ponto registrado com sucesso com GPS calibrado!'
      });
      
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setCalibrating(false);
    }
  };

  const handleRegister = async (type: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    try {
      const isValid = await validateLocation();
      if (!isValid) {
        toast({
          title: 'Localização inválida',
          description: validationResult?.message || 'Você precisa estar em uma localização permitida para registrar o ponto.',
          variant: 'destructive'
        });
        return;
      }

      await onRegister(type);
      toast({
        title: 'Ponto registrado',
        description: 'Ponto registrado com sucesso!'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    validateLocation();
  }, [location]);

  useEffect(() => {
    if (locationError) {
      toast({
        title: 'Erro de GPS',
        description: locationError,
        variant: 'destructive'
      });
    }
  }, [locationError, toast]);

  const shouldRecommendCalibration = location && location.accuracy > 30;
  const isProcessing = isLoading || locationLoading || calibrating || calibration.isCalibrating;

  return (
    <div className="space-y-4">
      <GPSStatus
        location={location}
        calibration={calibration}
        onCalibrate={handleCalibrate}
        onRefresh={handleRefresh}
        isHighAccuracy={isHighAccuracy}
        isMediumAccuracy={isMediumAccuracy}
        isLowAccuracy={isLowAccuracy}
        gpsAccuracy={location?.accuracy}
        distance={validationResult?.distance}
        adaptiveRange={validationResult?.adaptiveRange}
        isCalibrating={calibration.isCalibrating || calibrating}
      />

      {validationResult && !validationResult.valid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {validationResult.message}
          </AlertDescription>
        </Alert>
      )}

      {shouldRecommendCalibration && !calibrating && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertDescription>
            GPS com precisão baixa ({Math.round(location.accuracy)}m). 
            Recomendamos calibrar para melhor precisão.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleRegister('clock_in')}
              disabled={isProcessing || !validationResult?.valid}
              className="w-full"
            >
              <Clock className="mr-2 h-4 w-4" />
              Entrada
            </Button>

            <Button
              onClick={() => handleRegister('lunch_start')}
              disabled={isProcessing || !validationResult?.valid}
              className="w-full"
            >
              <Clock className="mr-2 h-4 w-4" />
              Início Almoço
            </Button>

            <Button
              onClick={() => handleRegister('lunch_end')}
              disabled={isProcessing || !validationResult?.valid}
              className="w-full"
            >
              <Clock className="mr-2 h-4 w-4" />
              Fim Almoço
            </Button>

            <Button
              onClick={() => handleRegister('clock_out')}
              disabled={isProcessing || !validationResult?.valid}
              className="w-full"
            >
              <Clock className="mr-2 h-4 w-4" />
              Saída
            </Button>
          </div>

          {/* Botão de Calibração + Registro */}
          <div className="mt-4 space-y-2">
            <Button
              onClick={() => {
                const nextAction = !validationResult?.clock_in ? 'clock_in' :
                                !validationResult?.lunch_start ? 'lunch_start' :
                                !validationResult?.lunch_end ? 'lunch_end' : 'clock_out';
                handleRegisterWithCalibration(nextAction);
              }}
              disabled={isProcessing}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {calibrating || calibration.isCalibrating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calibrando GPS...
                </>
              ) : (
                <>
                  <Target className="mr-2 h-4 w-4" />
                  Calibrar GPS + Registrar
                </>
              )}
            </Button>
            
            <p className="text-xs text-gray-500 text-center">
              Calibra o GPS automaticamente antes de registrar para máxima precisão
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 
