
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateDayHours } from '@/utils/timeCalculations';

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
  const [startDate, setStartDate] = useState('2025-05-01');
  const [endDate, setEndDate] = useState('2025-05-31');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [reportData, setReportData] = useState<EmployeeDetailedReport | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);

  const generateDaysInPeriod = (start: string, end: string): DayRecord[] => {
    const days: DayRecord[] = [];
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = dayNames[date.getDay()];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      let dayRecord: DayRecord = {
        date: dateStr,
        dayOfWeek,
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        totalPay: 0
      };
      
      // Gerar dados mock apenas para dias úteis
      if (!isWeekend) {
        const entryHour = 8 + Math.floor(Math.random() * 2);
        const entryMinute = Math.floor(Math.random() * 60);
        
        const lunchStartHour = 12 + Math.floor(Math.random() * 2);
        const lunchStartMinute = Math.floor(Math.random() * 60);
        
        const lunchEndHour = lunchStartHour + 1;
        const lunchEndMinute = lunchStartMinute;
        
        const exitHour = 17 + Math.floor(Math.random() * 3);
        const exitMinute = Math.floor(Math.random() * 60);
        
        const clockIn = `${entryHour.toString().padStart(2, '0')}:${entryMinute.toString().padStart(2, '0')}`;
        const lunchStart = `${lunchStartHour.toString().padStart(2, '0')}:${lunchStartMinute.toString().padStart(2, '0')}`;
        const lunchEnd = `${lunchEndHour.toString().padStart(2, '0')}:${lunchEndMinute.toString().padStart(2, '0')}`;
        const clockOut = `${exitHour.toString().padStart(2, '0')}:${exitMinute.toString().padStart(2, '0')}`;
        
        const calculation = calculateDayHours(clockIn, lunchStart, lunchEnd, clockOut);
        
        dayRecord = {
          ...dayRecord,
          clockIn,
          lunchStart,
          lunchEnd,
          clockOut,
          totalHours: calculation.totalHours,
          normalHours: calculation.normalHours,
          overtimeHours: calculation.overtimeHours,
          totalPay: (calculation.normalHours * employees.find(e => e.id === selectedEmployeeId)!.hourlyRate) + 
                   (calculation.overtimeHours * employees.find(e => e.id === selectedEmployeeId)!.overtimeRate)
        };
      }
      
      days.push(dayRecord);
    }
    
    return days;
  };

  const generateReport = () => {
    if (!startDate || !endDate || !selectedEmployeeId) {
      alert('Selecione todos os campos para gerar o relatório');
      return;
    }

    const employee = employees.find(e => e.id === selectedEmployeeId);
    if (!employee) return;

    const days = generateDaysInPeriod(startDate, endDate);
    
    const totalHours = days.reduce((sum, day) => sum + day.totalHours, 0);
    const totalNormalHours = days.reduce((sum, day) => sum + day.normalHours, 0);
    const totalOvertimeHours = days.reduce((sum, day) => sum + day.overtimeHours, 0);
    const totalPay = days.reduce((sum, day) => sum + day.totalPay, 0);

    setReportData({
      employee,
      days,
      totalHours,
      totalNormalHours,
      totalOvertimeHours,
      totalPay
    });
    
    setIsGenerated(true);
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="employee">Funcionário</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
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
                onClick={generateReport}
                className="bg-primary-800 hover:bg-primary-700"
              >
                Gerar Relatório
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatório Detalhado */}
        {isGenerated && reportData && (
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
                    € {reportData.employee.hourlyRate.toFixed(2)}/hora
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
                    € {reportData.totalPay.toFixed(2)}
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
                            {new Date(day.date).toLocaleDateString('pt-BR')}
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
                            {day.totalPay > 0 ? `€ ${day.totalPay.toFixed(2)}` : '-'}
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
      </div>
    </div>
  );
};

export default DetailedTimeReport;
