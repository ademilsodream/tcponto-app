import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Clock, MapPin } from 'lucide-react';
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
  const { toast } = useToast();
  const {
    location,
    loading: locationLoading,
    error: locationError,
    calibration,
    startCalibration,
    refreshLocation,
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
        isCalibrating={calibration.isCalibrating}
      />

      {validationResult && !validationResult.valid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {validationResult.message}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleRegister('clock_in')}
              disabled={isLoading || locationLoading || !validationResult?.valid}
              className="w-full"
            >
              <Clock className="mr-2 h-4 w-4" />
              Entrada
            </Button>

            <Button
              onClick={() => handleRegister('lunch_start')}
              disabled={isLoading || locationLoading || !validationResult?.valid}
              className="w-full"
            >
              <Clock className="mr-2 h-4 w-4" />
              Início Almoço
            </Button>

            <Button
              onClick={() => handleRegister('lunch_end')}
              disabled={isLoading || locationLoading || !validationResult?.valid}
              className="w-full"
            >
              <Clock className="mr-2 h-4 w-4" />
              Fim Almoço
            </Button>

            <Button
              onClick={() => handleRegister('clock_out')}
              disabled={isLoading || locationLoading || !validationResult?.valid}
              className="w-full"
            >
              <Clock className="mr-2 h-4 w-4" />
              Saída
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 