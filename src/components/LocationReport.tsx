import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, ArrowLeft, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

interface LocationData {
  id: string;
  employeeName: string;
  date: string;
  type: string;
  time: string;
  address: string;
  coordinates: string;
}

interface LocationReportProps {
  employees: User[];
  onBack?: () => void;
}

// Função para processar dados de localização em diferentes formatos
const processLocationData = (locations: any, fieldName: string) => {
  console.log(`Processando localização para ${fieldName}:`, locations);
  
  if (!locations) {
    console.log(`Nenhuma localização encontrada para ${fieldName}`);
    return null;
  }

  // Verificar se locations é uma string (formato antigo)
  if (typeof locations === 'string') {
    console.log(`Formato antigo detectado para ${fieldName}: ${locations}`);
    
    // Tentar parsear coordenadas no formato "lat,lng"
    const coordMatch = locations.match(/-?\d+\.?\d*,-?\d+\.?\d*/);
    if (coordMatch) {
      const [lat, lng] = coordMatch[0].split(',');
      return {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: 'Endereço não disponível (formato antigo)'
      };
    }
    
    console.warn(`Formato de string não reconhecido para ${fieldName}: ${locations}`);
    return {
      lat: null,
      lng: null,
      address: 'Formato de localização inválido'
    };
  }

  // Verificar se locations é um objeto (formato novo)
  if (typeof locations === 'object') {
    // Verificar se existe a propriedade específica do campo
    const fieldData = locations[fieldName];
    if (fieldData) {
      console.log(`Formato novo encontrado para ${fieldName}:`, fieldData);
      return {
        lat: fieldData.lat || null,
        lng: fieldData.lng || null,
        address: fieldData.address || 'Endereço não disponível'
      };
    }
    
    // Fallback: verificar se o objeto tem propriedades de coordenadas diretamente
    if (locations.lat && locations.lng) {
      console.log(`Formato de objeto direto para ${fieldName}:`, locations);
      return {
        lat: locations.lat,
        lng: locations.lng,
        address: locations.address || 'Endereço não disponível'
      };
    }
  }

  console.warn(`Formato não reconhecido para ${fieldName}:`, typeof locations, locations);
  return null;
};

const LocationReport: React.FC<LocationReportProps> = ({ employees, onBack }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocationData();
  }, [employees]);

  const loadLocationData = async () => {
    if (!employees || employees.length === 0) {
      setLocationData([]);
      setLoading(false);
      return;
    }

    console.log('Carregando dados de localização...');
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('time_records')
        .select(`
          id,
          date,
          clock_in,
          lunch_start,
          lunch_end,
          clock_out,
          locations,
          user_id
        `)
        .not('locations', 'is', null)
        .eq('status', 'active')
        .order('date', { ascending: false })
        .order('clock_in', { ascending: true });

      if (error) {
        console.error('Erro ao carregar dados de localização:', error);
        throw error;
      }

      console.log('Registros com localização encontrados:', data);

      // Criar um mapa de user_id para nome do funcionário
      const employeeMap = employees.reduce((map, employee) => {
        map[employee.id] = employee.name;
        return map;
      }, {} as Record<string, string>);

      const formattedData: LocationData[] = [];

      data?.forEach((record) => {
        const employeeName = employeeMap[record.user_id] || 'Funcionário';
        const locations = record.locations;

        console.log(`Processando registro ${record.id} com locations:`, locations);

        // Processar entrada
        if (record.clock_in) {
          const locationInfo = processLocationData(locations, 'clockIn');
          if (locationInfo) {
            formattedData.push({
              id: `${record.id}-clock_in`,
              employeeName,
              date: record.date,
              type: 'Entrada',
              time: record.clock_in,
              address: locationInfo.address,
              coordinates: locationInfo.lat && locationInfo.lng 
                ? `${locationInfo.lat}, ${locationInfo.lng}`
                : 'Coordenadas não disponíveis'
            });
          }
        }

        // Processar saída para almoço
        if (record.lunch_start) {
          const locationInfo = processLocationData(locations, 'lunchStart');
          if (locationInfo) {
            formattedData.push({
              id: `${record.id}-lunch_start`,
              employeeName,
              date: record.date,
              type: 'Saída Almoço',
              time: record.lunch_start,
              address: locationInfo.address,
              coordinates: locationInfo.lat && locationInfo.lng 
                ? `${locationInfo.lat}, ${locationInfo.lng}`
                : 'Coordenadas não disponíveis'
            });
          }
        }

        // Processar volta do almoço
        if (record.lunch_end) {
          const locationInfo = processLocationData(locations, 'lunchEnd');
          if (locationInfo) {
            formattedData.push({
              id: `${record.id}-lunch_end`,
              employeeName,
              date: record.date,
              type: 'Volta Almoço',
              time: record.lunch_end,
              address: locationInfo.address,
              coordinates: locationInfo.lat && locationInfo.lng 
                ? `${locationInfo.lat}, ${locationInfo.lng}`
                : 'Coordenadas não disponíveis'
            });
          }
        }

        // Processar saída
        if (record.clock_out) {
          const locationInfo = processLocationData(locations, 'clockOut');
          if (locationInfo) {
            formattedData.push({
              id: `${record.id}-clock_out`,
              employeeName,
              date: record.date,
              type: 'Saída',
              time: record.clock_out,
              address: locationInfo.address,
              coordinates: locationInfo.lat && locationInfo.lng 
                ? `${locationInfo.lat}, ${locationInfo.lng}`
                : 'Coordenadas não disponíveis'
            });
          }
        }
      });

      console.log('Dados de localização formatados:', formattedData);
      setLocationData(formattedData);
    } catch (error) {
      console.error('Erro ao carregar dados de localização:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar dados por funcionário selecionado
  const filteredData = useMemo(() => {
    if (!selectedEmployee) {
      return locationData;
    }
    
    return locationData.filter(item => {
      const employee = employees.find(emp => emp.id === selectedEmployee);
      return employee && item.employeeName === employee.name;
    });
  }, [selectedEmployee, locationData, employees]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Entrada':
        return 'bg-green-100 text-green-800';
      case 'Saída':
        return 'bg-red-100 text-red-800';
      case 'Saída Almoço':
        return 'bg-yellow-100 text-yellow-800';
      case 'Volta Almoço':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  console.log('LocationReport renderizado com:', {
    employeesCount: employees.length,
    locationDataCount: locationData.length,
    filteredDataCount: filteredData.length,
    loading
  });

  if (loading) {
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
                    <MapPin className="w-5 h-5" />
                    Relatório de Localizações
                  </h1>
                  <p className="text-sm text-gray-600">Localizações dos registros de ponto</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Carregando dados de localização...</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                  <MapPin className="w-5 h-5" />
                  Relatório de Localizações
                </h1>
                <p className="text-sm text-gray-600">Localizações dos registros de ponto</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Funcionário</label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os funcionários" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os funcionários</SelectItem>
                      {employees.map(employee => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total de Registros</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredData.length}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Funcionários</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {employees.length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Localizações */}
          <Card>
            <CardHeader>
              <CardTitle>Registros de Localização</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Horário</TableHead>
                        <TableHead>Coordenadas</TableHead>
                        <TableHead>Endereço</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {format(new Date(item.date + 'T00:00:00'), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.employeeName}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
                              {item.type}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.time}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.coordinates}
                          </TableCell>
                          <TableCell>
                            {item.address}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {employees.length === 0 
                      ? 'Nenhum funcionário cadastrado' 
                      : 'Nenhum registro de localização'
                    }
                  </h3>
                  <p className="text-sm">
                    {employees.length === 0 
                      ? 'Cadastre funcionários para ver os registros de localização'
                      : 'Os registros de localização aparecerão aqui quando os funcionários registrarem o ponto'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LocationReport;
