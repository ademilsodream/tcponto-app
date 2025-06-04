import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileText, Calendar, Clock, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { isWorkingDay } from '@/utils/workingDays';




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




// ✨ Função para formatar horas no padrão HH:MM
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
  const [startDate, setStartDate] = useState('2025-05-01'); // Exemplo, idealmente viria de props ou estado global
  const [endDate, setEndDate] = useState('2025-05-31'); // Exemplo, idealmente viria de props ou estado global
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




  // Função para formatar data para exibição
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return format(date, 'dd/MM/yyyy');
  };




  // Função para gerar todas as datas do período EXATO
  const generateDateRange = (start: string, end: string) => {
    const dates = [];
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');




    // console.log('Gerando datas do período:', start, 'até', end); // Debug
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }




    // console.log('Datas geradas:', dates); // Debug
    return dates;
  };




  // Função para validar se uma data está dentro do período
  const isDateInPeriod = (dateStr: string, start: string, end: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');




    const isValid = date >= startDate && date <= endDate;
    // console.log(`Data ${dateStr} está no período ${start} a ${end}?`, isValid); // Debug
    return isValid;
  };




  // Função para calcular valores (hora extra = hora normal)
  const calculatePay = (normalHours: number, overtimeHours: number, rate: number) => {
    const normalPay = normalHours * rate;
    const overtimePay = overtimeHours * rate; // Hora extra com mesmo valor da hora normal
    const totalPay = normalPay + overtimePay;




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
    // Definir período inicial com base no mês atual se não estiver definido
    if (!startDate || !endDate) {
       const today = new Date();
       const firstDayOfMonth = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
       const lastDayOfMonth = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');
       setStartDate(firstDayOfMonth);
       setEndDate(lastDayOfMonth);
    }




    if (user && profileLoaded && startDate && endDate) {
      loadRecords();
    }
  }, [startDate, endDate, user, profileLoaded, hourlyRate]);




  const loadUserProfile = async () => {
    if (!user) return;




    // console.log('Carregando perfil do usuário:', user.id); // Debug
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', user.id)
        .single();




      if (error) {
        console.error('Erro ao carregar perfil:', error);
        // Não lançar erro aqui para não quebrar o componente, apenas logar
        // throw error;
      }




      if (data) {
        const rate = Number(data.hourly_rate);
        if (!isNaN(rate)) { // Valida se a taxa é um número válido
           // console.log('Valor da hora carregado do perfil:', rate); // Debug
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








  const loadRecords = async () => {
    if (!user || !profileLoaded || !startDate || !endDate) return;




    // console.log('=== INÍCIO CARREGAMENTO REGISTROS ==='); // Debug
    // console.log('Período selecionado:', startDate, 'até', endDate); // Debug
    // console.log('Carregando registros com valor da hora:', hourlyRate); // Debug




    setLoading(true);
    try {
      // Gerar APENAS as datas do período selecionado
      const dateRange = generateDateRange(startDate, endDate);
      // console.log('Range de datas gerado:', dateRange); // Debug








      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'active')
        .order('date');




      if (error) {
         console.error('Erro ao carregar registros de ponto:', error);
         throw error; // Lança o erro para ser pego pelo catch
      }




      // console.log('Registros encontrados na consulta:', data); // Debug








      // Criar um mapa dos registros por data
      const recordsMap = (data || []).reduce((acc, record) => {
        // Validar se a data do registro está REALMENTE no período
        if (isDateInPeriod(record.date, startDate, endDate)) {
          acc[record.date] = record;
          // console.log('Registro adicionado ao mapa:', record.date, record); // Debug
        } else {
          // console.log('Registro REJEITADO (fora do período):', record.date); // Debug
        }
        return acc;
      }, {} as Record<string, any>);




      // console.log('Mapa de registros válidos:', recordsMap); // Debug








      // Combinar APENAS as datas do período com os registros existentes
      // Filtrar para mostrar apenas dias úteis OU fins de semana com registros
      const completeRecords: TimeRecord[] = [];




      for (const dateString of dateRange) {
        const record = recordsMap[dateString];
        const dateObj = new Date(dateString + 'T00:00:00');
        const isWeekendDay = !isWorkingDay(dateObj);




        // Mostrar se for dia útil OU se for fim de semana com registro
        if (!isWeekendDay || record) {
          if (record) {
            // Usar a função padronizada com tolerância de 15 minutos
            const { totalHours, normalHours, overtimeHours } = calculateWorkingHours(
              record.clock_in || '',
              record.lunch_start || '',
              record.lunch_end || '',
              record.clock_out || ''
            );




            // Calcular valores com o hourlyRate correto carregado do perfil
            const { normalPay, overtimePay, totalPay } = calculatePay(
              normalHours,
              overtimeHours,
              hourlyRate
            );




            // console.log(`Calculando para ${dateString}: ${normalHours}h normais + ${overtimeHours}h extras * ${formatCurrency(hourlyRate)} = ${formatCurrency(totalPay)}`); // Debug








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




      // console.log('Registros completos para exibição:', completeRecords); // Debug
      // console.log('Total de datas no resultado:', completeRecords.length); // Debug
      setRecords(completeRecords);
    } catch (error) {
      console.error('Error loading records:', error);
       // Resetar registros em caso de erro
       setRecords([]);
    } finally {
      setLoading(false);
      // console.log('=== FIM CARREGAMENTO REGISTROS ==='); // Debug
    }
  };








  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return format(date, 'EEEE', { locale: ptBR });
  };




  // Recalcular totais sempre que os registros mudarem
  const totals = records.reduce((acc, record) => ({
    totalHours: acc.totalHours + Number(record.total_hours || 0), // Garante que é um número
    normalHours: acc.normalHours + Number(record.normal_hours || 0), // Garante que é um número
    overtimeHours: acc.overtimeHours + Number(record.overtime_hours || 0), // Garante que é um número
    totalPay: acc.totalPay + Number(record.total_pay || 0) // Garante que é um número
  }), { totalHours: 0, normalHours: 0, overtimeHours: 0, totalPay: 0 });








  if (loading || !profileLoaded) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-600">
           {/* Adicionado um spinner simples */}
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
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"> {/* Ajuste no tamanho do título */}
              <Calendar className="w-5 h-5 text-primary-600" /> {/* Cor no ícone */}
              Relatório Detalhado
            </CardTitle>
            <Button variant="outline" onClick={onBack} size="sm" className="border-primary-300 text-primary-700 hover:bg-primary-100"> {/* Cores no botão */}
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
            <Calendar className="w-5 h-5 text-primary-600" /> {/* Cor no ícone */}
            Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Data Inicial</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10"
                />
                 {/* Overlay para exibir data formatada */}
                <div className="absolute inset-0 flex items-center px-3 pointer-events-none bg-white border rounded-md">
                  <span className="text-sm text-gray-900">
                    {formatDateForDisplay(startDate)}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-sm">Data Final</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10"
                />
                {/* Overlay para exibir data formatada */}
                <div className="absolute inset-0 flex items-center px-3 pointer-events-none bg-white border rounded-md">
                  <span className="text-sm text-gray-900">
                    {formatDateForDisplay(endDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>




          {/* Resumo Mobile */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Total Horas</span>
              </div>
              {/* ✨ Aplicado formato HH:MM */}
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
                        {format(new Date(record.date + 'T00:00:00'), 'dd/MM')}
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
                            {/* ✨ Aplicado formato HH:MM */}
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
                           {/* ✨ Aplicado formato HH:MM */}
                          <span>{formatHoursAsTime(record.normal_hours)}</span>
                        </div>
                        {record.overtime_hours > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Horas Extras:</span>
                            <span className="text-orange-600">
                              {/* ✨ Aplicado formato HH:MM */}
                              {formatHoursAsTime(record.overtime_hours)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-medium pt-2 border-t">
                          <span>Total Ganho:</span> {/* Texto ajustado para clareza */}
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
    </div>
  );
};




export default EmployeeDetailedReport;