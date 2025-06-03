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
  
  // ✨ NOVOS: Estados para porcentagem e somatório
  const [percentageConfig, setPercentageConfig] = useState<PercentageConfig>({});
  const [isPercentageDialogOpen, setIsPercentageDialogOpen] = useState(false);
  const [tempPercentage, setTempPercentage] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  
  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();

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
    if (!startDate || !endDate || employees.length === 0) {
      console.log('⚠️ Dados insuficientes para carregar');
      return;
    }

    setLoading(true);
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
            totalDays: 0,
            totalValue: 0
          };
          employeeData.locations.push(locationEntry);
        }

        locationEntry.totalHours += Number(record.total_hours);
        locationEntry.totalValue = locationEntry.totalHours * autoValue;
        
        console.log(`📊 DADOS ATUALIZADOS: ${profile.name} em ${locationName}: ${locationEntry.totalHours}h = R$ ${locationEntry.totalValue.toFixed(2)}`);
      });

      // Contar dias únicos para cada localização
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
      console.log(`📊 Total processados: ${stats.total}`);
      console.log(`❌ Sem profile: ${stats.noProfile}`);
      console.log(`❌ Sem dept/job: ${stats.noDeptJob}`);
      console.log(`❌ Sem auto-valor: ${stats.noAutoValue}`);
      console.log(`❌ Sem location: ${stats.noLocation}`);
      console.log(`✅ Válidos: ${stats.valid}`);
      console.log(`👥 Funcionários no resultado: ${result.length}`);

      // Log detalhado dos resultados
      result.forEach((emp, index) => {
        console.log(`\n👤 RESULTADO ${index + 1}: ${emp.employeeName}`);
        emp.locations.forEach((loc) => {
          console.log(` 📍 ${loc.locationName}: ${loc.totalHours}h em ${loc.totalDays} dias = R$ ${loc.totalValue.toFixed(2)}`);
        });
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
    if (startDate && endDate && employees.length > 0) {
      console.log('🚀 INICIANDO CARREGAMENTO...');
      setEmployeeAutoObrasData([]);
      loadAutoObrasData();
    }
  }, [startDate, endDate, selectedEmployee, employees]);

  const filteredData = useMemo(() => {
    console.log('🔄 Recalculando filteredData');
    console.log('📊 employeeAutoObrasData.length:', employeeAutoObrasData.length);
    
    if (selectedEmployee === 'all') {
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

  // ✨ NOVO: Calcular somatório por localização
  const locationSummary = useMemo(() => {
    const summaryMap = new Map<string, LocationSummary>();

    expandedData.forEach(row => {
      if (!summaryMap.has(row.locationName)) {
        summaryMap.set(row.locationName, {
          locationName: row.locationName,
          totalDays: 0,
          totalValue: 0,
          totalValueWithPercentage: 0,
          percentage: percentageConfig[row.locationName] || 0
        });
      }

      const summary = summaryMap.get(row.locationName)!;
      summary.totalDays += row.totalDays;
      summary.totalValue += row.totalValue;
      
      // Calcular valor com porcentagem
      const percentage = percentageConfig[row.locationName] || 0;
      summary.percentage = percentage;
      summary.totalValueWithPercentage = summary.totalValue * (1 + percentage / 100);
    });

    return Array.from(summaryMap.values())
      .sort((a, b) => a.locationName.localeCompare(b.locationName));
  }, [expandedData, percentageConfig]);

  // ✨ NOVO: Obter todas as localizações únicas
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    expandedData.forEach(row => locations.add(row.locationName));
    return Array.from(locations).sort();
  }, [expandedData]);

  // ✨ NOVO: Aplicar porcentagem
  const handleApplyPercentage = () => {
    const percentage = parseFloat(tempPercentage);
    
    if (isNaN(percentage) || percentage < 0) {
      toast({
        title: "Erro",
        description: "Digite um valor de porcentagem válido",
        variant: "destructive"
      });
      return;
    }

    if (selectedLocations.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma localização",
        variant: "destructive"
      });
      return;
    }

    const newConfig = { ...percentageConfig };
    selectedLocations.forEach(location => {
      newConfig[location] = percentage;
    });

    setPercentageConfig(newConfig);
    setIsPercentageDialogOpen(false);
    setTempPercentage('');
    setSelectedLocations([]);

    toast({
      title: "Sucesso",
      description: `Porcentagem de ${percentage}% aplicada a ${selectedLocations.length} localização(ões)`,
    });
  };

  // ✨ NOVO: Limpar porcentagens
  const handleClearPercentages = () => {
    setPercentageConfig({});
    toast({
      title: "Sucesso",
      description: "Todas as porcentagens foram removidas",
    });
  };

  // ✨ NOVO: Toggle seleção de localização
  const toggleLocationSelection = (location: string) => {
    setSelectedLocations(prev => 
      prev.includes(location) 
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

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

          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">Carregando dados...</div>
              </CardContent>
            </Card>
          ) : expandedData.length > 0 ? (
            <>
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

              {/* ✨ NOVO: Somatório por Localização */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      Somatório por Localização
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Localização</TableHead>
                          <TableHead className="text-center font-semibold">Total de Dias</TableHead>
                          <TableHead className="text-right font-semibold">Valor Base</TableHead>
                          <TableHead className="text-center font-semibold">Porcentagem</TableHead>
                          <TableHead className="text-right font-semibold">Valor Final</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locationSummary.map((summary) => (
                          <TableRow key={summary.locationName}>
                            <TableCell className="font-medium">{summary.locationName}</TableCell>
                            <TableCell className="text-center">
                              {summary.totalDays} dia{summary.totalDays !== 1 ? 's' : ''}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(summary.totalValue)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium",
                                summary.percentage > 0 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-gray-100 text-gray-600"
                              )}>
                                {summary.percentage > 0 ? `+${summary.percentage}%` : '0%'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(summary.totalValueWithPercentage)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableBody>
                        <TableRow className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                          <TableCell className="font-bold">TOTAL GERAL</TableCell>
                          <TableCell className="text-center font-bold">
                            {locationSummary.reduce((sum, s) => sum + s.totalDays, 0)} dias
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(locationSummary.reduce((sum, s) => sum + s.totalValue, 0))}
                          </TableCell>
                          <TableCell className="text-center">-</TableCell>
                          <TableCell className="text-right font-bold text-blue-600">
                            {formatCurrency(locationSummary.reduce((sum, s) => sum + s.totalValueWithPercentage, 0))}
                          </TableCell>
                        </TableRow>
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
                      : 'Verifique se existem registros de ponto no período selecionado.'
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
