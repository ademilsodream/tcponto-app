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

interface EmployeeAutoObrasData {
  employeeId: string;
  employeeName: string;
  departmentId: string;
  jobFunctionId: string;
  jobFunctionName: string; // Adicionado para o novo formato de exibição
  autoValue: number;
  locations: Array<{
    locationName: string;
    totalHours: number;
    totalDays: number;
    totalValue: number;
  }>;
}

// Interface para somatório por localização (mantida para o cálculo da porcentagem)
interface LocationSummary {
  locationName: string;
  totalDays: number;
  totalValue: number;
  totalValueWithPercentage: number;
  percentage: number;
}

// ✨ NOVA: Interface para o dado agrupado por localização para a nova exibição
interface GroupedLocationDisplayData {
  [locationName: string]: {
    employees: { name: string; jobFunctionName: string; totalHours: number }[];
    totalValueWithPercentage: number;
    percentage: number;
  };
}


// Interface para configuração de porcentagem
interface PercentageConfig {
  [locationName: string]: number;
}

interface AutoDeObrasProps {
  employees: User[];
  onBack?: () => void;
}

const AutoDeObras: React.FC<AutoDeObrasProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  // Mantido para o primeiro relatório (Painel de Alocação)
  const [employeeAutoObrasData, setEmployeeAutoObrasData] = useState<EmployeeAutoObrasData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Mantido para o cálculo da porcentagem e diálogo
  const [locationSummary, setLocationSummary] = useState<LocationSummary[]>([]);

  // ✨ NOVO: Estado para os dados agrupados para a nova exibição
  const [groupedLocationDisplayData, setGroupedLocationDisplayData] = useState<GroupedLocationDisplayData>({});

  const [percentageConfig, setPercentageConfig] = useState<PercentageConfig>({});
  const [isPercentageDialogOpen, setIsPercentageDialogOpen] = useState(false);
  const [tempPercentage, setTempPercentage] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();

  // Função para formatar horas no padrão HH:MM
  const formatHoursAsTime = (hours: number) => {
    if (!hours || hours === 0) return '00:00';

    const totalMinutes = Math.round(hours * 60);
    const hoursDisplay = Math.floor(totalMinutes / 60);
    const minutesDisplay = totalMinutes % 60;

    return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
  };

  // Função para extrair locationName (mantida)
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

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

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
        setEmployeeAutoObrasData([]);
        setLocationSummary([]);
        setGroupedLocationDisplayData({});
        return;
      }

      const userIds = [...new Set(timeRecords?.map(r => r.user_id) || [])];

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
        setEmployeeAutoObrasData([]);
        setLocationSummary([]);
        setGroupedLocationDisplayData({});
        return;
      }

      const profilesMap = new Map();
      profiles?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Buscar valores do auto de obras
      const { data: autoValues, error: autoError } = await supabase
        .from('auto_obras_values')
        .select('department_id, job_function_id, auto_value')
        .eq('is_active', true);

      if (autoError) {
        console.error('❌ Erro ao carregar auto values:', autoError);
      }

      const autoValuesMap = new Map<string, number>();
      autoValues?.forEach(av => {
        const key = `${av.department_id}-${av.job_function_id}`;
        autoValuesMap.set(key, av.auto_value);
      });

      // ✨ NOVO: Buscar nomes das funções
      const { data: jobFunctions, error: jobFunctionsError } = await supabase
        .from('job_functions')
        .select('id, name');

      if (jobFunctionsError) {
        console.error('❌ Erro ao carregar job functions:', jobFunctionsError);
      }

      const jobFunctionsMap = new Map();
      jobFunctions?.forEach(jf => {
        jobFunctionsMap.set(jf.id, jf.name);
      });


      // Processamento dos registros para employeeMap (Painel de Alocação)
      const employeeMap = new Map<string, EmployeeAutoObrasData>();
      const locationDaysMap = new Map<string, Map<string, Set<string>>>(); // Para contar dias únicos por local/usuário

      timeRecords?.forEach((record) => {
        const profile = profilesMap.get(record.user_id);

        if (!profile || !profile.department_id || !profile.job_function_id) return;

        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;
        if (autoValue <= 0) return;

        const locationName = extractLocationName(record.locations);
        if (!locationName) return;

        const jobFunctionName = jobFunctionsMap.get(profile.job_function_id) || 'Função Desconhecida'; // Obter nome da função


        if (!employeeMap.has(record.user_id)) {
          employeeMap.set(record.user_id, {
            employeeId: record.user_id,
            employeeName: profile.name,
            departmentId: profile.department_id,
            jobFunctionId: profile.job_function_id,
            jobFunctionName: jobFunctionName, // Armazenar nome da função
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
            totalDays: 0, // totalDays será calculado depois por localização
            totalValue: 0
          };
          employeeData.locations.push(locationEntry);
        }

        locationEntry.totalHours += Number(record.total_hours);
        locationEntry.totalValue = locationEntry.totalHours * autoValue;

        // Adicionar dia para contagem de dias únicos por local/usuário
        if (!locationDaysMap.has(locationName)) {
            locationDaysMap.set(locationName, new Map());
        }
        if (!locationDaysMap.get(locationName)!.has(record.user_id)) {
            locationDaysMap.get(locationName)!.set(record.user_id, new Set());
        }
        locationDaysMap.get(locationName)!.get(record.user_id)!.add(record.date);
      });

      // Calcular total de dias por localização
      const locationTotalDaysMap = new Map<string, number>();
      locationDaysMap.forEach((userDaysMap, locationName) => {
          let totalDaysForLocation = 0;
          userDaysMap.forEach(daysSet => {
              totalDaysForLocation += daysSet.size;
          });
          locationTotalDaysMap.set(locationName, totalDaysForLocation);
      });


      // Processar dados para o somatório por localização (base para cálculo de %)
      const locationSummaryMap = new Map<string, LocationSummary>();

      // Primeiro, agregar valor total por localização do employeeMap
      employeeMap.forEach(employeeData => {
        employeeData.locations.forEach(locationEntry => {
          if (!locationSummaryMap.has(locationEntry.locationName)) {
            locationSummaryMap.set(locationEntry.locationName, {
              locationName: locationEntry.locationName,
              totalDays: locationTotalDaysMap.get(locationEntry.locationName) || 0, // Usar total de dias calculado
              totalValue: 0,
              totalValueWithPercentage: 0, // Será calculado depois
              percentage: percentageConfig[locationEntry.locationName] || 0 // Aplicar configuração de porcentagem existente
            });
          }
          locationSummaryMap.get(locationEntry.locationName)!.totalValue += locationEntry.totalValue;
        });
      });

      // Calcular totalValueWithPercentage usando percentageConfig
      locationSummaryMap.forEach(summary => {
        const percentage = percentageConfig[summary.locationName] || 0;
        summary.percentage = percentage; // Garantir que o estado de porcentagem seja refletido
        summary.totalValueWithPercentage = summary.totalValue * (1 + percentage / 100);
      });

      const locationSummaryArray = Array.from(locationSummaryMap.values());
      locationSummaryArray.sort((a, b) => a.locationName.localeCompare(b.locationName)); // Ordenar por nome do local


      // ✨ NOVO: Construir a estrutura de dados agrupada para a nova exibição
      const groupedLocationData: GroupedLocationDisplayData = {};

      employeeMap.forEach(employeeData => {
        employeeData.locations.forEach(locationEntry => {
          const locationName = locationEntry.locationName;
          if (!groupedLocationData[locationName]) {
            // Encontrar o summary correspondente para obter o valor total e porcentagem
            const summary = locationSummaryArray.find(s => s.locationName === locationName);
            groupedLocationData[locationName] = {
              employees: [],
              totalValueWithPercentage: summary?.totalValueWithPercentage || 0,
              percentage: summary?.percentage || 0
            };
          }
          // Adicionar informações do funcionário ao local
          groupedLocationData[locationName].employees.push({
            name: employeeData.employeeName,
            jobFunctionName: employeeData.jobFunctionName, // Usar o nome da função armazenado
            totalHours: locationEntry.totalHours
          });
        });
      });

      // Ordenar funcionários dentro de cada local por nome
      Object.values(groupedLocationData).forEach(locationData => {
          locationData.employees.sort((a, b) => a.name.localeCompare(b.name));
      });


      // Definir estados
      setEmployeeAutoObrasData(Array.from(employeeMap.values())); // Para o Painel de Alocação
      setLocationSummary(locationSummaryArray); // Para o diálogo de % e cálculo
      setGroupedLocationDisplayData(groupedLocationData); // Para a nova exibição do Total por Localização


    } catch (error) {
      console.error('❌ Erro geral ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao carregar o relatório.",
        variant: "destructive"
      });
      setEmployeeAutoObrasData([]);
      setLocationSummary([]);
      setGroupedLocationDisplayData({});
    } finally {
      setLoading(false);
    }
  };

  // ✨ NOVO: useMemo para os dados expandidos do primeiro relatório (Painel)
  const expandedData = useMemo(() => {
    const data: Array<EmployeeAutoObrasData['locations'][0] & { employeeName: string; employeeId: string }> = [];
    employeeAutoObrasData.forEach(employee => {
      employee.locations.forEach(location => {
        data.push({
          ...location,
          employeeName: employee.employeeName,
          employeeId: employee.employeeId,
          // jobFunctionName is not needed in this table display
        });
      });
    });
    return data.sort((a, b) => {
      // Sort by location name, then employee name
      if (a.locationName < b.locationName) return -1;
      if (a.locationName > b.locationName) return 1;
      if (a.employeeName < b.employeeName) return -1;
      if (a.employeeName > b.employeeName) return 1;
      return 0;
    });
  }, [employeeAutoObrasData]);


  // ✨ NOVO: useMemo para lista de localizações únicas (para o diálogo de %)
  const uniqueLocations = useMemo(() => {
    // Obter localizações únicas do locationSummary (que já está ordenado)
    return locationSummary.map(summary => summary.locationName);
  }, [locationSummary]); // Depende de locationSummary


  const handleSearch = () => {
    loadAutoObrasData();
  };

  const handleClearSearch = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedEmployee('all');
    setEmployeeAutoObrasData([]);
    setLocationSummary([]);
    setGroupedLocationDisplayData({});
    setPercentageConfig({}); // Limpar porcentagens ao limpar a busca
    setHasSearched(false);
  };

  const handleApplyPercentage = () => {
    const percentage = parseFloat(tempPercentage);
    if (isNaN(percentage) || percentage < 0) {
      toast({
        title: "Erro",
        description: "Porcentagem inválida. Insira um número positivo.",
        variant: "destructive"
      });
      return;
    }

    if (selectedLocations.length === 0) {
       toast({
        title: "Aviso",
        description: "Selecione pelo menos uma localização para aplicar a porcentagem.",
        variant: "default" // Use default or info variant for warnings
      });
      return;
    }

    const newPercentageConfig = { ...percentageConfig };
    selectedLocations.forEach(location => {
      newPercentageConfig[location] = percentage;
    });

    setPercentageConfig(newPercentageConfig);
    setIsPercentageDialogOpen(false);
    setTempPercentage('');
    setSelectedLocations([]); // Limpar seleção após aplicar

    // Recarregar dados para aplicar a nova porcentagem
    loadAutoObrasData();
  };

  const handleClearPercentages = () => {
    setPercentageConfig({});
    setSelectedLocations([]); // Limpar seleção

    // Recarregar dados para remover as porcentagens
    loadAutoObrasData();
  };

  const toggleLocationSelection = (locationName: string) => {
    setSelectedLocations(prev =>
      prev.includes(locationName)
        ? prev.filter(loc => loc !== locationName)
        : [...prev, locationName]
    );
  };


  // Efeito para carregar dados iniciais se necessário (opcional, dependendo do fluxo)
  // Removido useEffect inicial para garantir que só carregue após pesquisa
  // useEffect(() => {
  //   // Pode adicionar lógica aqui se quiser carregar dados por padrão ao abrir a tela
  //   // Por enquanto, só carrega ao clicar em pesquisar
  // }, []); // Dependências vazias para rodar apenas uma vez


  return (
    <div className="container mx-auto py-8 px-4">
      {onBack && (
        <Button variant="outline" className="mb-6" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      )}
      <h1 className="text-2xl font-bold mb-6">Relatórios de Auto de Obras</h1>

      <div className="grid gap-6">
        {/* Card de Filtros e Resumo */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros e Resumo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Filtro de Data de Início */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                    id="startDate"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione a data</span>}
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

            {/* Filtro de Data de Fim */}
            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                    id="endDate"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione a data</span>}
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

            {/* Filtro de Funcionário */}
            <div className="space-y-2">
              <Label htmlFor="employeeFilter">Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employeeFilter">
                  <SelectValue placeholder="Todos os Funcionários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Funcionários</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resumo dos Dados Carregados (Mantido) */}
            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border rounded-lg p-3 text-center">
                <div className="text-sm text-gray-500">Registros Processados</div>
                <div className="text-xl font-bold text-blue-600">
                  {hasSearched ? employeeAutoObrasData.reduce((sum, emp) => sum + emp.locations.length, 0) : '-'}
                </div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-sm text-gray-500">Funcionários Envolvidos</div>
                <div className="text-xl font-bold text-blue-600">
                  {hasSearched ? employeeAutoObrasData.length : '-'}
                </div>
              </div>
               <div className="border rounded-lg p-3 text-center">
                <div className="text-sm text-gray-500">Locais Envolvidos</div>
                <div className="text-xl font-bold text-blue-600">
                  {hasSearched ? uniqueLocations.length : '-'}
                </div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-sm text-gray-500">Registros no Painel</div>
                <div className="text-xl font-bold text-blue-600">
                  {hasSearched ? expandedData.length : '-'}
                </div>
              </div>
            </div>

            {/* Botões de ação (Mantidos) */}
            <div className="flex gap-2 pt-4 border-t md:col-span-2 lg:col-span-3">
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

            {/* Aviso sobre obrigatoriedade das datas (Mantido) */}
            {(!startDate || !endDate) && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg md:col-span-2 lg:col-span-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Atenção:</strong> Selecione as datas de início e fim para pesquisar os registros.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ✨ MUDANÇA: Condicional para mostrar resultados ou estado inicial */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Search className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                Carregando dados...
              </div>
            </CardContent>
          </Card>
        ) : hasSearched ? (
           // Mostrar resultados apenas após pesquisar
           expandedData.length > 0 ? (
            <>
              {/* Painel de Alocação (Mantido como Tabela) */}
              <Card>
                <CardHeader>
                  <CardTitle>Painel de Alocação</CardTitle>
                  <p className="text-sm text-gray-600">
                    Valores calculados com base no valor por função
                    {startDate && endDate && (
                      <span className="ml-2 text-gray-400">
                        ({format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')})
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

              {/* ✨ NOVO: Somatório por Localização (NOVO LAYOUT) */}
              {Object.keys(groupedLocationDisplayData).length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        Total por Localização
                      </CardTitle>
                      <p className="text-sm text-gray-600">Totais agrupados por local de trabalho</p>
                    </div>
                    {/* Botões de Porcentagem (Mantidos) */}
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
                                      {percentageConfig[location] !== undefined && ( // Mostrar % configurada
                                        <span className="text-blue-600 ml-1">
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
                    {/* Renderizar a nova estrutura agrupada */}
                    <div className="space-y-6">
                      {Object.entries(groupedLocationDisplayData).map(([locationName, data]) => (
                        <div key={locationName} className="border rounded-md p-4 bg-gray-50">
                          <h3 className="font-bold text-lg mb-2">
                            Local - {locationName}
                            {data.percentage > 0 && (
                               <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                 +{data.percentage}%
                               </span>
                            )}
                          </h3>
                          <ul className="list-none space-y-1 text-gray-700 pl-0"> {/* Removido list-disc */}
                            {data.employees.map((emp, empIndex) => (
                              <li key={`${locationName}-${emp.name}-${empIndex}`}>
                                {emp.jobFunctionName} {emp.name} - {formatHoursAsTime(emp.totalHours)}
                              </li>
                            ))}
                          </ul>
                          <p className="font-bold mt-3 text-right text-blue-700">
                            Total = {formatCurrency(data.totalValueWithPercentage)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            </>
           ) : (
              // Mensagem de nenhum registro encontrado após pesquisa
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-gray-500 py-12">
                    <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Nenhum registro encontrado
                    </h3>
                    <p className="text-sm">
                      {startDate && endDate ? (
                        `Nenhum registro válido encontrado para o período de ${format(startDate, 'dd/MM/yyyy')} até ${format(endDate, 'dd/MM/yyyy')}.`
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
          // Estado inicial - sem dados e sem pesquisa
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-gray-500 py-12">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Painel de Alocação
                </h3>
                <p className="text-sm">
                  Selecione as datas de início e fim, depois clique em "Pesquisar" para visualizar os relatórios.
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
