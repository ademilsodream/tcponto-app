
export const calculateWorkingHours = (
  clockIn?: string,
  lunchStart?: string,
  lunchEnd?: string,
  clockOut?: string
) => {
  if (!clockIn || !clockOut) {
    return {
      totalHours: 0,
      normalHours: 0,
      overtimeHours: 0
    };
  }

  // Converter strings de tempo para minutos
  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const clockInMinutes = parseTime(clockIn);
  const clockOutMinutes = parseTime(clockOut);
  
  // Calcular intervalo de almoço
  let lunchBreakMinutes = 0;
  if (lunchStart && lunchEnd) {
    const lunchStartMinutes = parseTime(lunchStart);
    const lunchEndMinutes = parseTime(lunchEnd);
    lunchBreakMinutes = lunchEndMinutes - lunchStartMinutes;
  }

  // Total de minutos trabalhados
  const totalWorkedMinutes = clockOutMinutes - clockInMinutes - lunchBreakMinutes;
  const totalHours = totalWorkedMinutes / 60;

  // 8 horas = 480 minutos
  const standardWorkMinutes = 480;
  
  // Calcular horas normais e extras
  let normalHours = Math.min(totalHours, 8);
  let overtimeHours = 0;

  // Só conta como hora extra se ultrapassar 8h15min (495 minutos)
  if (totalWorkedMinutes > standardWorkMinutes + 15) {
    overtimeHours = (totalWorkedMinutes - standardWorkMinutes - 15) / 60;
    normalHours = 8; // Máximo de 8 horas normais
  }

  return {
    totalHours: Math.max(0, totalHours),
    normalHours: Math.max(0, normalHours),
    overtimeHours: Math.max(0, overtimeHours)
  };
};

export const calculateDayHours = (
  workStart: string,
  lunchStart: string,
  lunchEnd: string,
  workEnd: string
) => {
  return calculateWorkingHours(workStart, lunchStart, lunchEnd, workEnd);
};

export const calculatePay = (
  normalHours: number,
  overtimeHours: number,
  hourlyRate: number,
  overtimeRate: number
) => {
  const normalPay = normalHours * hourlyRate;
  const overtimePay = overtimeHours * overtimeRate;
  const totalPay = normalPay + overtimePay;

  return {
    normalPay,
    overtimePay,
    totalPay
  };
};
