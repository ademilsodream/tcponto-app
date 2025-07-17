import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { AllowedLocation } from '@/types/index';
import { 
  AdvancedLocationSystem,
  LocationValidationResult 
} from '@/utils/advancedLocationSystem';

interface AdvancedLocationState {
  isValidating: boolean;
  canRegister: boolean;
  currentLocation: AllowedLocation | null;
  hasLocationChanged: boolean;
  previousLocationName: string | null;
  validationMessage: string;
  needsCalibration: boolean;
  gpsAccuracy: number | null;
  appliedRange: number | null;
  debug: any;
}

type SimpleAllowedLocation = Omit<AllowedLocation, 'created_at' | 'updated_at'>;

export const useAdvancedLocationSystem = (allowedLocations: SimpleAllowedLocation[]) => {
  const [state, setState] = useState<AdvancedLocationState>({
    isValidating: false,
    canRegister: false,
    currentLocation: null,
    hasLocationChanged: false,
    previousLocationName: null,
    validationMessage: '',
    needsCalibration: false,
    gpsAccuracy: null,
    appliedRange: null,
    debug: null
  });

  const [isCalibrating, setIsCalibrating] = useState(false);
  const { toast } = useToast();

  // Converter locais simples para formato completo
  const convertToFullLocations = useCallback((locations: SimpleAllowedLocation[]): AllowedLocation[] => {
    return locations.map(loc => ({
      ...loc,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }, []);

  // Validar localização usando o sistema avançado
  const validateLocation = useCallback(async () => {
    if (allowedLocations.length === 0) return;

    setState(prev => ({ ...prev, isValidating: true }));

    try {
      const fullLocations = convertToFullLocations(allowedLocations);
      const result: LocationValidationResult = await AdvancedLocationSystem.validateLocation(
        fullLocations,
        0.7
      );

      setState(prev => ({
        ...prev,
        isValidating: false,
        canRegister: result.valid,
        currentLocation: result.closestLocation || null,
        hasLocationChanged: result.locationChanged || false,
        previousLocationName: result.previousLocation || null,
        validationMessage: result.message,
        needsCalibration: result.gpsAccuracy ? result.gpsAccuracy > 30 : false,
        gpsAccuracy: result.gpsAccuracy || null,
        appliedRange: result.appliedRange || null,
        debug: result.debug
      }));

      // Mostrar notificação se localização mudou
      if (result.locationChanged && result.valid) {
        toast({
          title: "Localização Alterada",
          description: result.message,
          duration: 5000
        });
      }

      // Log detalhado para debug
      console.log('🔍 Validação avançada concluída:', {
        valid: result.valid,
        location: result.closestLocation?.name,
        distance: result.distance ? Math.round(result.distance) + 'm' : null,
        accuracy: result.gpsAccuracy ? Math.round(result.gpsAccuracy) + 'm' : null,
        range: result.appliedRange ? result.appliedRange + 'm' : null,
        changed: result.locationChanged,
        debug: result.debug
      });

    } catch (error) {
      console.error('❌ Erro na validação avançada:', error);
      setState(prev => ({
        ...prev,
        isValidating: false,
        canRegister: false,
        validationMessage: 'Erro ao validar localização'
      }));
      
      toast({
        title: "Erro",
        description: "Falha ao validar localização",
        variant: "destructive"
      });
    }
  }, [allowedLocations, toast, convertToFullLocations]);

  // Calibrar GPS para o local atual
  const calibrateForCurrentLocation = useCallback(async () => {
    if (!state.currentLocation) {
      toast({
        title: "Erro",
        description: "Nenhum local identificado para calibração",
        variant: "destructive"
      });
      return;
    }

    setIsCalibrating(true);

    try {
      const success = await AdvancedLocationSystem.calibrateForLocation(
        state.currentLocation.id,
        {
          latitude: state.currentLocation.latitude,
          longitude: state.currentLocation.longitude
        }
      );

      if (success) {
        toast({
          title: "Calibração Salva",
          description: `GPS calibrado para ${state.currentLocation.name}`,
        });
        
        // Revalidar após calibração
        setTimeout(() => {
          validateLocation();
        }, 1000);
      } else {
        throw new Error('Falha na calibração');
      }

    } catch (error) {
      console.error('Erro na calibração:', error);
      toast({
        title: "Erro na Calibração",
        description: "Falha ao calibrar GPS",
        variant: "destructive"
      });
    } finally {
      setIsCalibrating(false);
    }
  }, [state.currentLocation, toast, validateLocation]);

  // Forçar nova localização (limpar cache)
  const forceLocationRefresh = useCallback(() => {
    AdvancedLocationSystem.forceLocationRefresh();
    toast({
      title: "Cache Limpo",
      description: "Forçando nova validação de localização",
      duration: 3000
    });
    
    // Validar após forçar refresh
    setTimeout(() => {
      validateLocation();
    }, 500);
  }, [toast, validateLocation]);

  // Registrar ponto com sistema avançado
  const registerTimeWithTracking = useCallback((action: string): boolean => {
    if (state.canRegister && state.currentLocation) {
      // O sistema avançado já salva o local automaticamente durante a validação
      console.log(`📍 Registrando ${action} em:`, {
        location: state.currentLocation.name,
        hasLocationChanged: state.hasLocationChanged,
        previousLocation: state.previousLocationName,
        gpsAccuracy: state.gpsAccuracy,
        appliedRange: state.appliedRange
      });
      
      // Reset para próximo registro
      AdvancedLocationSystem.resetForNewRegistration();
      
      return true;
    }
    return false;
  }, [state]);

  // Auto-validar quando localizações mudarem
  useEffect(() => {
    if (allowedLocations.length > 0) {
      validateLocation();
    }
  }, [allowedLocations, validateLocation]);

  // Obter logs de debug
  const getDebugLogs = useCallback(() => {
    return AdvancedLocationSystem.getValidationLogs();
  }, []);

  // Configurar ranges personalizados
  const configureRanges = useCallback((ranges: { base?: number; expanded?: number; emergency?: number }) => {
    AdvancedLocationSystem.configureEmployeeRanges(ranges);
    toast({
      title: "Configuração Salva",
      description: "Ranges de localização atualizados",
    });
  }, [toast]);

  return {
    // Estado atual
    ...state,
    
    // Estado de calibração
    isCalibrating,
    
    // Funções principais
    validateLocation,
    calibrateForLocation: calibrateForCurrentLocation,
    forceLocationRefresh,
    registerWithLocationTracking: registerTimeWithTracking,
    
    // Utilidades e debug
    getDebugLogs,
    configureRanges,
    
    // Informações úteis para UI
    hasDebugInfo: !!state.debug,
    locationAccuracyText: state.gpsAccuracy ? `${Math.round(state.gpsAccuracy)}m` : null,
    appliedRangeText: state.appliedRange ? `${state.appliedRange}m` : null
  };
};