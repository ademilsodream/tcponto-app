/**
 * Hook Unificado de Localização
 * Usa o UnifiedLocationSystem para resolver problemas de GPS e calibração
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { UnifiedLocationSystem, UnifiedLocationResult, CalibrationData } from '@/utils/unifiedLocationSystem';
import { AllowedLocation } from '@/types/index';

export interface UseUnifiedLocationReturn {
  // Estado da localização
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null;
  loading: boolean;
  error: string | null;
  
  // Estado da validação
  validationResult: UnifiedLocationResult | null;
  isValidating: boolean;
  canRegister: boolean;
  
  // Estado da calibração
  calibration: {
    isCalibrating: boolean;
    calibrationProgress: number;
    currentLocation: AllowedLocation | null;
  };
  
  // Funções
  validateLocation: () => Promise<void>;
  calibrateForCurrentLocation: () => Promise<void>;
  refreshLocation: () => Promise<void>;
  clearCalibration: (locationId: string) => void;
  
  // Informações de qualidade
  gpsQuality: {
    quality: 'EXCELENTE' | 'BOM' | 'REGULAR' | 'RUIM';
    acceptable: boolean;
    confidence: number;
    message: string;
  } | null;
  
  // Debug
  debug: {
    environment: 'APK' | 'WEB';
    cacheValid: boolean;
    calibrationsCount: number;
    lastLocation: any;
  };
}

export const useUnifiedLocation = (
  allowedLocations: AllowedLocation[],
  autoValidate: boolean = true
): UseUnifiedLocationReturn => {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<UnifiedLocationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [canRegister, setCanRegister] = useState(false);
  const [calibration, setCalibration] = useState<{
    isCalibrating: boolean;
    calibrationProgress: number;
    currentLocation: AllowedLocation | null;
  }>({
    isCalibrating: false,
    calibrationProgress: 0,
    currentLocation: null
  });
  const [gpsQuality, setGpsQuality] = useState<{
    quality: 'EXCELENTE' | 'BOM' | 'REGULAR' | 'RUIM';
    acceptable: boolean;
    confidence: number;
    message: string;
  } | null>(null);
  const [debug, setDebug] = useState<{
    environment: 'APK' | 'WEB';
    cacheValid: boolean;
    calibrationsCount: number;
    lastLocation: any;
  }>({
    environment: 'WEB',
    cacheValid: false,
    calibrationsCount: 0,
    lastLocation: null
  });

  const { toast } = useToast();
  const watchIdRef = useRef<number | null>(null);

  // Função para validar qualidade do GPS
  const validateGPSQuality = useCallback((accuracy: number) => {
    if (accuracy <= 15) {
      return {
        quality: 'EXCELENTE' as const,
        acceptable: true,
        confidence: 95,
        message: 'GPS com excelente precisão'
      };
    } else if (accuracy <= 35) {
      return {
        quality: 'BOM' as const,
        acceptable: true,
        confidence: 80,
        message: 'GPS com boa precisão'
      };
    } else if (accuracy <= 100) {
      return {
        quality: 'REGULAR' as const,
        acceptable: true,
        confidence: 60,
        message: 'GPS com precisão regular'
      };
    } else {
      return {
        quality: 'RUIM' as const,
        acceptable: false,
        confidence: 30,
        message: 'GPS com baixa precisão'
      };
    }
  }, []);

  // Função para obter localização atual
  const getCurrentLocation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Usar o sistema unificado para obter localização
      const result = await UnifiedLocationSystem.validateLocation(allowedLocations, 0.6);
      
      if (result.location) {
        setLocation(result.location);
        setGpsQuality(validateGPSQuality(result.location.accuracy));
      }

      return result;
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [allowedLocations, validateGPSQuality]);

  // Função para validar localização
  const validateLocation = useCallback(async () => {
    if (!allowedLocations || allowedLocations.length === 0) {
      setValidationResult({
        valid: false,
        message: 'Nenhuma localização permitida configurada'
      });
      setCanRegister(false);
      return;
    }

    setIsValidating(true);

    try {
      const result = await UnifiedLocationSystem.validateLocation(allowedLocations, 0.6);
      
      setValidationResult(result);
      setCanRegister(result.valid);

      // Atualizar localização se obtida
      if (result.location) {
        setLocation(result.location);
        setGpsQuality(validateGPSQuality(result.location.accuracy));
      }

      // Notificar mudança de local
      if (result.locationChanged && result.valid) {
        toast({
          title: "Localização Alterada",
          description: `Agora registrando em ${result.closestLocation?.name}`,
          duration: 4000
        });
      }

      // Notificar se precisa de calibração
      if (result.needsCalibration) {
        toast({
          title: "GPS com Baixa Precisão",
          description: "Recomendamos calibrar o GPS para melhor precisão",
          variant: "destructive",
          duration: 5000
        });
      }

    } catch (error: any) {
      setValidationResult({
        valid: false,
        message: error.message || 'Erro ao validar localização'
      });
      setCanRegister(false);
    } finally {
      setIsValidating(false);
    }
  }, [allowedLocations, validateGPSQuality, toast]);

  // Função para calibrar GPS para local atual
  const calibrateForCurrentLocation = useCallback(async () => {
    if (!validationResult?.closestLocation) {
      toast({
        title: "Erro",
        description: "Nenhum local identificado para calibração",
        variant: "destructive"
      });
      return;
    }

    setCalibration(prev => ({
      ...prev,
      isCalibrating: true,
      calibrationProgress: 0,
      currentLocation: validationResult.closestLocation
    }));

    try {
      toast({
        title: 'Calibrando GPS',
        description: 'Coletando amostras para maior precisão...',
        duration: 3000
      });

      const result = await UnifiedLocationSystem.calibrateForLocation(
        validationResult.closestLocation.id,
        validationResult.closestLocation.name
      );

      if (result.success) {
        toast({
          title: 'Calibração Concluída',
          description: result.message,
          duration: 4000
        });

        // Revalidar após calibração
        setTimeout(validateLocation, 1000);
      } else {
        toast({
          title: 'Erro na Calibração',
          description: result.message,
          variant: 'destructive'
        });
      }

    } catch (error: any) {
      toast({
        title: 'Erro na Calibração',
        description: error.message || 'Falha ao calibrar GPS',
        variant: 'destructive'
      });
    } finally {
      setCalibration(prev => ({
        ...prev,
        isCalibrating: false,
        calibrationProgress: 0
      }));
    }
  }, [validationResult, validateLocation, toast]);

  // Função para atualizar localização
  const refreshLocation = useCallback(async () => {
    try {
      await validateLocation();
    } catch (error: any) {
      setError(error.message);
    }
  }, [validateLocation]);

  // Função para limpar calibração
  const clearCalibration = useCallback((locationId: string) => {
    UnifiedLocationSystem.clearCache();
    toast({
      title: 'Cache Limpo',
      description: 'Calibrações e cache foram limpos',
      duration: 2000
    });
  }, [toast]);

  // Atualizar estatísticas de debug
  const updateDebugStats = useCallback(() => {
    const stats = UnifiedLocationSystem.getSystemStats();
    setDebug(stats);
  }, []);

  // Inicializar localização e validação
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        await validateLocation();
        updateDebugStats();
      } catch (error: any) {
        setError(error.message);
      }
    };

    if (allowedLocations.length > 0) {
      initializeLocation();
    }
  }, [allowedLocations, validateLocation, updateDebugStats]);

  // Auto-validar quando localização mudar
  useEffect(() => {
    if (autoValidate && location && allowedLocations.length > 0) {
      validateLocation();
    }
  }, [location, allowedLocations, autoValidate, validateLocation]);

  // Atualizar estatísticas periodicamente
  useEffect(() => {
    const interval = setInterval(updateDebugStats, 10000); // A cada 10 segundos
    return () => clearInterval(interval);
  }, [updateDebugStats]);

  return {
    location,
    loading,
    error,
    validationResult,
    isValidating,
    canRegister,
    calibration,
    validateLocation,
    calibrateForCurrentLocation,
    refreshLocation,
    clearCalibration,
    gpsQuality,
    debug
  };
}; 