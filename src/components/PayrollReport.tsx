import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, DollarSign, Clock, Users, Search, CalendarIcon, Clock4 } from 'lucide-react'; // Clock4 importado
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { getActiveEmployees, type Employee } from '@/utils/employeeFilters';
import { useToast } from '@/components/ui/use-toast';


interface PayrollReportProps {
  employees: Employee[];
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
  // Armazenar horas brutas por funcionário para cálculo total
  totalHoursRaw: number;
  normalHoursRaw: number;
  overtimeHoursRaw: number;
  // Armazenar horas arredondadas por funcionário para exibição na tabela
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  // Pagamentos arredondados por funcionário
  normalPay: number;
  overtimePay: number;
  totalPay: number;
}


const PayrollReport: React.FC<PayrollReportProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Estados para armazenar os totais brutos GERAIS (todos os funcionários)
  const [grandTotalHoursRaw, setGrandTotalHoursRaw] = useState(0);
  const [grandTotalOvertimeHoursRaw, setGrandTotalOvertimeHoursRaw] = useState(0);


  const { formatCurrency } = useCurrency();
  const { toast } = useToast();


  // Filtrar apenas funcionários ativos
  const activeEmployees = useMemo(() => getActiveEmployees(employees), [employees]);


  // Função para formatar horas no padrão HH:MM
  const formatHoursAsTime = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined || hours === 0) return '00:00';

    const totalMinutes = Math.round(hours * 60);
    const hoursDisplay = Math.floor(totalMinutes / 60);
    const minutesDisplay = totalMinutes % 60;

    return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
  };


  const generatePayroll = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Datas obrigatórias",
        description: "Por favor, selecione as datas de início e fim antes de gerar o relatório.",
        variant: "destructive"
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        title: "Período inválido",
        description: "A data de início deve ser anterior à data de fim.",
        variant: "destructive"
      });
      return;
    }


    if (activeEmployees.length === 0) {
      toast({
        title: "Sem funcionários",
        description: "Nenhum funcionário ativo encontrado para gerar folha de pagamento.",
        variant: "destructive"
      });
      return;
    }


    setLoading(true);
    setHasSearched(true);
    setPayrollData([]);
    // Resetar totais brutos gerais
    setGrandTotalHoursRaw(0);
    setGrandTotalOvertimeHoursRaw(0);


    try {
      console.log('=== INÍCIO GERAÇÃO FOLHA DE PAGAMENTO ===');

      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      console.log('Período selecionado:', startDateStr, 'até', endDateStr);


      const payrollResults: PayrollData[] = [];
      // Acumuladores brutos GERAIS dentro da função
      let currentGrandTotalHoursRaw = 0;
      let currentGrandTotalOvertimeHoursRaw = 0;


      // Determinar funcionários para processar
      let employeesToProcess;
      if (selectedEmployee === 'all') {
        employeesToProcess = activeEmployees;
      } else {
        employeesToProcess = activeEmployees.filter(emp => emp.id === selectedEmployee);
      }


      // Buscar dados dos funcionários do banco (apenas os necessários)
      const employeeIds = employeesToProcess.map(emp => emp.id);
      const { data: dbEmployees, error: employeesError } = await supabase
        .from('profiles')
        .select('id, name, email, hourly_rate, overtime_rate')
        .in('id', employeeIds)
        .eq('role', 'user')
        .or('status.is.null,status.eq.active');


      if (employeesError) {
        console.error('Erro ao buscar funcionários:', employeesError);
        toast({
          title: "Erro",
          description: "Erro ao buscar funcionários",
          variant: "destructive"
        });
        return;
      }


      console.log('Funcionários ativos encontrados:', dbEmployees);


      for (const employee of dbEmployees) {
        console.log(`\n=== Processando funcionário: ${employee.name} ===`);

        // Buscar registros do funcionário APENAS no período selecionado
        const { data: timeRecords, error } = await supabase
          .from('time_records')
          .select('date, clock_in, lunch_start, lunch_end, clock_out')
          .eq('user_id', employee.id)
          .gte('date', startDateStr)
          .lte('date', endDateStr);


        if (error) {
          console.error('Erro ao buscar registros:', error);
          continue;
        }


        console.log(`Registros encontrados na consulta para ${employee.name}:`, timeRecords);


        let totalHoursRawPerEmployee = 0; // Acumulador bruto POR FUNCIONÁRIO
        let totalNormalHoursRawPerEmployee = 0; // Acumulador bruto POR FUNCIONÁRIO
        let totalOvertimeHoursRawPerEmployee = 0; // Acumulador bruto POR FUNCIONÁRIO


        // Calcular horas de TODOS os registros retornados pela consulta (já filtrados por data)
        if (timeRecords && timeRecords.length > 0) {
          timeRecords.forEach(record => {
            // Usar a função padronizada
            const { totalHours: dayTotalHours, normalHours: dayNormalHours, overtimeHours: dayOvertimeHours } =
              calculateWorkingHours(record.clock_in, record.lunch_start, record.lunch_end, record.clock_out);

            console.log(`Horas do dia ${record.date}:`, {
              dayTotalHours,
              dayNormalHours,
              dayOvertimeHours
            });

            totalHoursRawPerEmployee += dayTotalHours;
            totalNormalHoursRawPerEmployee += dayNormalHours;
            totalOvertimeHoursRawPerEmployee += dayOvertimeHours;

            // Acumular nos totais brutos GERAIS
            currentGrandTotalHoursRaw += dayTotalHours;
            currentGrandTotalOvertimeHoursRaw += dayOvertimeHours;
          });
        }


        console.log(`Totais BRUTOS POR FUNCIONÁRIO para ${employee.name}:`, {
          totalHoursRawPerEmployee,
          totalNormalHoursRawPerEmployee,
          totalOvertimeHoursRawPerEmployee
        });


        // Usar o hourly_rate e overtime_rate do banco de dados
        const hourlyRate = Number(employee.hourly_rate) || 0;
        const overtimeRate = Number(employee.overtime_rate) || hourlyRate;


        // Calcular pagamentos usando horas BRUTAS POR FUNCIONÁRIO
        const normalPay = totalNormalHoursRawPerEmployee * hourlyRate;
        const overtimePay = totalOvertimeHoursRawPerEmployee * overtimeRate;
        const totalPayRaw = normalPay + overtimePay;


        // Arredondar o total de pagamento do funcionário para 2 casas decimais
        const totalPayRounded = parseFloat(totalPayRaw.toFixed(2));
        console.log(`Total de pagamento ARREDONDADO para ${employee.name}:`, totalPayRounded);


        payrollResults.push({
          employee: {
            id: employee.id,
            name: employee.name,
            email: employee.email,
            hourlyRate: hourlyRate,
            overtimeRate: overtimeRate
          },
          // Armazenar totais brutos POR FUNCIONÁRIO
          totalHoursRaw: totalHoursRawPerEmployee,
          normalHoursRaw: totalNormalHoursRawPerEmployee,
          overtimeHoursRaw: totalOvertimeHoursRawPerEmployee,
          // Arredondar horas para exibição na tabela (1 casa decimal)
          totalHours: Math.round(totalHoursRawPerEmployee * 10) / 10,
          normalHours: Math.round(totalNormalHoursRawPerEmployee * 10) / 10,
          overtimeHours: Math.round(totalOvertimeHoursRawPerEmployee * 10) / 10,
          // Arredondar pagamentos para exibição (2 casas decimais)
          normalPay: parseFloat(normalPay.toFixed(2)),
          overtimePay: parseFloat(overtimePay.toFixed(2)),
          totalPay: totalPayRounded // Total de pagamento ARREDONDADO por funcionário
        });
      }


      // Atualizar estados com os totais brutos GERAIS
      setGrandTotalHoursRaw(currentGrandTotalHoursRaw);
      setGrandTotalOvertimeHoursRaw(currentGrandTotalOvertimeHoursRaw);


      console.log('=== RESULTADO FINAL DA FOLHA DE PAGAMENTO ===');
      console.log('Dados da folha de pagamento para o período:', payrollResults);
      console.log('Totais Brutos GERAIS:', {
        grandTotalHoursRaw: currentGrandTotalHoursRaw,
        grandTotalOvertimeHoursRaw: currentGrandTotalOvertimeHoursRaw,
      });
      setPayrollData(payrollResults);


      toast({
        title: "Sucesso",
        description: `Folha de pagamento gerada para ${payrollResults.length} funcionário(s)`,
      });


    } catch (error) {
      console.error('Erro ao gerar folha de pagamento:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao gerar folha de pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  // Função para limpar pesquisa
  const handleClearSearch = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedEmployee('all');
    setPayrollData([]);
    setHasSearched(false);
    // Resetar totais brutos gerais ao limpar
    setGrandTotalHoursRaw(0);
    setGrandTotalOvertimeHoursRaw(0);

    toast({
      title: "Pesquisa limpa",
      description: "Filtros e resultados foram resetados.",
    });
  };


  const getTotalPayroll = () => {
    // Soma os totais de pagamento *arredondados* por funcionário
    // E aplica um arredondamento final no total geral para exibição
    const sum = payrollData.reduce((sum, data) => sum + data.totalPay, 0);
    return parseFloat(sum.toFixed(2)); // Arredonda o total geral para 2 casas
  };


  // Usar o total bruto GERAL para calcular o total de horas
  const getTotalHours = () => {
    // Arredonda o total bruto GERAL para 1 casa decimal para exibição
    return Math.round(grandTotalHoursRaw * 10) / 10;
  };


  // Usar o total bruto GERAL para calcular o total de horas extras
  const getTotalOvertimeHours = () => {
    // Arredonda o total bruto GERAL para 1 casa decimal para exibição
    return Math.round(grandTotalOvertimeHoursRaw * 10) / 10;
  };


  if (activeEmployees.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Folha de Pagamento
                  </h1>
                  <p className="text-sm text-gray-600">Relatório de pagamentos e horas trabalhadas</p>
                </div>
              </div>
            </div>
          </div>
        </header>


        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum funcionário ativo encontrado</h3>
              <p className="text-sm text-gray-500">
                Cadastre funcionários ativos (não administradores) para gerar folhas de pagamento.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Folha de Pagamento
                </h1>
                <p className="text-sm text-gray-600">Relatório de pagamentos e horas trabalhadas</p>
              </div>
            </div>
          </div>
        </div>
      </header>


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Inicial *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>


                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Final *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>


                <div className="space-y-2">
                  <label className="text-sm font-medium">Funcionário</label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os funcionários" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os funcionários</SelectItem>
                      {activeEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>


                <div className="space-y-2">
                  <label className="text-sm font-medium">Funcionários</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {hasSearched ? payrollData.length : '-'}
                  </div>
                </div>
              </div>


              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={generatePayroll}
                  disabled={loading || !startDate || !endDate}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Search className="w-4 h-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Gerar Folha de Pagamento
                    </>
                  )}
                </Button>

                {hasSearched && (
                  <Button
                    variant="outline"
                    onClick={handleClearSearch}
                    disabled={loading}
                  >
                    Limpar
                  </Button>
                )}
              </div>


              {(!startDate || !endDate) && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Atenção:</strong> Selecione as datas de início e fim para gerar a folha de pagamento.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>


          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <Search className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                  Gerando folha de pagamento...
                </div>
              </CardContent>
            </Card>
          ) : hasSearched ? (
            payrollData.length > 0 ? (
              <>
                {/* Resumo Total */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
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
                        {/* Exibe o total geral arredondado */}
                        {formatHoursAsTime(getTotalHours())}
                      </div>
                    </CardContent>
                  </Card>


                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Horas Extras</CardTitle>
                      <Clock4 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {/* Exibe o total geral arredondado */}
                        {formatHoursAsTime(getTotalOvertimeHours())}
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
                          ({format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')})
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Valor/Hora Normal</TableHead>
                            <TableHead>Valor/Hora Extra</TableHead>
                            <TableHead>Total de Horas</TableHead>
                            <TableHead>Horas Normais</TableHead>
                            <TableHead>Horas Extras</TableHead>
                            <TableHead>Pagamento Normal</TableHead>
                            <TableHead>Pagamento Extra</TableHead>
                            <TableHead>Total a Receber</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payrollData.map((data) => (
                            <TableRow key={data.employee.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{data.employee.name}</div>
                                  <div className="text-sm text-gray-500">{data.employee.email}</div>
                                </div>
                              </TableCell>
                              <TableCell>{formatCurrency(data.employee.hourlyRate)}</TableCell>
                              <TableCell>{formatCurrency(data.employee.overtimeRate)}</TableCell>
                              {/* Exibe horas arredondadas POR FUNCIONÁRIO na tabela */}
                              <TableCell>{formatHoursAsTime(data.totalHours)}</TableCell>
                              <TableCell>{formatHoursAsTime(data.normalHours)}</TableCell>
                              <TableCell>{formatHoursAsTime(data.overtimeHours)}</TableCell>
                              <TableCell>{formatCurrency(data.normalPay)}</TableCell>
                              <TableCell>{formatCurrency(data.overtimePay)}</TableCell>
                              <TableCell className="font-bold text-accent-600">
                                {formatCurrency(data.totalPay)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-gray-500 py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Nenhum registro encontrado
                    </h3>
                    <p className="text-sm">
                      {startDate && endDate ? (
                        `Nenhum registro de ponto encontrado para o período de ${format(startDate, 'dd/MM/yyyy')} até ${format(endDate, 'dd/MM/yyyy')}.`
                      ) : (
                        'Nenhum registro de ponto encontrado para os filtros selecionados.'
                      )}
                  </p>
                  <div className="mt-4 text-xs text-gray-400">
                    💰 Este relatório calcula pagamentos baseados nas horas trabalhadas e valores por hora configurados.
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500 py-12">
                  <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Folha de Pagamento
                  </h3>
                  <p className="text-sm">
                    Selecione as datas de início e fim, escolha um funcionário (ou todos), depois clique em "Gerar Folha de Pagamento" para visualizar os dados.
                  </p>
                  <div className="mt-4 text-xs text-gray-400">
                    💰 Este relatório calcula pagamentos baseados nas horas trabalhadas e valores por hora configurados.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};


export default PayrollReport;
