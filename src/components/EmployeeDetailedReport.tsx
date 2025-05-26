
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';

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
  selectedMonth,
  onBack
}) => {
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(50);
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
  const calculatePay = (normalHours: number, overtimeHours: number, hourlyRate: number) => {
    const normalPay = normalHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate; // Hora extra com mesmo valor da hora normal
    const totalPay = normalPay + overtimePay;
    
    return { normalPay, overtimePay, totalPay };
  };

  useEffect(() => {
    if (user) {
      loadRecords();
      loadUserProfile();
    }
  }, [selectedMonth, user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setHourlyRate(Number(data.hourly_rate));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadRecords = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = format(selectedMonth, 'yyyy-MM-01');
      const endDate = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'active')
        .order('date');

      if (error) throw error;

      // Gerar todas as datas do mês
      const allDates = generateMonthDates(selectedMonth);
      
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
          
          // Calcular valores com hora extra igual à hora normal
          const { normalPay, overtimePay, totalPay } = calculatePay(
            normalHours,
            overtimeHours,
            hourlyRate
          );

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

  if (loading) {
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
              {user?.name} ({totals.totalHours.toFixed(1)}h - {formatCurrency(totals.totalPay)})
            </CardTitle>
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
