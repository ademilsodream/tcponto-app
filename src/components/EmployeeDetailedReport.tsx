import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIconLucide, Clock, DollarSign, ChevronDown, ChevronUp, CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { isWorkingDay } from '@/utils/workingDays';

// Importar componentes necessários para seletores de data individuais (Calendar, Popover)
import { Calendar } from '@/components/ui/calendar';
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
  normal_pay: number; // ✨ Agora calculado em tempo real
  overtime_pay: number; // ✨ Agora calculado em tempo real
  total_pay: number; // ✨ Agora calculado em tempo real
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

const EmployeeDetailedReport: React.FC<EmployeeDetailedReportProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  // Estados para as datas de início e fim do período
  // Inicializa com o primeiro e último dia do mês atual
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  
  // ✨ NOVO: Estado para armazenar dados do funcionário (hourly_rate e overtime_rate)
  const [userProfile, setUserProfile] = useState<{ hourly_rate: number; overtime_rate: number } | null>(null);

  // ✨ NOVO: Função para buscar dados do perfil do usuário
  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('hourly_rate, overtime_rate')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      setUserProfile({ 
        hourly_rate: Number(data.hourly_rate) || 0,
        overtime_rate: Number(data.overtime_rate) || 0
      });
    } catch (error) {
      console.error('Unexpected error loading user profile:', error);
    }
  };

  const loadRecords = async (userId: string, start: Date, end: Date) => {
    setLoading(true);
    setRecords([]); // Limpa registros anteriores

    const startDateStr = format(start, 'yyyy-MM-dd');
    const endDateStr = format(end, 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error loading time records:', error);
        // TODO: Adicionar tratamento de erro para o usuário (toast, etc.)
        setLoading(false);
        return;
      }

      // ✨ ALTERAÇÃO: Processar os dados com cálculo financeiro em tempo real
      const processedRecords = data.map(record => {
        const date = parseISO(record.date);
        const isWeekendDay = !isWorkingDay(date);

        // ✨ Usar os dados de horas que já vêm do banco ou recalcular se necessário
        const totalHours = Number(record.total_hours || 0);
        const normalHours = Number(record.normal_hours || 0);
        const overtimeHours = Number(record.overtime_hours || 0);

        // ✨ NOVO: Calcular valores financeiros usando ambos hourly_rate e overtime_rate
        const hourlyRate = userProfile?.hourly_rate || 0;
        const overtimeRate = userProfile?.overtime_rate || 0;
        const normalPay = normalHours * hourlyRate;
        const overtimePay = overtimeHours * overtimeRate; // ✨ Usando overtime_rate diferenciado
        const totalPay = normalPay + overtimePay;

        return {
          ...record,
          total_hours: totalHours,
          normal_hours: normalHours,
          overtime_hours: overtimeHours,
          normal_pay: normalPay, // ✨ Calculado em tempo real
          overtime_pay: overtimePay, // ✨ Calculado em tempo real  
          total_pay: totalPay, // ✨ Calculado em tempo real
          isWeekend: isWeekendDay,
        };
      });

      setRecords(processedRecords);

    } catch (error) {
      console.error('Unexpected error loading time records:', error);
      // TODO: Adicionar tratamento de erro para o usuário
    } finally {
      setLoading(false);
    }
  };

  // ✨ NOVO: Carrega perfil do usuário quando o componente monta
  useEffect(() => {
    if (user?.id) {
      loadUserProfile(user.id);
    }
  }, [user?.id]);

  // ✨ ALTERAÇÃO: Carrega os registros quando o perfil do usuário é carregado também
  useEffect(() => {
    if (user?.id && startDate && endDate && userProfile) {
      loadRecords(user.id, startDate, endDate);
    } else {
        setRecords([]); // Limpa os registros se as datas, usuário ou perfil não estiverem definidos
    }
  }, [user?.id, startDate, endDate, userProfile]); // ✨ Adicionado userProfile como dependência

  // Alterna a expansão do card
  const toggleExpand = (recordId: string) => {
    setExpandedRecordId(expandedRecordId === recordId ? null : recordId);
  };

  // Calcula os totais para o período exibido
  const totals = useMemo(() => {
    return records.reduce(
      (sum, record) => {
        sum.totalHours += record.total_hours;
        sum.normalHours += record.normal_hours;
        sum.overtimeHours += record.overtime_hours;
        sum.normalPay += record.normal_pay;
        sum.overtimePay += record.overtime_pay;
        sum.totalPay += record.total_pay;
        return sum;
      },
      {
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        normalPay: 0,
        overtimePay: 0,
        totalPay: 0,
      }
    );
  }, [records]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Relatório Detalhado
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Selecionar Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Seletor de Data Inicial - Estilo Popover/Calendar */}
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="startDate"
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
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Seletor de Data Final - Estilo Popover/Calendar */}
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="endDate"
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
                    <Calendar
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
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              Carregando registros...
            </CardContent>
          </Card>
        ) : records.length > 0 ? (
          <div className="space-y-4">
            {/* Card de Totais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo do Período</CardTitle>
              </CardHeader>
            </Card>

            {/* Lista de Registros Detalhados */}
            {records.map((record) => (
              <Card key={record.id} className={record.isWeekend ? 'border-yellow-300 bg-yellow-50' : ''}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {format(parseISO(record.date), 'dd/MM/yyyy (EEE)', { locale: ptBR })}
                       {record.isWeekend && (
                           <span className="text-xs font-medium text-yellow-800 bg-yellow-200 px-2 py-1 rounded-full">Fim de Semana</span>
                       )}
                    </CardTitle>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatHoursAsTime(record.total_hours)} trabalhadas
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggleExpand(record.id)}>
                    {expandedRecordId === record.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CardHeader>
                {expandedRecordId === record.id && (
                    <CardContent className="border-t pt-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Entrada:</span>
                                <span className="font-medium">{record.clock_in || '--:--'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Início Almoço:</span>
                                <span className="font-medium">{record.lunch_start || '--:--'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Fim Almoço:</span>
                                <span className="font-medium">{record.lunch_end || '--:--'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Saída:</span>
                                <span className="font-medium">{record.clock_out || '--:--'}</span>
                            </div>
                            <div className="flex justify-between text-sm text-green-600 font-medium">
                                <span>Horas Normais:</span>
                                <span>{formatHoursAsTime(record.normal_hours)}</span>
                            </div>
                            {record.overtime_hours > 0 && (
                                <div className="flex justify-between text-sm text-orange-600 font-medium">
                                    <span>Horas Extras:</span>
                                    <span>{formatHoursAsTime(record.overtime_hours)}</span>
                                </div>
                            )}
                             {/* ✨ Sempre mostrar pagamento agora que é calculado */}
                             <div className="flex justify-between text-sm font-medium pt-2 border-t">
                                <span>Total Ganho Estimado:</span>
                                <span className="text-green-600">
                                    {formatCurrency(Number(record.total_pay))}
                                </span>
                             </div>
                        </div>
                    </CardContent>
                )}
              </Card>
            ))}
          </div>
        ) : (
           // Mensagem quando não há registros após carregar (ou no estado inicial se não inicializar com mês atual)
          <Card>
            <CardContent className="p-6 text-center text-gray-600">
              Nenhum registro encontrado para o período selecionado.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetailedReport;