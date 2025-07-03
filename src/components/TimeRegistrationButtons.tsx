
import React from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Compass } from 'lucide-react';
import { CooldownDisplay } from './CooldownDisplay';
import { MobileWorkerControls } from './MobileWorkerControls';
import { useEnhancedLocation } from '@/hooks/useEnhancedLocation';

interface AllowedButtons {
  clock_in: boolean;
  lunch_start: boolean;
  lunch_end: boolean;
  clock_out: boolean;
}

interface TimeRegistrationButtonsProps {
  nextAction: string | null;
  onTimeAction: (action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => void;
  isRegistrationButtonDisabled: boolean;
  submitting: boolean;
  shiftValidation: {
    allowedButtons: AllowedButtons;
    timeUntilNext?: number;
  };
  remainingCooldown: number | null;
  formatRemainingTime: (ms: number) => string;
  mobileWorkerLocation?: {
    canRegister: boolean;
    currentLocation: { name: string } | null;
    hasLocationChanged: boolean;
    previousLocationName: string | null;
    validationMessage: string;
    needsCalibration: boolean;
    isCalibrating: boolean;
    isValidating: boolean;
    validateLocation: () => void;
    calibrateForLocation: () => void;
  };
}

export const TimeRegistrationButtons: React.FC<TimeRegistrationButtonsProps> = ({
  nextAction,
  onTimeAction,
  isRegistrationButtonDisabled,
  submitting,
  shiftValidation,
  remainingCooldown,
  formatRemainingTime,
  mobileWorkerLocation
}) => {
  const { startCalibration, calibration } = useEnhancedLocation();

  const handleCalibrateGPS = async () => {
    try {
      if (mobileWorkerLocation?.currentLocation) {
        // Usar calibração contextual se funcionário móvel está ativo
        await mobileWorkerLocation.calibrateForLocation();
      } else {
        // Usar calibração padrão
        await startCalibration();
      }
    } catch (error) {
      console.error('Erro na calibração:', error);
    }
  };

  if (!nextAction) return null;

  const isAllowedByShift = shiftValidation.allowedButtons[nextAction as keyof AllowedButtons];
  const canRegisterAtCurrentLocation = !mobileWorkerLocation || mobileWorkerLocation.canRegister;

  return (
    <>
      {/* Controles específicos para funcionário móvel */}
      {mobileWorkerLocation && (
        <MobileWorkerControls
          canRegister={mobileWorkerLocation.canRegister}
          currentLocation={mobileWorkerLocation.currentLocation?.name || null}
          hasLocationChanged={mobileWorkerLocation.hasLocationChanged}
          previousLocationName={mobileWorkerLocation.previousLocationName}
          validationMessage={mobileWorkerLocation.validationMessage}
          needsCalibration={mobileWorkerLocation.needsCalibration}
          isCalibrating={mobileWorkerLocation.isCalibrating}
          isValidating={mobileWorkerLocation.isValidating}
          onCalibrateForLocation={mobileWorkerLocation.calibrateForLocation}
          onValidateLocation={mobileWorkerLocation.validateLocation}
        />
      )}

      {/* Botão principal de registro */}
      <Button
        onClick={() => onTimeAction(nextAction as 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out')}
        disabled={isRegistrationButtonDisabled || !canRegisterAtCurrentLocation}
        className={`w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation ${
          isAllowedByShift && canRegisterAtCurrentLocation
            ? 'bg-[#10C6B4] hover:bg-[#10C6B4]/90 text-white'
            : 'bg-yellow-500 hover:bg-yellow-600 text-white'
        }`}
      >
        <Clock className="w-5 h-5 mr-2" />
        {submitting ? 'Registrando...' : 
         !isAllowedByShift ? 'Fora do Horário' :
         !canRegisterAtCurrentLocation ? 'Local não autorizado' :
         'Registrar'}
      </Button>

      {/* Botão de calibração GPS padrão (apenas se não há funcionário móvel ativo) */}
      {!mobileWorkerLocation && (
        <Button
          onClick={handleCalibrateGPS}
          disabled={calibration.isCalibrating}
          variant="outline"
          className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation mt-3"
        >
          <Compass className="w-5 h-5 mr-2" />
          {calibration.isCalibrating ? 'Calibrando GPS...' : 'Calibrar GPS'}
        </Button>
      )}
      
      <CooldownDisplay 
        remainingCooldown={remainingCooldown}
        formatRemainingTime={formatRemainingTime}
      />

      {nextAction && !isAllowedByShift && shiftValidation.timeUntilNext !== undefined && shiftValidation.timeUntilNext > 0 && (
        <div className="text-center text-sm text-yellow-600 mt-2">
          Registro disponível em {shiftValidation.timeUntilNext} minutos
        </div>
      )}

      {/* Alerta para localização não autorizada */}
      {mobileWorkerLocation && !mobileWorkerLocation.canRegister && (
        <div className="text-center text-sm text-red-600 mt-2 p-2 bg-red-50 rounded">
          {mobileWorkerLocation.hasLocationChanged 
            ? 'Mudança de local detectada - valide sua localização'
            : 'Você precisa estar em um local autorizado para registrar'
          }
        </div>
      )}
    </>
  );
};
