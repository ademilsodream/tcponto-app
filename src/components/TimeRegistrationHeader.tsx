
import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimeRegistrationHeaderProps {
  currentTime: Date;
}

export const TimeRegistrationHeader: React.FC<TimeRegistrationHeaderProps> = ({
  currentTime
}) => {
  return (
    <div className="text-center mb-6">
      <div className="text-gray-600 text-base sm:text-lg mb-2">
        {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      </div>
      <div className="text-gray-900 text-4xl sm:text-6xl font-bold tracking-wider mb-4">
        {format(currentTime, 'HH:mm:ss')}
      </div>
    </div>
  );
};
