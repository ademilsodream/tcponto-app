import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, ArrowLeft, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// Importar o tipo Database do seu arquivo de tipos Supabase
import { Database } from '@/types/supabase'; // Ajuste o caminho conforme necessário

// Tipos inferidos do banco de dados
type TimeRecordRow = Database['public']['Tables']['time_records']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

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
  [key: string]: LocationDetails | null | undefined; // Permite outras chaves, mas tipa as conhecidas
}

// NOVA INTERFACE: Representa uma linha na tabela de relatório (um registro de ponto)
interface TimeRecordReportRow {
  recordId: string; // ID do registro original
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

// Função para processar os dados de localização de um ponto específico
const processLocationData = (locations: TimeRecordRow['locations'], fieldName: string): LocationDetails | null => {
  if (!locations || typeof locations !== 'object') {
    return null;
  }

  const locObject = locations as TimeRecordLocations;
  const fieldData = locObject[fieldName];

  if (fieldData && typeof fieldData === 'object') {
    return {
      lat: fieldData.lat ?? null,
      lng: fieldData.lng ?? null,
      address: fieldData.address || 'Endereço não disponível'
    };
  }

  return null;
};


const LocationReport: React.FC<LocationReportProps> = ({ employees, onBack }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  // Mudar o estado para armazenar a nova estrutura de dados
  const [timeRecordsReportData, setTimeRecordsReportData] = useState<TimeRecordReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeRecordsData();
  }, [employees]); // Dependência de employees

  const loadTimeRecordsData = async () => {
    if (!employees || employees.length === 0) {
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
        // Remover o filtro .not('locations', 'is', null)
        // Agora queremos TODOS os registros, mas só exibiremos a localização se ela existir
        .eq('status', 'active')
        .order('date', { ascending: false })
        .order('clock_in', { ascending: true });

      if (error) {
        console.error('Erro ao carregar dados de localização:', error);
        setTimeRecordsReportData([]);
        throw error;
      }

      const employeeMap = employees.reduce((map, employee) => {
        // Adicionar verificação para garantir que o id não é null/undefined/empty string
        if (employee.id && typeof employee.id === 'string' && employee.id !== '') {
           map[employee.id] = employee.name;
        }
        return map;
      }, {} as Record<string, string>);

      // Processar os dados para a nova estrutura
      const formattedData: TimeRecordReportRow[] = data?.map((record) => {
        // Usar o map para obter o nome do funcionário
        const employeeName = employeeMap[record.user_id] || 'Funcionário Desconhecido';
        const locations = record.locations; // locations já é Json | null

        // Processar localização para cada tipo de ponto
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
          clockInLocation, // Pode ser LocationDetails | null
          lunchStartTime: record.lunch_start,
          lunchStartLocation, // Pode ser LocationDetails | null
          lunchEndTime: record.lunch_end,
          lunchEndLocation, // Pode ser LocationDetails | null
          clockOutTime: record.clock_out,
          clockOutLocation, // Pode ser LocationDetails | null
        };
      }) || []; // Garante que formattedData é sempre um array

      setTimeRecordsReportData(formattedData);

    } catch (error) {
      console.error('Erro inesperado ao carregar dados:', error);
      setTimeRecordsReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar os dados com base no funcionário selecionado
  const filteredTimeRecords = useMemo(() => {
    if (selectedEmployee === 'all') {
      return timeRecordsReportData;
    }
    // Filtrar pela nova estrutura, usando o userId
    return timeRecordsReportData.filter(record => record.userId === selectedEmployee);

  }, [timeRecordsReportData, selectedEmployee]); // Dependências corretas

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
                          // Filtro mais robusto para garantir que o id é uma string não vazia
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
                    {/* Usar filteredTimeRecords para a contagem */}
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
                {/* Usar filteredTimeRecords */}
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
                        {/* Mapear sobre filteredTimeRecords */}
                        {filteredTimeRecords.map((record) => (
                          <TableRow key={record.recordId}> {/* Usar recordId como chave */}
                            <TableCell>
                              {/* Formatar a data */}
                              {format(new Date(record.date + 'T00:00:00'), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {record.employeeName}
                            </TableCell>
                            {/* Células para Entrada */}
                            <TableCell>{record.clockInTime || '-'}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {record.clockInLocation ? record.clockInLocation.address : 'N/A'}
                               {record.clockInLocation?.lat != null && record.clockInLocation?.lng != null &&
                                ` (${record.clockInLocation.lat.toFixed(4)}, ${record.clockInLocation.lng.toFixed(4)})`
                              }
                            </TableCell>
                            {/* Células para Saída Almoço */}
                            <TableCell>{record.lunchStartTime || '-'}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {record.lunchStartLocation ? record.lunchStartLocation.address : 'N/A'}
                               {record.lunchStartLocation?.lat != null && record.lunchStartLocation?.lng != null &&
                                ` (${record.lunchStartLocation.lat.toFixed(4)}, ${record.lunchStartLocation.lng.toFixed(4)})`
                              }
                            </TableCell>
                            {/* Células para Volta Almoço */}
                            <TableCell>{record.lunchEndTime || '-'}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {record.lunchEndLocation ? record.lunchEndLocation.address : 'N/A'}
                               {record.lunchEndLocation?.lat != null && record.lunchEndLocation?.lng != null &&
                                ` (${record.lunchEndLocation.lat.toFixed(4)}, ${record.lunchEndLocation.lng.toFixed(4)})`
                              }
                            </TableCell>
                            {/* Células para Saída */}
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
