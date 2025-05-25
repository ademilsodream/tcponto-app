
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, DollarSign, Clock } from 'lucide-react';
import { calculateDayHours } from '@/utils/timeCalculations';

interface PayrollReportProps {
  employees: Array<{
    id: string;
    name: string;
    email: string;
    hourlyRate: number;
    overtimeRate: number;
  }>;
  onBack: () => void;
}

interface PayrollData {
  employee: {
    id: string;
    name: string;
    email: string;
    hourlyRate: number;
    overtimeRate: number;
  };
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  normalPay: number;
  overtimePay: number;
  totalPay: number;
}

// Função para gerar dados mock de maio de 2025
const generateMayTimeData = (employeeId: string) => {
  const may2025 = new Date(2025, 4, 1); // Maio é mês 4 (0-indexed)
  const daysInMay = 31;
  const weekdays = [];
  
  // Gerar apenas dias úteis (segunda a sexta)
  for (let day = 1; day <= daysInMay; day++) {
    const date = new Date(2025, 4, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Segunda a sexta
      weekdays.push(day);
    }
  }
  
  let totalHours = 0;
  let totalNormalHours = 0;
  let totalOvertimeHours = 0;
  
  weekdays.forEach(day => {
    // Gerar horários aleatórios mas realistas
    const entryHour = 8 + Math.floor(Math.random() * 2); // Entre 8h e 9h
    const entryMinute = Math.floor(Math.random() * 60);
    
    const lunchStartHour = 12 + Math.floor(Math.random() * 2); // Entre 12h e 13h
    const lunchStartMinute = Math.floor(Math.random() * 60);
    
    const lunchEndHour = lunchStartHour + 1; // 1 hora de almoço
    const lunchEndMinute = lunchStartMinute;
    
    const exitHour = 17 + Math.floor(Math.random() * 3); // Entre 17h e 19h
    const exitMinute = Math.floor(Math.random() * 60);
    
    const workStart = `${entryHour.toString().padStart(2, '0')}:${entryMinute.toString().padStart(2, '0')}`;
    const lunchStart = `${lunchStartHour.toString().padStart(2, '0')}:${lunchStartMinute.toString().padStart(2, '0')}`;
    const lunchEnd = `${lunchEndHour.toString().padStart(2, '0')}:${lunchEndMinute.toString().padStart(2, '0')}`;
    const workEnd = `${exitHour.toString().padStart(2, '0')}:${exitMinute.toString().padStart(2, '0')}`;
    
    const dayCalculation = calculateDayHours(workStart, lunchStart, lunchEnd, workEnd);
    
    totalHours += dayCalculation.totalHours;
    totalNormalHours += dayCalculation.normalHours;
    totalOvertimeHours += dayCalculation.overtimeHours;
  });
  
  return {
    totalHours: Math.round(totalHours * 10) / 10,
    normalHours: Math.round(totalNormalHours * 10) / 10,
    overtimeHours: Math.round(totalOvertimeHours * 10) / 10
  };
};

const PayrollReport: React.FC<PayrollReportProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState('2025-05-01');
  const [endDate, setEndDate] = useState('2025-05-31');
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  const generatePayroll = () => {
    if (!startDate || !endDate) {
      alert('Selecione o período para gerar a folha de pagamento');
      return;
    }

    const mockPayroll: PayrollData[] = employees.map(employee => {
      const timeData = generateMayTimeData(employee.id);
      
      const normalPay = timeData.normalHours * employee.hourlyRate;
      const overtimePay = timeData.overtimeHours * employee.overtimeRate;
      const totalPay = normalPay + overtimePay;

      return {
        employee,
        totalHours: timeData.totalHours,
        normalHours: timeData.normalHours,
        overtimeHours: timeData.overtimeHours,
        normalPay,
        overtimePay,
        totalPay
      };
    });

    setPayrollData(mockPayroll);
    setIsGenerated(true);
  };

  const getTotalPayroll = () => {
    return payrollData.reduce((sum, data) => sum + data.totalPay, 0);
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
                <h1 className="text-xl font-semibold text-primary-900">Folha de Pagamento</h1>
                <p className="text-sm text-gray-600">Relatório de pagamentos por período</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros de Período */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Selecionar Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
                onClick={generatePayroll}
                className="bg-primary-800 hover:bg-primary-700"
              >
                Gerar Folha de Pagamento
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatório de Folha de Pagamento */}
        {isGenerated && (
          <>
            {/* Resumo Total */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Funcionários</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary-900">
                    {payrollData.length}
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
                    {payrollData.reduce((sum, data) => sum + data.totalHours, 0).toFixed(1)}h
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total da Folha</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent-600">
                    € {getTotalPayroll().toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Folha de Pagamento */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Detalhamento da Folha de Pagamento
                  {startDate && endDate && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      ({new Date(startDate).toLocaleDateString('pt-BR')} a {new Date(endDate).toLocaleDateString('pt-BR')})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Funcionário
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total de Horas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Horas Normais
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Horas Extras
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pagamento Normal
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pagamento Extra
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total a Receber
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payrollData.map((data) => (
                        <tr key={data.employee.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {data.employee.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {data.employee.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {data.totalHours.toFixed(1)}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {data.normalHours.toFixed(1)}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {data.overtimeHours.toFixed(1)}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            € {data.normalPay.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            € {data.overtimePay.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-accent-600">
                            € {data.totalPay.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default PayrollReport;
