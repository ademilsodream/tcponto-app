
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

  useEffect(() => {
    if (user) {
      loadRecords();
    }
  }, [selectedMonth, user]);

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
      setRecords(data || []);
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

  // Gerar todas as datas do mês
  const allDates = generateMonthDates(selectedMonth);
  
  // Criar um mapa dos registros por data
  const recordsMap = records.reduce((acc, record) => {
    acc[record.date] = record;
    return acc;
  }, {} as Record<string, TimeRecord>);

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
              {allDates.map((dateString) => {
                const record = recordsMap[dateString];
                const dayOfWeek = getDayOfWeek(dateString);
                
                return (
                  <TableRow key={dateString}>
                    <TableCell>{format(new Date(dateString), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{dayOfWeek}</TableCell>
                    <TableCell>{record?.clock_in || '-'}</TableCell>
                    <TableCell>{record?.lunch_start || '-'}</TableCell>
                    <TableCell>{record?.lunch_end || '-'}</TableCell>
                    <TableCell>{record?.clock_out || '-'}</TableCell>
                    <TableCell>{record ? Number(record.total_hours).toFixed(1) + 'h' : '-'}</TableCell>
                    <TableCell>{record ? Number(record.overtime_hours).toFixed(1) + 'h' : '-'}</TableCell>
                    <TableCell>{record ? formatCurrency(Number(record.total_pay)) : '-'}</TableCell>
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
