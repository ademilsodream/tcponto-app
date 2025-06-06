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
    totalDays: number; // totalDays aqui é por funcionário/local, mas será usado o total por local no summary
    totalValue: number;
  }>;
}


// Interface para somatório por localização (mantida para o cálculo da porcentagem e nova tabela)
interface LocationSummary {
  locationName: string;
  totalDays: number; // Total de dias únicos de todos os funcionários no local
  totalValue: number; // Valor total SEM porcentagem
  totalValueWithPercentage: number; // Valor total COM porcentagem
  percentage: number; // Porcentagem aplicada
}


// Removida a interface GroupedLocationDisplayData pois não será mais usada para exibição


// Interface para configuração de porcentagem (Mantida)
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


  // Mantido para o cálculo da porcentagem e agora para a nova tabela de resumo
  const [locationSummary, setLocationSummary] = useState<LocationSummary[]>([]);


  // ✨ REMOVIDO: Estado para os dados agrupados que eram usados na exibição anterior
  // const [groupedLocationDisplayData, setGroupedLocationDisplayData] = useState<GroupedLocationDisplayData>({});


  const [percentageConfig, setPercentageConfig] = useState<PercentageConfig>(() => {
    // Carregar configuração salva do localStorage ao iniciar
    const savedConfig = localStorage.getItem('percentageConfig');
    return savedConfig ? JSON.parse(savedConfig) : {};
  });
  const [isPercentageDialogOpen, setIsPercentageDialogOpen] = useState(false);
  const [tempPercentage, setTempPercentage] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);


  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();


  // Função para formatar horas no padrão HH:MM (Mantida)
  const formatHoursAsTime = (hours: number) => {
    if (!hours || hours === 0) return '00:00';


    const totalMinutes = Math.round(hours * 60);
    const hoursDisplay = Math.floor(totalMinutes / 60);
    const minutesDisplay = totalMinutes % 60;


    return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
  };


  // Função para extrair locationName (Mantida)
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
        // setGroupedLocationDisplayData({}); // REMOVIDO
        return;
      }


      const userIds = [...new Set(timeRecords?.map(r => r.user_id) || [])];


      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, department_id, job_function_id');
        // .in('id', userIds); // Não precisa filtrar por userIds aqui, pois profilesMap será construído com todos os profiles disponíveis


      if (profilesError) {
        console.error('❌ Erro na query profiles:', profilesError);
        toast({
          title: "Erro",
          description: "Erro ao carregar perfis de usuários",
          variant: "destructive"
        });
        setEmployeeAutoObrasData([]);
        setLocationSummary([]);
        // setGroupedLocationDisplayData({}); // REMOVIDO
        return;
      }


      const profilesMap = new Map();
      profiles?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });


      // Buscar valores do auto de obras (Mantido)
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


      // Buscar nomes das funções (Mantido)
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


      // Processamento dos registros para employeeMap (Painel de Alocação) e locationSummaryMap (Total por Localização)
      const employeeMap = new Map<string, EmployeeAutoObrasData>();
      const locationSummaryMap = new Map<string, LocationSummary>();
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


        // --- Lógica para employeeMap (Painel de Alocação) ---
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
            totalDays: 0, // totalDays aqui será calculado depois por localização
            totalValue: 0
          };
          employeeData.locations.push(locationEntry);
        }


        locationEntry.totalHours += Number(record.total_hours);
        locationEntry.totalValue = locationEntry.totalHours * autoValue;


        // --- Lógica para locationSummaryMap (Total por Localização) ---
        if (!locationSummaryMap.has(locationName)) {
          locationSummaryMap.set(locationName, {
            locationName: locationName,
            totalDays: 0, // Será calculado depois
            totalValue: 0,
            totalValueWithPercentage: 0, // Será calculado depois
            percentage: percentageConfig[locationName] || 0 // Aplicar configuração de porcentagem existente
          });
        }
        locationSummaryMap.get(locationName)!.totalValue += (Number(record.total_hours) * autoValue);


        // Adicionar dia para contagem de dias únicos por local/usuário
        if (!locationDaysMap.has(locationName)) {
            locationDaysMap.set(locationName, new Map());
        }
        if (!locationDaysMap.get(locationName)!.has(record.user_id)) {
            locationDaysMap.get(locationName)!.set(record.user_id, new Set());
        }
        locationDaysMap.get(locationName)!.get(record.user_id)!.add(record.date);
      });


      // Calcular total de dias por localização para o locationSummaryMap
      locationDaysMap.forEach((userDaysMap, locationName) => {
          let totalDaysForLocation = 0;
          userDaysMap.forEach(daysSet => {
              totalDaysForLocation += daysSet.size;
          });
          if (locationSummaryMap.has(locationName)) {
            locationSummaryMap.get(locationName)!.totalDays = totalDaysForLocation;
          }
      });


      // Calcular totalValueWithPercentage usando percentageConfig para locationSummaryMap
      locationSummaryMap.forEach(summary => {
        const percentage = percentageConfig[summary.locationName] || 0;
        summary.percentage = percentage; // Garantir que o estado de porcentagem seja refletido
        summary.totalValueWithPercentage = summary.totalValue * (1 + percentage / 100);
      });


      const locationSummaryArray = Array.from(locationSummaryMap.values());
      locationSummaryArray.sort((a, b) => a.locationName.localeCompare(b.locationName)); // Ordenar por nome do local


      // ✨ REMOVIDO: Lógica para construir groupedLocationData
      // const groupedLocationData: GroupedLocationDisplayData = {};
      // employeeMap.forEach(employeeData => { ... });
      // Object.values(groupedLocationData).forEach(locationData => { ... });


      // Definir estados
      setEmployeeAutoObrasData(Array.from(employeeMap.values())); // Para o Painel de Alocação
      setLocationSummary(locationSummaryArray); // Para o Total por Localização (nova tabela)
      // setGroupedLocationDisplayData(groupedLocationData); // REMOVIDO


    } catch (error) {
      console.error('❌ Erro geral ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar dados.",
        variant: "destructive"
      });
      setEmployeeAutoObrasData([]);
      setLocationSummary([]);
      // setGroupedLocationDisplayData({}); // REMOVIDO
    } finally {
      setLoading(false);
    }
  };


  // Efeito para recarregar dados quando a configuração de porcentagem muda
  useEffect(() => {
    // Apenas recarrega se já houver dados pesquisados
    if (hasSearched) {
      loadAutoObrasData();
    }
  }, [percentageConfig]); // Depende de percentageConfig


  // Efeito para salvar percentageConfig no localStorage
  useEffect(() => {
    localStorage.setItem('percentageConfig', JSON.stringify(percentageConfig));
  }, [percentageConfig]);


  const handleSearch = () => {
    loadAutoObrasData();
  };


  const handleClearSearch = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedEmployee('all');
    setEmployeeAutoObrasData([]);
    setLocationSummary([]);
    // setGroupedLocationDisplayData({}); // REMOVIDO
    setHasSearched(false);
    // Não limpa percentageConfig ao limpar a pesquisa
  };


  // Expande os dados do employeeAutoObrasData para a tabela de alocação (Mantido)
  const expandedData = useMemo(() => {
    return employeeAutoObrasData.flatMap(employee =>
      employee.locations.map(location => ({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        locationName: location.locationName,
        totalHours: location.totalHours,
        totalDays: location.totalDays, // Este totalDays aqui é por funcionário/local (não usado na tabela, mas mantido na estrutura)
        totalValue: location.totalValue,
      }))
    );
  }, [employeeAutoObrasData]);


  // Lista única de locais para o diálogo de porcentagem (Mantido)
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    employeeAutoObrasData.forEach(employee => {
      employee.locations.forEach(location => {
        locations.add(location.locationName);
      });
    });
    // Incluir locais do locationSummary mesmo que não apareçam no employeeAutoObrasData (caso raro, mas segurança)
    locationSummary.forEach(summary => {
      locations.add(summary.locationName);
    });
    return Array.from(locations).sort();
  }, [employeeAutoObrasData, locationSummary]); // Depende de ambos agora


  // Lógica do diálogo de porcentagem (Mantida)
  const toggleLocationSelection = (location: string) => {
    setSelectedLocations(prev =>
      prev.includes(location) ? prev.filter(loc => loc !== location) : [...prev, location]
    );
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
        variant: "default"
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
    setSelectedLocations([]);
  };


  const handleClearPercentages = () => {
    setPercentageConfig({});
    // Não precisa recarregar explicitamente aqui, o useEffect fará isso
  };


  // Efeito para pré-selecionar locais no diálogo ao abrir
  useEffect(() => {
    if (isPercentageDialogOpen) {
      // Ao abrir, pré-seleciona os locais que já têm porcentagem configurada
      setSelectedLocations(Object.keys(percentageConfig));
      setTempPercentage(''); // Limpa o campo de porcentagem
    }
  }, [isPercentageDialogOpen, percentageConfig]);


  return (
    <div className="flex flex-col space-y-6">
      {/* Botão Voltar (Mantido) */}
      {onBack && (
        <Button variant="outline" className="w-fit" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      )}


      {/* Card de Filtros e Resumo (Mantido) */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros e Resumo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Filtro de Data */}
          <div className="space-y-2">
            <Label htmlFor="dateRange">Período</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="dateRange"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate && endDate ? (
                    `${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`
                  ) : (
                    "Selecione o período"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: startDate,
                    to: endDate,
                  }}
                  onSelect={(range) => {
                    setStartDate(range?.from);
                    setEndDate(range?.to);
                  }}
                  numberOfMonths={2}
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
         (expandedData.length > 0 || locationSummary.length > 0) ? ( // Verifica se há dados em qualquer um dos relatórios
          <>
            {/* Painel de Alocação (Mantido como Tabela) */}
            {expandedData.length > 0 && (
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
                              {locationSummary.find(ls => ls.locationName === row.locationName)?.totalDays || 0} dia{locationSummary.find(ls => ls.locationName === row.locationName)?.totalDays !== 1 ? 's' : ''}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(row.totalValue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
              </Card>
            )}


            {/* ✨ NOVO LAYOUT: Somatório por Localização (AGORA COMO TABELA) */}
            {locationSummary.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      Total por Localização
                    </CardTitle>
                    <p className="text-sm text-gray-600">Totais agrupados por local de trabalho com porcentagem aplicada</p>
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
                  {/* Renderizar a nova estrutura agrupada como tabela */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Localização</TableHead>
                          <TableHead className="text-center font-semibold">Total de Dias</TableHead>
                          <TableHead className="text-right font-semibold">Valor Total (Original)</TableHead>
                          <TableHead className="text-center font-semibold">Porcentagem Aplicada</TableHead>
                          <TableHead className="text-right font-semibold">Valor Total (Com %)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locationSummary.map((summary, index) => (
                          <TableRow key={`summary-${summary.locationName}-${index}`}>
                            <TableCell className="font-medium">{summary.locationName}</TableCell>
                            <TableCell className="text-center">
                              {summary.totalDays} dia{summary.totalDays !== 1 ? 's' : ''}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(summary.totalValue)}
                            </TableCell>
                            <TableCell className="text-center">
                              {summary.percentage > 0 ? `${summary.percentage}%` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(summary.totalValueWithPercentage)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
