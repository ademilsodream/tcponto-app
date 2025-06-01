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
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();

  useEffect(() => {
    loadAllowedLocations();
  }, []);

  const loadAllowedLocations = async () => {
    try {
      console.log('🏢 AutoDeObras: Carregando localizações permitidas...');
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('id, name, latitude, longitude, range_meters, address')
        .eq('is_active', true);

      if (error) {
        console.error('❌ Erro ao carregar localizações permitidas:', error);
        setAllowedLocations([]);
        return;
      }

      console.log(`✅ AutoDeObras: ${data?.length || 0} localizações carregadas:`);
      data?.forEach((loc, i) => {
        console.log(`   ${i + 1}. "${loc.name}"`);
      });
      setAllowedLocations(data || []);
    } catch (error) {
      console.error('💥 Erro inesperado ao carregar localizações:', error);
      setAllowedLocations([]);
    }
  };

  // Verificar se uma localização existe na lista de permitidas
  const isValidLocationName = (locationName: string): boolean => {
    const isValid = allowedLocations.some(loc => {
      const match = loc.name.trim() === locationName.trim();
      console.log(`🔍 Comparando: "${loc.name.trim()}" === "${locationName.trim()}" = ${match}`);
      return match;
    });
    console.log(`📍 LocationName "${locationName}" é válido: ${isValid}`);
    return isValid;
  };

  const extractLocationName = (locations: any): string | null => {
    console.log('📍 AutoDeObras: Extraindo locationName dos dados completos:', JSON.stringify(locations, null, 2));
    
    if (!locations || typeof locations !== 'object') {
      console.log('❌ Dados de localização inválidos ou nulos');
      return null;
    }

    let locationName = null;
    
    // Verificar todas as estruturas possíveis com logs detalhados
    if (locations.clockIn) {
      console.log('🔍 Encontrada estrutura clockIn:', JSON.stringify(locations.clockIn, null, 2));
      if (locations.clockIn.locationName) {
        locationName = locations.clockIn.locationName;
        console.log(`✅ LocationName encontrado em clockIn: "${locationName}"`);
      }
    }
    
    if (!locationName && locations.clock_in) {
      console.log('🔍 Encontrada estrutura clock_in:', JSON.stringify(locations.clock_in, null, 2));
      if (locations.clock_in.locationName) {
        locationName = locations.clock_in.locationName;
        console.log(`✅ LocationName encontrado em clock_in: "${locationName}"`);
      }
    }
    
    if (!locationName && locations.locationName) {
      console.log('🔍 Encontrada locationName na raiz');
      locationName = locations.locationName;
      console.log(`✅ LocationName encontrado na raiz: "${locationName}"`);
    }

    // Verificar todas as chaves do objeto locations para debug
    console.log('🔍 Todas as chaves no objeto locations:', Object.keys(locations));
    
    if (!locationName) {
      console.log('❌ Nenhum locationName encontrado em nenhuma estrutura');
      console.log('📋 Estrutura completa para análise:', JSON.stringify(locations, null, 2));
      return null;
    }

    console.log(`📍 LocationName extraído final: "${locationName}"`);
    return locationName.trim();
  };

  const loadAutoObrasData = async () => {
    if (!startDate || !endDate || employees.length === 0) {
      console.log('⚠️ AutoDeObras: Dados insuficientes para carregar');
      return;
    }

    setLoading(true);
    console.log('\n🚀 AutoDeObras: Iniciando carregamento de dados...');
    
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    console.log(`📅 Período selecionado: ${startDateStr} até ${endDateStr}`);
    console.log(`📅 Período formatado: ${format(startDate, 'dd/MM/yyyy')} até ${format(endDate, 'dd/MM/yyyy')}`);

    try {
      // Consulta time_records
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
        .gt('total_hours', 0)
        .not('profiles.department_id', 'is', null)
        .not('profiles.job_function_id', 'is', null);

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

      console.log(`📊 Registros encontrados no período: ${timeRecords?.length || 0}`);
      timeRecords?.forEach((record, i) => {
        console.log(`   ${i + 1}. ${record.profiles.name} - ${record.date} - ${record.total_hours}h`);
      });

      // Buscar valores do auto de obras
      const { data: autoValues, error: autoError } = await supabase
        .from('auto_obras_values')
        .select('department_id, job_function_id, auto_value')
        .eq('is_active', true);

      if (autoError) {
        console.error('❌ Erro ao carregar valores do auto:', autoError);
      }

      console.log(`💰 Valores do auto carregados: ${autoValues?.length || 0}`);

      const autoValuesMap = new Map<string, number>();
      autoValues?.forEach(av => {
        const key = `${av.department_id}-${av.job_function_id}`;
        autoValuesMap.set(key, av.auto_value);
        console.log(`💰 Auto-valor configurado: ${key} = R$ ${av.auto_value}`);
      });

      // Processar dados por funcionário e localização
      const employeeMap = new Map<string, EmployeeAutoObrasData>();
      let totalRecords = timeRecords?.length || 0;
      let recordsWithValidLocation = 0;
      let recordsWithAutoValue = 0;
      let recordsProcessed = 0;

      console.log('\n🔄 Iniciando processamento dos registros...');

      timeRecords?.forEach((record, index) => {
        console.log(`\n📝 === PROCESSANDO REGISTRO ${index + 1}/${totalRecords} ===`);
        console.log(`   ID: ${record.id}`);
        console.log(`   Funcionário: ${record.profiles.name}`);
        console.log(`   Data: ${record.date}`);
        console.log(`   Horas: ${record.total_hours}`);
        
        const profile = record.profiles;
        
        // FILTRO 1: Verificar se tem valor do auto
        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;
        
        console.log(`   Auto-valor key: ${autoKey}`);
        console.log(`   Auto-valor encontrado: R$ ${autoValue}`);
        
        if (autoValue <= 0) {
          console.log(`❌ Registro descartado - sem valor do auto`);
          return;
        }
        
        recordsWithAutoValue++;
        console.log(`✅ Registro tem valor do auto válido`);
        
        // FILTRO 2: Extrair locationName dos dados
        const locationName = extractLocationName(record.locations);
        if (!locationName) {
          console.log(`❌ Registro descartado - sem locationName nos dados`);
          return;
        }
        
        console.log(`✅ LocationName extraído: "${locationName}"`);
        
        // FILTRO 3: Verificar se locationName é válido (existe na lista de permitidas)
        if (!isValidLocationName(locationName)) {
          console.log(`❌ Registro descartado - locationName "${locationName}" não está na lista de permitidas`);
          return;
        }
        
        recordsWithValidLocation++;
        recordsProcessed++;
        
        console.log(`🎉 REGISTRO VÁLIDO PROCESSADO - ${profile.name} em ${locationName}`);

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
      });

      // Recontar dias únicos por localização
      const locationDaysMap = new Map<string, Map<string, Set<string>>>();
      
      timeRecords?.forEach((record) => {
        const profile = record.profiles;
        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;
        
        if (autoValue <= 0) return;
        
        const locationName = extractLocationName(record.locations);
        if (!locationName || !isValidLocationName(locationName)) return;

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

      // Debug info atualizado
      const debug = {
        period: `${startDateStr} até ${endDateStr}`,
        totalRecords,
        recordsWithValidLocation,
        recordsWithAutoValue,
        recordsProcessed,
        employeesWithData: result.length,
        recordsDiscarded: totalRecords - recordsProcessed,
        allowedLocationsCount: allowedLocations.length
      };

      console.log('\n📊 === RESUMO FINAL DO PROCESSAMENTO ===');
      console.log(`   Período: ${debug.period}`);
      console.log(`   Total de registros: ${debug.totalRecords}`);
      console.log(`   Com valor do auto: ${debug.recordsWithAutoValue}`);
      console.log(`   Com localização válida: ${debug.recordsWithValidLocation}`);
      console.log(`   Processados com sucesso: ${debug.recordsProcessed}`);
      console.log(`   Funcionários no resultado: ${debug.employeesWithData}`);
      console.log(`   Registros descartados: ${debug.recordsDiscarded}`);
      console.log(`   Localizações permitidas: ${debug.allowedLocationsCount}`);

      setDebugInfo(debug);
      setEmployeeAutoObrasData(result);

    } catch (error) {
      console.error('💥 Erro inesperado ao carregar dados:', error);
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
  }, [startDate, endDate, selectedEmployee, employees, allowedLocations]);

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
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800 text-sm">Informações de Processamento</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>Período: {debugInfo.period}</div>
                  <div>Registros encontrados: {debugInfo.totalRecords}</div>
                  <div>Processados: {debugInfo.recordsProcessed}</div>
                  <div>Descartados: {debugInfo.recordsDiscarded}</div>
                  <div>Com valor do auto: {debugInfo.recordsWithAutoValue}</div>
                  <div>Com localização válida: {debugInfo.recordsWithValidLocation}</div>
                  <div>Funcionários exibidos: {debugInfo.employeesWithData}</div>
                  <div>Localizações permitidas: {debugInfo.allowedLocationsCount}</div>
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
                      : 'Nenhum registro com locationName válido foi encontrado para o período selecionado.'
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
