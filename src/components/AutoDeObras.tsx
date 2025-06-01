
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
    console.log('🔍 EXTRAINDO LOCATION - Input completo:', JSON.stringify(locations, null, 2));
    
    if (!locations) {
      console.log('❌ Locations é null/undefined');
      return null;
    }

    let locationName = null;
    
    // ESTRATÉGIA 1: Verificar todas as estruturas possíveis
    const possiblePaths = [
      'locationName',
      'clock_in.locationName', 
      'clockIn.locationName',
      'location.name',
      'name'
    ];

    for (const path of possiblePaths) {
      const pathParts = path.split('.');
      let value = locations;
      
      for (const part of pathParts) {
        if (value && typeof value === 'object' && value[part] !== undefined) {
          value = value[part];
        } else {
          value = null;
          break;
        }
      }
      
      if (value && typeof value === 'string') {
        locationName = value;
        console.log(`✅ LocationName encontrado via ${path}: "${locationName}"`);
        break;
      }
    }

    // ESTRATÉGIA 2: Busca recursiva por qualquer string que pareça um nome de local
    if (!locationName && typeof locations === 'object') {
      const findLocationRecursive = (obj: any, depth = 0): string | null => {
        if (depth > 3) return null; // Evitar loops infinitos
        
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string' && value.length > 2 && value.length < 100) {
            // Se contém "Casa" ou parece um nome de local
            if (value.includes('Casa') || value.includes('casa') || 
                /^[A-Za-zÀ-ÿ\s]+$/.test(value)) {
              console.log(`🎯 LocationName encontrado recursivamente em ${key}: "${value}"`);
              return value;
            }
          } else if (typeof value === 'object' && value !== null) {
            const found = findLocationRecursive(value, depth + 1);
            if (found) return found;
          }
        }
        return null;
      };
      
      locationName = findLocationRecursive(locations);
    }

    // ESTRATÉGIA 3: Fallback - usar qualquer string válida
    if (!locationName && typeof locations === 'object') {
      const allStrings = JSON.stringify(locations).match(/"([^"]+)"/g);
      if (allStrings && allStrings.length > 0) {
        for (const str of allStrings) {
          const cleanStr = str.replace(/"/g, '');
          if (cleanStr.length > 2 && cleanStr.length < 100 && 
              !cleanStr.includes('clock') && !cleanStr.includes('time')) {
            locationName = cleanStr;
            console.log(`🔄 LocationName fallback: "${locationName}"`);
            break;
          }
        }
      }
    }

    if (!locationName) {
      console.log('❌ NENHUM LOCATIONNAME ENCONTRADO após todas as estratégias');
      console.log('📊 Objeto locations analisado:', locations);
      return null;
    }

    console.log(`🎉 LOCATIONNAME FINAL: "${locationName}"`);
    return locationName;
  };

  const loadAutoObrasData = async () => {
    if (!startDate || !endDate || employees.length === 0) {
      console.log('⚠️ Dados insuficientes para carregar');
      return;
    }

    setLoading(true);
    console.log('\n🚀 === IMPLEMENTAÇÃO FINAL DO PLANO ===');
    
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    console.log(`📅 PERÍODO: ${startDateStr} até ${endDateStr}`);

    try {
      // QUERY ULTRA SIMPLIFICADA
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

      console.log(`📊 REGISTROS BRUTOS ENCONTRADOS: ${timeRecords?.length || 0}`);

      // Log específico para cada registro
      timeRecords?.forEach((record, index) => {
        console.log(`\n📝 REGISTRO ${index + 1}/${timeRecords.length}:`);
        console.log(`   👤 Nome: ${record.profiles.name}`);
        console.log(`   📅 Data: ${record.date}`);
        console.log(`   ⏰ Horas: ${record.total_hours}h`);
        console.log(`   🏢 Dept ID: ${record.profiles.department_id}`);
        console.log(`   👔 Job ID: ${record.profiles.job_function_id}`);
        console.log(`   📍 Locations RAW:`, record.locations);
        
        if (record.profiles.name === 'Usuario de teste') {
          console.log(`🎯🎯🎯 USUARIO DE TESTE ENCONTRADO! 🎯🎯🎯`);
          console.log(`   ANÁLISE COMPLETA DO USUARIO DE TESTE:`);
          console.log(`   - Nome: "${record.profiles.name}"`);
          console.log(`   - Data: ${record.date}`);
          console.log(`   - Horas: ${record.total_hours}`);
          console.log(`   - Dept: ${record.profiles.department_id}`);
          console.log(`   - Job: ${record.profiles.job_function_id}`);
          console.log(`   - Locations objeto:`, JSON.stringify(record.locations, null, 2));
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
        console.log(`💰 Auto-valor mapeado: ${key} = R$ ${av.auto_value}`);
      });

      // PROCESSAMENTO ULTRA SIMPLIFICADO
      const employeeMap = new Map<string, EmployeeAutoObrasData>();
      let totalProcessed = 0;
      let totalValid = 0;
      let usuarioTesteProcessado = false;

      console.log('\n=== PROCESSAMENTO RECORD POR RECORD ===');

      timeRecords?.forEach((record, index) => {
        console.log(`\n🔄 PROCESSANDO ${index + 1}/${timeRecords.length}: ${record.profiles.name}`);
        
        const profile = record.profiles;
        const isUsuarioTeste = profile.name === 'Usuario de teste';
        
        if (isUsuarioTeste) {
          console.log(`🎯 PROCESSANDO USUARIO DE TESTE - INÍCIO`);
        }
        
        totalProcessed++;

        // VALIDAÇÃO 1: Department e Job Function
        if (!profile.department_id || !profile.job_function_id) {
          console.log(`❌ Sem department_id (${profile.department_id}) ou job_function_id (${profile.job_function_id})`);
          if (isUsuarioTeste) {
            console.log(`🚨 USUARIO DE TESTE REJEITADO: FALTA DEPT/JOB`);
          }
          return;
        }
        
        // VALIDAÇÃO 2: Auto valor
        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;
        
        console.log(`💰 Buscando auto-valor para chave: ${autoKey}`);
        console.log(`💰 Auto-valor encontrado: R$ ${autoValue}`);
        
        if (autoValue <= 0) {
          console.log(`❌ Auto-valor inválido: R$ ${autoValue}`);
          if (isUsuarioTeste) {
            console.log(`🚨 USUARIO DE TESTE REJEITADO: AUTO-VALOR ZERO`);
          }
          return;
        }
        
        // VALIDAÇÃO 3: Location Name - VERSÃO MELHORADA
        console.log(`📍 Extraindo locationName do objeto:`, record.locations);
        const locationName = extractLocationName(record.locations);
        
        if (!locationName) {
          console.log(`❌ LocationName não encontrado`);
          if (isUsuarioTeste) {
            console.log(`🚨 USUARIO DE TESTE REJEITADO: SEM LOCATION NAME`);
          }
          return;
        }
        
        // SE CHEGOU ATÉ AQUI = REGISTRO VÁLIDO
        console.log(`✅ REGISTRO VÁLIDO CONFIRMADO!`);
        console.log(`   LocationName: "${locationName}"`);
        console.log(`   Horas: ${record.total_hours}`);
        console.log(`   Auto-valor: R$ ${autoValue}`);
        
        totalValid++;
        
        if (isUsuarioTeste) {
          console.log(`🎉🎉🎉 USUARIO DE TESTE APROVADO! 🎉🎉🎉`);
          console.log(`   LocationName final: "${locationName}"`);
          console.log(`   Horas: ${record.total_hours}`);
          console.log(`   Auto-valor: R$ ${autoValue}`);
          console.log(`   Valor calculado: R$ ${Number(record.total_hours) * autoValue}`);
          usuarioTesteProcessado = true;
        }

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
        
        console.log(`📊 Dados atualizados para ${profile.name}:`);
        console.log(`   Location: ${locationEntry.locationName}`);
        console.log(`   Horas totais: ${locationEntry.totalHours}`);
        console.log(`   Valor total: R$ ${locationEntry.totalValue}`);
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

      console.log('\n=== RESULTADO FINAL DETALHADO ===');
      console.log(`📊 Total de registros processados: ${totalProcessed}`);
      console.log(`✅ Registros válidos: ${totalValid}`);
      console.log(`👥 Funcionários no resultado: ${result.length}`);
      console.log(`🎯 Usuario de teste processado: ${usuarioTesteProcessado ? 'SIM ✅' : 'NÃO ❌'}`);

      result.forEach((emp, index) => {
        console.log(`\n👤 FUNCIONÁRIO ${index + 1}: ${emp.employeeName}`);
        emp.locations.forEach((loc, locIndex) => {
          console.log(`   📍 Local ${locIndex + 1}: ${loc.locationName}`);
          console.log(`      Horas: ${loc.totalHours}h`);
          console.log(`      Dias: ${loc.totalDays}`);
          console.log(`      Valor: R$ ${loc.totalValue}`);
        });
        
        if (emp.employeeName === 'Usuario de teste') {
          console.log(`🎯 USUARIO DE TESTE NO RESULTADO FINAL:`, JSON.stringify(emp, null, 2));
        }
      });

      setDebugInfo({
        period: `${startDateStr} até ${endDateStr}`,
        totalRecords: timeRecords?.length || 0,
        recordsProcessed: totalProcessed,
        recordsValid: totalValid,
        employeesWithData: result.length,
        usuarioTesteProcessado
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

          {/* Debug Info Melhorado */}
          {debugInfo.totalRecords > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800 text-sm">🔧 Debug Info - Plano Final Implementado</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-700">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div>Período: {debugInfo.period}</div>
                  <div>Registros encontrados: {debugInfo.totalRecords}</div>
                  <div>Processados: {debugInfo.recordsProcessed}</div>
                  <div>Válidos: {debugInfo.recordsValid}</div>
                  <div>Funcionários exibidos: {debugInfo.employeesWithData}</div>
                  <div className={debugInfo.usuarioTesteProcessado ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    Usuario de teste: {debugInfo.usuarioTesteProcessado ? '✅ PROCESSADO' : '❌ NÃO PROCESSADO'}
                  </div>
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
                      : 'Verifique os logs do console para mais detalhes sobre o processamento.'
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
