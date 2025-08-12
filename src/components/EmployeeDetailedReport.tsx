
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIconLucide, Clock, DollarSign, ChevronDown, ChevronUp, CalendarIcon, Grid as GridIcon, List as ListIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isValid, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { isWorkingDay } from '@/utils/workingDays';

// Importar componentes necessários para seletores de data individuais (Calendar, Popover)
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type ViewMode = 'calendar' | 'list';

const EmployeeDetailedReport: React.FC<EmployeeDetailedReportProps> = ({ onBack }) => {
  const { user } = useOptimizedAuth();
  const { formatCurrency } = useCurrency();

  // Estados para as datas de início e fim do período (mês atual por padrão)
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  
  // ✨ NOVO: Estado para armazenar dados do funcionário (hourly_rate e overtime_rate)
  const [userProfile, setUserProfile] = useState<{ hourly_rate: number; overtime_rate: number } | null>(null);

  // ✨ NOVO: Dialog de detalhes do dia
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<Date | null>(null);

  // ✨ NOVO: Mapear registros por data
  const recordsByDate = useMemo(() => {
    const map = new Map<string, TimeRecord[]>();
    for (const r of records) {
      const key = r.date; // 'yyyy-MM-dd'
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [records]);

  // ✨ NOVO: Totais de horas por data
  const totalsByDate = useMemo(() => {
    const map = new Map<string, { total: number; normal: number; overtime: number }>();
    for (const r of records) {
      const key = r.date;
      const prev = map.get(key) || { total: 0, normal: 0, overtime: 0 };
      map.set(key, {
        total: prev.total + Number(r.total_hours || 0),
        normal: prev.normal + Number(r.normal_hours || 0),
        overtime: prev.overtime + Number(r.overtime_hours || 0)
      });
    }
    return map;
  }, [records]);

  // ✨ NOVO: Função para abrir detalhes do dia
  const openDayDetails = (day: Date) => {
    setDialogDate(day);
    setDayDialogOpen(true);
  };

  // ✨ NOVO: Geração da grade de calendário do mês selecionado
  const monthGrid = useMemo(() => {
    if (!startDate) return [] as Date[];
    const monthStart = startOfMonth(startDate);
    const monthEnd = endOfMonth(startDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [startDate]);

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
        .order('date', { ascending: true });

      if (error) {
        console.error('Error loading time records:', error);
        setLoading(false);
        return;
      }

      // ✨ Processar os dados com cálculo financeiro em tempo real
      const processedRecords = (data || []).map(record => {
        const date = parseISO(record.date);
        const isWeekendDay = !isWorkingDay(date);

        const totalHours = Number(record.total_hours || 0);
        const normalHours = Number(record.normal_hours || 0);
        const overtimeHours = Number(record.overtime_hours || 0);

        const hourlyRate = userProfile?.hourly_rate || 0;
        const overtimeRate = userProfile?.overtime_rate || 0;
        const normalPay = normalHours * hourlyRate;
        const overtimePay = overtimeHours * overtimeRate;
        const totalPay = normalPay + overtimePay;

        return {
          ...record,
          total_hours: totalHours,
          normal_hours: normalHours,
          overtime_hours: overtimeHours,
          normal_pay: normalPay,
          overtime_pay: overtimePay,
          total_pay: totalPay,
          isWeekend: isWeekendDay,
        } as TimeRecord;
      });

      setRecords(processedRecords);

    } catch (error) {
      console.error('Unexpected error loading time records:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carrega perfil do usuário quando o componente monta
  useEffect(() => {
    if (user?.id) {
      loadUserProfile(user.id);
    }
  }, [user?.id]);

  // Carrega os registros quando o perfil do usuário é carregado também
  useEffect(() => {
    if (user?.id && startDate && endDate && userProfile) {
      loadRecords(user.id, startDate, endDate);
    } else {
      setRecords([]);
    }
  }, [user?.id, startDate, endDate, userProfile]);

  // Alterna a expansão do card (modo lista)
  const toggleExpand = (recordId: string) => {
    setExpandedRecordId(expandedRecordId === recordId ? null : recordId);
  };

  // Render: Cabeçalho de filtros e toggle de visualização
  const FiltersHeader = (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">Selecionar Período</span>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="flex items-center gap-1"
            >
              <GridIcon className="w-4 h-4" /> Calendário
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex items-center gap-1"
            >
              <ListIcon className="w-4 h-4" /> Lista
            </Button>
          </div>
        </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Seletor de Data Inicial */}
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="startDate"
                      variant="outline"
                  className={cn("w-full justify-start text-left font-normal")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                  onSelect={(d) => {
                    if (d) {
                      setStartDate(startOfMonth(d));
                      setEndDate(endOfMonth(d));
                    }
                  }}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

          {/* Seletor de Data Final */}
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="endDate"
                      variant="outline"
                  className={cn("w-full justify-start text-left font-normal")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                  onSelect={(d) => {
                    if (d) setEndDate(endOfMonth(d));
                  }}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>
  );

  // Render: Calendário mensal com registros
  const CalendarGrid = (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarIconLucide className="w-5 h-5" />
          {startDate ? format(startDate, 'MMMM yyyy', { locale: ptBR }) : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 text-xs sm:text-sm font-medium text-gray-600 mb-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="p-1 text-center">{d}</div>
          ))}
        </div>

        {/* Grade de dias */}
        <div className="grid grid-cols-7 gap-[2px] bg-gray-200 rounded-md overflow-hidden">
          {monthGrid.map((day, idx) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayNum = format(day, 'd', { locale: ptBR });
            const inMonth = startDate ? isSameMonth(day, startDate) : false;
            const totals = totalsByDate.get(key);
            const hasRecords = !!recordsByDate.get(key);

            return (
              <button
                key={idx}
                onClick={() => hasRecords && openDayDetails(day)}
                className={cn(
                  'relative min-h-[68px] sm:min-h-[86px] bg-white p-1.5 sm:p-2 text-left hover:bg-gray-50 transition-colors',
                  !inMonth && 'bg-gray-50 text-gray-400',
                  hasRecords && 'ring-1 ring-blue-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold">{dayNum}</span>
                  {totals && (
                    <span className="text-[10px] sm:text-xs text-primary-700 font-medium">
                      {formatHoursAsTime(totals.total)}
                    </span>
                  )}
                </div>

                {/* Registros resumidos */}
                {hasRecords && (
                  <div className="mt-1 space-y-0.5">
                    {recordsByDate.get(key)!.slice(0, 3).map((r) => (
                      <div key={r.id} className="text-[10px] sm:text-xs truncate">
                        • {r.clock_in || '--:--'} - {r.clock_out || '--:--'}
                      </div>
                    ))}
                    {recordsByDate.get(key)!.length > 3 && (
                      <div className="text-[10px] sm:text-[11px] text-gray-500">+{recordsByDate.get(key)!.length - 3} mais</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  // Render: Lista já existente (mantida como alternativa)
  const ListView = (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Registros</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-6 text-center">
              <Clock className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              Carregando registros...
          </div>
        ) : records.length > 0 ? (
          <div className="space-y-4">
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
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Entrada:</span><span className="font-medium">{record.clock_in || '--:--'}</span></div>
                      <div className="flex justify-between"><span>Início Almoço:</span><span className="font-medium">{record.lunch_start || '--:--'}</span></div>
                      <div className="flex justify-between"><span>Fim Almoço:</span><span className="font-medium">{record.lunch_end || '--:--'}</span></div>
                      <div className="flex justify-between"><span>Saída:</span><span className="font-medium">{record.clock_out || '--:--'}</span></div>
                        </div>
                    </CardContent>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-600">Nenhum registro encontrado para o período selecionado.</div>
        )}
      </CardContent>
    </Card>
  );

  // Conteúdo principal
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
        {FiltersHeader}

        {viewMode === 'calendar' ? CalendarGrid : ListView}
      </div>

      {/* Dialog de detalhes do dia (mobile friendly) */}
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogDate ? format(dialogDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {dialogDate ? (
              (() => {
                const key = format(dialogDate, 'yyyy-MM-dd');
                const items = recordsByDate.get(key) || [];
                if (items.length === 0) {
                  return <div className="text-sm text-gray-500">Sem registros neste dia.</div>;
                }
                return (
                  <div className="space-y-2">
                    {items.map((r) => (
                      <Card key={r.id}>
                        <CardContent className="p-3 text-sm">
                          <div className="flex justify-between"><span>Entrada:</span><span className="font-medium">{r.clock_in || '--:--'}</span></div>
                          <div className="flex justify-between"><span>Início Almoço:</span><span className="font-medium">{r.lunch_start || '--:--'}</span></div>
                          <div className="flex justify-between"><span>Fim Almoço:</span><span className="font-medium">{r.lunch_end || '--:--'}</span></div>
                          <div className="flex justify-between"><span>Saída:</span><span className="font-medium">{r.clock_out || '--:--'}</span></div>
                          <div className="flex justify-between text-primary-700 mt-2"><span>Total:</span><span className="font-semibold">{formatHoursAsTime(r.total_hours)}</span></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeDetailedReport;
