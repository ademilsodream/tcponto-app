
import React from 'react';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { CooldownDisplay } from './CooldownDisplay';

interface TimeRegistrationButtonsProps {
  nextAction: string | null;
  onTimeAction: (action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => void;
  isRegistrationButtonDisabled: boolean;
  submitting: boolean;
  shiftValidation: {
    allowedButtons: Record<string, boolean>;
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
  if (!nextAction) return null;

  const isAllowedByShift = shiftValidation.allowedButtons[nextAction as keyof typeof shiftValidation.allowedButtons];

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
