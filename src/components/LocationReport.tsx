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
  // hourlyRate e overtimeRate podem não estar no tipo Profile diretamente,
  // se estiverem, use o tipo inferido. Se não, mantenha como está
  hourly_rate?: number | null; // Use o nome do campo do DB
  // overtimeRate: number; // Não parece existir no schema profiles
}

// Tipo para a estrutura de localização dentro do campo 'locations' (do arquivo TimeRegistration)
interface LocationDetails {
  lat: number | null; // Pode ser null se as coordenadas não foram obtidas
  lng: number | null; // Pode ser null se as coordenadas não foram obtidas
  address: string; // Endereço formatado
}

// Tipo para o campo 'locations' que agora é um objeto JSON (do arquivo TimeRegistration)
interface TimeRecordLocations {
  clockIn?: LocationDetails | null;
  lunchStart?: LocationDetails | null;
  lunchEnd?: LocationDetails | null;
  clockOut?: LocationDetails | null;
  // Adicione outros tipos de ponto se existirem
  [key: string]: LocationDetails | null | undefined; // Permite acesso dinâmico
}


// Atualizar a interface LocationData para incluir userId
interface LocationData {
  id: string; // ID único para o item (ex: record_id-type)
  recordId: string; // ID do registro original (time_records)
  userId: string; // Adicionado userId para filtragem
  employeeName: string;
  date: string;
  type: string; // 'Entrada', 'Saída Almoço', etc.
  time: string; // Horário do registro (HH:MM:SS)
  address: string;
  coordinates: string; // Formatado como "lat, lng"
}

interface LocationReportProps {
  employees: User[]; // Usar o tipo User definido acima
  onBack?: () => void;
}


// Função para processar os dados de localização de um ponto específico
const processLocationData = (locations: TimeRecordRow['locations'], fieldName: string): LocationDetails | null => {
   // Garantir que locations é um objeto e não null ou outro tipo primitivo
  if (!locations || typeof locations !== 'object') {
    return null;
  }

  // Converter para o tipo esperado para acesso seguro
  const locObject = locations as TimeRecordLocations;

  // Acessar os dados do campo específico (ex: 'clockIn')
  const fieldData = locObject[fieldName];

  // Verificar se os dados do campo existem e são um objeto válido
  if (fieldData && typeof fieldData === 'object') {
    return {
      lat: fieldData.lat ?? null, // Usar nullish coalescing para garantir null se undefined
      lng: fieldData.lng ?? null,
      address: fieldData.address || 'Endereço não disponível' // Usar fallback para endereço
    };
  }

  return null; // Retorna null se o campo não existir ou não for válido
};


const getTypeColor = (type: string) => {
  switch (type) {
    case 'Entrada':
      return 'bg-green-100 text-green-800';
    case 'Saída Almoço':
      return 'bg-yellow-100 text-yellow-800';
    case 'Volta Almoço':
      return 'bg-blue-100 text-blue-800';
    case 'Saída':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};


const LocationReport: React.FC<LocationReportProps> = ({ employees, onBack }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocationData();
    // Adicionado selectedEmployee como dependência para recarregar dados ao mudar o filtro
    // No entanto, a filtragem é feita no useMemo, então carregar tudo uma vez é suficiente.
    // A dependência correta aqui é apenas 'employees' se você carregar TUDO e filtrar no useMemo.
    // Se você quiser filtrar a query do Supabase, selectedEmployee seria uma dependência.
    // Vamos manter a query carregando tudo e filtrar no useMemo por enquanto.
  }, [employees]); // Dependência de employees está correta para carregar ao receber a lista de funcionários


  const loadLocationData = async () => {
    if (!employees || employees.length === 0) {
      setLocationData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Usar o tipo inferido para a query
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
        // Filtrar apenas registros que têm ALGUMA localização registrada
        .not('locations', 'is', null)
        .eq('status', 'active')
        .order('date', { ascending: false })
        .order('clock_in', { ascending: true });


      if (error) {
        console.error('Erro ao carregar dados de localização:', error);
        // Considere mostrar um erro na UI
        setLocationData([]); // Limpa dados em caso de erro
        throw error; // Re-lança o erro para ser pego pelo catch
      }

      const employeeMap = employees.reduce((map, employee) => {
        map[employee.id] = employee.name;
        return map;
      }, {} as Record<string, string>);

      const formattedData: LocationData[] = [];

      data?.forEach((record) => {
        const employeeName = employeeMap[record.user_id] || 'Funcionário Desconhecido';
        const locations = record.locations; // locations já é Json | null

        // Processar e adicionar Entrada se existir e tiver localização
        if (record.clock_in) {
          const locationInfo = processLocationData(locations, 'clockIn');
          if (locationInfo) { // Adiciona apenas se locationInfo não for null
            formattedData.push({
              id: `${record.id}-clock_in`, // ID único para o item na lista
              recordId: record.id, // ID do registro original
              userId: record.user_id, // Adicionado userId
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

        // Processar e adicionar Saída Almoço se existir e tiver localização
        if (record.lunch_start) {
          const locationInfo = processLocationData(locations, 'lunchStart');
           if (locationInfo) { // Adiciona apenas se locationInfo não for null
            formattedData.push({
              id: `${record.id}-lunch_start`,
              recordId: record.id,
              userId: record.user_id, // Adicionado userId
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

        // Processar e adicionar Volta Almoço se existir e tiver localização
        if (record.lunch_end) {
          const locationInfo = processLocationData(locations, 'lunchEnd');
          if (locationInfo) { // Adiciona apenas se locationInfo não for null
            formattedData.push({
              id: `${record.id}-lunch_end`,
              recordId: record.id,
              userId: record.user_id, // Adicionado userId
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

        // Processar e adicionar Saída se existir e tiver localização
        if (record.clock_out) {
          const locationInfo = processLocationData(locations, 'clockOut');
          if (locationInfo) { // Adiciona apenas se locationInfo não for null
            formattedData.push({
              id: `${record.id}-clock_out`,
              recordId: record.id,
              userId: record.user_id, // Adicionado userId
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

      setLocationData(formattedData);
    } catch (error) {
      console.error('Erro inesperado ao carregar dados:', error);
      setLocationData([]); // Limpa dados em caso de erro
    } finally {
      setLoading(false);
    }
  };

  // Corrigir a lógica de filtragem no useMemo para usar o ID do funcionário
  const filteredData = useMemo(() => {
    if (selectedEmployee === 'all') {
      return locationData;
    }

    // Filtrar locationData onde o userId corresponde ao selectedEmployee
    return locationData.filter(item => item.userId === selectedEmployee);

  }, [locationData, selectedEmployee]); // Dependências corretas

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
                        .filter(employee => employee.id && employee.id !== '')
                        .map(employee => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Total de Registros com Localização</label>
                  {/* Usar filteredData */}
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredData.length}
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
              <CardTitle>Registros de Localização</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Usar filteredData */}
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
                      {/* Usar filteredData */}
                      {filteredData.map((item) => (
                        <TableRow key={item.id}> {/* Usar item.id que é único */}
                          <TableCell>
                            {/* Certificar que a data é um formato válido para o construtor Date */}
                            {/* Assumindo que item.date está no formato 'YYYY-MM-DD' */}
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
                      : 'Nenhum registro de localização encontrado'
                    }
                  </h3>
                  <p className="text-sm">
                     {employees.length === 0
                      ? 'Cadastre funcionários para ver os registros de localização'
                      : selectedEmployee === 'all'
                        ? 'Nenhum registro de localização encontrado para todos os funcionários.'
                        : `Nenhum registro de localização encontrado para o funcionário selecionado.`
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
