import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Clock, DollarSign, ChevronDown, ChevronUp, CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { isWorkingDay } from '@/utils/workingDays';

// Adicionado: Importar componentes necessários para seletores de data individuais
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils'; // Importar cn para classes condicionais


interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  normal_hours: number;
  overtime_hours: number;
  normal_pay: number;
  overtime_pay: number;
  total_pay: number;
  isWeekend?: boolean;
}


interface EmployeeDetailedReportProps {
  selectedMonth: Date; // Esta prop não está sendo usada, mas mantida se for relevante para o componente pai
  onBack: () => void;
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


const EmployeeDetailedReport: React.FC<EmployeeDetailedReportProps> = ({
  onBack
}) => {
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // ✨ Mudar o estado para usar Date objects separados
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date())); // Inicializa com o início do mês atual
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date())); // Inicializa com o fim do mês atual
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();

  // Toggle expansão de um registro
  const toggleRecord = (recordId: string) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRecords(newExpanded);
  };

  // Função para gerar todas as datas do período EXATO (usando Date objects agora)
  const generateDateRange = (start: Date, end: Date) => {
    const dates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  // Função para validar se uma data está dentro do período (usando Date objects agora)
  const isDateInPeriod = (dateStr: string, start: Date, end: Date) => {
    const date = parseISO(dateStr);
    if (!isValid(date)) return false;
    // Comparação apenas da data (ignorando horas)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    return dateOnly >= startOnly && dateOnly <= endOnly;
  };

  // Função para calcular valores (hora extra = hora normal)
  const calculatePay = (normalHours: number, overtimeHours: number, rate: number) => {
    const normalPay = normalHours * rate;
    const overtimePay = overtimeHours * rate; // Hora extra com mesmo valor da hora normal

    // Garantir que os resultados são números válidos antes de somar
    const validNormalPay = typeof normalPay === 'number' && !isNaN(normalPay) ? normalPay : 0;
    const validOvertimePay = typeof overtimePay === 'number' && !isNaN(overtimePay) ? overtimePay : 0;

    const totalPayValid = validNormalPay + validOvertimePay;

    return { normalPay: validNormalPay, overtimePay: validOvertimePay, totalPay: totalPayValid };
  };

  // Primeiro carrega o perfil do usuário
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  // Depois carrega os registros quando o perfil estiver carregado ou período mudar
  useEffect(() => {
    // ✨ Usar startDate e endDate (Date objects)
    if (user && profileLoaded && startDate && endDate) {
      loadRecords(startDate, endDate);
    } else if (profileLoaded && (!startDate || !endDate)) {
        // Limpar registros se as datas não estiverem selecionadas
        setRecords([]);
        setLoading(false);
    }
  }, [startDate, endDate, user, profileLoaded, hourlyRate]); // Depende de startDate e endDate

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
           setHourlyRate(50); // Fallback para valor padrão
        }
      } else {
         console.warn('Nenhum perfil encontrado ou sem hourly_rate, usando valor padrão:', 50);
         setHourlyRate(50); // Fallback para valor padrão
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setHourlyRate(50); // Fallback em caso de erro na requisição
    } finally {
      setProfileLoaded(true);
    }
  };

  // ✨ Função loadRecords agora recebe Date objects
  const loadRecords = async (startDate: Date, endDate: Date) => {
    if (!user || !profileLoaded || !startDate || !endDate) return;

    setLoading(true);
    try {
      // ✨ Formatar Date objects para string yyyy-MM-dd para a consulta
      const startDateString = format(startDate, 'yyyy-MM-dd');
      const endDateString = format(endDate, 'yyyy-MM-dd');

      // Gerar APENAS as datas do período selecionado (usando Date objects)
      const dateRangeStrings = generateDateRange(startDate, endDate);

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDateString) // Usar string formatada
        .lte('date', endDateString) // Usar string formatada
        .eq('status', 'active')
        .order('date');

      if (error) {
         console.error('Erro ao carregar registros de ponto:', error);
         throw error;
      }

      // Criar um mapa dos registros por data
      const recordsMap = (data || []).reduce((acc, record) => {
        // Validar se a data do registro está REALMENTE no período (usando Date objects)
        if (isDateInPeriod(record.date, startDate, endDate)) {
          acc[record.date] = record;
        }
        return acc;
      }, {} as Record<string, any>);

      // Combinar APENAS as datas do período com os registros existentes
      // Filtrar para mostrar apenas dias úteis OU fins de semana com registros
      const completeRecords: TimeRecord[] = [];

      for (const dateString of dateRangeStrings) {
        const record = recordsMap[dateString];
        const dateObj = parseISO(dateString);
        const isWeekendDay = !isWorkingDay(dateObj);

        // Mostrar se for dia útil OU se for fim de semana com registro
        if (!isWeekendDay || record) {
          if (record) {
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

            completeRecords.push({
              id: record.id,
              date: record.date,
              clock_in: record.clock_in,
              lunch_start: record.lunch_start,
              lunch_end: record.lunch_end,
              clock_out: record.clock_out,
              total_hours: totalHours,
              normal_hours: normalHours,
              overtime_hours: overtimeHours,
              normal_pay: normalPay,
              overtime_pay: overtimePay,
              total_pay: totalPay,
              isWeekend: isWeekendDay
            });
          } else {
            // Dia útil sem registro
            completeRecords.push({
              id: `empty-${dateString}`,
              date: dateString,
              total_hours: 0,
              normal_hours: 0,
              overtime_hours: 0,
              normal_pay: 0,
              overtime_pay: 0,
              total_pay: 0,
              isWeekend: isWeekendDay
            });
          }
        }
      }

      setRecords(completeRecords);
    } catch (error) {
      console.error('Error loading records:', error);
       setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const getDayOfWeek = (dateString: string) => {
    const date = parseISO(dateString);
     if (!isValid(date)) return '';
    return format(date, 'EEEE', { locale: ptBR });
  };

  // Recalcular totais sempre que os registros mudarem
  const totals = records.reduce((acc, record) => ({
    totalHours: acc.totalHours + Number(record.total_hours || 0),
    normalHours: acc.normalHours + Number(record.normal_hours || 0),
    overtimeHours: acc.overtimeHours + Number(record.overtime_hours || 0),
    totalPay: acc.totalPay + Number(record.total_pay || 0)
  }), { totalHours: 0, normalHours: 0, overtimeHours: 0, totalPay: 0 });

  // ✨ Formatar as datas selecionadas para exibição no título
  const formattedStartDate = startDate ? format(startDate, 'dd/MM/yyyy') : '';
  const formattedEndDate = endDate ? format(endDate, 'dd/MM/yyyy') : '';
  const periodTitle = formattedStartDate && formattedEndDate ? `${formattedStartDate} a ${formattedEndDate}` : 'Selecione o período';

  if (loading || !profileLoaded) { // Ajustado para apenas verificar profileLoaded
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-600">
           <div className="flex items-center justify-center mb-2">
             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
           </div>
          Carregando relatório...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header Mobile */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="w-5 h-5 text-primary-600" />
              Relatório Detalhado
            </CardTitle>
            <Button variant="outline" onClick={onBack} size="sm" className="border-primary-300 text-primary-700 hover:bg-primary-100">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Seletor de Período Mobile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ✨ Substituído DatePickerWithRange por dois seletores individuais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Resumo Mobile */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Total Horas</span>
              </div>
              <div className="text-lg font-bold">{formatHoursAsTime(totals.totalHours)}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Valor Total</span>
              </div>
              <div className="text-lg font-bold">{formatCurrency(totals.totalPay)}</div>
            </div>
          </div>

          <div className="text-center text-sm text-gray-600 pt-2 border-t">
            Valor/Hora: {formatCurrency(hourlyRate)}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Registros Mobile */}
       {records.length > 0 ? (
        <div className="space-y-2">
          {records.map((record) => {
            const dayOfWeek = getDayOfWeek(record.date);
            const isExpanded = expandedRecords.has(record.id);
            const hasData = record.clock_in || record.lunch_start || record.lunch_end || record.clock_out;

            return (
              <Card key={record.id} className={record.isWeekend ? 'bg-blue-50 border-blue-200' : ''}>
                <CardContent className="p-4">
                  {/* Header do dia */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleRecord(record.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {/* Usar parseISO para garantir que a data seja interpretada corretamente */}
                          {isValid(parseISO(record.date)) ? format(parseISO(record.date), 'dd/MM') : 'Data inválida'}
                        </span>
                        <span className="text-sm text-gray-600 capitalize">
                          {dayOfWeek}
                        </span>
                        {record.isWeekend && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Fim de semana
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Resumo rápido */}
                      <div className="text-right">
                        {record.total_hours > 0 ? (
                          <>
                            <div className="text-sm font-medium">
                              {formatHoursAsTime(record.total_hours)}
                            </div>
                            <div className="text-xs text-green-600">
                              {formatCurrency(Number(record.total_pay))}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-500">
                            Sem registro
                          </div>
                        )}
                    </div>

                    {hasData && (
                        <Button variant="ghost" size="sm" className="p-1">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {isExpanded && hasData && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {/* Horários */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Entrada:</span>
                          <span className="ml-2 font-medium">{record.clock_in || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Saída:</span>
                          <span className="ml-2 font-medium">{record.clock_out || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Almoço:</span>
                          <span className="ml-2 font-medium">{record.lunch_start || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Volta:</span>
                          <span className="ml-2 font-medium">{record.lunch_end || '-'}</span>
                        </div>
                      </div>

                      {/* Cálculos */}
                      {record.total_hours > 0 && (
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Horas Normais:</span>
                            <span>{formatHoursAsTime(record.normal_hours)}</span>
                          </div>
                          {record.overtime_hours > 0 && (
                            <div className="flex justify-between text-sm">
                              <span>Horas Extras:</span>
                              <span className="text-orange-600">
                                {formatHoursAsTime(record.overtime_hours)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-medium pt-2 border-t">
                            <span>Total Ganho:</span>
                            <span className="text-green-600">
                              {formatCurrency(Number(record.total_pay))}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
       ) : (
         <Card>
           <CardContent className="p-6 text-center text-gray-600">
             Nenhum registro encontrado para o período selecionado.
           </CardContent>
         </Card>
       )}
    </div>
  );
};

export default EmployeeDetailedReport;
