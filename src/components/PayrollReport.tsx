
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, DollarSign, Clock, FileText } from 'lucide-react';
import DetailedTimeReport from './DetailedTimeReport';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';

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

const PayrollReport: React.FC<PayrollReportProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState('2025-05-01');
  const [endDate, setEndDate] = useState('2025-05-31');
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const { formatCurrency } = useCurrency();

  const generatePayroll = async () => {
    if (!startDate || !endDate) {
      alert('Selecione o período para gerar a folha de pagamento');
      return;
    }

    setLoading(true);
    
    try {
      const payrollResults: PayrollData[] = [];

      // Buscar todos os funcionários do banco, excluindo administradores
      const { data: dbEmployees, error: employeesError } = await supabase
        .from('profiles')
        .select('*')
        .neq('email', 'admin@tcponto.com');

      if (employeesError) {
        console.error('Erro ao buscar funcionários:', employeesError);
        alert('Erro ao buscar funcionários');
        return;
      }

      console.log('Funcionários encontrados:', dbEmployees);

      for (const employee of dbEmployees) {
        // Buscar registros do funcionário no período
        const { data: timeRecords, error } = await supabase
          .from('time_records')
          .select('*')
          .eq('user_id', employee.id)
          .gte('date', startDate)
          .lte('date', endDate);

        if (error) {
          console.error('Erro ao buscar registros:', error);
          continue;
        }

        console.log(`Registros para ${employee.name}:`, timeRecords);

        // Calcular totais
        const totalHours = timeRecords?.reduce((sum, record) => sum + Number(record.total_hours || 0), 0) || 0;
        const normalHours = timeRecords?.reduce((sum, record) => sum + Number(record.normal_hours || 0), 0) || 0;
        const overtimeHours = timeRecords?.reduce((sum, record) => sum + Number(record.overtime_hours || 0), 0) || 0;

        // Usar o hourly_rate do banco de dados
        const hourlyRate = Number(employee.hourly_rate) || 0;
        
        // Calcular pagamentos - hora extra com mesmo valor da hora normal
        const normalPay = normalHours * hourlyRate;
        const overtimePay = overtimeHours * hourlyRate; // Mesmo valor da hora normal
        const totalPay = normalPay + overtimePay;

        payrollResults.push({
          employee: {
            id: employee.id,
            name: employee.name,
            email: employee.email,
            hourlyRate: hourlyRate,
            overtimeRate: hourlyRate // Mesmo valor da hora normal
          },
          totalHours: Math.round(totalHours * 10) / 10,
          normalHours: Math.round(normalHours * 10) / 10,
          overtimeHours: Math.round(overtimeHours * 10) / 10,
          normalPay,
          overtimePay,
          totalPay
        });
      }

      console.log('Dados da folha de pagamento:', payrollResults);
      setPayrollData(payrollResults);
      setIsGenerated(true);
    } catch (error) {
      console.error('Erro ao gerar folha de pagamento:', error);
      alert('Erro ao gerar folha de pagamento');
    } finally {
      setLoading(false);
    }
  };

  const getTotalPayroll = () => {
    return payrollData.reduce((sum, data) => sum + data.totalPay, 0);
  };

  if (showDetailedReport) {
    // Converter dados dos funcionários do banco para o formato esperado
    const employeesForReport = payrollData.map(data => data.employee);
    return <DetailedTimeReport employees={employeesForReport} onBack={() => setShowDetailedReport(false)} />;
  }

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
            
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setShowDetailedReport(true)}
                variant="outline"
                size="sm"
                className="text-primary-700 border-primary-200 hover:bg-primary-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Relatório Detalhado
              </Button>
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
                disabled={loading}
                className="bg-primary-800 hover:bg-primary-700"
              >
                {loading ? 'Gerando...' : 'Gerar Folha de Pagamento'}
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
                    {formatCurrency(getTotalPayroll())}
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
                          Valor/Hora
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
                            {formatCurrency(data.employee.hourlyRate)}
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
                            {formatCurrency(data.normalPay)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(data.overtimePay)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-accent-600">
                            {formatCurrency(data.totalPay)}
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
