
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, Clock, User, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';

interface Employee {
  id: string;
  name: string;
  email: string;
  hourlyRate: number;
  overtimeRate: number;
}

interface DetailedTimeReportProps {
  employees: Employee[];
  onBack: () => void;
}

interface DayRecord {
  date: string;
  dayOfWeek: string;
  clockIn?: string;
  lunchStart?: string;
  lunchEnd?: string;
  clockOut?: string;
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  totalPay: number;
}

interface EmployeeDetailedReport {
  employee: Employee;
  days: DayRecord[];
  totalHours: number;
  totalNormalHours: number;
  totalOvertimeHours: number;
  totalPay: number;
}

const DetailedTimeReport: React.FC<DetailedTimeReportProps> = ({ employees, onBack }) => {
  const { formatCurrency } = useCurrency();
  
  const [startDate, setStartDate] = useState('2025-05-01');
  const [endDate, setEndDate] = useState('2025-05-31');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [reportData, setReportData] = useState<EmployeeDetailedReport | null>(null);
  const [allEmployeesData, setAllEmployeesData] = useState<EmployeeDetailedReport[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbEmployees, setDbEmployees] = useState<Employee[]>([]);

  // Carregar funcionários do banco de dados
  useEffect(() => {
    loadEmployeesFromDB();
  }, []);

  const loadEmployeesFromDB = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('email', 'admin@tcponto.com');

      if (error) {
        console.error('Erro ao carregar funcionários:', error);
        return;
      }

      const employeesData = data.map(emp => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        hourlyRate: Number(emp.hourly_rate) || 0,
        overtimeRate: Number(emp.hourly_rate) || 0 // Mesmo valor da hora normal
      }));

      setDbEmployees(employeesData);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  const calculateHours = (clockIn?: string, lunchStart?: string, lunchEnd?: string, clockOut?: string) => {
    if (!clockIn || !clockOut) return { totalHours: 0, normalHours: 0, overtimeHours: 0 };

    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const clockInMinutes = parseTime(clockIn);
    const clockOutMinutes = parseTime(clockOut);
    const lunchStartMinutes = lunchStart ? parseTime(lunchStart) : 0;
    const lunchEndMinutes = lunchEnd ? parseTime(lunchEnd) : 0;

    let lunchBreakMinutes = 0;
    if (lunchStart && lunchEnd && lunchEndMinutes > lunchStartMinutes) {
      lunchBreakMinutes = lunchEndMinutes - lunchStartMinutes;
    }

    const totalWorkedMinutes = clockOutMinutes - clockInMinutes - lunchBreakMinutes;
    let effectiveWorkedMinutes = totalWorkedMinutes;

    const extraMinutes = totalWorkedMinutes - 480;
    if (extraMinutes > 0 && extraMinutes <= 15) {
      effectiveWorkedMinutes = 480;
    }

    const totalHours = Math.max(0, effectiveWorkedMinutes / 60);

    let normalHours = Math.min(totalHours, 8);
    let overtimeHours = 0;

    if (totalHours > 8) {
      overtimeHours = totalHours - 8;
      normalHours = 8;
    }

    return { totalHours, normalHours, overtimeHours };
  };

  const generateDaysInPeriod = async (start: string, end: string, employee: Employee): Promise<DayRecord[]> => {
    const days: DayRecord[] = [];
    const startDateObj = new Date(start + 'T00:00:00');
    const endDateObj = new Date(end + 'T23:59:59');
    
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    // Buscar registros do funcionário no período exato
    const { data: timeRecords, error } = await supabase
      .from('time_records')
      .select('*')
      .eq('user_id', employee.id)
      .gte('date', start)
      .lte('date', end);

    if (error) {
      console.error('Erro ao buscar registros:', error);
    }

    console.log(`Registros para ${employee.name} no período ${start} a ${end}:`, timeRecords);

    // Criar mapa de registros por data
    const recordsMap = new Map();
    timeRecords?.forEach(record => {
      recordsMap.set(record.date, record);
    });
    
    // Gerar apenas os dias do período selecionado
    const currentDate = new Date(startDateObj);
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = dayNames[currentDate.getDay()];
      
      const record = recordsMap.get(dateStr);
      
      let dayRecord: DayRecord = {
        date: dateStr,
        dayOfWeek,
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        totalPay: 0
      };
      
      if (record) {
        // Usar os cálculos corretos
        const { totalHours, normalHours, overtimeHours } = calculateHours(
          record.clock_in, 
          record.lunch_start, 
          record.lunch_end, 
          record.clock_out
        );
        
        const normalPay = normalHours * employee.hourlyRate;
        const overtimePay = overtimeHours * employee.hourlyRate; // Mesmo valor da hora normal
        const totalPay = normalPay + overtimePay;

        dayRecord = {
          ...dayRecord,
          clockIn: record.clock_in || undefined,
          lunchStart: record.lunch_start || undefined,
          lunchEnd: record.lunch_end || undefined,
          clockOut: record.clock_out || undefined,
          totalHours: Math.round(totalHours * 10) / 10,
          normalHours: Math.round(normalHours * 10) / 10,
          overtimeHours: Math.round(overtimeHours * 10) / 10,
          totalPay: Math.round(totalPay * 100) / 100
        };
      }
      
      days.push(dayRecord);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const generateSingleEmployeeReport = async () => {
    if (!startDate || !endDate || !selectedEmployeeId) {
      alert('Selecione todos os campos para gerar o relatório');
      return;
    }

    setLoading(true);
    
    try {
      const employee = dbEmployees.find(e => e.id === selectedEmployeeId);
      if (!employee) return;

      const days = await generateDaysInPeriod(startDate, endDate, employee);
      
      const totalHours = days.reduce((sum, day) => sum + day.totalHours, 0);
      const totalNormalHours = days.reduce((sum, day) => sum + day.normalHours, 0);
      const totalOvertimeHours = days.reduce((sum, day) => sum + day.overtimeHours, 0);
      const totalPay = days.reduce((sum, day) => sum + day.totalPay, 0);

      setReportData({
        employee,
        days,
        totalHours: Math.round(totalHours * 10) / 10,
        totalNormalHours: Math.round(totalNormalHours * 10) / 10,
        totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
        totalPay: Math.round(totalPay * 100) / 100
      });
      
      setShowAllEmployees(false);
      setIsGenerated(true);
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
      const allReports: EmployeeDetailedReport[] = [];

      for (const employee of dbEmployees) {
        const days = await generateDaysInPeriod(startDate, endDate, employee);
        
        const totalHours = days.reduce((sum, day) => sum + day.totalHours, 0);
        const totalNormalHours = days.reduce((sum, day) => sum + day.normalHours, 0);
        const totalOvertimeHours = days.reduce((sum, day) => sum + day.overtimeHours, 0);
        const totalPay = days.reduce((sum, day) => sum + day.totalPay, 0);

        allReports.push({
          employee,
          days,
          totalHours: Math.round(totalHours * 10) / 10,
          totalNormalHours: Math.round(totalNormalHours * 10) / 10,
          totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
          totalPay: Math.round(totalPay * 100) / 100
        });
      }

      setAllEmployeesData(allReports);
      setShowAllEmployees(true);
      setIsGenerated(true);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const getTotalFromAllEmployees = () => {
    return allEmployeesData.reduce((totals, employeeData) => ({
      totalHours: totals.totalHours + employeeData.totalHours,
      totalPay: totals.totalPay + employeeData.totalPay,
      totalEmployees: totals.totalEmployees + 1
    }), { totalHours: 0, totalPay: 0, totalEmployees: 0 });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                onClick={onBack}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-primary-900">Relatório Detalhado de Horas</h1>
                <p className="text-sm text-gray-600">Relatório diário por funcionário</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Selecionar Período e Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="employee">Funcionário</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {dbEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <Button
                onClick={generateSingleEmployeeReport}
                disabled={loading}
                className="bg-primary-800 hover:bg-primary-700"
              >
                <User className="w-4 h-4 mr-2" />
                {loading ? 'Gerando...' : 'Gerar Individual'}
              </Button>

              <Button
                onClick={generateAllEmployeesReport}
                disabled={loading}
                variant="outline"
                className="border-primary-300 text-primary-700 hover:bg-primary-50"
              >
                <Users className="w-4 h-4 mr-2" />
                {loading ? 'Gerando...' : 'Gerar Todos'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatório Individual */}
        {isGenerated && !showAllEmployees && reportData && (
          <>
            {/* Resumo do Funcionário */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Funcionário</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold text-primary-900">
                    {reportData.employee.name}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(reportData.employee.hourlyRate)}/hora
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Horas</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary-900">
                    {reportData.totalHours.toFixed(1)}h
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{reportData.totalOvertimeHours.toFixed(1)}h extras
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Dias Trabalhados</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary-900">
                    {reportData.days.filter(day => day.totalHours > 0).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    de {reportData.days.length} dias
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent-600">
                    {formatCurrency(reportData.totalPay)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Dias */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Detalhamento Diário
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({new Date(startDate).toLocaleDateString('pt-BR')} a {new Date(endDate).toLocaleDateString('pt-BR')})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
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
                      {reportData.days.map((day) => (
                        <TableRow key={day.date} className={day.totalHours === 0 ? 'bg-gray-50' : ''}>
                          <TableCell className="font-medium">
                            {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>{day.dayOfWeek}</TableCell>
                          <TableCell>{day.clockIn || '-'}</TableCell>
                          <TableCell>{day.lunchStart || '-'}</TableCell>
                          <TableCell>{day.lunchEnd || '-'}</TableCell>
                          <TableCell>{day.clockOut || '-'}</TableCell>
                          <TableCell>
                            {day.totalHours > 0 ? `${day.totalHours.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell>
                            {day.overtimeHours > 0 ? `${day.overtimeHours.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell className="font-medium text-accent-600">
                            {day.totalPay > 0 ? formatCurrency(day.totalPay) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Relatório de Todos os Funcionários */}
        {isGenerated && showAllEmployees && allEmployeesData.length > 0 && (
          <>
            {/* Resumo Geral */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Funcionários</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary-900">
                    {getTotalFromAllEmployees().totalEmployees}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Horas</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary-900">
                    {getTotalFromAllEmployees().totalHours.toFixed(1)}h
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent-600">
                    {formatCurrency(getTotalFromAllEmployees().totalPay)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Funcionários */}
            {allEmployeesData.map((employeeData, index) => (
              <Card key={employeeData.employee.id} className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {employeeData.employee.name}
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      ({employeeData.totalHours.toFixed(1)}h - {formatCurrency(employeeData.totalPay)})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
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
                        {employeeData.days.map((day) => (
                          <TableRow key={`${employeeData.employee.id}-${day.date}`} className={day.totalHours === 0 ? 'bg-gray-50' : ''}>
                            <TableCell className="font-medium">
                              {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>{day.dayOfWeek}</TableCell>
                            <TableCell>{day.clockIn || '-'}</TableCell>
                            <TableCell>{day.lunchStart || '-'}</TableCell>
                            <TableCell>{day.lunchEnd || '-'}</TableCell>
                            <TableCell>{day.clockOut || '-'}</TableCell>
                            <TableCell>
                              {day.totalHours > 0 ? `${day.totalHours.toFixed(1)}h` : '-'}
                            </TableCell>
                            <TableCell>
                              {day.overtimeHours > 0 ? `${day.overtimeHours.toFixed(1)}h` : '-'}
                            </TableCell>
                            <TableCell className="font-medium text-accent-600">
                              {day.totalPay > 0 ? formatCurrency(day.totalPay) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default DetailedTimeReport;
