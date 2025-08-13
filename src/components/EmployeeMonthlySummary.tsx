
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, Briefcase, Clock9, AlarmClock, Utensils, Coffee, DollarSign } from 'lucide-react';
import { format, isSameMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { Progress } from '@/components/ui/progress';

interface MonthlySummary {
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  totalPay: number;
  normalPay: number;
  overtimePay: number;
  workingDays: number;
  lunchHours: number; // novo
  plannedHours: number; // novo
}

interface EmployeeMonthlySummaryProps {
  selectedMonth: Date;
  onBack?: () => void;
}

// Função para formatar horas no padrão HH:MM
const formatHoursAsTime = (hours: number) => {
  if (typeof hours !== 'number' || isNaN(hours) || hours < 0) {
    return '00:00';
  }

  const totalMinutes = Math.round(hours * 60);
  const hoursDisplay = Math.floor(totalMinutes / 60);
  const minutesDisplay = totalMinutes % 60;

  return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
};

// Gerar lista de meses para o seletor
const generateMonths = () => {
  const months = [] as { value: number; label: string }[];
  for (let i = 0; i < 12; i++) {
    const date = new Date(2024, i, 1);
    months.push({ value: i, label: format(date, 'MMMM', { locale: ptBR }) });
  }
  return months;
};

// Gerar lista de anos (últimos 5 anos)
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [] as { value: number; label: string }[];
  for (let i = 0; i < 5; i++) {
    const year = currentYear - i;
    years.push({ value: year, label: year.toString() });
  }
  return years;
};

// Contar dias úteis (seg-sex) entre duas datas, inclusivo
const countBusinessDays = (start: Date, end: Date) => {
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (d <= last) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
};

const EmployeeMonthlySummary: React.FC<EmployeeMonthlySummaryProps> = ({ selectedMonth: initialMonth }) => {
  // Estado interno para período selecionado
  const [selectedYear, setSelectedYear] = useState(initialMonth.getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(initialMonth.getMonth());
  
  const [summary, setSummary] = useState<MonthlySummary>({
    totalHours: 0,
    normalHours: 0,
    overtimeHours: 0,
    totalPay: 0,
    normalPay: 0,
    overtimePay: 0,
    workingDays: 0,
    lunchHours: 0,
    plannedHours: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const { formatCurrency } = useCurrency();
  const { user } = useOptimizedAuth();

  // Data base do período selecionado (primeiro dia do mês)
  const baseDate = new Date(selectedYear, selectedMonthIndex, 1);

  // Carregar perfil do usuário primeiro
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  // Recarregar resumo quando período muda
  useEffect(() => {
    if (user && profileLoaded) {
      loadMonthlySummary();
    }
  }, [selectedYear, selectedMonthIndex, user, profileLoaded, hourlyRate]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', user.id)
        .single();

      const rate = Number(data?.hourly_rate);
      setHourlyRate(!isNaN(rate) ? rate : 50);
    } catch {
      setHourlyRate(50);
    } finally {
      setProfileLoaded(true);
    }
  };

  // Auxiliar para somar almoço do dia
  const getLunchHours = (lunchStart?: string, lunchEnd?: string) => {
    if (!lunchStart || !lunchEnd) return 0;
    const [sh, sm] = lunchStart.split(':').map(Number);
    const [eh, em] = lunchEnd.split(':').map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(0, minutes) / 60;
  };

  const loadMonthlySummary = async () => {
    if (!user || !profileLoaded) return;

    setLoading(true);
    try {
      const periodStart = new Date(selectedYear, selectedMonthIndex, 1);
      const periodEnd = endOfMonth(periodStart);

      const startDate = format(periodStart, 'yyyy-MM-01');
      const endDate = format(periodEnd, 'yyyy-MM-dd');

      const { data: records } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'active');

      // Calcular horas previstas: 8h por dia útil do primeiro dia do mês até hoje (se for mês atual) ou até o fim do mês se passado/futuro limitado
      const today = new Date();
      const untilDate = isSameMonth(today, periodStart) ? today : periodEnd;
      const businessDays = countBusinessDays(periodStart, untilDate);
      const plannedHours = businessDays * 8; // 8h/dia útil

      const initial = {
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        totalPay: 0,
        normalPay: 0,
        overtimePay: 0,
        workingDays: 0,
        lunchHours: 0,
        plannedHours,
      } as MonthlySummary;

      const result = (records || []).reduce((acc, record) => {
        const { totalHours, normalHours, overtimeHours } = calculateWorkingHours(
          record.clock_in || '',
          record.lunch_start || '',
          record.lunch_end || '',
          record.clock_out || ''
        );

        const lunch = getLunchHours(record.lunch_start, record.lunch_end);
        const hasWorked = totalHours > 0;

        return {
          ...acc,
          totalHours: acc.totalHours + totalHours,
          normalHours: acc.normalHours + normalHours,
          overtimeHours: acc.overtimeHours + overtimeHours,
          workingDays: acc.workingDays + (hasWorked ? 1 : 0),
          lunchHours: acc.lunchHours + lunch,
        };
      }, initial);

      setSummary(result);
    } catch (error) {
      console.error('Error loading monthly summary:', error);
      setSummary(prev => ({ ...prev, totalHours: 0, normalHours: 0, overtimeHours: 0, workingDays: 0, lunchHours: 0 }));
    } finally {
      setLoading(false);
    }
  };

  // Navegação rápida entre meses
  const goToPreviousMonth = () => {
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonthIndex(selectedMonthIndex - 1);
    }
  };

  const goToNextMonth = () => {
    const currentDate = new Date();
    const nextMonth = selectedMonthIndex === 11 ? 0 : selectedMonthIndex + 1;
    const nextYear = selectedMonthIndex === 11 ? selectedYear + 1 : selectedYear;
    if (nextYear > currentDate.getFullYear() || (nextYear === currentDate.getFullYear() && nextMonth > currentDate.getMonth())) return;
    setSelectedMonthIndex(nextMonth);
    setSelectedYear(nextYear);
  };

  const canGoToNextMonth = () => {
    const currentDate = new Date();
    const nextMonth = selectedMonthIndex === 11 ? 0 : selectedMonthIndex + 1;
    const nextYear = selectedMonthIndex === 11 ? selectedYear + 1 : selectedYear;
    return !(nextYear > currentDate.getFullYear() || (nextYear === currentDate.getFullYear() && nextMonth > currentDate.getMonth()));
  };

  if (loading || !profileLoaded) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-600">
          <div className="flex items-center justify-center mb-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
          </div>
          Carregando resumo mensal...
        </CardContent>
      </Card>
    );
  }

  const months = generateMonths();
  const years = generateYears();

  const progress = Math.min(100, Math.round((summary.totalHours / Math.max(1, summary.plannedHours)) * 100));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Resumo Mensal</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Controles de período */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth} className="h-10 w-10 p-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 flex-1">
              <Select value={selectedMonthIndex.toString()} onValueChange={(v) => setSelectedMonthIndex(parseInt(v))}>
                <SelectTrigger className="h-10 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.value} value={m.value.toString()} className="text-base">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="h-10 w-20 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y.value} value={y.value.toString()} className="text-base">{y.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={goToNextMonth} disabled={!canGoToNextMonth()} className="h-10 w-10 p-0">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="text-base text-gray-600 text-center">{format(baseDate, 'MMMM yyyy', { locale: ptBR })}</div>
        </div>

        {/* Barra de progresso Trabalhadas vs Previstas */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between text-base text-gray-700 mb-2">
            <span className="font-medium">Progresso do mês</span>
            <span className="font-bold">{formatHoursAsTime(summary.totalHours)} / {formatHoursAsTime(summary.plannedHours)}</span>
          </div>
          <Progress value={progress} className="h-4" />
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-xl shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-medium">Dias trabalhados</p>
                <p className="text-2xl font-bold text-gray-900">{summary.workingDays}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-50 text-green-600">
                <Clock9 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-medium">Horas trabalhadas</p>
                <p className="text-2xl font-bold text-gray-900">{formatHoursAsTime(summary.totalHours)}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                <AlarmClock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-medium">Horas previstas</p>
                <p className="text-2xl font-bold text-gray-900">{formatHoursAsTime(summary.plannedHours)}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-orange-50 text-orange-600">
                <AlarmClock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-medium">Horas extras</p>
                <p className="text-2xl font-bold text-gray-900">{formatHoursAsTime(summary.overtimeHours)}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                <Coffee className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-medium">Horas de almoço</p>
                <p className="text-2xl font-bold text-gray-900">{formatHoursAsTime(summary.lunchHours)}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-medium">Total a receber</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalPay)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detalhamento de valores */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Detalhamento de Valores</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-base text-gray-700">Horas normais ({formatHoursAsTime(summary.normalHours)})</span>
              <span className="text-base font-semibold text-gray-900">{formatCurrency(summary.normalPay)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-base text-gray-700">Horas extras ({formatHoursAsTime(summary.overtimeHours)})</span>
              <span className="text-base font-semibold text-orange-600">{formatCurrency(summary.overtimePay)}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-3">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalPay)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeMonthlySummary;
