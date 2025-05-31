
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, DollarSign, Clock } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { isValidQueryResult, filterValidProfiles, filterValidTimeRecords, safeStringCast, isValidProfile } from '@/utils/queryValidation';

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
  const [loading, setLoading] = useState(false);
  const { formatCurrency } = useCurrency();

  // Função para validar se uma data está dentro do período
  const isDateInPeriod = (dateStr: string, start: string, end: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    
    const isValid = date >= startDate && date <= endDate;
    console.log(`[PayrollReport] Data ${dateStr} está no período ${start} a ${end}?`, isValid);
    return isValid;
  };

  const generatePayroll = async () => {
    if (!startDate || !endDate) {
      alert('Selecione o período para gerar a folha de pagamento');
      return;
    }

    setLoading(true);
    // Limpar dados anteriores
    setPayrollData([]);
    setIsGenerated(false);
    
    try {
      console.log('=== INÍCIO GERAÇÃO FOLHA DE PAGAMENTO ===');
      console.log('Período selecionado:', startDate, 'até', endDate);

      const payrollResults: PayrollData[] = [];

      // Buscar todos os funcionários do banco, excluindo administradores
      const { data: dbEmployees, error: employeesError } = await supabase
        .from('profiles')
        .select('*')
        .neq('email', safeStringCast('admin@tcponto.com'));

      if (employeesError) {
        console.error('Erro ao buscar funcionários:', employeesError);
        alert('Erro ao buscar funcionários');
        return;
      }

      // Verificar se os dados são válidos
      if (!isValidQueryResult(dbEmployees, employeesError)) {
        console.error('Dados inválidos retornados para profiles');
        alert('Erro: dados de funcionários inválidos');
        return;
      }

      // Filtrar apenas registros válidos de profiles
      const validEmployees = filterValidProfiles(dbEmployees);
      console.log('Funcionários encontrados:', validEmployees);

      for (const employee of validEmployees) {
        // Verificar se o funcionário é válido antes de processar
        if (!isValidProfile(employee)) {
          console.log(`Funcionário inválido ignorado:`, employee);
          continue;
        }

        console.log(`\n=== Processando funcionário: ${employee.name} ===`);
        
        // Buscar registros do funcionário APENAS no período selecionado
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

        // Verificar se os dados são válidos
        if (!isValidQueryResult(timeRecords, error)) {
          console.log(`Registros inválidos para ${employee.name}`);
          continue;
        }

        // Filtrar apenas registros válidos
        const validRecords = filterValidTimeRecords(timeRecords);
        console.log(`Registros encontrados na consulta para ${employee.name}:`, validRecords);

        let totalHours = 0;
        let totalNormalHours = 0;
        let totalOvertimeHours = 0;

        // Calcular horas APENAS dos registros VÁLIDOS do período selecionado
        if (validRecords && validRecords.length > 0) {
          const periodRecords = validRecords.filter(record => {
            const isValid = isDateInPeriod(record.date, startDate, endDate);
            if (!isValid) {
              console.log(`Registro REJEITADO para ${employee.name}:`, record.date);
            }
            return isValid;
          });

          console.log(`Registros VÁLIDOS para ${employee.name}:`, periodRecords);

          periodRecords.forEach(record => {
            // Usar a função padronizada com tolerância de 15 minutos
            const { totalHours: dayTotalHours, normalHours: dayNormalHours, overtimeHours: dayOvertimeHours } = 
              calculateWorkingHours(record.clock_in, record.lunch_start, record.lunch_end, record.clock_out);
            
            console.log(`Horas do dia ${record.date}:`, {
              dayTotalHours,
              dayNormalHours,
              dayOvertimeHours
            });
            
            totalHours += dayTotalHours;
            totalNormalHours += dayNormalHours;
            totalOvertimeHours += dayOvertimeHours;
          });
        }

        console.log(`Totais para ${employee.name}:`, {
          totalHours,
          totalNormalHours,
          totalOvertimeHours
        });

        // Usar o hourly_rate do banco de dados
        const hourlyRate = Number(employee.hourly_rate) || 0;
        
        // Calcular pagamentos - hora extra com mesmo valor da hora normal
        const normalPay = totalNormalHours * hourlyRate;
        const overtimePay = totalOvertimeHours * hourlyRate; // Mesmo valor da hora normal
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
          normalHours: Math.round(totalNormalHours * 10) / 10,
          overtimeHours: Math.round(totalOvertimeHours * 10) / 10,
          normalPay,
          overtimePay,
          totalPay
        });
      }

      console.log('=== RESULTADO FINAL DA FOLHA DE PAGAMENTO ===');
      console.log('Dados da folha de pagamento para o período:', payrollResults);
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

  return (
    <div className="min-h-screen bg-gray-50">
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
                      ({new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')})
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
