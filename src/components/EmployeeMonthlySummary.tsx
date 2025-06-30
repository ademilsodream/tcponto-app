
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';

interface MonthlySummary {
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  totalPay: number;
  normalPay: number;
  overtimePay: number;
  workingDays: number;
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
  const months = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(2024, i, 1);
    months.push({
      value: i,
      label: format(date, 'MMMM', { locale: ptBR })
    });
  }
  return months;
};

// Gerar lista de anos (últimos 5 anos)
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i < 5; i++) {
    const year = currentYear - i;
    years.push({
      value: year,
      label: year.toString()
    });
  }
  return years;
};

const EmployeeMonthlySummary: React.FC<EmployeeMonthlySummaryProps> = ({
  selectedMonth: initialMonth,
  onBack
}) => {
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
    workingDays: 0
  });
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const { formatCurrency } = useCurrency();
  const { user } = useOptimizedAuth();

  // Criar data atual baseada na seleção
  const currentSelectedDate = new Date(selectedYear, selectedMonthIndex, 1);

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
      const { data, error } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
      }

      if (data) {
        const rate = Number(data.hourly_rate);
        if (!isNaN(rate)) {
           setHourlyRate(rate);
        } else {
           console.warn('Hourly rate inválido no perfil, usando valor padrão.');
           setHourlyRate(50);
        }
      } else {
         console.warn('Perfil do usuário não encontrado ou sem hourly_rate.');
         setHourlyRate(50);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setHourlyRate(50);
    } finally {
      setProfileLoaded(true);
    }
  };

  // Função para calcular valores
  const calculatePay = (normalHours: number, overtimeHours: number, rate: number) => {
    const normalPay = normalHours * rate;
    const overtimePay = overtimeHours * rate;

    const validNormalPay = typeof normalPay === 'number' && !isNaN(normalPay) ? normalPay : 0;
    const validOvertimePay = typeof overtimePay === 'number' && !isNaN(overtimePay) ? overtimePay : 0;

    const totalPay = validNormalPay + validOvertimePay;

    return { normalPay: validNormalPay, overtimePay: validOvertimePay, totalPay };
  };

  const loadMonthlySummary = async () => {
    if (!user || !profileLoaded) return;

    setLoading(true);
    try {
      const startDate = format(currentSelectedDate, 'yyyy-MM-01');
      const endDate = format(new Date(selectedYear, selectedMonthIndex + 1, 0), 'yyyy-MM-dd');

      const { data: records, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'active');

      if (error) {
         console.error('Erro ao carregar registros de ponto:', error);
         throw error;
      }

      const summary = records.reduce((acc, record) => {
        const { totalHours, normalHours, overtimeHours } = calculateWorkingHours(
          record.clock_in || '',
          record.lunch_start || '',
          record.lunch_end || '',
          record.clock_out || ''
        );

        const { normalPay, overtimePay, totalPay } = calculatePay(
          normalHours,
          overtimeHours,
          hourlyRate
        );

        return {
          totalHours: acc.totalHours + totalHours,
          normalHours: acc.normalHours + normalHours,
          overtimeHours: acc.overtimeHours + overtimeHours,
          totalPay: acc.totalPay + totalPay,
          normalPay: acc.normalPay + normalPay,
          overtimePay: acc.overtimePay + overtimePay,
          workingDays: acc.workingDays + (totalHours > 0 ? 1 : 0)
        };
      }, {
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        totalPay: 0,
        normalPay: 0,
        overtimePay: 0,
        workingDays: 0
      });

      setSummary(summary);
    } catch (error) {
      console.error('Error loading monthly summary:', error);
      setSummary({
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        totalPay: 0,
        normalPay: 0,
        overtimePay: 0,
        workingDays: 0
      });
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
    
    // Não permitir ir para meses futuros
    if (nextYear > currentDate.getFullYear() || 
        (nextYear === currentDate.getFullYear() && nextMonth > currentDate.getMonth())) {
      return;
    }

    setSelectedMonthIndex(nextMonth);
    setSelectedYear(nextYear);
  };

  // Verificar se pode ir para o próximo mês
  const canGoToNextMonth = () => {
    const currentDate = new Date();
    const nextMonth = selectedMonthIndex === 11 ? 0 : selectedMonthIndex + 1;
    const nextYear = selectedMonthIndex === 11 ? selectedYear + 1 : selectedYear;
    
    return !(nextYear > currentDate.getFullYear() || 
             (nextYear === currentDate.getFullYear() && nextMonth > currentDate.getMonth()));
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

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 shadow-lg border-none">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-primary-800 flex items-center gap-2 text-lg sm:text-xl">
            <Calendar className="w-5 h-5 text-primary-600" />
            Resumo Mensal
          </CardTitle>
        </div>
        
        {/* Controles de navegação de período */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {/* Navegação rápida */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              disabled={!canGoToNextMonth()}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Seletores de mês e ano */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Select
              value={selectedMonthIndex.toString()}
              onValueChange={(value) => setSelectedMonthIndex(parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.value} value={year.value.toString()}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mostrar período selecionado */}
        <div className="text-sm text-gray-600 mt-2">
          {format(currentSelectedDate, 'MMMM yyyy', { locale: ptBR })}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-center">
          {/* Dias Trabalhados */}
          <div className="flex flex-col items-center justify-center p-2 bg-white rounded-md shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase">Dias Trabalhados</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">
              {summary.workingDays}
            </p>
          </div>

          {/* Horas Normais */}
          <div className="flex flex-col items-center justify-center p-2 bg-white rounded-md shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase">Horas Normais</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatHoursAsTime(summary.normalHours)}
            </p>
          </div>

          {/* Horas Extras */}
          <div className="flex flex-col items-center justify-center p-2 bg-white rounded-md shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase">Horas Extras</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {formatHoursAsTime(summary.overtimeHours)}
            </p>
          </div>

          {/* Total */}
          <div className="flex flex-col items-center justify-center p-2 bg-white rounded-md shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase">Total</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">
              {formatHoursAsTime(summary.totalHours)}h
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeMonthlySummary;
