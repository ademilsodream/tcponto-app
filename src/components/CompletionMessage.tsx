
import React from 'react';

export const CompletionMessage: React.FC = () => {
  return (
    <div className="text-center py-4">
      <div className="text-green-600 font-semibold mb-2">
        ✅ Todos os registros concluídos!
      </div>
      <div className="text-sm text-gray-500">
        Tenha um ótimo resto do dia!
      </div>
    </div>
  );
};
