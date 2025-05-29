
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, ArrowLeft, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// Importar o tipo Database do seu arquivo de tipos Supabase
import { Database } from '@/integrations/supabase/types';

// Tipos inferidos do banco de dados
type TimeRecordRow = Database['public']['Tables']['time_records']['Row'];

// Adicionar hourlyRate e overtimeRate ao tipo User se vierem do profile
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourly_rate?: number | null;
}

// Tipo para a estrutura de localização dentro do campo 'locations' (do arquivo TimeRegistration)
interface LocationDetails {
  lat: number | null;
  lng: number | null;
  address: string;
}

// Tipo para o campo 'locations' que agora é um objeto JSON (do arquivo TimeRegistration)
interface TimeRecordLocations {
  clockIn?: LocationDetails | null;
  lunchStart?: LocationDetails | null;
  lunchEnd?: LocationDetails | null;
  clockOut?: LocationDetails | null;
  [key: string]: LocationDetails | null | undefined;
}

// NOVA INTERFACE: Representa uma linha na tabela de relatório (um registro de ponto)
interface TimeRecordReportRow {
  recordId: string;
  userId: string;
  employeeName: string;
  date: string;
  clockInTime: string | null;
  clockInLocation: LocationDetails | null;
  lunchStartTime: string | null;
  lunchStartLocation: LocationDetails | null;
  lunchEndTime: string | null;
  lunchEndLocation: LocationDetails | null;
  clockOutTime: string | null;
  clockOutLocation: LocationDetails | null;
}

interface LocationReportProps {
  employees: User[];
  onBack?: () => void;
}

// Função melhorada para processar diferentes formatos de dados de localização
const processLocationData = (locations: TimeRecordRow['locations'], fieldName: string): LocationDetails | null => {
  console.log('Processing location data:', { locations, fieldName });
  
  if (!locations) {
    console.log('No locations data found');
    return null;
  }

  // Se locations é uma string (formato antigo: "lat,lng")
  if (typeof locations === 'string') {
    console.log('Processing string format location:', locations);
    const parts = locations.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          lat,
          lng,
          address: 'Localização registrada'
        };
      }
    }
    return null;
  }

  // Se locations é um objeto (formato novo)
  if (typeof locations === 'object') {
    const locObject = locations as TimeRecordLocations;
    const fieldData = locObject[fieldName];

    if (fieldData && typeof fieldData === 'object') {
      return {
        lat: fieldData.lat ?? null,
        lng: fieldData.lng ?? null,
        address: fieldData.address || 'Endereço não disponível'
      };
    }

    // Se o objeto tem lat/lng diretos (outro formato possível)
    if ('lat' in locObject && 'lng' in locObject) {
      return {
        lat: locObject.lat as number,
        lng: locObject.lng as number,
        address: 'Localização registrada'
      };
    }
  }

  return null;
};

const LocationReport: React.FC<LocationReportProps> = ({ employees, onBack }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [timeRecordsReportData, setTimeRecordsReportData] = useState<TimeRecordReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeRecordsData();
  }, [employees]);

  const loadTimeRecordsData = async () => {
    console.log('Loading time records data...');
    console.log('Employees received:', employees);

    if (!employees || employees.length === 0) {
      console.log('No employees provided');
      setTimeRecordsReportData([]);
      setLoading(false);
      return;
    }

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
        .eq('status', 'active')
        .order('date', { ascending: false })
        .order('clock_in', { ascending: true });

      if (error) {
        console.error('Erro ao carregar dados de localização:', error);
        setTimeRecordsReportData([]);
        throw error;
      }

      console.log('Raw time records from database:', data);

      const employeeMap = employees.reduce((map, employee) => {
        if (employee.id && typeof employee.id === 'string' && employee.id !== '') {
           map[employee.id] = employee.name;
        }
        return map;
      }, {} as Record<string, string>);

      console.log('Employee map:', employeeMap);

      const formattedData: TimeRecordReportRow[] = data?.map((record) => {
        const employeeName = employeeMap[record.user_id] || 'Funcionário Desconhecido';
        const locations = record.locations;

        console.log('Processing record:', { recordId: record.id, locations, employeeName });

        const clockInLocation = processLocationData(locations, 'clockIn');
        const lunchStartLocation = processLocationData(locations, 'lunchStart');
        const lunchEndLocation = processLocationData(locations, 'lunchEnd');
        const clockOutLocation = processLocationData(locations, 'clockOut');

        return {
          recordId: record.id,
          userId: record.user_id,
          employeeName,
          date: record.date,
          clockInTime: record.clock_in,
          clockInLocation,
          lunchStartTime: record.lunch_start,
          lunchStartLocation,
          lunchEndTime: record.lunch_end,
          lunchEndLocation,
          clockOutTime: record.clock_out,
          clockOutLocation,
        };
      }) || [];

      console.log('Formatted data for display:', formattedData);
      setTimeRecordsReportData(formattedData);

    } catch (error) {
      console.error('Erro inesperado ao carregar dados:', error);
      setTimeRecordsReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTimeRecords = useMemo(() => {
    if (selectedEmployee === 'all') {
      return timeRecordsReportData;
    }
    return timeRecordsReportData.filter(record => record.userId === selectedEmployee);
  }, [timeRecordsReportData, selectedEmployee]);

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
                    Relatório de Localizações por Registro
                  </h1>
                  <p className="text-sm text-gray-600">Localizações associadas a cada registro de ponto</p>
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
                  Relatório de Localizações por Registro
                </h1>
                <p className="text-sm text-gray-600">Localizações associadas a cada registro de ponto</p>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <label className="text-sm font-medium">Total de Registros Exibidos</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredTimeRecords.length}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Funcionários Cadastrados</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {employees.length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registros de Ponto e Localizações</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTimeRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Entrada (Horário)</TableHead>
                        <TableHead>Entrada (Localização)</TableHead>
                        <TableHead>Saída Almoço (Horário)</TableHead>
                        <TableHead>Saída Almoço (Localização)</TableHead>
                        <TableHead>Volta Almoço (Horário)</TableHead>
                        <TableHead>Volta Almoço (Localização)</TableHead>
                        <TableHead>Saída (Horário)</TableHead>
                        <TableHead>Saída (Localização)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTimeRecords.map((record) => (
                        <TableRow key={record.recordId}>
                          <TableCell>
                            {format(new Date(record.date + 'T00:00:00'), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="font-medium">
                            {record.employeeName}
                          </TableCell>
                          <TableCell>{record.clockInTime || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.clockInLocation ? record.clockInLocation.address : 'N/A'}
                             {record.clockInLocation?.lat != null && record.clockInLocation?.lng != null &&
                              ` (${record.clockInLocation.lat.toFixed(4)}, ${record.clockInLocation.lng.toFixed(4)})`
                            }
                          </TableCell>
                          <TableCell>{record.lunchStartTime || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.lunchStartLocation ? record.lunchStartLocation.address : 'N/A'}
                             {record.lunchStartLocation?.lat != null && record.lunchStartLocation?.lng != null &&
                              ` (${record.lunchStartLocation.lat.toFixed(4)}, ${record.lunchStartLocation.lng.toFixed(4)})`
                            }
                          </TableCell>
                          <TableCell>{record.lunchEndTime || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.lunchEndLocation ? record.lunchEndLocation.address : 'N/A'}
                             {record.lunchEndLocation?.lat != null && record.lunchEndLocation?.lng != null &&
                              ` (${record.lunchEndLocation.lat.toFixed(4)}, ${record.lunchEndLocation.lng.toFixed(4)})`
                            }
                          </TableCell>
                          <TableCell>{record.clockOutTime || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.clockOutLocation ? record.clockOutLocation.address : 'N/A'}
                             {record.clockOutLocation?.lat != null && record.clockOutLocation?.lng != null &&
                              ` (${record.clockOutLocation.lat.toFixed(4)}, ${record.clockOutLocation.lng.toFixed(4)})`
                            }
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
                      : 'Nenhum registro de ponto encontrado'
                    }
                  </h3>
                  <p className="text-sm">
                     {employees.length === 0
                      ? 'Cadastre funcionários para ver os registros de ponto e localização'
                      : selectedEmployee === 'all'
                        ? 'Nenhum registro de ponto encontrado para todos os funcionários.'
                        : `Nenhum registro de ponto encontrado para o funcionário selecionado.`
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
