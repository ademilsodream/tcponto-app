
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, DollarSign, Clock } from 'lucide-react';

interface PayrollReportProps {
  onBack: () => void;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  hourlyRate: number;
  overtimeRate: number;
}

interface PayrollData {
  employee: Employee;
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  normalPay: number;
  overtimePay: number;
  totalPay: number;
}

const PayrollReport: React.FC<PayrollReportProps> = ({ onBack }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  // Mock data para demonstração
  const mockEmployees: Employee[] = [
    {
      id: '1',
      name: 'João Silva',
      email: 'joao@tcponto.com',
      hourlyRate: 25,
      overtimeRate: 37.5
    },
    {
      id: '3',
      name: 'Ana Santos',
      email: 'ana@tcponto.com',
      hourlyRate: 30,
      overtimeRate: 45
    }
  ];

  const generatePayroll = () => {
    if (!startDate || !endDate) {
      alert('Selecione o período para gerar a folha de pagamento');
      return;
    }

    // Simulação de dados de folha de pagamento
    const mockPayroll: PayrollData[] = mockEmployees.map(employee => {
      // Simulando dados aleatórios para demonstração
      const totalHours = Math.round((Math.random() * 50 + 150) * 10) / 10; // Entre 150-200h
      const normalHours = Math.min(totalHours, 176); // 22 dias úteis * 8h
      const overtimeHours = Math.max(0, totalHours - 176);
      
      const normalPay = normalHours * employee.hourlyRate;
      const overtimePay = overtimeHours * employee.overtimeRate;
      const totalPay = normalPay + overtimePay;

      return {
        employee,
        totalHours,
        normalHours,
        overtimeHours,
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
                    R$ {getTotalPayroll().toFixed(2)}
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
                            R$ {data.normalPay.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            R$ {data.overtimePay.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-accent-600">
                            R$ {data.totalPay.toFixed(2)}
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
