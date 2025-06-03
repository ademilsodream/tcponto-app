import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, User, Users, FileDown, Search, Clock, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getActiveEmployees, type Employee } from '@/utils/employeeFilters';
import { useToast } from '@/components/ui/use-toast';

interface DetailedTimeReportProps {
  employees: Employee[];
  onBack?: () => void;
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
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  
  // Usar o contexto de moeda
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  // Usar useMemo para evitar recálculos desnecessários
  const activeEmployees = useMemo(() => getActiveEmployees(employees), [employees]);

  // Função para gerar todas as datas do período EXATO
  const generateDateRange = (start: string, end: string) => {
    const dates = [];
    const startDateObj = new Date(start + 'T00:00:00');
    const endDateObj = new Date(end + 'T00:00:00');
    
    console.log('Gerando datas do período:', start, 'até', end);
    console.log('Start date object:', startDateObj);
    console.log('End date object:', endDateObj);
    
    for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 1)) {
      const dateString = format(date, 'yyyy-MM-dd');
      dates.push(dateString);
    }
    
    console.log('Datas geradas:', dates);
    return dates;
  };

  // Função para validar se uma data está dentro do período
  const isDateInPeriod = (dateStr: string, start: string, end: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const startDateObj = new Date(start + 'T00:00:00');
    const endDateObj = new Date(end + 'T00:00:00');
    
    const isValid = date >= startDateObj && date <= endDateObj;
    console.log(`Data ${dateStr} está no período ${start} a ${end}?`, isValid);
    return isValid;
  };

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return format(date, 'EEEE', { locale: ptBR });
  };

  // Função para calcular valores
  const calculatePay = (normalHours: number, overtimeHours: number, hourlyRate: number) => {
    const normalPay = normalHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate; // Hora extra com mesmo valor da hora normal
    const totalPay = normalPay + overtimePay;
    
    return { normalPay, overtimePay, totalPay };
  };

  const generateReport = async () => {
    // ✨ NOVO: Validar se as datas foram selecionadas
    if (!startDate || !endDate) {
      toast({
        title: "Datas obrigatórias",
        description: "Por favor, selecione as datas de início e fim antes de pesquisar.",
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
        description: "Não há funcionários ativos cadastrados para gerar o relatório.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setTimeRecords([]); // Limpar dados anteriores
    
    try {
      console.log('=== INÍCIO GERAÇÃO RELATÓRIO ===');
      console.log('Funcionário selecionado:', selectedEmployeeId);
      console.log('Período selecionado:', startDate, 'até', endDate);

      // Converter datas para string
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      // Gerar APENAS as datas do período selecionado
      const dateRange = generateDateRange(startDateStr, endDateStr);
      console.log('Range de datas gerado:', dateRange);

      // Query baseada no funcionário selecionado
      let query = supabase
        .from('time_records')
        .select('*')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('user_id', { ascending: true })
        .order('date', { ascending: true });

      // Se um funcionário específico foi selecionado
      if (selectedEmployeeId !== 'all') {
        query = query.eq('user_id', selectedEmployeeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao carregar registros:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar registros de ponto",
          variant: "destructive"
        });
        return;
      }

      console.log('Registros encontrados na consulta:', data);

      // Determinar IDs dos funcionários para buscar
      let employeeIds: string[];
      if (selectedEmployeeId === 'all') {
        employeeIds = activeEmployees.map(emp => emp.id);
      } else {
        employeeIds = [selectedEmployeeId];
      }
      
      // Buscar perfis dos funcionários
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, hourly_rate, role')
        .in('id', employeeIds)
        .eq('role', 'user')
        .or('status.is.null,status.eq.active');

      if (profilesError) {
        console.error('Erro ao carregar perfis:', profilesError);
        toast({
          title: "Erro",
          description: "Erro ao carregar perfis dos funcionários",
          variant: "destructive"
        });
        return;
      }

      // Criar um mapa dos registros por usuário e data
      const recordsMap = (data || []).reduce((acc, record) => {
        // Validar se a data do registro está REALMENTE no período
        if (isDateInPeriod(record.date, startDateStr, endDateStr)) {
          const key = `${record.user_id}-${record.date}`;
          acc[key] = record;
          console.log('Registro adicionado ao mapa:', key, record);
        } else {
          console.log('Registro REJEITADO (fora do período):', record.date);
        }
        return acc;
      }, {} as Record<string, any>);

      console.log('Mapa de registros válidos:', recordsMap);

      // Criar registros completos APENAS para o período selecionado
      const completeRecords: TimeRecord[] = [];
      
      profilesData?.forEach(profile => {
        dateRange.forEach(date => {
          const key = `${profile.id}-${date}`;
          const record = recordsMap[key];
          
          if (record) {
            // Usar a função padronizada com tolerância de 15 minutos
            const { totalHours, normalHours, overtimeHours } = calculateWorkingHours(
              record.clock_in || '',
              record.lunch_start || '',
              record.lunch_end || '',
              record.clock_out || ''
            );
            
            // Calcular valores com hora extra igual à hora normal
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

      console.log('Registros completos para exibição:', completeRecords);
      console.log('Total de registros no resultado:', completeRecords.length);
      setTimeRecords(completeRecords);

      toast({
        title: "Sucesso",
        description: `Relatório gerado com ${completeRecords.length} registros`,
      });

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao gerar relatório",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // ✨ NOVA: Função para limpar pesquisa
  const handleClearSearch = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedEmployeeId('all');
    setTimeRecords([]);
    setHasSearched(false);
    console.log('🧹 Pesquisa limpa');
    
    toast({
      title: "Pesquisa limpa",
      description: "Filtros e resultados foram resetados.",
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '-';
    return timeString.slice(0, 5);
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

  if (activeEmployees.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Relatório Detalhado de Horários
                  </h1>
                  <p className="text-sm text-gray-600">Relatório completo de registros de ponto e cálculos financeiros</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="text-center py-8">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum funcionário ativo encontrado</h3>
              <p className="text-sm text-gray-500">
                Cadastre funcionários ativos (não administradores) para visualizar relatórios detalhados.
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
                  <Clock className="w-5 h-5" />
                  Relatório Detalhado de Horários
                </h1>
                <p className="text-sm text-gray-600">Relatório completo de registros de ponto e cálculos financeiros</p>
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
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
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

                {/* ✨ MUDANÇA: Só mostrar estatísticas após pesquisar */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total de Registros</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {hasSearched ? timeRecords.length : '-'}
                  </div>
                </div>
              </div>

              {/* ✨ NOVOS: Botões de ação */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={generateReport}
                  disabled={loading || !startDate || !endDate}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Search className="w-4 h-4 mr-2 animate-spin" />
                      Gerando relatório...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Gerar Relatório
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

              {/* ✨ NOVO: Aviso sobre obrigatoriedade das datas */}
              {(!startDate || !endDate) && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Atenção:</strong> Selecione as datas de início e fim para gerar o relatório.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ✨ MUDANÇA: Condicional para mostrar resultados */}
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <Search className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                  Carregando relatório detalhado...
                </div>
              </CardContent>
            </Card>
          ) : hasSearched ? (
            // Mostrar resultados apenas após pesquisar
            Object.keys(groupedRecords).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedRecords).map(([employeeName, records]) => {
                  const totals = calculateEmployeeTotals(records);
                  
                  return (
                    <Card key={employeeName}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-5 h-5" />
                            {employeeName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {startDate && endDate && (
                              <span>
                                {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}
                              </span>
                            )}
                          </div>
                        </CardTitle>
                        <div className="flex gap-6 text-sm text-gray-600">
                          <span>Total de Horas: <strong>{totals.totalHours.toFixed(1)}h</strong></span>
                          <span>Horas Extras: <strong>{totals.overtimeHours.toFixed(1)}h</strong></span>
                          <span>Valor Total: <strong>{formatCurrency(totals.totalPay)}</strong></span>
                        </div>
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
                              {records.map((record: TimeRecord, index: number) => {
                                const key = record.id || `${record.user_id || 'no-user'}-${record.date}-${index}`;
                                return (
                                  <TableRow key={key}>
                                    <TableCell>{format(new Date(record.date + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
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
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-gray-500 py-12">
                    <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
                  </div>
                </CardContent>
              </Card>
            )
          ) : (
            // ✨ NOVO: Estado inicial - sem dados
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500 py-12">
                  <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Relatório Detalhado de Horários
                  </h3>
                  <p className="text-sm">
                    Selecione as datas de início e fim, escolha um funcionário (ou todos), depois clique em "Gerar Relatório" para visualizar os registros detalhados de ponto.
                  </p>
                  <div className="mt-4 text-xs text-gray-400">
                    💡 Este relatório inclui cálculos de horas normais, extras e valores financeiros baseados na taxa horária de cada funcionário.
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

export default DetailedTimeReport;
