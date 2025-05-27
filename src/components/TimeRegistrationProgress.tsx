
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LogIn, Coffee, LogOut, CheckCircle, Clock } from 'lucide-react';

interface TimeRegistrationProgressProps {
  record: {
    clockIn?: string;
    lunchStart?: string;
    lunchEnd?: string;
    clockOut?: string;
  };
}

const TimeRegistrationProgress: React.FC<TimeRegistrationProgressProps> = ({ record }) => {
  const steps = [
    { key: 'clockIn', label: 'Entrada', icon: LogIn, color: 'bg-green-500' },
    { key: 'lunchStart', label: 'Início Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'lunchEnd', label: 'Fim Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'clockOut', label: 'Saída', icon: LogOut, color: 'bg-red-500' },
  ];

  const completedCount = steps.filter(step => record[step.key as keyof typeof record]).length;
  const isComplete = completedCount === 4;

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">Progresso do Dia</h3>
          <div className="flex items-center gap-1">
            {isComplete ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <Clock className="w-4 h-4 text-amber-600" />
            )}
            <span className={`text-sm font-medium ${isComplete ? 'text-green-600' : 'text-amber-600'}`}>
              {completedCount}/4 registros
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = !!record[step.key as keyof typeof record];
            const isNext = !isCompleted && completedCount === index;

            return (
              <div key={step.key} className="flex flex-col items-center flex-1">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all duration-200 ${
                    isCompleted 
                      ? `${step.color} text-white shadow-md` 
                      : isNext
                        ? 'bg-gray-200 border-2 border-blue-400 text-gray-600'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-xs text-center leading-tight ${
                  isCompleted ? 'text-gray-900 font-medium' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
                {isCompleted && (
                  <span className="text-xs text-gray-600 mt-1">
                    {record[step.key as keyof typeof record]}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Barra de progresso */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / 4) * 100}%` }}
            />
          </div>
        </div>

        {isComplete && (
          <div className="mt-3 text-center">
            <span className="text-sm text-green-600 font-medium">
              ✅ Todos os registros do dia foram concluídos!
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeRegistrationProgress;
