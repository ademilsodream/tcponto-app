
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { AllowedLocation } from '@/types/index';
import { 
  validateLocationForMobileWorker,
  saveLastRegistrationLocation,
  getLastRegistrationLocation,
  saveLocationCalibration,
  getLocationCalibration
} from '@/utils/smartLocationValidation';
import { useEnhancedLocation } from './useEnhancedLocation';

interface MobileWorkerLocationState {
  isValidating: boolean;
  canRegister: boolean;
  currentLocation: AllowedLocation | null;
  hasLocationChanged: boolean;
  previousLocationName: string | null;
  validationMessage: string;
  needsCalibration: boolean;
}

export const useMobileWorkerLocation = (allowedLocations: AllowedLocation[]) => {
  const [state, setState] = useState<MobileWorkerLocationState>({
    isValidating: false,
    canRegister: false,
    currentLocation: null,
    hasLocationChanged: false,
    previousLocationName: null,
    validationMessage: '',
    needsCalibration: false
  });

  const { location, startCalibration, calibration } = useEnhancedLocation();
  const { toast } = useToast();

  // Validar localização automaticamente
  const validateCurrentLocation = useCallback(async () => {
    if (!location || allowedLocations.length === 0) return;

    setState(prev => ({ ...prev, isValidating: true }));

    try {
      const result = await validateLocationForMobileWorker(allowedLocations, 0.7);

      setState(prev => ({
        ...prev,
        isValidating: false,
        canRegister: result.valid,
        currentLocation: result.closestLocation || null,
        hasLocationChanged: result.locationChanged || false,
        previousLocationName: result.previousLocation || null,
        validationMessage: result.message,
        needsCalibration: result.gpsAccuracy ? result.gpsAccuracy > 30 : false
      }));

      // Notificar mudança de local
      if (result.locationChanged && result.valid) {
        toast({
          title: "Localização Alterada",
          description: result.message,
          duration: 5000
        });
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isValidating: false,
        canRegister: false,
        validationMessage: 'Erro ao validar localização'
      }));
    }
  }, [location, allowedLocations, toast]);

  // Calibrar GPS para local específico
  const calibrateForCurrentLocation = useCallback(async () => {
    if (!state.currentLocation) {
      toast({
        title: "Erro",
        description: "Nenhum local identificado para calibração",
        variant: "destructive"
      });
      return;
    }

    try {
      await startCalibration();
      
      // Salvar calibração para este local específico
      if (calibration.offset && !calibration.isCalibrating) {
        saveLocationCalibration(
          state.currentLocation.id,
          calibration.offset,
          calibration.bestAccuracy
        );
        
        toast({
          title: "Calibração Salva",
          description: `GPS calibrado para ${state.currentLocation.name}`,
        });
        
        // Revalidar após calibração
        setTimeout(validateCurrentLocation, 1000);
      }
      
    } catch (error) {
      toast({
        title: "Erro na Calibração",
        description: "Falha ao calibrar GPS",
        variant: "destructive"
      });
    }
  }, [state.currentLocation, startCalibration, calibration, toast, validateCurrentLocation]);

  // Registrar ponto com suporte a funcionário móvel
  const registerTimeWithLocationTracking = useCallback((action: string) => {
    if (state.canRegister && state.currentLocation) {
      // Salvar local atual para próxima validação
      saveLastRegistrationLocation(state.currentLocation.id);
      
      // Log para debug
      console.log(`📍 Registrando ${action} em:`, {
        location: state.currentLocation.name,
        hasLocationChanged: state.hasLocationChanged,
        previousLocation: state.previousLocationName
      });
      
      return true;
    }
    return false;
  }, [state]);

  // Auto-validar quando localização ou locais permitidos mudarem
  useEffect(() => {
    if (location && allowedLocations.length > 0) {
      validateCurrentLocation();
    }
  }, [location, allowedLocations, validateCurrentLocation]);

  // Aplicar calibração armazenada quando identificar local
  useEffect(() => {
    if (state.currentLocation && location) {
      const storedCalibration = getLocationCalibration(state.currentLocation.id);
      if (storedCalibration) {
        console.log(`🎯 Aplicando calibração armazenada para ${state.currentLocation.name}`);
      }
    }
  }, [state.currentLocation, location]);

  return {
    ...state,
    validateLocation: validateCurrentLocation,
    calibrateForLocation: calibrateForCurrentLocation,
    registerWithLocationTracking: registerTimeWithLocationTracking,
    isCalibrating: calibration.isCalibrating
  };
};
