
import React from 'react';

interface CooldownDisplayProps {
  remainingCooldown: number | null;
  formatRemainingTime: (ms: number) => string;
}

export const CooldownDisplay: React.FC<CooldownDisplayProps> = ({
  remainingCooldown,
  formatRemainingTime
}) => {
  if (remainingCooldown === null || remainingCooldown <= 0) return null;

  return (
    <div className="text-center text-sm text-gray-600 mt-2">
      Próximo registro disponível em: {formatRemainingTime(remainingCooldown)}
    </div>
  );
};
