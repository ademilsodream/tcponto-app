
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

interface LocationWorkCount {
  locationName: string;
  daysWorked: number;
}

interface EmployeeLocationData {
  employeeId: string;
  employeeName: string;
  locations: LocationWorkCount[];
  totalDays: number;
}

interface AutoDeObrasProps {
  employees: User[];
  onBack?: () => void;
}

const AutoDeObras: React.FC<AutoDeObrasProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employeeLocationData, setEmployeeLocationData] = useState<EmployeeLocationData[]>([]);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAllowedLocations();
  }, []);

  const loadAllowedLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('id, name, latitude, longitude, range_meters, address')
        .eq('is_active', true);

      if (error) {
        console.error('Erro ao carregar localizações permitidas:', error);
        setAllowedLocations([]);
        return;
      }

      setAllowedLocations(data || []);
    } catch (error) {
      console.error('Erro inesperado ao carregar localizações:', error);
      setAllowedLocations([]);
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const findLocationName = (lat: number, lng: number): string => {
    for (const location of allowedLocations) {
      const distance = calculateDistance(lat, lng, location.latitude, location.longitude);
      if (distance <= location.range_meters) {
        return location.name;
      }
    }
    return 'Localização não identificada';
  };

  const loadLocationWorkData = async () => {
    if (!startDate || !endDate || employees.length === 0 || allowedLocations.length === 0) {
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from('time_records')
        .select('id, date, user_id, locations')
        .eq('status', 'active')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (selectedEmployee !== 'all') {
        query = query.eq('user_id', selectedEmployee);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) {
        console.error('Erro ao carregar dados:', error);
        setEmployeeLocationData([]);
        return;
      }

      const employeeMap = employees.reduce((map, employee) => {
        if (employee.id && typeof employee.id === 'string' && employee.id !== '') {
          map[employee.id] = employee.name;
        }
        return map;
      }, {} as Record<string, string>);

      const locationCounts: Record<string, Record<string, Set<string>>> = {};

      data?.forEach((record) => {
        const employeeName = employeeMap[record.user_id];
        if (!employeeName) return;

        if (!locationCounts[record.user_id]) {
          locationCounts[record.user_id] = {};
        }

        const locations = record.locations;
        if (!locations || typeof locations !== 'object') return;

        const locObject = locations as Record<string, any>;
        const clockInData = locObject.clockIn || locObject.clock_in;
        
        if (clockInData && typeof clockInData === 'object' && clockInData.lat && clockInData.lng) {
          const locationName = clockInData.locationName || findLocationName(
            Number(clockInData.lat), 
            Number(clockInData.lng)
          );

          if (!locationCounts[record.user_id][locationName]) {
            locationCounts[record.user_id][locationName] = new Set();
          }
          locationCounts[record.user_id][locationName].add(record.date);
        }
      });

      const result: EmployeeLocationData[] = Object.entries(locationCounts).map(([userId, userLocations]) => {
        const locations: LocationWorkCount[] = Object.entries(userLocations).map(([locationName, datesSet]) => ({
          locationName,
          daysWorked: datesSet.size
        }));

        const totalDays = locations.reduce((sum, loc) => sum + loc.daysWorked, 0);

        return {
          employeeId: userId,
          employeeName: employeeMap[userId],
          locations: locations.sort((a, b) => b.daysWorked - a.daysWorked),
          totalDays
        };
      });

      setEmployeeLocationData(result.sort((a, b) => a.employeeName.localeCompare(b.employeeName)));

    } catch (error) {
      console.error('Erro inesperado ao carregar dados:', error);
      setEmployeeLocationData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate && allowedLocations.length > 0) {
      loadLocationWorkData();
    }
  }, [startDate, endDate, selectedEmployee, employees, allowedLocations]);

  const filteredData = useMemo(() => {
    if (selectedEmployee === 'all') {
      return employeeLocationData;
    }
    return employeeLocationData.filter(data => data.employeeId === selectedEmployee);
  }, [employeeLocationData, selectedEmployee]);

  const allLocationNames = useMemo(() => {
    const locationSet = new Set<string>();
    employeeLocationData.forEach(employee => {
      employee.locations.forEach(loc => {
        locationSet.add(loc.locationName);
      });
    });
    return Array.from(locationSet).sort();
  }, [employeeLocationData]);

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
                <p className="text-sm text-gray-600">Contagem de dias trabalhados por localização</p>
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
                  <label className="text-sm font-medium">Total de Funcionários</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredData.length}
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
          ) : filteredData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Contagem de Dias por Localização</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Funcionário</TableHead>
                        {allLocationNames.map(locationName => (
                          <TableHead key={locationName} className="text-center font-semibold">
                            {locationName}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-semibold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map(employee => (
                        <TableRow key={employee.employeeId}>
                          <TableCell className="font-medium">{employee.employeeName}</TableCell>
                          {allLocationNames.map(locationName => {
                            const locationData = employee.locations.find(loc => loc.locationName === locationName);
                            return (
                              <TableCell key={locationName} className="text-center">
                                {locationData ? `${locationData.daysWorked} dia${locationData.daysWorked !== 1 ? 's' : ''}` : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold">
                            {employee.totalDays} dia{employee.totalDays !== 1 ? 's' : ''}
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
                      : 'Nenhum registro encontrado'
                    }
                  </h3>
                  <p className="text-sm">
                    {!startDate || !endDate
                      ? 'Escolha as datas inicial e final para gerar o relatório'
                      : 'Nenhum registro de ponto encontrado para o período selecionado.'
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
