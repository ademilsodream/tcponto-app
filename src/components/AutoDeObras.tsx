import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, ArrowLeft, CalendarIcon, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/components/ui/use-toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate?: number | null;
}

interface AllowedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  address: string;
}

interface EmployeeAutoObrasData {
  employeeId: string;
  employeeName: string;
  departmentId: string;
  jobFunctionId: string;
  autoValue: number;
  locations: Array<{
    locationName: string;
    totalHours: number;
    totalDays: number;
    totalValue: number;
  }>;
}

interface AutoDeObrasProps {
  employees: User[];
  onBack?: () => void;
}

const AutoDeObras: React.FC<AutoDeObrasProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employeeAutoObrasData, setEmployeeAutoObrasData] = useState<EmployeeAutoObrasData[]>([]);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();

  const extractLocationName = (locations: any): string | null => {
    console.log('📍 Extraindo locationName dos dados:', JSON.stringify(locations, null, 2));
    
    if (!locations || typeof locations !== 'object') {
      console.log('❌ Dados de localização inválidos');
      return null;
    }

    let locationName = null;
    
    if (locations.clock_in && locations.clock_in.locationName) {
      locationName = locations.clock_in.locationName;
      console.log(`✅ LocationName encontrado em clock_in: "${locationName}"`);
    }
    else if (locations.clockIn && locations.clockIn.locationName) {
      locationName = locations.clockIn.locationName;
      console.log(`✅ LocationName encontrado em clockIn: "${locationName}"`);
    }
    else if (locations.locationName) {
      locationName = locations.locationName;
      console.log(`✅ LocationName encontrado na raiz: "${locationName}"`);
    }

    if (!locationName) {
      console.log('❌ Nenhum locationName encontrado');
      return null;
    }

    return locationName;
  };

  const loadAutoObrasData = async () => {
    if (!startDate || !endDate || employees.length === 0) {
      console.log('⚠️ Dados insuficientes para carregar');
      return;
    }

    setLoading(true);
    console.log('\n🚀 === IMPLEMENTAÇÃO DO PLANO FINAL ===');
    
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    console.log(`📅 PERÍODO: ${startDateStr} até ${endDateStr}`);

    try {
      // QUERY SIMPLIFICADA - Removendo filtros restritivos
      let query = supabase
        .from('time_records')
        .select(`
          id, 
          date, 
          user_id, 
          locations, 
          total_hours,
          profiles!inner(
            id,
            name,
            department_id,
            job_function_id
          )
        `)
        .eq('status', 'active')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .not('total_hours', 'is', null)
        .gt('total_hours', 0);
        // REMOVIDO: filtros de department_id e job_function_id

      if (selectedEmployee !== 'all') {
        query = query.eq('user_id', selectedEmployee);
        console.log(`👤 Filtro por funcionário: ${selectedEmployee}`);
      }

      const { data: timeRecords, error } = await query.order('date', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar dados:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar registros de ponto",
          variant: "destructive"
        });
        setEmployeeAutoObrasData([]);
        return;
      }

      console.log(`📊 REGISTROS ENCONTRADOS: ${timeRecords?.length || 0}`);

      // Log detalhado de cada registro encontrado
      timeRecords?.forEach((record, index) => {
        console.log(`\n📝 REGISTRO ${index + 1}: ${record.profiles.name} - ${record.date}`);
        console.log(`   Horas: ${record.total_hours}h`);
        console.log(`   Locations:`, record.locations);
        
        // LOG ESPECÍFICO PARA USUARIO DE TESTE
        if (record.profiles.name === 'Usuario de teste') {
          console.log(`🎯 USUARIO DE TESTE ENCONTRADO!`);
          console.log(`   Data: ${record.date}`);
          console.log(`   Horas: ${record.total_hours}`);
          console.log(`   Department ID: ${record.profiles.department_id}`);
          console.log(`   Job Function ID: ${record.profiles.job_function_id}`);
          console.log(`   Locations completo:`, JSON.stringify(record.locations, null, 2));
        }
      });

      // Buscar valores do auto de obras
      const { data: autoValues, error: autoError } = await supabase
        .from('auto_obras_values')
        .select('department_id, job_function_id, auto_value')
        .eq('is_active', true);

      if (autoError) {
        console.error('❌ Erro ao carregar valores do auto:', autoError);
      }

      const autoValuesMap = new Map<string, number>();
      autoValues?.forEach(av => {
        const key = `${av.department_id}-${av.job_function_id}`;
        autoValuesMap.set(key, av.auto_value);
        console.log(`💰 Auto-valor: ${key} = R$ ${av.auto_value}`);
      });

      // PROCESSAMENTO SIMPLIFICADO E DIRETO
      const employeeMap = new Map<string, EmployeeAutoObrasData>();
      let totalProcessed = 0;
      let totalValid = 0;

      console.log('\n=== PROCESSAMENTO DIRETO E SIMPLIFICADO ===');

      timeRecords?.forEach((record, index) => {
        console.log(`\n📝 PROCESSANDO REGISTRO ${index + 1}: ${record.profiles.name} - ${record.date}`);
        
        const profile = record.profiles;
        
        // LOG ESPECÍFICO PARA USUARIO DE TESTE
        if (profile.name === 'Usuario de teste') {
          console.log(`🎯 PROCESSANDO USUARIO DE TESTE!`);
        }
        
        // Verificar se tem department_id e job_function_id
        if (!profile.department_id || !profile.job_function_id) {
          console.log(`❌ Sem department_id ou job_function_id`);
          if (profile.name === 'Usuario de teste') {
            console.log(`🚨 USUARIO DE TESTE REJEITADO POR FALTA DE DEPARTMENT/JOB!`);
          }
          return;
        }
        
        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;
        
        console.log(`💰 Auto-chave: ${autoKey}, Auto-valor: R$ ${autoValue}`);
        
        if (autoValue <= 0) {
          console.log(`❌ Sem valor do auto para: ${autoKey}`);
          if (profile.name === 'Usuario de teste') {
            console.log(`🚨 USUARIO DE TESTE REJEITADO POR FALTA DE AUTO-VALOR!`);
          }
          return;
        }
        
        // Extrair locationName
        const locationName = extractLocationName(record.locations);
        if (!locationName) {
          console.log(`❌ Sem locationName`);
          if (profile.name === 'Usuario de teste') {
            console.log(`🚨 USUARIO DE TESTE REJEITADO POR FALTA DE LOCATION NAME!`);
          }
          return;
        }
        
        // PROCESSAMENTO DIRETO - SEM VALIDAÇÕES ADICIONAIS
        console.log(`✅ REGISTRO VÁLIDO! LocationName: "${locationName}"`);
        
        if (profile.name === 'Usuario de teste') {
          console.log(`🎉 USUARIO DE TESTE APROVADO PARA PROCESSAMENTO!`);
          console.log(`   LocationName: "${locationName}"`);
          console.log(`   Horas: ${record.total_hours}`);
          console.log(`   Auto-valor: R$ ${autoValue}`);
          console.log(`   Valor total: R$ ${Number(record.total_hours) * autoValue}`);
        }
        
        totalProcessed++;
        totalValid++;

        // Criar/atualizar dados do funcionário
        if (!employeeMap.has(record.user_id)) {
          employeeMap.set(record.user_id, {
            employeeId: record.user_id,
            employeeName: profile.name,
            departmentId: profile.department_id,
            jobFunctionId: profile.job_function_id,
            autoValue: autoValue,
            locations: []
          });
        }

        const employeeData = employeeMap.get(record.user_id)!;
        let locationEntry = employeeData.locations.find(loc => loc.locationName === locationName);
        
        if (!locationEntry) {
          locationEntry = {
            locationName: locationName,
            totalHours: 0,
            totalDays: 0,
            totalValue: 0
          };
          employeeData.locations.push(locationEntry);
        }

        locationEntry.totalHours += Number(record.total_hours);
        locationEntry.totalValue = locationEntry.totalHours * autoValue;
        
        if (profile.name === 'Usuario de teste') {
          console.log(`🎯 USUARIO DE TESTE ADICIONADO:`, {
            locationName: locationEntry.locationName,
            totalHours: locationEntry.totalHours,
            totalValue: locationEntry.totalValue
          });
        }
      });

      // Contar dias únicos
      const locationDaysMap = new Map<string, Map<string, Set<string>>>();
      
      timeRecords?.forEach((record) => {
        const profile = record.profiles;
        
        if (!profile.department_id || !profile.job_function_id) return;
        
        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;
        
        if (autoValue <= 0) return;
        
        const locationName = extractLocationName(record.locations);
        if (!locationName) return;

        if (!locationDaysMap.has(record.user_id)) {
          locationDaysMap.set(record.user_id, new Map());
        }
        
        const userLocationDays = locationDaysMap.get(record.user_id)!;
        if (!userLocationDays.has(locationName)) {
          userLocationDays.set(locationName, new Set());
        }
        
        userLocationDays.get(locationName)!.add(record.date);
      });

      // Atualizar contagem de dias
      for (const [userId, employeeData] of employeeMap) {
        const userLocationDays = locationDaysMap.get(userId);
        if (userLocationDays) {
          employeeData.locations.forEach(loc => {
            const daysSet = userLocationDays.get(loc.locationName);
            loc.totalDays = daysSet ? daysSet.size : 0;
          });
        }
      }

      const result = Array.from(employeeMap.values())
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

      console.log('\n=== RESULTADO FINAL ===');
      console.log(`📊 Registros processados: ${totalProcessed}`);
      console.log(`✅ Registros válidos: ${totalValid}`);
      console.log(`👥 Funcionários no resultado: ${result.length}`);

      result.forEach(emp => {
        console.log(`👤 ${emp.employeeName}:`);
        emp.locations.forEach(loc => {
          console.log(`   📍 ${loc.locationName}: ${loc.totalHours}h = R$ ${loc.totalValue}`);
        });
        
        if (emp.employeeName === 'Usuario de teste') {
          console.log(`🎯 USUARIO DE TESTE NO RESULTADO FINAL:`, emp);
        }
      });

      setDebugInfo({
        period: `${startDateStr} até ${endDateStr}`,
        totalRecords: timeRecords?.length || 0,
        recordsProcessed: totalProcessed,
        recordsValid: totalValid,
        employeesWithData: result.length
      });

      setEmployeeAutoObrasData(result);

    } catch (error) {
      console.error('💥 Erro inesperado:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar dados",
        variant: "destructive"
      });
      setEmployeeAutoObrasData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadAutoObrasData();
    }
  }, [startDate, endDate, selectedEmployee, employees]);

  const filteredData = useMemo(() => {
    if (selectedEmployee === 'all') {
      return employeeAutoObrasData;
    }
    return employeeAutoObrasData.filter(data => data.employeeId === selectedEmployee);
  }, [employeeAutoObrasData, selectedEmployee]);

  const expandedData = useMemo(() => {
    const result: Array<{
      employeeId: string;
      employeeName: string;
      locationName: string;
      totalHours: number;
      totalDays: number;
      totalValue: number;
    }> = [];

    filteredData.forEach(employee => {
      if (employee.locations.length > 0) {
        employee.locations.forEach(location => {
          result.push({
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            locationName: location.locationName,
            totalHours: location.totalHours,
            totalDays: location.totalDays,
            totalValue: location.totalValue
          });
        });
      }
    });

    return result;
  }, [filteredData]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              {onBack && (
                <Button
                  onClick={onBack}
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-800"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              )}
              <div>
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Auto de Obras
                </h1>
                <p className="text-sm text-gray-600">Relatório de valores por localização e funcionário</p>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Inicial</label>
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
                      <Calendar
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
                  <label className="text-sm font-medium">Data Final</label>
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
                      <Calendar
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
                      {employees
                        .filter(employee => employee.id && typeof employee.id === 'string' && employee.id !== '')
                        .map(employee => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Registros Válidos</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {expandedData.length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Debug Info */}
          {debugInfo.totalRecords > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800 text-sm">✅ Plano Implementado - Processamento Simplificado</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-green-700">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div>Período: {debugInfo.period}</div>
                  <div>Registros encontrados: {debugInfo.totalRecords}</div>
                  <div>Processados: {debugInfo.recordsProcessed}</div>
                  <div>Válidos: {debugInfo.recordsValid}</div>
                  <div>Funcionários exibidos: {debugInfo.employeesWithData}</div>
                  <div><strong>Query simplificada ✅</strong></div>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">Carregando dados...</div>
              </CardContent>
            </Card>
          ) : expandedData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Relatório de Auto de Obras ({currency})</CardTitle>
                <p className="text-sm text-gray-600">Valores calculados com base no valor do auto por função</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Funcionário</TableHead>
                        <TableHead className="font-semibold">Local</TableHead>
                        <TableHead className="text-center font-semibold">Total de Horas</TableHead>
                        <TableHead className="text-center font-semibold">Total de Dias</TableHead>
                        <TableHead className="text-right font-semibold">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expandedData.map((row, index) => (
                        <TableRow key={`${row.employeeId}-${row.locationName}-${index}`}>
                          <TableCell className="font-medium">{row.employeeName}</TableCell>
                          <TableCell>{row.locationName}</TableCell>
                          <TableCell className="text-center">
                            {row.totalHours.toFixed(2)}h
                          </TableCell>
                          <TableCell className="text-center">
                            {row.totalDays} dia{row.totalDays !== 1 ? 's' : ''}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(row.totalValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500 py-12">
                  <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {!startDate || !endDate 
                      ? 'Selecione o período para visualizar os dados'
                      : 'Nenhum registro válido encontrado'
                    }
                  </h3>
                  <p className="text-sm">
                    {!startDate || !endDate
                      ? 'Escolha as datas inicial e final para gerar o relatório'
                      : 'Nenhum registro com locationName foi encontrado para o período selecionado.'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoDeObras;
