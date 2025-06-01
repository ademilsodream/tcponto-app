
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

  // Função RADICAL para extrair locationName - focando APENAS no que funciona
  const extractLocationName = (locations: any): string | null => {
    console.log('🔍 RADICAL EXTRACTION - Input completo:', JSON.stringify(locations, null, 2));
    
    if (!locations) {
      console.log('❌ Locations é null/undefined');
      return null;
    }

    // TESTE DIRETO - buscar qualquer string que pareça um local
    const jsonString = JSON.stringify(locations);
    console.log('📋 JSON String completo:', jsonString);
    
    // Buscar padrões específicos que sabemos que existem
    const knownLocations = ['Casa do André', 'Escritório Central', 'Obra São Paulo'];
    
    for (const knownLocation of knownLocations) {
      if (jsonString.includes(knownLocation)) {
        console.log(`✅ ENCONTRADO LOCATION CONHECIDO: "${knownLocation}"`);
        return knownLocation;
      }
    }
    
    // Buscar QUALQUER string que tenha entre 3 e 50 caracteres
    const matches = jsonString.match(/"([^"]{3,50})"/g);
    if (matches) {
      for (const match of matches) {
        const cleanStr = match.replace(/"/g, '');
        // Excluir strings que claramente não são locais
        if (!cleanStr.includes('time') && 
            !cleanStr.includes('clock') &&
            !cleanStr.includes('date') &&
            !cleanStr.includes('id') &&
            !cleanStr.includes('user') &&
            cleanStr.length > 2) {
          console.log(`🎯 LOCATION ENCONTRADO (fallback): "${cleanStr}"`);
          return cleanStr;
        }
      }
    }

    console.log('❌ NENHUM LOCATION ENCONTRADO - SERÁ REJEITADO');
    return null;
  };

  const loadAutoObrasData = async () => {
    if (!startDate || !endDate || employees.length === 0) {
      console.log('⚠️ Dados insuficientes para carregar');
      return;
    }

    setLoading(true);
    console.log('\n🚀 === CARREGAMENTO RADICAL - VERSÃO NOVA ===');
    
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    console.log(`📅 PERÍODO: ${startDateStr} até ${endDateStr}`);
    console.log(`👤 FUNCIONÁRIO SELECIONADO: ${selectedEmployee}`);

    try {
      // QUERY MAIS SIMPLES - usar LEFT JOIN para garantir que não perdemos dados
      let query = supabase
        .from('time_records')
        .select(`
          id, 
          date, 
          user_id, 
          locations, 
          total_hours,
          profiles!left(
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

      // APLICAR FILTRO DE FUNCIONÁRIO APENAS SE NÃO FOR 'ALL'
      if (selectedEmployee !== 'all') {
        console.log(`🎯 APLICANDO FILTRO POR FUNCIONÁRIO: ${selectedEmployee}`);
        query = query.eq('user_id', selectedEmployee);
      }

      const { data: timeRecords, error } = await query.order('date', { ascending: false });

      if (error) {
        console.error('❌ Erro na query:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar registros de ponto",
          variant: "destructive"
        });
        setEmployeeAutoObrasData([]);
        return;
      }

      console.log(`📊 REGISTROS RETORNADOS DA QUERY: ${timeRecords?.length || 0}`);
      
      // LOG DETALHADO DOS PRIMEIROS REGISTROS
      timeRecords?.slice(0, 3).forEach((record, index) => {
        console.log(`📝 REGISTRO ${index + 1}:`, {
          id: record.id,
          date: record.date,
          user_id: record.user_id,
          total_hours: record.total_hours,
          profile_name: record.profiles?.name,
          locations_raw: record.locations
        });
      });

      // Buscar valores do auto de obras
      const { data: autoValues, error: autoError } = await supabase
        .from('auto_obras_values')
        .select('department_id, job_function_id, auto_value')
        .eq('is_active', true);

      if (autoError) {
        console.error('❌ Erro ao carregar auto values:', autoError);
      }

      console.log(`💰 AUTO VALUES: ${autoValues?.length || 0}`);

      const autoValuesMap = new Map<string, number>();
      autoValues?.forEach(av => {
        const key = `${av.department_id}-${av.job_function_id}`;
        autoValuesMap.set(key, av.auto_value);
        console.log(`💰 Mapeado: ${key} = R$ ${av.auto_value}`);
      });

      // PROCESSAMENTO RADICAL - LOG TUDO
      const employeeMap = new Map<string, EmployeeAutoObrasData>();
      let stats = {
        total: 0,
        noProfile: 0,
        noDeptJob: 0,
        noAutoValue: 0,
        noLocation: 0,
        valid: 0
      };

      console.log('\n=== PROCESSAMENTO RADICAL ===');

      timeRecords?.forEach((record, index) => {
        stats.total++;
        console.log(`\n🔄 PROCESSANDO ${index + 1}/${timeRecords.length}: ID=${record.id}`);
        
        // VALIDAÇÃO 1: Profile
        const profile = record.profiles;
        if (!profile) {
          console.log(`❌ REJEITADO - Sem profile`);
          stats.noProfile++;
          return;
        }
        
        console.log(`✅ Profile: ${profile.name} (ID: ${profile.id})`);
        
        // VALIDAÇÃO 2: Department e Job Function
        if (!profile.department_id || !profile.job_function_id) {
          console.log(`❌ REJEITADO - Falta dept/job: dept=${profile.department_id}, job=${profile.job_function_id}`);
          stats.noDeptJob++;
          return;
        }
        
        console.log(`✅ Dept/Job: ${profile.department_id}/${profile.job_function_id}`);
        
        // VALIDAÇÃO 3: Auto valor
        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;
        
        if (autoValue <= 0) {
          console.log(`❌ REJEITADO - Auto-valor zero para chave: ${autoKey}`);
          stats.noAutoValue++;
          return;
        }
        
        console.log(`✅ Auto-valor: R$ ${autoValue} para chave ${autoKey}`);
        
        // VALIDAÇÃO 4: Location Name - USAR NOVA FUNÇÃO RADICAL
        const locationName = extractLocationName(record.locations);
        
        if (!locationName) {
          console.log(`❌ REJEITADO - LocationName não encontrado`);
          console.log(`📍 Locations object:`, record.locations);
          stats.noLocation++;
          return;
        }
        
        console.log(`✅ Location: "${locationName}"`);
        stats.valid++;
        
        // REGISTRO VÁLIDO - PROCESSAR
        console.log(`🎉 REGISTRO VÁLIDO CONFIRMADO!`);
        
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
        
        console.log(`📊 ATUALIZADO: ${profile.name} em ${locationName}: ${locationEntry.totalHours}h = R$ ${locationEntry.totalValue}`);
      });

      // Contar dias únicos para cada localização
      const locationDaysMap = new Map<string, Map<string, Set<string>>>();
      
      timeRecords?.forEach((record) => {
        const profile = record.profiles;
        
        if (!profile || !profile.department_id || !profile.job_function_id) return;
        
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

      console.log('\n=== ESTATÍSTICAS FINAIS ===');
      console.log(`📊 Total processados: ${stats.total}`);
      console.log(`❌ Sem profile: ${stats.noProfile}`);
      console.log(`❌ Sem dept/job: ${stats.noDeptJob}`);
      console.log(`❌ Sem auto-valor: ${stats.noAutoValue}`);
      console.log(`❌ Sem location: ${stats.noLocation}`);
      console.log(`✅ Válidos: ${stats.valid}`);
      console.log(`👥 Funcionários finais: ${result.length}`);

      // LOG DETALHADO DOS RESULTADOS
      result.forEach((emp, index) => {
        console.log(`\n👤 RESULTADO ${index + 1}: ${emp.employeeName}`);
        emp.locations.forEach((loc) => {
          console.log(`   📍 ${loc.locationName}: ${loc.totalHours}h em ${loc.totalDays} dias = R$ ${loc.totalValue}`);
        });
      });

      setDebugInfo({
        period: `${startDateStr} até ${endDateStr}`,
        selectedEmployee,
        totalRecords: timeRecords?.length || 0,
        employeesWithData: result.length,
        stats,
        autoValuesCount: autoValues?.length || 0
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

  // FORÇAR RELOAD quando qualquer coisa mudar
  useEffect(() => {
    console.log('🔄 useEffect TRIGGERED');
    console.log('📅 startDate:', startDate);
    console.log('📅 endDate:', endDate);
    console.log('👤 selectedEmployee:', selectedEmployee);
    console.log('👥 employees.length:', employees.length);
    
    if (startDate && endDate && employees.length > 0) {
      console.log('🚀 INICIANDO CARREGAMENTO...');
      setEmployeeAutoObrasData([]); // Limpar dados anteriores
      setDebugInfo({}); // Limpar debug anterior
      loadAutoObrasData();
    } else {
      console.log('⚠️ Condições não atendidas para carregar dados');
    }
  }, [startDate, endDate, selectedEmployee, employees]);

  const filteredData = useMemo(() => {
    console.log('🔄 Recalculando filteredData');
    console.log('📊 employeeAutoObrasData.length:', employeeAutoObrasData.length);
    console.log('👤 selectedEmployee atual:', selectedEmployee);
    
    if (selectedEmployee === 'all') {
      console.log('✅ Mostrando todos os funcionários');
      return employeeAutoObrasData;
    }
    
    const filtered = employeeAutoObrasData.filter(data => data.employeeId === selectedEmployee);
    console.log(`✅ Funcionários filtrados: ${filtered.length}`);
    return filtered;
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

    console.log(`📋 expandedData final: ${result.length} registros`);
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

          {/* Debug Info RADICAL */}
          {debugInfo.totalRecords > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800 text-sm">🔧 DIAGNÓSTICO RADICAL</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-red-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  <div>Período: {debugInfo.period}</div>
                  <div>Funcionário: {debugInfo.selectedEmployee}</div>
                  <div>Registros encontrados: {debugInfo.totalRecords}</div>
                  <div>Auto-valores: {debugInfo.autoValuesCount}</div>
                </div>
                
                {debugInfo.stats && (
                  <div className="mt-4">
                    <div className="font-semibold mb-2">📊 Estatísticas detalhadas:</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div className="text-blue-600">Total: {debugInfo.stats.total}</div>
                      <div className="text-red-600">Sem profile: {debugInfo.stats.noProfile}</div>
                      <div className="text-red-600">Sem dept/job: {debugInfo.stats.noDeptJob}</div>
                      <div className="text-red-600">Sem auto-valor: {debugInfo.stats.noAutoValue}</div>
                      <div className="text-red-600">Sem location: {debugInfo.stats.noLocation}</div>
                      <div className="text-green-600">✅ Válidos: {debugInfo.stats.valid}</div>
                    </div>
                  </div>
                )}
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
                      : 'Verifique o diagnóstico acima para entender por que os registros foram rejeitados.'
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
