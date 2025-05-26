import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, User, Users, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  hourlyRate: number;
  overtimeRate: number;
  role: string;
}

interface DetailedTimeReportProps {
  employees: Employee[];
  onBack: () => void;
}

interface TimeRecord {
  id?: string;
  date: string;
  user_id?: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours?: number;
  normal_hours?: number;
  overtime_hours?: number;
  normal_pay?: number;
  overtime_pay?: number;
  total_pay?: number;
  profiles?: {
    id: string;
    name: string;
    email: string;
    hourly_rate: number;
    role: string;
  };
}

const DetailedTimeReport: React.FC<DetailedTimeReportProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState('2025-05-01');
  const [endDate, setEndDate] = useState('2025-05-31');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [allDates, setAllDates] = useState<string[]>([]);

  // Filtrar funcionários para não exibir administradores
  const nonAdminEmployees = employees.filter(employee => employee.role !== 'admin');

  // Função para gerar todas as datas do período
  const generateDateRange = (start: string, end: string) => {
    const dates = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      dates.push(format(date, 'yyyy-MM-dd'));
    }
    return dates;
  };

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'EEEE', { locale: ptBR });
  };

  // Função para calcular horas trabalhadas
  const calculateHours = (clockIn: string, lunchStart: string, lunchEnd: string, clockOut: string) => {
    if (!clockIn || !clockOut) return { totalHours: 0, normalHours: 0, overtimeHours: 0 };

    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours + minutes / 60;
    };

    const clockInHours = parseTime(clockIn);
    const clockOutHours = parseTime(clockOut);
    const lunchStartHours = lunchStart ? parseTime(lunchStart) : 0;
    const lunchEndHours = lunchEnd ? parseTime(lunchEnd) : 0;

    // Calcular tempo de almoço
    const lunchHours = (lunchStart && lunchEnd) ? (lunchEndHours - lunchStartHours) : 0;
    
    // Calcular total de horas trabalhadas
    const totalHours = clockOutHours - clockInHours - lunchHours;
    
    // Calcular horas normais e extras (considerando 8h como jornada normal)
    const normalHours = Math.min(totalHours, 8);
    const overtimeHours = Math.max(0, totalHours - 8);

    return { totalHours, normalHours, overtimeHours };
  };

  // Função para calcular valores
  const calculatePay = (normalHours: number, overtimeHours: number, hourlyRate: number) => {
    const normalPay = normalHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * 1.5; // 50% adicional para horas extras
    const totalPay = normalPay + overtimePay;
    
    return { normalPay, overtimePay, totalPay };
  };

  const generateSingleEmployeeReport = async () => {
    if (!startDate || !endDate || !selectedEmployeeId) {
      alert('Selecione todos os campos para gerar o relatório');
      return;
    }

    setLoading(true);
    
    try {
      console.log('Buscando registros para o funcionário:', selectedEmployeeId);
      console.log('Período:', startDate, 'até', endDate);

      // Gerar todas as datas do período
      const dateRange = generateDateRange(startDate, endDate);
      setAllDates(dateRange);

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', selectedEmployeeId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) {
        console.error('Erro ao carregar registros:', error);
        alert('Erro ao carregar registros: ' + error.message);
        return;
      }

      console.log('Registros encontrados:', data);

      // Buscar informações do funcionário separadamente
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, hourly_rate, role')
        .eq('id', selectedEmployeeId)
        .single();

      if (profileError) {
        console.error('Erro ao carregar perfil do funcionário:', profileError);
      }

      // Criar um mapa dos registros por data
      const recordsMap = (data || []).reduce((acc, record) => {
        acc[record.date] = record;
        return acc;
      }, {} as Record<string, any>);

      // Combinar todas as datas com os registros existentes e calcular valores
      const completeRecords: TimeRecord[] = dateRange.map(date => {
        const record = recordsMap[date];
        
        if (record && profileData) {
          // Calcular horas se os dados estão disponíveis
          const { totalHours, normalHours, overtimeHours } = calculateHours(
            record.clock_in || '',
            record.lunch_start || '',
            record.lunch_end || '',
            record.clock_out || ''
          );
          
          // Calcular valores
          const { normalPay, overtimePay, totalPay } = calculatePay(
            normalHours,
            overtimeHours,
            Number(profileData.hourly_rate)
          );

          return {
            date,
            user_id: selectedEmployeeId,
            profiles: profileData,
            ...record,
            total_hours: totalHours,
            normal_hours: normalHours,
            overtime_hours: overtimeHours,
            normal_pay: normalPay,
            overtime_pay: overtimePay,
            total_pay: totalPay
          };
        }

        return {
          date,
          user_id: selectedEmployeeId,
          profiles: profileData || undefined,
          ...record
        };
      });

      setTimeRecords(completeRecords);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const generateAllEmployeesReport = async () => {
    if (!startDate || !endDate) {
      alert('Selecione o período para gerar o relatório');
      return;
    }

    setLoading(true);

    try {
      console.log('Buscando registros de todos os funcionários');
      console.log('Período:', startDate, 'até', endDate);

      // Gerar todas as datas do período
      const dateRange = generateDateRange(startDate, endDate);
      setAllDates(dateRange);

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('user_id', { ascending: true })
        .order('date', { ascending: true });

      if (error) {
        console.error('Erro ao carregar registros:', error);
        alert('Erro ao carregar registros: ' + error.message);
        return;
      }

      console.log('Registros encontrados:', data);

      // Buscar informações de todos os funcionários (somente não-administradores)
      const nonAdminIds = nonAdminEmployees.map(emp => emp.id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, hourly_rate, role')
        .in('id', nonAdminIds);

      if (profilesError) {
        console.error('Erro ao carregar perfis:', profilesError);
        alert('Erro ao carregar perfis dos funcionários');
        return;
      }

      // Criar um mapa dos registros por usuário e data
      const recordsMap = (data || []).reduce((acc, record) => {
        const key = `${record.user_id}-${record.date}`;
        acc[key] = record;
        return acc;
      }, {} as Record<string, any>);

      // Criar registros completos para todos os funcionários e todas as datas
      const completeRecords: TimeRecord[] = [];
      
      profilesData?.forEach(profile => {
        dateRange.forEach(date => {
          const key = `${profile.id}-${date}`;
          const record = recordsMap[key];
          
          if (record) {
            // Calcular horas se os dados estão disponíveis
            const { totalHours, normalHours, overtimeHours } = calculateHours(
              record.clock_in || '',
              record.lunch_start || '',
              record.lunch_end || '',
              record.clock_out || ''
            );
            
            // Calcular valores
            const { normalPay, overtimePay, totalPay } = calculatePay(
              normalHours,
              overtimeHours,
              Number(profile.hourly_rate)
            );

            completeRecords.push({
              date,
              user_id: profile.id,
              profiles: profile,
              ...record,
              total_hours: totalHours,
              normal_hours: normalHours,
              overtime_hours: overtimeHours,
              normal_pay: normalPay,
              overtime_pay: overtimePay,
              total_pay: totalPay
            });
          } else {
            completeRecords.push({
              date,
              user_id: profile.id,
              profiles: profile
            });
          }
        });
      });

      setTimeRecords(completeRecords);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '-';
    return timeString.slice(0, 5);
  };

  const formatCurrency = (value: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Agrupar registros por funcionário para exibição
  const groupedRecords = timeRecords.reduce((acc, record) => {
    const employeeName = record.profiles?.name || 'Funcionário Desconhecido';
    if (!acc[employeeName]) {
      acc[employeeName] = [];
    }
    acc[employeeName].push(record);
    return acc;
  }, {} as Record<string, TimeRecord[]>);

  // Calcular totais por funcionário
  const calculateEmployeeTotals = (records: TimeRecord[]) => {
    return records.reduce((totals, record) => {
      const totalHours = Number(record.total_hours || 0);
      const overtimeHours = Number(record.overtime_hours || 0);
      const totalPay = Number(record.total_pay || 0);
      
      return {
        totalHours: totals.totalHours + totalHours,
        overtimeHours: totals.overtimeHours + overtimeHours,
        totalPay: totals.totalPay + totalPay
      };
    }, { totalHours: 0, overtimeHours: 0, totalPay: 0 });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Card com filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Selecionar Período e Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Labels em linha */}
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Funcionário</Label>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Data Inicial</Label>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Data Final</Label>
                </div>
                <div></div>
                <div></div>
              </div>

              {/* Inputs e botões em linha */}
              <div className="grid grid-cols-5 gap-4 items-center">
                {/* Select Funcionário */}
                <div>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione o funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {nonAdminEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data Inicial */}
                <div>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10"
                  />
                </div>

                {/* Data Final */}
                <div>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10"
                  />
                </div>

                {/* Botão Gerar Individual */}
                <div>
                  <Button
                    onClick={generateSingleEmployeeReport}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-10 w-full"
                  >
                    <User className="w-4 h-4 mr-2" />
                    {loading ? 'Gerando...' : 'Gerar Individual'}
                  </Button>
                </div>

                {/* Botão Gerar Todos */}
                <div>
                  <Button
                    onClick={generateAllEmployeesReport}
                    disabled={loading}
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 h-10 w-full"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    {loading ? 'Gerando...' : 'Gerar Todos'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exibir relatórios agrupados por funcionário */}
        {Object.keys(groupedRecords).length > 0 && (
          <div className="space-y-8">
            {Object.entries(groupedRecords).map(([employeeName, records]) => {
              const totals = calculateEmployeeTotals(records);
              
              return (
                <Card key={employeeName}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {employeeName} ({totals.totalHours.toFixed(1)}h - {totals.overtimeHours.toFixed(1)}h extras - {formatCurrency(totals.totalPay)})
                    </CardTitle>
                  </CardHeader>
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
                        {records.map((record: TimeRecord, index: number) => {
                          const key = record.id || `${record.user_id || 'no-user'}-${record.date}-${index}`;
                          return (
                            <TableRow key={key}>
                              <TableCell>{format(new Date(record.date), 'dd/MM/yyyy')}</TableCell>
                              <TableCell>{getDayOfWeek(record.date)}</TableCell>
                              <TableCell>{formatTime(record.clock_in || '')}</TableCell>
                              <TableCell>{formatTime(record.lunch_start || '')}</TableCell>
                              <TableCell>{formatTime(record.lunch_end || '')}</TableCell>
                              <TableCell>{formatTime(record.clock_out || '')}</TableCell>
                              <TableCell>{record.total_hours ? Number(record.total_hours).toFixed(1) + 'h' : '-'}</TableCell>
                              <TableCell>{record.overtime_hours ? Number(record.overtime_hours).toFixed(1) + 'h' : '-'}</TableCell>
                              <TableCell>{formatCurrency(Number(record.total_pay || 0))}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailedTimeReport;
