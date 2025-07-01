
import React from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Compass } from 'lucide-react';
import { CooldownDisplay } from './CooldownDisplay';
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
}

export const TimeRegistrationButtons: React.FC<TimeRegistrationButtonsProps> = ({
  nextAction,
  onTimeAction,
  isRegistrationButtonDisabled,
  submitting,
  shiftValidation,
  remainingCooldown,
  formatRemainingTime
}) => {
  const { startCalibration, calibration } = useEnhancedLocation();

  const handleCalibrateGPS = async () => {
    try {
      await startCalibration();
    } catch (error) {
      console.error('Erro na calibração:', error);
    }
  };

  if (!nextAction) return null;

  const isAllowedByShift = shiftValidation.allowedButtons[nextAction as keyof AllowedButtons];

  return (
    <>
      <Button
        onClick={() => onTimeAction(nextAction as 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out')}
        disabled={isRegistrationButtonDisabled}
        className={`w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation ${
          isAllowedByShift
            ? 'bg-[#10C6B4] hover:bg-[#10C6B4]/90 text-white'
            : 'bg-yellow-500 hover:bg-yellow-600 text-white'
        }`}
      >
        <Clock className="w-5 h-5 mr-2" />
        {submitting ? 'Registrando...' : 
         !isAllowedByShift ? 'Fora do Horário' :
         'Registrar'}
      </Button>

      <Button
        onClick={handleCalibrateGPS}
        disabled={calibration.isCalibrating}
        variant="outline"
        className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation mt-3"
      >
        <Compass className="w-5 h-5 mr-2" />
        {calibration.isCalibrating ? 'Calibrando GPS...' : 'Calibrar GPS'}
      </Button>
      
      <CooldownDisplay 
        remainingCooldown={remainingCooldown}
        formatRemainingTime={formatRemainingTime}
      />

      {nextAction && !isAllowedByShift && shiftValidation.timeUntilNext !== undefined && shiftValidation.timeUntilNext > 0 && (
        <div className="text-center text-sm text-yellow-600 mt-2">
          Registro disponível em {shiftValidation.timeUntilNext} minutos
        </div>
      )}
    </>
  );
};
