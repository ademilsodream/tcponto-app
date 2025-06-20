
import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimeDisplayProps {
  currentTime: Date;
  greeting: string;
  userDisplayName: string;
  currentShiftMessage?: string;
}

export const TimeDisplay: React.FC<TimeDisplayProps> = ({
  currentTime,
  greeting,
  userDisplayName,
  currentShiftMessage
}) => {
  return (
    <>
      <div className="text-center mb-4">
        <div className="text-blue-600 text-xl sm:text-2xl font-semibold mb-1">
          {greeting}, {userDisplayName}! 👋
        </div>
        <div className="text-gray-500 text-sm sm:text-base">
          Pronto para registrar seu ponto?
        </div>
        {currentShiftMessage && (
          <div className="text-xs text-blue-600 mt-1 bg-blue-50 p-2 rounded">
            {currentShiftMessage}
          </div>
        )}
      </div>

      <div className="text-center mb-6">
        <div className="text-gray-600 text-base sm:text-lg mb-2">
          {format(currentTime, "EEEE, dd 'de' MMMM")}
        </div>
        <div className="text-gray-900 text-4xl sm:text-6xl font-bold tracking-wider mb-4">
          {format(currentTime, 'HH:mm:ss')}
        </div>
      </div>
    </>
  );
};
