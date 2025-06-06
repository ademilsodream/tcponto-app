import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, ArrowLeft, CalendarIcon, Search, Percent, Calculator } from 'lucide-react';
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

// ✨ CORRIGIDO: Removido department_id da interface JobFunction
interface JobFunction {
  id: string;
  name: string;
  // department_id: string; // Removido
}

interface EmployeeLocationData {
  locationName: string;
  totalHours: number;
  totalDays: number;
  totalValue: number;
  jobFunctionName: string;
}

interface EmployeeAutoObrasData {
  employeeId: string;
  employeeName: string;
  departmentId: string;
  jobFunctionId: string;
  autoValue: number;
  locations: EmployeeLocationData[];
}

interface LocationSummary {
  locationName: string;
  totalDays: number;
  totalValue: number;
  totalValueWithPercentage: number;
  percentage: number;
}

interface PercentageConfig {
  [locationName: string]: number;
}

interface ExpandedRowData {
    employeeId: string;
    employeeName: string;
    locationName: string;
    totalHours: number;
    totalDays: number;
    totalValue: number;
    jobFunctionName: string;
}

interface AutoDeObrasProps {
  employees: User[];
  onBack?: () => void;
}

const AutoDeObras: React.FC<AutoDeObrasProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [processedEmployeeData, setProcessedEmployeeData] = useState<EmployeeAutoObrasData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [percentageConfig, setPercentageConfig] = useState<PercentageConfig>({});
  const [isPercentageDialogOpen, setIsPercentageDialogOpen] = useState(false);
  const [tempPercentage, setTempPercentage] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);

  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();

  const formatHoursAsTime = (hours: number) => {
    if (!hours || hours === 0) return '00:00';

    const totalMinutes = Math.round(hours * 60);
    const hoursDisplay = Math.floor(totalMinutes / 60);
    const minutesDisplay = totalMinutes % 60;

    return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
  };

  const extractLocationName = (locations: any): string | null => {
    if (!locations) {
      return null;
    }

    if (typeof locations === 'object' && !Array.isArray(locations)) {
      const events = ['clock_in', 'clock_out', 'lunch_start', 'lunch_end'];

      for (const event of events) {
        const eventData = locations[event];
        if (eventData && typeof eventData === 'object') {
          const locationName = eventData.locationName;
          if (locationName && typeof locationName === 'string' && locationName.trim()) {
            return locationName.trim();
          }
        }
      }
    }

    if (typeof locations === 'string' && locations.trim()) {
      return locations.trim();
    }

    const findLocationNameRecursive = (obj: any, depth = 0): string | null => {
      if (!obj || typeof obj !== 'object' || depth > 3) return null;

      if (obj.locationName && typeof obj.locationName === 'string' && obj.locationName.trim()) {
        return obj.locationName.trim();
      }

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const result = findLocationNameRecursive(obj[key], depth + 1);
          if (result) return result;
        }
      }

      return null;
    };

    const recursiveResult = findLocationNameRecursive(locations);
    if (recursiveResult) {
      return recursiveResult;
    }

    return "Local Não Identificado";
  };

  // ✨ CORRIGIDO: Buscar funções de trabalho sem department_id
  useEffect(() => {
    const fetchJobFunctions = async () => {
      const { data, error } = await supabase
        .from('job_functions')
        .select('id, name'); // ✨ CORRIGIDO: Removido department_id
      if (error) {
        console.error('Error fetching job functions:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar funções de trabalho",
          variant: "destructive"
        });
      } else {
        setJobFunctions(data || []);
      }
    };
    fetchJobFunctions();
  }, [toast]);

  // ✨ NOVO: Mapa de funções de trabalho para fácil acesso (sem department_id)
  const jobFunctionsMap = useMemo(() => {
    const map = new Map<string, string>();
    jobFunctions.forEach(jf => map.set(jf.id, jf.name));
    return map;
  }, [jobFunctions]);

  const loadAutoObrasData = async () => {
    if (!startDate || !endDate) {
      console.warn('⚠️ Datas de início e fim são obrigatórias');
      return;
    }

    if (employees.length === 0) {
      console.log('⚠️ Nenhum funcionário disponível');
      return;
    }

    setLoading(true);
    setHasSearched(true);
    console.log('\n🚀 === CARREGAMENTO COM JOIN CORRIGIDO ===');

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    console.log(`📅 PERÍODO: ${startDateStr} até ${endDateStr}`);
    console.log(`👤 FUNCIONÁRIO SELECIONADO: ${selectedEmployee}`);

    try {
      let query = supabase
        .from('time_records')
        .select(`
          id,
          date,
          user_id,
          locations,
          total_hours
        `)
        .eq('status', 'active')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .not('total_hours', 'is', null)
        .gt('total_hours', 0);

      if (selectedEmployee !== 'all') {
        console.log(`🎯 APLICANDO FILTRO POR FUNCIONÁRIO: ${selectedEmployee}`);
        query = query.eq('user_id', selectedEmployee);
      }

      const { data: timeRecords, error } = await query.order('date', { ascending: false });

      if (error) {
        console.error('❌ Erro na query time_records:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar registros de ponto",
          variant: "destructive"
        });
        setProcessedEmployeeData([]);
        setLoading(false);
        return;
      }

      console.log(`📊 REGISTROS TIME_RECORDS: ${timeRecords?.length || 0}`);

      const userIds = [...new Set(timeRecords?.map(r => r.user_id) || [])];
      console.log(`👥 USER_IDS únicos: ${userIds.length}`, userIds);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, department_id, job_function_id')
        .in('id', userIds);

      if (profilesError) {
        console.error('❌ Erro na query profiles:', profilesError);
        toast({
          title: "Erro",
          description: "Erro ao carregar perfis de usuários",
          variant: "destructive"
        });
        setProcessedEmployeeData([]);
        setLoading(false);
        return;
      }

      console.log(`👤 PROFILES ENCONTRADOS: ${profiles?.length || 0}`);
      profiles?.forEach(p => {
        console.log(` - ${p.name} (ID: ${p.id}, Dept: ${p.department_id}, Job: ${p.job_function_id})`);
      });

      const profilesMap = new Map();
      profiles?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      const { data: autoValues, error: autoError } = await supabase
        .from('auto_obras_values')
        .select('department_id, job_function_id, auto_value')
        .eq('is_active', true);

      if (autoError) {
        console.error('❌ Erro ao carregar auto values:', autoError);
      }

      console.log(`💰 AUTO VALUES CARREGADOS: ${autoValues?.length || 0}`);

      const autoValuesMap = new Map<string, number>();
      autoValues?.forEach(av => {
        const key = `${av.department_id}-${av.job_function_id}`;
        autoValuesMap.set(key, av.auto_value);
        console.log(`💰 Auto-valor mapeado: ${key} = R$ ${av.auto_value}`);
      });

      const employeeMap = new Map<string, EmployeeAutoObrasData>();
      let stats = {
        total: 0,
        noProfile: 0,
        noDeptJob: 0,
        noAutoValue: 0,
        noLocation: 0,
        valid: 0
      };

      console.log('\n=== PROCESSAMENTO COM JOIN CORRIGIDO ===');

      timeRecords?.forEach((record, index) => {
        stats.total++;

        const profile = profilesMap.get(record.user_id);
        if (!profile) {
          stats.noProfile++;
          return;
        }

        if (!profile.department_id || !profile.job_function_id) {
          stats.noDeptJob++;
          return;
        }

        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;

        if (autoValue <= 0) {
          stats.noAutoValue++;
          return;
        }

        const locationName = extractLocationName(record.locations);

        if (!locationName) {
          stats.noLocation++;
          return;
        }

        stats.valid++;

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
          // ✨ CORRIGIDO: Usando jobFunctionsMap para obter o nome da função
          const jobFunctionName = jobFunctionsMap.get(profile.job_function_id) || 'Função Desconhecida';
          locationEntry = {
            locationName: locationName,
            totalHours: 0,
            totalDays: 0,
            totalValue: 0,
            jobFunctionName: jobFunctionName
          };
          employeeData.locations.push(locationEntry);
        }

        locationEntry.totalHours += Number(record.total_hours);
        locationEntry.totalValue = locationEntry.totalHours * autoValue;
      });

      const locationDaysMap = new Map<string, Map<string, Set<string>>>();

      timeRecords?.forEach((record) => {
        const profile = profilesMap.get(record.user_id);

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

      for (const [userId, userLocationDays] of locationDaysMap.entries()) {
        const employeeData = employeeMap.get(userId);
        if (employeeData) {
          for (const [locationName, daysSet] of userLocationDays.entries()) {
            const locationEntry = employeeData.locations.find(loc => loc.locationName === locationName);
            if (locationEntry) {
              locationEntry.totalDays = daysSet.size;
            }
          }
        }
      }

      console.log('\n=== ESTATÍSTICAS DE PROCESSAMENTO ===');
      console.log(`Registros Totais: ${stats.total}`);
      console.log(`Rejeitados (Sem Profile): ${stats.noProfile}`);
      console.log(`Rejeitados (Sem Dept/Job): ${stats.noDeptJob}`);
      console.log(`Rejeitados (Auto-valor Zero): ${stats.noAutoValue}`);
      console.log(`Rejeitados (Sem Localização): ${stats.noLocation}`);
      console.log(`Registros Válidos Processados: ${stats.valid}`);
      console.log('=====================================');

      const processedData = Array.from(employeeMap.values());
      console.log(`📦 Dados Processados para ${processedData.length} funcionários:`, processedData);

      setProcessedEmployeeData(processedData);

    } catch (error) {
      console.error('❌ Erro inesperado ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao carregar os dados do relatório.",
        variant: "destructive"
      });
      setProcessedEmployeeData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Limpa os dados processados e o estado de busca ao mudar as datas ou funcionário
    setProcessedEmployeeData([]);
    setHasSearched(false);
    setPercentageConfig({}); // Limpa as porcentagens configuradas
    setSelectedLocations([]); // Limpa as localizações selecionadas
  }, [startDate, endDate, selectedEmployee]);

  const handleSearch = () => {
    loadAutoObrasData();
  };

  const handleClearSearch = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedEmployee('all');
    setProcessedEmployeeData([]);
    setHasSearched(false);
    setPercentageConfig({});
    setSelectedLocations([]);
  };

  // ✨ NOVO: Dados expandidos para a primeira tabela (Painel de Alocação)
  const expandedData: ExpandedRowData[] = useMemo(() => {
    const data: ExpandedRowData[] = [];
    processedEmployeeData.forEach(employee => {
      employee.locations.forEach(location => {
        data.push({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          locationName: location.locationName,
          totalHours: location.totalHours,
          totalDays: location.totalDays,
          totalValue: location.totalValue,
          jobFunctionName: location.jobFunctionName,
        });
      });
    });
    // Opcional: Ordenar por funcionário e depois por local
    return data.sort((a, b) => {
      const employeeCompare = a.employeeName.localeCompare(b.employeeName);
      if (employeeCompare !== 0) return employeeCompare;
      return a.locationName.localeCompare(b.locationName);
    });
  }, [processedEmployeeData]);

  // ✨ NOVO: Dados agrupados por localização para a segunda tabela
  const groupedByLocation = useMemo(() => {
    const groups: { [locationName: string]: ExpandedRowData[] } = {};
    expandedData.forEach(row => {
      if (!groups[row.locationName]) {
        groups[row.locationName] = [];
      }
      groups[row.locationName].push(row);
    });
    return groups;
  }, [expandedData]);

  // ✨ NOVO: Lista de localizações únicas
  const uniqueLocations = useMemo(() => {
    return Object.keys(groupedByLocation).sort();
  }, [groupedByLocation]);

  // ✨ NOVO: Somatório por localização com porcentagem
  const locationSummary = useMemo(() => {
    const summaryMap = new Map<string, LocationSummary>();

    Object.entries(groupedByLocation).forEach(([locationName, employeeRows]) => {
      const totalValue = employeeRows.reduce((sum, row) => sum + row.totalValue, 0);
      const totalDays = employeeRows.reduce((sum, row) => sum + row.totalDays, 0); // Sum days per location
      const percentage = percentageConfig[locationName] || 0;
      const totalValueWithPercentage = totalValue * (1 + percentage / 100);

      summaryMap.set(locationName, {
        locationName,
        totalDays, // Store total days here
        totalValue,
        totalValueWithPercentage,
        percentage
      });
    });

    // Ordenar por nome da localização
    return Array.from(summaryMap.values()).sort((a, b) => a.locationName.localeCompare(b.locationName));
  }, [groupedByLocation, percentageConfig]);

  // ✨ NOVO: Mapa de somatório para fácil acesso na renderização
  const locationSummaryMap = useMemo(() => {
      const map = new Map<string, LocationSummary>();
      locationSummary.forEach(summary => map.set(summary.locationName, summary));
      return map;
  }, [locationSummary]);


  // ✨ NOVO: Handlers para porcentagem
  const toggleLocationSelection = (location: string) => {
    setSelectedLocations(prev =>
      prev.includes(location)
        ? prev.filter(loc => loc !== location)
        : [...prev, location]
    );
  };

  const handleApplyPercentage = () => {
    const percentageValue = parseFloat(tempPercentage);

    if (isNaN(percentageValue) || percentageValue < 0) {
      toast({
        title: "Erro",
        description: "Porcentagem inválida. Insira um número positivo.",
        variant: "destructive"
      });
      return;
    }

    const newPercentageConfig = { ...percentageConfig };
    selectedLocations.forEach(location => {
      newPercentageConfig[location] = percentageValue;
    });

    setPercentageConfig(newPercentageConfig);
    setTempPercentage('');
    setSelectedLocations([]);
    setIsPercentageDialogOpen(false);
    toast({
      title: "Sucesso",
      description: `Porcentagem de ${percentageValue}% aplicada às localizações selecionadas.`,
    });
  };

  const handleClearPercentages = () => {
    setPercentageConfig({});
    setSelectedLocations([]);
    toast({
      title: "Limpo",
      description: "Todas as porcentagens foram removidas.",
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          Relatório Auto de Obras
        </h1>
      </div>

      <div className="grid gap-6">
        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Seleção de Data Início */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate">Data Início</Label>
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Seleção de Data Fim */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="endDate">Data Fim</Label>
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Seleção de Funcionário */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="employee">Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-full" id="employee">
                  <SelectValue placeholder="Selecione um funcionário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Funcionários</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estatísticas */}
            {/* Removido temporariamente ou ajustado se necessário */}
            {/* <div className="flex flex-col gap-2">
              <Label>Registros Válidos</Label>
              <div className="flex items-center justify-between rounded-md border p-3 shadow-sm">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Total</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {hasSearched ? expandedData.length : '-'}
                </div>
              </div>
            </div> */}

            {/* Botões de ação */}
            <div className="flex gap-2 pt-4 border-t col-span-full md:col-span-3">
              <Button
                onClick={handleSearch}
                disabled={loading || !startDate || !endDate}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Search className="w-4 h-4 mr-2 animate-spin" />
                    Pesquisando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Pesquisar
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

            {/* Aviso sobre obrigatoriedade das datas */}
            {(!startDate || !endDate) && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg col-span-full">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Atenção:</strong> Selecione as datas de início e fim para pesquisar os registros.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Condicional para mostrar resultados */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Search className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                Carregando dados painel de alocação...
              </div>
            </CardContent>
          </Card>
        ) : hasSearched ? (
          expandedData.length > 0 ? (
            <>
              {/* Primeiro Relatório: Painel de Alocação (Mantido) */}
              <Card>
                <CardHeader>
                  <CardTitle>Painel de Alocação</CardTitle>
                  <p className="text-sm text-gray-600">
                    Valores calculados com base no valor por função
                    {startDate && endDate && (
                      <span className="ml-2 text-gray-400">
                        ({format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - {format(endDate, 'dd/MM/yyyy', { locale: ptBR })})
                      </span>
                    )}
                  </p>
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
                              {formatHoursAsTime(row.totalHours)}
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

              {/* Somatório por Localização (Nova Exibição) */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      Total por Localização
                    </CardTitle>
                    <p className="text-sm text-gray-600">Totais agrupados por local de trabalho com porcentagem aplicada</p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isPercentageDialogOpen} onOpenChange={setIsPercentageDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Percent className="w-4 h-4 mr-2" />
                          Adicionar %
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Configurar Porcentagem por Localização</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="percentage">Porcentagem (%)</Label>
                            <Input
                              id="percentage"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Ex: 15.5"
                              value={tempPercentage}
                              onChange={(e) => setTempPercentage(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Selecionar Localizações</Label>
                            <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3">
                              {uniqueLocations.map(location => (
                                <div key={location} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`location-${location}`}
                                    checked={selectedLocations.includes(location)}
                                    onCheckedChange={() => toggleLocationSelection(location)}
                                  />
                                  <Label htmlFor={`location-${location}`} className="text-sm">
                                    {location}
                                    {percentageConfig[location] !== undefined && (
                                      <span className={cn(
                                        "ml-1 px-1 py-0.5 rounded text-xs font-medium",
                                         percentageConfig[location] > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                                      )}>
                                        ({percentageConfig[location]}%)
                                      </span>
                                    )}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              onClick={() => setIsPercentageDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button onClick={handleApplyPercentage}>
                              Aplicar
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {Object.keys(percentageConfig).length > 0 && (
                      <Button variant="outline" size="sm" onClick={handleClearPercentages}>
                        Limpar %
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(groupedByLocation).map(([locationName, employeeRows]) => {
                        const summary = locationSummaryMap.get(locationName);
                        const totalValueForLocation = summary ? summary.totalValueWithPercentage : 0;
                        // const totalDaysForLocation = summary ? summary.totalDays : 0; // Dias totais não são exibidos aqui na nova estrutura

                        return (
                            <div key={locationName} className="p-4 border rounded-lg bg-gray-50 shadow-sm">
                                <h4 className="text-lg font-semibold mb-3 border-b pb-2 border-gray-200">Local - {locationName}</h4>
                                <ul className="list-none space-y-1 text-gray-700 pl-0">
                                    {employeeRows
                                        .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
                                        .map((employeeRow, index) => (
                                            <li key={`${locationName}-${employeeRow.employeeId}-${index}`} className="text-sm">
                                                {employeeRow.jobFunctionName} {employeeRow.employeeName} - {formatHoursAsTime(employeeRow.totalHours)}
                                            </li>
                                        ))}
                                </ul>
                                <div className="mt-4 pt-3 border-t border-gray-200 text-right font-bold text-blue-600">
                                    Total = {formatCurrency(totalValueForLocation)}
                                </div>
                            </div>
                        );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Card para o Total Geral (Mantido) */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumo Geral</CardTitle>
                  <p className="text-sm text-gray-600">Total calculado considerando as porcentagens aplicadas por localização</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-md border p-4 shadow-sm bg-blue-50">
                    <div className="flex items-center space-x-3">
                      <Calculator className="h-6 w-6 text-blue-700" />
                      <span className="text-lg font-semibold text-blue-800">TOTAL GERAL DO PERÍODO</span>
                    </div>
                    <div className="text-3xl font-bold text-blue-800">
                      {formatCurrency(locationSummary.reduce((sum, s) => sum + s.totalValueWithPercentage, 0))}
                    </div>
                  </div>
                </CardContent>
              </Card>

            </>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500 py-12">
                  <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Nenhum registro encontrado
                  </h3>
                  <p className="text-sm">
                    {startDate && endDate ? (
                      `Nenhum registro válido encontrado para o período de ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} até ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}.`
                    ) : (
                      'Nenhum registro válido encontrado para os filtros selecionados.'
                    )}
                    <br />
                    Verifique se existem registros de ponto com valores configurados.
                  </p>
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
                  Painel de Alocação
                </h3>
                <p className="text-sm">
                  Selecione as datas de início e fim, depois clique em "Pesquisar" para visualizar o relatório por localização e funcionário.
                </p>
                <div className="mt-4 text-xs text-gray-400">
                  💡 Este relatório mostra valores calculados com base nos valores configurados por departamento e função.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AutoDeObras;
