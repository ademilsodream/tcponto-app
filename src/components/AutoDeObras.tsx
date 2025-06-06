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
    console.log('🔍 EXTRAÇÃO - Input completo:', JSON.stringify(locations, null, 2));

    if (!locations) {
      console.log('❌ Locations é null/undefined');
      return null;
    }

    // ESTRATÉGIA 1: Verificar se locations tem propriedades de eventos de ponto
    if (typeof locations === 'object' && !Array.isArray(locations)) {
      const events = ['clock_in', 'clock_out', 'lunch_start', 'lunch_end'];

      for (const event of events) {
        const eventData = locations[event];
        console.log(`🔍 Verificando evento ${event}:`, eventData);

        if (eventData && typeof eventData === 'object') {
          const locationName = eventData.locationName;
          if (locationName && typeof locationName === 'string' && locationName.trim()) {
            console.log(`✅ LOCATION ENCONTRADO em ${event}: "${locationName}"`);
            return locationName.trim();
          }
        }
      }
    }

    // ESTRATÉGIA 2: Se locations é uma string direta
    if (typeof locations === 'string' && locations.trim()) {
      console.log(`✅ LOCATION STRING DIRETO: "${locations.trim()}"`);
      return locations.trim();
    }

    // ESTRATÉGIA 3: Buscar recursivamente por qualquer propriedade locationName
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
      console.log(`✅ LOCATION ENCONTRADO RECURSIVAMENTE: "${recursiveResult}"`);
      return recursiveResult;
    }

    console.log('❌ NENHUM LOCATION ENCONTRADO - Usando fallback');
    return "Local Não Identificado"; // Fallback para não rejeitar registros
  };

  const loadAutoObrasData = async () => {
    // ✨ NOVO: Validar se as datas foram selecionadas
    if (!startDate || !endDate) {
      console.warn('⚠️ Datas de início e fim são obrigatórias');
      return;
    }

    if (employees.length === 0) {
      console.log('⚠️ Nenhum funcionário disponível');
      return;
    }

    setLoading(true);
    setHasSearched(true); // ✨ NOVO: Marcar que foi feita uma pesquisa
    console.log('\n🚀 === CARREGAMENTO COM JOIN CORRIGIDO ===');

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    console.log(`📅 PERÍODO: ${startDateStr} até ${endDateStr}`);
    console.log(`👤 FUNCIONÁRIO SELECIONADO: ${selectedEmployee}`);

    try {
      // Query CORRIGIDA - fazer JOIN explícito ao invés de usar select aninhado
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
        setEmployeeAutoObrasData([]);
        return;
      }

      console.log(`📊 REGISTROS TIME_RECORDS: ${timeRecords?.length || 0}`);

      // Buscar profiles separadamente para evitar problemas no JOIN
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
        setEmployeeAutoObrasData([]);
        return;
      }

      console.log(`👤 PROFILES ENCONTRADOS: ${profiles?.length || 0}`);
      profiles?.forEach(p => {
        console.log(` - ${p.name} (ID: ${p.id}, Dept: ${p.department_id}, Job: ${p.job_function_id})`);
      });

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

      console.log(`💰 AUTO VALUES CARREGADOS: ${autoValues?.length || 0}`);

      const autoValuesMap = new Map<string, number>();
      autoValues?.forEach(av => {
        const key = `${av.department_id}-${av.job_function_id}`;
        autoValuesMap.set(key, av.auto_value);
        console.log(`💰 Auto-valor mapeado: ${key} = R$ ${av.auto_value}`);
      });

      // Processamento dos registros
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
        console.log(`\n🔄 PROCESSANDO ${index + 1}/${timeRecords.length}: ID=${record.id}, User_ID=${record.user_id}`);

        // Buscar profile no mapa
        const profile = profilesMap.get(record.user_id);
        if (!profile) {
          console.log(`❌ REJEITADO - Profile não encontrado para user_id: ${record.user_id}`);
          stats.noProfile++;
          return;
        }

        console.log(`✅ Profile encontrado: ${profile.name} (ID: ${profile.id})`);

        if (!profile.department_id || !profile.job_function_id) {
          console.log(`❌ REJEITADO - Falta dept/job: dept=${profile.department_id}, job=${profile.job_function_id}`);
          stats.noDeptJob++;
          return;
        }

        console.log(`✅ Dept/Job: ${profile.department_id}/${profile.job_function_id}`);

        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;

        if (autoValue <= 0) {
          console.log(`❌ REJEITADO - Auto-valor zero para chave: ${autoKey}`);
          stats.noAutoValue++;
          return;
        }

        console.log(`✅ Auto-valor: R$ ${autoValue} para chave ${autoKey}`);

        // Extrair location
        const locationName = extractLocationName(record.locations);

        if (!locationName) {
          console.log(`❌ REJEITADO - LocationName não extraído`);
          console.log(`📍 Locations object completo:`, record.locations);
          stats.noLocation++;
          return;
        }

        console.log(`✅ Location extraído: "${locationName}"`);
        stats.valid++;

        console.log(`🎉 REGISTRO VÁLIDO - SERÁ INCLUÍDO NO RELATÓRIO!`);

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
            totalDays: 0, // Assuming totalDays is calculated elsewhere or is count of records
            totalValue: 0
          };
          employeeData.locations.push(locationEntry);
        }

        locationEntry.totalHours += Number(record.total_hours);
        locationEntry.totalValue = locationEntry.totalHours * autoValue;

        // Note: The original code had a syntax error here.
        // The processing for this record is now complete.
      }); // <-- Correct end of timeRecords?.forEach loop

      console.log('\n=== FIM DO PROCESSAMENTO ===');
      console.log('📊 Estatísticas de processamento:', stats);

      // Convert map to array and sort by employee name
      const processedData = Array.from(employeeMap.values()).sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName)
      );

      console.log(`✅ Dados processados para exibição: ${processedData.length} funcionários/locais`);
      setEmployeeAutoObrasData(processedData);

    } catch (error) {
      console.error('❌ Erro geral ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao carregar os dados do painel.",
        variant: "destructive"
      });
      setEmployeeAutoObrasData([]);
    } finally {
      setLoading(false);
    }
  }; // <-- Correct end of loadAutoObrasData function definition


  useEffect(() => {
    // Clear results if dates are cleared
    if (!startDate || !endDate) {
      setEmployeeAutoObrasData([]);
      setHasSearched(false);
    }
  }, [startDate, endDate]); // Depend on dates to clear results if dates are unset

  // UseMemo to flatten and expand data for the first table
  const expandedData = useMemo(() => {
    const data: Array<{
      employeeId: string;
      employeeName: string;
      locationName: string;
      totalHours: number;
      totalDays: number;
      totalValue: number;
    }> = [];

    employeeAutoObrasData.forEach(employee => {
      employee.locations.forEach(location => {
        data.push({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          locationName: location.locationName,
          totalHours: location.totalHours,
          totalDays: location.totalDays, // Assuming totalDays is already calculated or 1 per record
          totalValue: location.totalValue,
        });
      });
    });

    // Sort by employee name then location name
    return data.sort((a, b) => {
      const employeeCompare = a.employeeName.localeCompare(b.employeeName);
      if (employeeCompare !== 0) return employeeCompare;
      return a.locationName.localeCompare(b.locationName);
    });

  }, [employeeAutoObrasData]);


  // UseMemo to get unique locations for the percentage dialog
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    expandedData.forEach(item => locations.add(item.locationName));
    return Array.from(locations).sort();
  }, [expandedData]);


  // UseMemo to calculate summary by location, applying percentages
  const locationSummary = useMemo(() => {
    const summaryMap = new Map<string, LocationSummary>();

    expandedData.forEach(item => {
      if (!summaryMap.has(item.locationName)) {
        summaryMap.set(item.locationName, {
          locationName: item.locationName,
          totalDays: 0, // Need to calculate total days per location
          totalValue: 0,
          totalValueWithPercentage: 0,
          percentage: percentageConfig[item.locationName] || 0,
        });
      }

      const summary = summaryMap.get(item.locationName)!;
      // Summing up total value per location
      summary.totalValue += item.totalValue;
      // Summing up total days per location
      summary.totalDays += item.totalDays; // This sums the 'totalDays' value from each expandedData item.

    });

    // Apply percentage and calculate final value
    const summaryArray = Array.from(summaryMap.values()).map(summary => {
      const percentage = percentageConfig[summary.locationName] || 0;
      const totalValueWithPercentage = summary.totalValue * (1 + percentage / 100);
      return {
        ...summary,
        percentage,
        totalValueWithPercentage,
      };
    });

    // Sort by location name
    return summaryArray.sort((a, b) => a.locationName.localeCompare(b.locationName));

  }, [expandedData, percentageConfig]); // Recalculate when expandedData or percentageConfig changes


  const handleSearch = () => {
    if (startDate && endDate) {
      loadAutoObrasData();
    } else {
      toast({
        title: "Datas Obrigatórias",
        description: "Por favor, selecione as datas de início e fim.",
        variant: "warning"
      });
    }
  };

  const handleClearSearch = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedEmployee('all');
    setEmployeeAutoObrasData([]);
    setHasSearched(false);
    setPercentageConfig({}); // Clear percentages on clear search
    setSelectedLocations([]); // Clear selected locations
    setTempPercentage(''); // Clear temp percentage input
  };

  const toggleLocationSelection = (location: string) => {
    setSelectedLocations(prev =>
      prev.includes(location)
        ? prev.filter(loc => loc !== location)
        : [...prev, location]
    );
  };

  const handleApplyPercentage = () => {
    const percentage = parseFloat(tempPercentage);
    if (isNaN(percentage) || percentage < 0) {
      toast({
        title: "Entrada Inválida",
        description: "Por favor, insira uma porcentagem válida (número positivo).",
        variant: "warning"
      });
      return;
    }

    const newPercentageConfig = { ...percentageConfig };
    selectedLocations.forEach(location => {
      newPercentageConfig[location] = percentage;
    });

    setPercentageConfig(newPercentageConfig);
    setIsPercentageDialogOpen(false);
    setSelectedLocations([]); // Clear selection after applying
    setTempPercentage(''); // Clear input after applying
  };

  const handleClearPercentages = () => {
    setPercentageConfig({});
    setSelectedLocations([]);
    setTempPercentage('');
  };


  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button onClick={onBack} variant="outline" className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
      </Button>

      <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        <Building2 className="w-7 h-7 text-blue-600" /> Auto de Obras
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters and Stats Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Filtros e Estatísticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range Picker */}
            <div className="space-y-2">
              <Label htmlFor="date-range">Período</Label>
              <div className="flex gap-2">
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

            {/* Employee Select */}
            <div className="space-y-2">
              <Label htmlFor="employee-select">Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employee-select">
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

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-500">Período Selecionado</div>
                <div className="text-lg font-semibold">
                  {startDate && endDate ? `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')}` : '-'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-500">Registros Encontrados</div>
                <div className="text-2xl font-bold text-blue-600">
                  {hasSearched ? expandedData.length : '-'}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
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

            {/* Date Required Warning */}
            {(!startDate || !endDate) && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Atenção:</strong> Selecione as datas de início e fim para pesquisar os registros.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <div className="lg:col-span-2 space-y-6">
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
            // Show results only after searching
            expandedData.length > 0 ? (
              <>
                {/* Painel de Alocação (Employee/Location Breakdown) - Keep as Table */}
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

                {/* Total por Localização (Location Summary) - Modified Display */}
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
                                      {percentageConfig[location] && (
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
                    {/* --- START: Modified display for Location Summary --- */}
                    <div className="space-y-6"> {/* Add spacing between locations */}
                      {locationSummary.map((summary) => (
                        <div key={summary.locationName} className="border p-4 rounded-lg bg-gray-50"> {/* Added bg-gray-50 for slight distinction */}
                          <h4 className="text-lg font-semibold mb-2 text-gray-800">Local - {summary.locationName}</h4>
                          <ul className="list-none ml-0 space-y-1 text-gray-700"> {/* Changed list-disc to list-none */}
                            {expandedData
                              .filter(item => item.locationName === summary.locationName)
                              .sort((a, b) => a.employeeName.localeCompare(b.employeeName)) // Optional: sort employees within location
                              .map(item => (
                                <li key={`${item.employeeId}-${item.locationName}`} className="text-sm">
                                  {item.employeeName} - {formatHoursAsTime(item.totalHours)}
                                </li>
                              ))}
                          </ul>
                          <div className="mt-3 pt-3 border-t text-right font-bold text-blue-600">
                            Total = {formatCurrency(summary.totalValueWithPercentage)} {currency}
                            {summary.percentage > 0 && (
                              <span className="ml-2 text-sm font-normal text-green-700">
                                (+{summary.percentage}%)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {/* Display Grand Total outside individual location blocks */}
                      {locationSummary.length > 0 && (
                        <div className="border-t-2 border-blue-600 pt-4 text-right font-bold text-xl text-blue-800">
                          TOTAL GERAL = {formatCurrency(locationSummary.reduce((sum, s) => sum + s.totalValueWithPercentage, 0))} {currency}
                        </div>
                      )}
                    </div>
                    {/* --- END: Modified display for Location Summary --- */}
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
            // Initial state - no data
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
