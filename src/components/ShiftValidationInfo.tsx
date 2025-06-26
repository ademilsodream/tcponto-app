
import React from 'react';
import { Timer } from 'lucide-react';

interface ShiftValidationInfoProps {
  currentShiftMessage?: string;
  nextButtonAvailable?: boolean;
  timeUntilNext?: number;
}

export const ShiftValidationInfo: React.FC<ShiftValidationInfoProps> = ({
  currentShiftMessage,
  nextButtonAvailable,
  timeUntilNext
}) => {
  if (!currentShiftMessage) return null;

  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2 text-blue-700 text-sm">
        <Timer className="w-4 h-4" />
        <span>{currentShiftMessage}</span>
      </div>
      {nextButtonAvailable && timeUntilNext !== undefined && timeUntilNext > 0 && (
        <div className="text-xs text-blue-600 mt-1">
          Próximo registro em {timeUntilNext} minutos
        </div>
      )}
    </div>
  );
};
