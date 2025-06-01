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
        console.log(`   ${i + 1}. ${loc.name} - Range: ${loc.range_meters}m - Coords: ${loc.latitude}, ${loc.longitude}`);
      });
      setAllowedLocations(data || []);
    } catch (error) {
      console.error('💥 Erro inesperado ao carregar localizações:', error);
      setAllowedLocations([]);
    }
  };

  // Função de cálculo de distância
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Raio da Terra em metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  // Verificar se uma localização existe na lista de permitidas
  const isValidLocationName = (locationName: string): boolean => {
    return allowedLocations.some(loc => loc.name === locationName);
  };

  const findLocationName = (lat: number, lng: number): string | null => {
    console.log(`🔍 AutoDeObras: Calculando localização para coordenadas: ${lat}, ${lng}`);
    
    if (!lat || !lng || allowedLocations.length === 0) {
      console.log('❌ Coordenadas inválidas ou sem localizações cadastradas');
      return null;
    }

    let closestLocation = null;
    let minDistance = Infinity;

    for (const location of allowedLocations) {
      console.log(`\n🏢 Verificando localização: ${location.name}`);
      console.log(`   Coordenadas cadastradas: ${location.latitude}, ${location.longitude}`);
      console.log(`   Range permitido: ${location.range_meters}m`);
      
      const distance = calculateDistance(lat, lng, location.latitude, location.longitude);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestLocation = location;
      }
      
      console.log(`   Distância: ${distance.toFixed(2)}m vs Range: ${location.range_meters}m`);
      
      if (distance <= location.range_meters) {
        console.log(`✅ MATCH! Funcionário está dentro do range de ${location.name}`);
        console.log(`   Distância final: ${distance.toFixed(2)}m`);
        return location.name;
      } else {
        console.log(`❌ Fora do range de ${location.name} (${distance.toFixed(2)}m > ${location.range_meters}m)`);
      }
    }
    
    if (closestLocation) {
      console.log(`\n📍 Localização mais próxima: ${closestLocation.name}`);
      console.log(`   Distância: ${minDistance.toFixed(2)}m (Range necessário: ${closestLocation.range_meters}m)`);
      console.log(`   Diferença: ${(minDistance - closestLocation.range_meters).toFixed(2)}m a mais que o permitido`);
    }
    
    console.log('❌ Nenhuma localização válida encontrada por coordenadas');
    return null;
  };

  const extractLocationData = (locations: any): { lat: number, lng: number, locationName?: string } | null => {
    console.log('📍 AutoDeObras: Extraindo dados de localização:', locations);
    
    if (!locations || typeof locations !== 'object') {
      console.log('❌ Dados de localização inválidos');
      return null;
    }

    let clockInData = null;
    let foundFieldName = '';
    
    // Tentar diferentes estruturas possíveis
    if (locations.clockIn && typeof locations.clockIn === 'object') {
      clockInData = locations.clockIn;
      foundFieldName = 'clockIn';
    } else if (locations.clock_in && typeof locations.clock_in === 'object') {
      clockInData = locations.clock_in;
      foundFieldName = 'clock_in';
    } else if (locations.lat && locations.lng) {
      clockInData = locations;
      foundFieldName = 'root';
    }

    if (!clockInData) {
      console.log('❌ Nenhum dado de clock-in encontrado');
      return null;
    }

    console.log(`✅ Dados encontrados no campo: ${foundFieldName}`, clockInData);

    const lat = Number(clockInData.lat || clockInData.latitude);
    const lng = Number(clockInData.lng || clockInData.longitude);

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.log(`❌ Coordenadas inválidas: lat=${lat}, lng=${lng}`);
      return null;
    }

    console.log(`✅ Coordenadas extraídas: ${lat}, ${lng}`);
    return {
      lat,
      lng,
      locationName: clockInData.locationName
    };
  };

  const loadAutoObrasData = async () => {
    if (!startDate || !endDate || employees.length === 0) {
      console.log('⚠️ AutoDeObras: Dados insuficientes para carregar');
      return;
    }

    setLoading(true);
    console.log('\n🚀 AutoDeObras: Iniciando carregamento de dados...');
    console.log(`📅 Período: ${format(startDate, 'dd/MM/yyyy')} até ${format(endDate, 'dd/MM/yyyy')}`);

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
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .not('total_hours', 'is', null)
        .gt('total_hours', 0)
        .not('profiles.department_id', 'is', null)
        .not('profiles.job_function_id', 'is', null);

      if (selectedEmployee !== 'all') {
        query = query.eq('user_id', selectedEmployee);
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

      console.log(`📊 Registros carregados: ${timeRecords?.length || 0}`);

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
        console.log(`\n📝 Processando registro ${index + 1}/${totalRecords}`);
        console.log(`   ID: ${record.id}`);
        console.log(`   Funcionário: ${record.profiles.name}`);
        console.log(`   Data: ${record.date}`);
        console.log(`   Horas: ${record.total_hours}`);
        
        const profile = record.profiles;
        
        // Verificar se tem valor do auto ANTES de processar
        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;
        
        console.log(`   Auto-valor key: ${autoKey}`);
        console.log(`   Auto-valor encontrado: R$ ${autoValue}`);
        
        // FILTRO 1: Pular se não tem valor do auto
        if (autoValue <= 0) {
          console.log(`❌ Registro descartado - sem valor do auto`);
          return;
        }
        
        recordsWithAutoValue++;
        
        // FILTRO 2: Verificar localização válida
        const locationData = extractLocationData(record.locations);
        if (!locationData) {
          console.log(`❌ Registro descartado - sem dados de localização`);
          return;
        }
        
        recordsWithValidLocation++;
        
        // NOVA LÓGICA: Priorizar locationName existente
        let finalLocationName = null;
        
        if (locationData.locationName) {
          console.log(`🏷️ LocationName encontrado nos dados: "${locationData.locationName}"`);
          
          // Verificar se é uma localização válida
          if (isValidLocationName(locationData.locationName)) {
            finalLocationName = locationData.locationName;
            console.log(`✅ LocationName válido - usando: "${finalLocationName}"`);
          } else {
            console.log(`⚠️ LocationName "${locationData.locationName}" não está na lista de permitidas, calculando por coordenadas...`);
            finalLocationName = findLocationName(locationData.lat, locationData.lng);
          }
        } else {
          console.log(`📍 Sem locationName nos dados, calculando por coordenadas...`);
          finalLocationName = findLocationName(locationData.lat, locationData.lng);
        }
        
        // FILTRO 3: Pular se não conseguiu determinar localização
        if (!finalLocationName) {
          console.log(`❌ Registro descartado - localização não identificada`);
          return;
        }
        
        recordsProcessed++;
        
        console.log(`✅ Registro VÁLIDO processado - ${profile.name} em ${finalLocationName}`);

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

        let locationEntry = employeeData.locations.find(loc => loc.locationName === finalLocationName);
        if (!locationEntry) {
          locationEntry = {
            locationName: finalLocationName,
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
        
        const locationData = extractLocationData(record.locations);
        if (!locationData) return;
        
        // Usar mesma lógica para determinar localização final
        let finalLocationName = null;
        
        if (locationData.locationName && isValidLocationName(locationData.locationName)) {
          finalLocationName = locationData.locationName;
        } else {
          finalLocationName = findLocationName(locationData.lat, locationData.lng);
        }
        
        if (!finalLocationName) return;

        if (!locationDaysMap.has(record.user_id)) {
          locationDaysMap.set(record.user_id, new Map());
        }
        
        const userLocationDays = locationDaysMap.get(record.user_id)!;
        if (!userLocationDays.has(finalLocationName)) {
          userLocationDays.set(finalLocationName, new Set());
        }
        
        userLocationDays.get(finalLocationName)!.add(record.date);
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
        totalRecords,
        recordsWithValidLocation,
        recordsWithAutoValue,
        recordsProcessed,
        employeesWithData: result.length,
        recordsDiscarded: totalRecords - recordsProcessed
      };

      console.log('\n📊 Resumo final do processamento:');
      console.log(`   Total de registros: ${debug.totalRecords}`);
      console.log(`   Com valor do auto: ${debug.recordsWithAutoValue}`);
      console.log(`   Com localização válida: ${debug.recordsWithValidLocation}`);
      console.log(`   Processados com sucesso: ${debug.recordsProcessed}`);
      console.log(`   Funcionários no resultado: ${debug.employeesWithData}`);
      console.log(`   Registros descartados: ${debug.recordsDiscarded}`);

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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div>Registros encontrados: {debugInfo.totalRecords}</div>
                  <div>Processados: {debugInfo.recordsProcessed}</div>
                  <div>Descartados: {debugInfo.recordsDiscarded}</div>
                  <div>Com valor do auto: {debugInfo.recordsWithAutoValue}</div>
                  <div>Com localização válida: {debugInfo.recordsWithValidLocation}</div>
                  <div>Funcionários exibidos: {debugInfo.employeesWithData}</div>
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
                      : 'Nenhum registro com departamento, função, valor do auto e localização válidos foi encontrado para o período selecionado.'
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
