
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
  let effectiveWorkedMinutes = totalWorkedMinutes;

  // Aplicar tolerância de 15 minutos apenas se for exatamente 15 minutos ou menos
  const extraMinutes = totalWorkedMinutes - 480; // 480 = 8 horas em minutos
  if (extraMinutes > 0 && extraMinutes <= 15) {
    // Se tiver entre 1 e 15 minutos extras, considerar como 8 horas exatas
    effectiveWorkedMinutes = 480;
  }

  const totalHours = effectiveWorkedMinutes / 60;

  // Calcular horas normais e extras
  let normalHours = Math.min(totalHours, 8);
  let overtimeHours = 0;

  if (totalHours > 8) {
    overtimeHours = totalHours - 8;
    normalHours = 8;
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

export const calculateMonthlyStats = (
  timeRecords: Array<{
    date: string;
    totalHours: number;
    normalHours: number;
    overtimeHours: number;
    totalPay: number;
    clockIn?: string;
    clockOut?: string;
  }>,
  workDaysInMonth: number,
  hourlyRate: number
) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthRecords = timeRecords.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
  });

  // Calcular dias com registro válido (que têm entrada e saída)
  const daysWithRecords = monthRecords.filter(record => 
    record.clockIn && record.clockOut
  ).length;

  // Calcular faltas (dias úteis sem registro)
  const absentDays = Math.max(0, workDaysInMonth - daysWithRecords);
  
  // Somar horas trabalhadas
  const totalWorkedHours = monthRecords.reduce((sum, record) => sum + record.totalHours, 0);
  const totalNormalHours = monthRecords.reduce((sum, record) => sum + record.normalHours, 0);
  const totalOvertimeHours = monthRecords.reduce((sum, record) => sum + record.overtimeHours, 0);
  
  // Subtrair 8 horas por cada dia de falta
  const hoursLostToAbsence = absentDays * 8;
  const effectiveTotalHours = Math.max(0, totalWorkedHours - hoursLostToAbsence);
  const effectiveNormalHours = Math.max(0, totalNormalHours - hoursLostToAbsence);
  
  // Calcular pagamento (descontando faltas)
  const totalWorkedPay = monthRecords.reduce((sum, record) => sum + record.totalPay, 0);
  const absenceDeduction = absentDays * 8 * hourlyRate;
  const effectiveTotalPay = Math.max(0, totalWorkedPay - absenceDeduction);

  return {
    totalHours: effectiveTotalHours,
    totalOvertimeHours,
    totalPay: effectiveTotalPay,
    absentDays,
    daysWithRecords,
    absenceDeduction
  };
};

