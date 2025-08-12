
import React from 'react';
import { LogIn, Coffee, LogOut } from 'lucide-react';

export type TimeRecordKey = 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';

interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  normal_hours?: number;
  overtime_hours?: number;
  normal_pay?: number;
  overtime_pay?: number;
  total_pay?: number;
  locations?: any;
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_pending_approval?: boolean;
  approved_by?: string;
  approved_at?: string;
}

interface TimeRegistrationProgressProps {
  timeRecord: TimeRecord | null;
  onEditRequest?: (field: TimeRecordKey, value: string) => void; // opcional e não usado
}

const steps = [
  { key: 'clock_in' as TimeRecordKey, label: 'Entrada', icon: LogIn, color: 'bg-green-500' },
  { key: 'lunch_start' as TimeRecordKey, label: 'Início Almoço', icon: Coffee, color: 'bg-orange-500' },
  { key: 'lunch_end' as TimeRecordKey, label: 'Volta Almoço', icon: Coffee, color: 'bg-orange-500' },
  { key: 'clock_out' as TimeRecordKey, label: 'Saída', icon: LogOut, color: 'bg-red-500' },
];

export const TimeRegistrationProgress: React.FC<TimeRegistrationProgressProps> = ({ timeRecord }) => {
  const getValue = (key: TimeRecordKey) => timeRecord?.[key];
  const completedCount = steps.filter(step => getValue(step.key)).length;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = !!getValue(step.key);
          const isNext = !isCompleted && completedCount === index;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 transition-all ${
                  isCompleted ? `${step.color} text-white` : isNext ? 'bg-blue-100 border-2 border-blue-600 text-blue-600' : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className={`text-xs text-center ${isCompleted ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{step.label}</span>
              {isCompleted && (
                <span className="text-xs text-blue-600 mt-1 font-medium">{getValue(step.key)}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{
            width: `${(completedCount / 4) * 100}%`,
            background: completedCount > 0 ? 'linear-gradient(to right, #22c55e, #f97316, #f97316, #ef4444)' : '#3b82f6',
          }}
        />
      </div>
    </div>
  );
};
