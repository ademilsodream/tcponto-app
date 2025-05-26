
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { cn } from '@/lib/utils';

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
}

interface EmployeeDetailedReportProps {
  selectedMonth: Date;
  onBack: () => void;
}

const EmployeeDetailedReport: React.FC<EmployeeDetailedReportProps> = ({
  onBack
}) => {
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Date>(new Date());
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();

  // Função para gerar todas as datas do mês
  const generateMonthDates = (month: Date) => {
    const year = month.getFullYear();
    const monthNumber = month.getMonth();
    const daysInMonth = new Date(year, monthNumber + 1, 0).getDate();
    
    const dates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthNumber, day);
      dates.push(format(date, 'yyyy-MM-dd'));
    }
    return dates;
  };

  // Função para calcular valores (hora extra = hora normal)
  const calculatePay = (normalHours: number, overtimeHours: number, rate: number) => {
    const normalPay = normalHours * rate;
    const overtimePay = overtimeHours * rate; // Hora extra com mesmo valor da hora normal
    const totalPay = normalPay + overtimePay;
    
    return { normalPay, overtimePay, totalPay };
  };

  // Primeiro carrega o perfil do usuário
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  // Depois carrega os registros quando o perfil estiver carregado ou período mudar
  useEffect(() => {
    if (user && profileLoaded) {
      loadRecords();
    }
  }, [selectedPeriod, user, profileLoaded, hourlyRate]);

  const loadUserProfile = async () => {
    if (!user) return;

    console.log('Carregando perfil do usuário:', user.id);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
        throw error;
      }

      if (data) {
        const rate = Number(data.hourly_rate);
        console.log('Valor da hora carregado do perfil:', rate);
        setHourlyRate(rate);
      } else {
        console.log('Nenhum perfil encontrado, usando valor padrão:', 50);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setProfileLoaded(true);
    }
  };

  const loadRecords = async () => {
    if (!user || !profileLoaded) return;

    console.log('Carregando registros com valor da hora:', hourlyRate);
    setLoading(true);
    try {
      const startDate = format(selectedPeriod, 'yyyy-MM-01');
      const endDate = format(new Date(selectedPeriod.getFullYear(), selectedPeriod.getMonth() + 1, 0), 'yyyy-MM-dd');

      console.log('Buscando registros entre:', startDate, 'e', endDate);

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'active')
        .order('date');

      if (error) throw error;

      // Gerar todas as datas do mês selecionado
      const allDates = generateMonthDates(selectedPeriod);
      
      // Criar um mapa dos registros por data
      const recordsMap = (data || []).reduce((acc, record) => {
        acc[record.date] = record;
        return acc;
      }, {} as Record<string, any>);

      // Combinar todas as datas com os registros existentes
      const completeRecords: TimeRecord[] = allDates.map(dateString => {
        const record = recordsMap[dateString];
        
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

          console.log(`Calculando para ${dateString}: ${normalHours}h normais + ${overtimeHours}h extras * R$${hourlyRate} = R$${totalPay}`);

          return {
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
            total_pay: totalPay
          };
        }

        return {
          id: `empty-${dateString}`,
          date: dateString,
          total_hours: 0,
          normal_hours: 0,
          overtime_hours: 0,
          normal_pay: 0,
          overtime_pay: 0,
          total_pay: 0
        };
      });

      setRecords(completeRecords);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'EEEE', { locale: ptBR });
  };

  const totals = records.reduce((acc, record) => ({
    totalHours: acc.totalHours + Number(record.total_hours),
    normalHours: acc.normalHours + Number(record.normal_hours),
    overtimeHours: acc.overtimeHours + Number(record.overtime_hours),
    totalPay: acc.totalPay + Number(record.total_pay)
  }), { totalHours: 0, normalHours: 0, overtimeHours: 0, totalPay: 0 });

  if (loading || !profileLoaded) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando relatório...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onBack} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {user?.name}
            </CardTitle>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Seletor de Período</h3>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedPeriod && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedPeriod ? format(selectedPeriod, "MMMM yyyy", { locale: ptBR }) : <span>Selecione o período</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedPeriod}
                  onSelect={(date) => date && setSelectedPeriod(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total de Horas: {totals.totalHours.toFixed(1)}h</span>
            <span>Valor Total: {formatCurrency(totals.totalPay)}</span>
            <span>Valor/Hora: {formatCurrency(hourlyRate)}</span>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Dia da Semana</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída Almoço</TableHead>
                <TableHead>Volta Almoço</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Total Horas</TableHead>
                <TableHead>Horas Extras</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const dayOfWeek = getDayOfWeek(record.date);
                
                return (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{dayOfWeek}</TableCell>
                    <TableCell>{record.clock_in || '-'}</TableCell>
                    <TableCell>{record.lunch_start || '-'}</TableCell>
                    <TableCell>{record.lunch_end || '-'}</TableCell>
                    <TableCell>{record.clock_out || '-'}</TableCell>
                    <TableCell>{record.total_hours > 0 ? Number(record.total_hours).toFixed(1) + 'h' : '-'}</TableCell>
                    <TableCell>{record.overtime_hours > 0 ? Number(record.overtime_hours).toFixed(1) + 'h' : '-'}</TableCell>
                    <TableCell>{record.total_pay > 0 ? formatCurrency(Number(record.total_pay)) : '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDetailedReport;
