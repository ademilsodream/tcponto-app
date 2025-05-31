import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, ArrowLeft, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { filterValidTimeRecords, isValidTimeRecord } from '@/utils/queryValidation';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourly_rate?: number | null;
}

// Tipo melhorado para a estrutura de localização com detalhes completos
interface LocationDetails {
  lat: number;
  lng: number;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  fullAddress: string;
}

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

// Função melhorada para processar os dados de localização com múltiplos formatos
const processLocationData = (locations: any, fieldName: string): LocationDetails | null => {
  console.log(`Processando localização para campo ${fieldName}:`, locations);
  
  if (!locations || typeof locations !== 'object' || Array.isArray(locations)) {
    console.log(`Dados de localização inválidos para ${fieldName}`);
    return null;
  }

  const locObject = locations as Record<string, any>;
  
  // Tentar múltiplas variações do nome do campo
  const possibleFields = [
    fieldName,
    fieldName.toLowerCase(),
    fieldName.replace(/([A-Z])/g, '_$1').toLowerCase().substring(1), // camelCase para snake_case
    fieldName.charAt(0).toLowerCase() + fieldName.slice(1) // primeira letra minúscula
  ];

  let fieldData = null;
  let foundFieldName = '';

  // Buscar o campo nos possíveis formatos
  for (const possibleField of possibleFields) {
    if (locObject[possibleField]) {
      fieldData = locObject[possibleField];
      foundFieldName = possibleField;
      console.log(`Campo encontrado como: ${possibleField}`, fieldData);
      break;
    }
  }

  if (!fieldData) {
    console.log(`Nenhum dado encontrado para campo ${fieldName} nas variações:`, possibleFields);
    return null;
  }

  // Se for string simples (formato muito antigo)
  if (typeof fieldData === 'string') {
    console.log(`Formato string simples detectado para ${foundFieldName}:`, fieldData);
    return {
      lat: 0,
      lng: 0,
      street: 'Não informado',
      houseNumber: 'S/N',
      neighborhood: 'Não informado',
      city: 'Não informado',
      state: 'Não informado',
      postalCode: 'Não informado',
      country: 'Não informado',
      fullAddress: fieldData
    };
  }

  // Se for objeto
  if (typeof fieldData === 'object') {
    console.log(`Formato objeto detectado para ${foundFieldName}:`, fieldData);
    
    // Verificar se é o novo formato com detalhes completos
    if (fieldData.street !== undefined || fieldData.fullAddress !== undefined) {
      return {
        lat: Number(fieldData.lat) || 0,
        lng: Number(fieldData.lng) || 0,
        street: fieldData.street || 'Não informado',
        houseNumber: fieldData.houseNumber || 'S/N',
        neighborhood: fieldData.neighborhood || 'Não informado',
        city: fieldData.city || 'Não informado',
        state: fieldData.state || 'Não informado',
        postalCode: fieldData.postalCode || 'Não informado',
        country: fieldData.country || 'Não informado',
        fullAddress: fieldData.fullAddress || 'Endereço não disponível'
      };
    } 
    // Formato antigo (apenas coordenadas)
    else if (fieldData.lat !== undefined && fieldData.lng !== undefined) {
      console.log(`Formato antigo (coordenadas) detectado para ${foundFieldName}`);
      return {
        lat: Number(fieldData.lat) || 0,
        lng: Number(fieldData.lng) || 0,
        street: 'Não informado',
        houseNumber: 'S/N',
        neighborhood: 'Não informado',
        city: 'Não informado',
        state: 'Não informado',
        postalCode: 'Não informado',
        country: 'Não informado',
        fullAddress: fieldData.address || `Coordenadas: ${fieldData.lat}, ${fieldData.lng}`
      };
    }
    // Formato com apenas endereço
    else if (fieldData.address) {
      console.log(`Formato com address simples detectado para ${foundFieldName}`);
      return {
        lat: Number(fieldData.latitude || fieldData.lat) || 0,
        lng: Number(fieldData.longitude || fieldData.lng) || 0,
        street: 'Não informado',
        houseNumber: 'S/N',
        neighborhood: 'Não informado',
        city: 'Não informado',
        state: 'Não informado',
        postalCode: 'Não informado',
        country: 'Não informado',
        fullAddress: fieldData.address
      };
    }
  }

  console.log(`Formato não reconhecido para ${foundFieldName}:`, fieldData);
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
    if (!employees || employees.length === 0) {
      setTimeRecordsReportData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('=== INÍCIO CARREGAMENTO DADOS DE LOCALIZAÇÃO ===');

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
        .eq('status', 'active' as any)
        .order('date', { ascending: false })
        .order('clock_in', { ascending: true });

      if (error) {
        console.error('Erro ao carregar dados de localização:', error);
        setTimeRecordsReportData([]);
        throw error;
      }

      console.log('Registros carregados do banco:', data?.length || 0);
      
      const employeeMap = employees.reduce((map, employee) => {
        if (employee.id && typeof employee.id === 'string' && employee.id !== '') {
           map[employee.id] = employee.name;
        }
        return map;
      }, {} as Record<string, string>);

      console.log('Mapeamento de funcionários:', employeeMap);

      const validRecords = filterValidTimeRecords(data || []);

      const formattedData: TimeRecordReportRow[] = validRecords.map((record, index) => {
        // Verificar se é um time record válido
        if (!isValidTimeRecord(record)) {
          console.log(`Registro ${index + 1} é inválido, pulando...`);
          return null;
        }

        console.log(`\n--- Processando registro ${index + 1}/${validRecords.length} ---`);
        console.log('Record ID:', record.id);
        console.log('User ID:', record.user_id);
        console.log('Data:', record.date);
        console.log('Locations raw:', record.locations);

        const employeeName = employeeMap[record.user_id || ''] || 'Funcionário Desconhecido';
        const locations = record.locations;

        console.log('Processando clockIn...');
        const clockInLocation = processLocationData(locations, 'clockIn');
        
        console.log('Processando lunchStart...');
        const lunchStartLocation = processLocationData(locations, 'lunchStart');
        
        console.log('Processando lunchEnd...');
        const lunchEndLocation = processLocationData(locations, 'lunchEnd');
        
        console.log('Processando clockOut...');
        const clockOutLocation = processLocationData(locations, 'clockOut');

        console.log('Resultado final do processamento:');
        console.log('- clockInLocation:', clockInLocation ? 'OK' : 'NULL');
        console.log('- lunchStartLocation:', lunchStartLocation ? 'OK' : 'NULL');
        console.log('- lunchEndLocation:', lunchEndLocation ? 'OK' : 'NULL');
        console.log('- clockOutLocation:', clockOutLocation ? 'OK' : 'NULL');

        return {
          recordId: record.id || '',
          userId: record.user_id || '',
          employeeName,
          date: record.date,
          clockInTime: record.clock_in || null,
          clockInLocation,
          lunchStartTime: record.lunch_start || null,
          lunchStartLocation,
          lunchEndTime: record.lunch_end || null,
          lunchEndLocation,
          clockOutTime: record.clock_out || null,
          clockOutLocation,
        };
      }).filter((record): record is TimeRecordReportRow => record !== null);

      console.log('=== DADOS FINAIS FORMATADOS ===');
      console.log('Total de registros processados:', formattedData.length);
      console.log('Registros com pelo menos uma localização:', 
        formattedData.filter(r => r.clockInLocation || r.lunchStartLocation || r.lunchEndLocation || r.clockOutLocation).length
      );

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

  // Função para renderizar informações de localização melhoradas
  const renderLocationInfo = (location: LocationDetails | null) => {
    if (!location) return 'N/A';
    
    return (
      <div className="text-xs">
        <div className="font-medium mb-1">{location.fullAddress}</div>
        {(location.street !== 'Não informado' || location.city !== 'Não informado') && (
          <div className="text-gray-500 space-y-0.5">
            {location.street !== 'Não informado' && (
              <div>📍 {location.street}, {location.houseNumber}</div>
            )}
            {location.neighborhood !== 'Não informado' && (
              <div>🏘️ {location.neighborhood}</div>
            )}
            {location.city !== 'Não informado' && (
              <div>🏙️ {location.city}/{location.state}</div>
            )}
            {location.postalCode !== 'Não informado' && (
              <div>📮 {location.postalCode}</div>
            )}
            {location.country !== 'Não informado' && (
              <div>🌍 {location.country}</div>
            )}
            {(location.lat !== 0 || location.lng !== 0) && (
              <div>📌 {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</div>
            )}
          </div>
        )}
      </div>
    );
  };

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
                    Relatório de Localizações Detalhado
                  </h1>
                  <p className="text-sm text-gray-600">Informações completas de localização dos registros de ponto</p>
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
                  Relatório de Localizações Detalhado
                </h1>
                <p className="text-sm text-gray-600">Informações completas de localização dos registros de ponto</p>
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
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registros de Localização ({filteredTimeRecords.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída Almoço</TableHead>
                      <TableHead>Volta Almoço</TableHead>
                      <TableHead>Saída</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTimeRecords.map((record) => (
                      <TableRow key={record.recordId}>
                        <TableCell className="font-medium">{record.employeeName}</TableCell>
                        <TableCell>
                          {format(new Date(record.date + 'T00:00:00'), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {record.clockInTime && (
                            <div className="space-y-1">
                              <div className="font-medium">{record.clockInTime}</div>
                              {renderLocationInfo(record.clockInLocation)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {record.lunchStartTime && (
                            <div className="space-y-1">
                              <div className="font-medium">{record.lunchStartTime}</div>
                              {renderLocationInfo(record.lunchStartLocation)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {record.lunchEndTime && (
                            <div className="space-y-1">
                              <div className="font-medium">{record.lunchEndTime}</div>
                              {renderLocationInfo(record.lunchEndLocation)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {record.clockOutTime && (
                            <div className="space-y-1">
                              <div className="font-medium">{record.clockOutTime}</div>
                              {renderLocationInfo(record.clockOutLocation)}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTimeRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          Nenhum registro encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LocationReport;
