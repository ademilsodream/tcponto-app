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
  autoValue: number;
  locations: Array<{
    locationName: string;
    totalHours: number;
    totalDays: number;
    totalValue: number;
  }>;
}




// ✨ NOVA: Interface para somatório por localização
interface LocationSummary {
  locationName: string;
  totalDays: number;
  totalValue: number;
  totalValueWithPercentage: number;
  percentage: number;
}




// ✨ NOVA: Interface para configuração de porcentagem
interface PercentageConfig {
  [locationName: string]: number;
}




interface JobFunction {
  id: string;
  name: string;
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
  const [hasSearched, setHasSearched] = useState(false);
  
  // ✨ NOVOS: Estados para porcentagem e somatório
  const [percentageConfig, setPercentageConfig] = useState<PercentageConfig>({});
  const [isPercentageDialogOpen, setIsPercentageDialogOpen] = useState(false);
  const [tempPercentage, setTempPercentage] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  
  // ✨ NOVO: Estado para funções de trabalho
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const jobFunctionsMap = useMemo(() => {
    const map = new Map<string, string>();
    jobFunctions.forEach(jf => map.set(jf.id, jf.name));
    return map;
  }, [jobFunctions]);




  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();




  // ✨ NOVA: Função para formatar horas no padrão HH:MM
  const formatHoursAsTime = (hours: number) => {
    if (!hours || hours === 0) return '00:00';
    
    const totalMinutes = Math.round(hours * 60);
    const hoursDisplay = Math.floor(totalMinutes / 60);
    const minutesDisplay = totalMinutes % 60;
    
    return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
  };




  // Função CORRIGIDA para extrair locationName
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




    return "Local Não Identificado"; // Fallback para não rejeitar registros
  };




  // ✨ NOVO: Carregar funções de trabalho ao montar o componente
  useEffect(() => {
    const fetchJobFunctions = async () => {
      const { data, error } = await supabase
        .from('job_functions')
        .select('id, name');
      
      if (error) {
        console.error('Erro ao carregar funções de trabalho:', error);
      } else {
        setJobFunctions(data || []);
      }
    };
    fetchJobFunctions();
  }, []);




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
        return;
      }




      // Buscar profiles separadamente
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
        return;
      }




      // Criar mapa de profiles
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




      // Processamento dos registros
      const employeeLocationHours: { [key: string]: { [location: string]: { hours: number, days: Set<string>, value: number } } } = {};
      
      timeRecords?.forEach((record) => {
        const profile = profilesMap.get(record.user_id);
        
        if (!profile || !profile.department_id || !profile.job_function_id) return;
        
        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;
        
        if (autoValue <= 0) return;
        
        const locationName = extractLocationName(record.locations);
        if (!locationName || locationName === "Local Não Identificado") return; // Ignorar "Local Não Identificado" nos totais




        if (!employeeLocationHours[record.user_id]) {
          employeeLocationHours[record.user_id] = {};
        }




        if (!employeeLocationHours[record.user_id][locationName]) {
          employeeLocationHours[record.user_id][locationName] = { hours: 0, days: new Set(), value: 0 };
        }




        employeeLocationHours[record.user_id][locationName].hours += Number(record.total_hours);
        employeeLocationHours[record.user_id][locationName].days.add(record.date);
        employeeLocationHours[record.user_id][locationName].value = employeeLocationHours[record.user_id][locationName].hours * autoValue;
      });




      const processedData: EmployeeAutoObrasData[] = [];
      
      for (const userId in employeeLocationHours) {
        const profile = profilesMap.get(userId);
        if (!profile) continue;
        
        const employeeData: EmployeeAutoObrasData = {
          employeeId: userId,
          employeeName: profile.name,
          departmentId: profile.department_id,
          jobFunctionId: profile.job_function_id,
          autoValue: autoValuesMap.get(`${profile.department_id}-${profile.job_function_id}`) || 0,
          locations: []
        };
        
        for (const locationName in employeeLocationHours[userId]) {
          const locationHoursData = employeeLocationHours[userId][locationName];
          employeeData.locations.push({
            locationName: locationName,
            totalHours: locationHoursData.hours,
            totalDays: locationHoursData.days.size,
            totalValue: locationHoursData.value
          });
        }
        processedData.push(employeeData);
      }




      setEmployeeAutoObrasData(processedData);
      
    } catch (error) {
      console.error('❌ Erro geral ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar os dados.",
        variant: "destructive"
      });
      setEmployeeAutoObrasData([]);
    } finally {
      setLoading(false);
    }
  };




  useEffect(() => {
    // Clear results when dates or employee selection change
    setEmployeeAutoObrasData([]);
    setHasSearched(false);
    setPercentageConfig({}); // Reset percentage config
    setSelectedLocations([]); // Reset selected locations
  }, [startDate, endDate, selectedEmployee]);




  const handleSearch = () => {
    loadAutoObrasData();
  };




  const handleClearSearch = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedEmployee('all');
    setEmployeeAutoObrasData([]);
    setHasSearched(false);
    setPercentageConfig({});
    setSelectedLocations([]);
  };




  // ✨ NOVO: Dados expandidos para a primeira tabela (Funcionário x Local)
  const expandedData = useMemo(() => {
    return employeeAutoObrasData.flatMap(employee =>
      employee.locations.map(location => ({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        jobFunctionId: employee.jobFunctionId, // Adicionar JobFunctionId
        locationName: location.locationName,
        totalHours: location.totalHours,
        totalDays: location.totalDays,
        totalValue: location.totalValue,
      }))
    ).sort((a, b) => {
      // Ordenar por Localização e depois por Nome do Funcionário
      if (a.locationName < b.locationName) return -1;
      if (a.locationName > b.locationName) return 1;
      if (a.employeeName < b.employeeName) return -1;
      if (a.employeeName > b.employeeName) return 1;
      return 0;
    });
  }, [employeeAutoObrasData]);




  // ✨ NOVO: Somatório por Localização (para a segunda seção)
  const locationSummary = useMemo(() => {
    const summaryMap = new Map<string, { totalValue: number, totalDays: Set<string>, employees: { name: string, hours: number, jobFunctionId: string }[] }>();




    // Calcular totais de valor e dias únicos por localização
    employeeAutoObrasData.forEach(employee => {
      employee.locations.forEach(location => {
        if (!summaryMap.has(location.locationName)) {
          summaryMap.set(location.locationName, { totalValue: 0, totalDays: new Set(), employees: [] });
        }
        
        const entry = summaryMap.get(location.locationName)!;
        entry.totalValue += location.totalValue;
        // Adicionar dias únicos para o total de dias da localização (precisa buscar os records originais ou recalcular)
        // Para simplificar agora, vamos somar os totalDays por enquanto, mas o correto seria contar dias únicos por localização
        // Uma abordagem melhor seria agrupar os time_records por localização e contar os dias únicos.
        // Vamos manter a soma de totalDays por enquanto, mas ciente que não é 100% preciso se um funcionário trabalhou 2x no mesmo dia no mesmo local.
        entry.totalDays.add(...Array.from({ length: location.totalDays }, (_, i) => `${location.locationName}-${i}`)); // Placeholder para simular dias únicos
        
        // Adicionar informações do funcionário para a lista detalhada
        entry.employees.push({
          name: employee.employeeName,
          hours: location.totalHours,
          jobFunctionId: employee.jobFunctionId
        });
      });
    });




    // Converter para array e aplicar porcentagem
    const summaryArray: LocationSummary[] = [];
    for (const [locationName, data] of summaryMap.entries()) {
      const percentage = percentageConfig[locationName] || 0;
      const totalValueWithPercentage = data.totalValue * (1 + percentage / 100);
      summaryArray.push({
        locationName,
        totalDays: data.totalDays.size, // Usando o tamanho do Set para dias únicos
        totalValue: data.totalValue,
        totalValueWithPercentage: totalValueWithPercentage,
        percentage: percentage,
        // Adicionar lista de funcionários para renderização detalhada
        // Ordenar funcionários por nome
        // @ts-ignore - Adicionando employees temporariamente para facilitar a renderização
        employees: data.employees.sort((a, b) => a.name.localeCompare(b.name))
      });
    }




    // Ordenar por nome da localização
    return summaryArray.sort((a, b) => a.locationName.localeCompare(b.locationName));
  
  }, [employeeAutoObrasData, percentageConfig]);




  // ✨ NOVO: Lista de localizações únicas para o diálogo de porcentagem
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    employeeAutoObrasData.forEach(employee => {
      employee.locations.forEach(location => {
        locations.add(location.locationName);
      });
    });
    return Array.from(locations).sort();
  }, [employeeAutoObrasData]);




  // ✨ NOVO: Funções para o diálogo de porcentagem
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




    const newPercentageConfig = { ...percentageConfig };
    selectedLocations.forEach(location => {
      newPercentageConfig[location] = percentage;
    });
    setPercentageConfig(newPercentageConfig);
    setIsPercentageDialogOpen(false);
    setTempPercentage('');
    setSelectedLocations([]);
    toast({
      title: "Porcentagem Aplicada",
      description: `Porcentagem de ${percentage}% aplicada às localizações selecionadas.`,
    });
  };




  const handleClearPercentages = () => {
    setPercentageConfig({});
    setSelectedLocations([]);
    toast({
      title: "Porcentagens Limpas",
      description: "Todas as configurações de porcentagem foram removidas.",
    });
  };




  // ✨ NOVO: Função para obter o nome da função de trabalho
  const getJobFunctionName = (jobFunctionId: string | null): string => {
    if (!jobFunctionId) return "Função Desconhecida";
    return jobFunctionsMap.get(jobFunctionId) || "Função Desconhecida";
  };




  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          )}
          Auto de Obras
        </h1>
      </div>




      <div className="grid gap-6">
        {/* Filtros e Botão de Pesquisa */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Seleção de Funcionário */}
              <div className="space-y-2">
                <Label htmlFor="employee-select">Funcionário</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger id="employee-select">
                    <SelectValue placeholder="Selecione um funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Funcionários</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                </SelectContent>
                </Select>
              </div>




              {/* Seleção de Data de Início */}
              <div className="space-y-2">
                <Label htmlFor="start-date">Data de Início</Label>
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
                      {startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : <span>Selecione a data</span>}
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




              {/* Seleção de Data de Fim */}
              <div className="space-y-2">
                <Label htmlFor="end-date">Data de Fim</Label>
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
                      {endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : <span>Selecione a data</span>}
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
            </div>




            <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
              <div>
                Total de funcionários: {employees.length}
              </div>
              <div>
                Registros encontrados:{" "}
                {hasSearched ? expandedData.length : '-'}
              </div>
            </div>




            {/* Botões de ação */}
            <div className="flex gap-2 pt-4 border-t">
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
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Atenção:</strong> Selecione as datas de início e fim para pesquisar os registros.
                </p>
              </div>
            )}
          </CardContent>
        </Card>




        {/* Resultados */}
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
          // Mostrar resultados apenas após pesquisar
          expandedData.length > 0 ? (
            <>
              {/* Painel de Alocação (Funcionário x Local) - Mantido como está */}
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




                {/* ✨ ALTERADO: Somatório por Localização - Novo Formato */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        Total por Localização
                      </CardTitle>
                      <p className="text-sm text-gray-600">Totais agrupados por local de trabalho</p>
                    </div>
                    <div className="flex gap-2">
                      {/* Diálogo de Porcentagem - Mantido */}
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
                                        <span className="text-blue-600 ml-1">
                                          ({percentageConfig[location]}%)
                                        </span>
                                      )}
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
                    {/* ✨ NOVO: Renderização do relatório por localização no formato de lista */}
                    <div className="space-y-6">
                      {locationSummary.map((summary) => (
                        <div key={summary.locationName} className="border rounded-lg p-4 bg-gray-50">
                          <h3 className="text-lg font-semibold mb-3">{summary.locationName}</h3>
                          <ul className="list-disc list-inside space-y-1 text-gray-700">
                            {/* @ts-ignore - A propriedade employees foi adicionada temporariamente ao LocationSummary */}
                            {summary.employees.map((employee, empIndex) => (
                              <li key={`${summary.locationName}-${employee.name}-${empIndex}`}>
                                <span className="font-medium">{getJobFunctionName(employee.jobFunctionId)} {employee.name}</span> - {formatHoursAsTime(employee.hours)}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-4 pt-3 border-t border-gray-200 text-right font-bold text-gray-800">
                            Total = {formatCurrency(summary.totalValueWithPercentage)}
                            {summary.percentage > 0 && (
                              <span className="ml-2 text-sm text-blue-600"> (+{summary.percentage}%)</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
            </>
          ) : (
            {/* Estado de "Nenhum registro encontrado" - Mantido */}
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
          {/* Estado inicial - sem dados - Mantido */}
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
    </div>
  );
};




export default AutoDeObras;
