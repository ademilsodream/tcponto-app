
// Utilitário para gerenciar dias úteis e fins de semana
export const isWeekend = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Domingo, 6 = Sábado
};

export const isWorkingDay = (date: Date): boolean => {
  return !isWeekend(date);
};

export const getWorkingDaysInPeriod = (startDate: string, endDate: string): string[] => {
  const workingDays: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (isWorkingDay(date)) {
      workingDays.push(date.toISOString().split('T')[0]);
    }
  }
  
  return workingDays;
};

export const getWorkingDaysInMonth = (year: number, month: number): string[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  return getWorkingDaysInPeriod(
    firstDay.toISOString().split('T')[0],
    lastDay.toISOString().split('T')[0]
  );
};

export const shouldShowDayInReport = async (dateString: string, userId: string, supabase: any): Promise<boolean> => {
  const date = new Date(dateString + 'T00:00:00');
  
  // Se é dia útil, sempre mostrar
  if (isWorkingDay(date)) {
    return true;
  }
  
  // Se é fim de semana, só mostrar se há registros
  try {
    const { data, error } = await supabase
      .from('time_records')
      .select('id')
      .eq('user_id', userId)
      .eq('date', dateString)
      .eq('status', 'active')
      .limit(1);

    if (error) {
      console.error('Erro ao verificar registros do fim de semana:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Erro ao verificar registros do fim de semana:', error);
    return false;
  }
};
