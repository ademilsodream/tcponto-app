
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { isWorkingDay } from '@/utils/workingDays';
import { isValidQueryResult, isValidSingleResult, hasValidProperties, filterValidTimeRecords } from '@/utils/queryValidation';

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
  const [startDate, setStartDate] = useState('2025-05-01');
  const [endDate, setEndDate] = useState('2025-05-31');
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();

  // Função para gerar todas as datas do período EXATO
  const generateDateRange = (start: string, end: string) => {
    const dates = [];
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    
    console.log('Gerando datas do período:', start, 'até', end);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateString = format(date, 'yyyy-MM-dd');
      dates.push(dateString);
    }
    
    console.log('Datas geradas:', dates);
    return dates;
  };

  // Função para validar se uma data está dentro do período
  const isDateInPeriod = (dateStr: string, start: string, end: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    
    const isValid = date >= startDate && date <= endDate;
    console.log(`Data ${dateStr} está no período ${start} a ${end}?`, isValid);
    return isValid;
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
    if (user && profileLoaded && startDate && endDate) {
      loadRecords();
    }
  }, [startDate, endDate, user, profileLoaded, hourlyRate]);

  const loadUserProfile = async () => {
    if (!user) return;

    console.log('Carregando perfil do usuário:', user.id);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', user.id as any)
        .single();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
        throw error;
      }

      if (isValidSingleResult(data, error) && hasValidProperties(data, ['hourly_rate'])) {
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
    if (!user || !profileLoaded || !startDate || !endDate) return;

    console.log('=== INÍCIO CARREGAMENTO REGISTROS ===');
    console.log('Período selecionado:', startDate, 'até', endDate);
    console.log('Carregando registros com valor da hora:', hourlyRate);
    
    setLoading(true);
    try {
      // Gerar APENAS as datas do período selecionado
      const dateRange = generateDateRange(startDate, endDate);
      console.log('Range de datas gerado:', dateRange);

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id as any)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'active' as any)
        .order('date');

      if (error) throw error;

      console.log('Registros encontrados na consulta:', data);

      // Verificar se os dados são válidos
      if (!isValidQueryResult(data, error)) {
        console.error('Dados inválidos retornados para time_records');
        setRecords([]);
        return;
      }

      // Filtrar apenas registros válidos usando a função específica
      const validData = filterValidTimeRecords(data);

      // Criar um mapa dos registros por data
      const recordsMap = validData.reduce((acc, record) => {
        // Validar se a data do registro está REALMENTE no período
        if (record && record.date && isDateInPeriod(record.date, startDate, endDate)) {
          acc[record.date] = record;
          console.log('Registro adicionado ao mapa:', record.date, record);
        } else {
          console.log('Registro REJEITADO (fora do período):', record?.date);
        }
        return acc;
      }, {} as Record<string, any>);

      console.log('Mapa de registros válidos:', recordsMap);

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

            console.log(`Calculando para ${dateString}: ${normalHours}h normais + ${overtimeHours}h extras * ${formatCurrency(hourlyRate)} = ${formatCurrency(totalPay)}`);

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

      console.log('Registros completos para exibição:', completeRecords);
      console.log('Total de datas no resultado:', completeRecords.length);
      setRecords(completeRecords);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
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
          <h3 className="text-lg font-semibold mb-4">Seletor de Período</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-700">Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10"
              />
            </div>
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
                  <TableRow key={record.id} className={record.isWeekend ? 'bg-blue-50' : ''}>
                    <TableCell>
                      {format(new Date(record.date + 'T00:00:00'), 'dd/MM/yyyy')}
                      {record.isWeekend && <span className="ml-2 text-xs text-blue-600">(Fim de semana)</span>}
                    </TableCell>
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
