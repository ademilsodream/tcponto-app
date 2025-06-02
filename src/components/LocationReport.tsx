import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MapPin, ArrowLeft, Search, User, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getActiveEmployees, type Employee } from '@/utils/employeeFilters';

// Importar o tipo Database do arquivo de tipos Supabase
import { Database } from '@/integrations/supabase/types';

// Tipos inferidos do banco de dados
type TimeRecordRow = Database['public']['Tables']['time_records']['Row'];

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourly_rate?: number | null;
}

interface AllowedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  address: string;
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
  locationName?: string; // Nome da localização cadastrada
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
  employees: Employee[];
  onBack?: () => void;
}

// Função simplificada para processar dados de localização - APENAS extrai dados gravados
const processLocationData = (locations: TimeRecordRow['locations'], fieldName: string): LocationDetails | null => {
  if (!locations || typeof locations !== 'object' || Array.isArray(locations)) {
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

  // Buscar o campo nos possíveis formatos
  for (const possibleField of possibleFields) {
    if (locObject[possibleField]) {
      fieldData = locObject[possibleField];
      break;
    }
  }

  if (!fieldData) {
    return null;
  }

  let locationDetails: LocationDetails = {
    lat: 0,
    lng: 0,
    street: 'Não informado',
    houseNumber: 'S/N',
    neighborhood: 'Não informado',
    city: 'Não informado',
    state: 'Não informado',
    postalCode: 'Não informado',
    country: 'Não informado',
    fullAddress: 'Endereço não disponível'
  };

  // Se for string simples (formato muito antigo)
  if (typeof fieldData === 'string') {
    locationDetails.fullAddress = fieldData;
  }
  // Se for objeto - APENAS extrair dados gravados, sem verificações
  else if (typeof fieldData === 'object') {
    locationDetails = {
      lat: Number(fieldData.lat) || 0,
      lng: Number(fieldData.lng) || 0,
      street: fieldData.street || 'Não informado',
      houseNumber: fieldData.houseNumber || 'S/N',
      neighborhood: fieldData.neighborhood || 'Não informado',
      city: fieldData.city || 'Não informado',
      state: fieldData.state || 'Não informado',
      postalCode: fieldData.postalCode || 'Não informado',
      country: fieldData.country || 'Não informado',
      fullAddress: fieldData.fullAddress || fieldData.address || 'Endereço não disponível'
    };

    // APENAS extrair o locationName se existir nos dados gravados
    if (fieldData.locationName) {
      locationDetails.locationName = fieldData.locationName;
    }
  }

  return locationDetails;
};

const LocationReport: React.FC<LocationReportProps> = ({ employees, onBack }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [timeRecordsReportData, setTimeRecordsReportData] = useState<TimeRecordReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtrar apenas funcionários ativos usando useMemo para evitar recálculos desnecessários
  const activeEmployees = useMemo(() => getActiveEmployees(employees), [employees]);

  useEffect(() => {
    loadTimeRecordsData();
  }, [employees, startDate, endDate]);

  const loadTimeRecordsData = async () => {
    // Recalcular activeEmployees aqui para garantir dados atualizados
    const currentActiveEmployees = getActiveEmployees(employees);
    
    if (!currentActiveEmployees || currentActiveEmployees.length === 0) {
      setTimeRecordsReportData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const activeEmployeeIds = currentActiveEmployees.map(emp => emp.id);

      let query = supabase
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
        .in('user_id', activeEmployeeIds)
        .eq('status', 'active')
        .order('date', { ascending: false })
        .order('clock_in', { ascending: true });

      // Aplicar filtros de data se existirem
      if (startDate) {
        query = query.gte('date', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        query = query.lte('date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao carregar dados de localização:', error);
        setTimeRecordsReportData([]);
        throw error;
      }

      const employeeMap = currentActiveEmployees.reduce((map, employee) => {
        if (employee.id && typeof employee.id === 'string' && employee.id !== '') {
           map[employee.id] = employee.name;
        }
        return map;
      }, {} as Record<string, string>);

      const formattedData: TimeRecordReportRow[] = data?.map((record) => {
        const employeeName = employeeMap[record.user_id] || 'Funcionário Desconhecido';
        const locations = record.locations;

        // Processar cada tipo de localização de forma simplificada
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

  // Agrupar registros por funcionário
  const recordsByEmployee = useMemo(() => {
    const grouped = filteredTimeRecords.reduce((acc, record) => {
      if (!acc[record.userId]) {
        acc[record.userId] = {
          employeeName: record.employeeName,
          records: []
        };
      }
      acc[record.userId].records.push(record);
      return acc;
    }, {} as Record<string, { employeeName: string; records: TimeRecordReportRow[] }>);

    // Ordenar registros de cada funcionário por data
    Object.values(grouped).forEach(employee => {
      employee.records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return grouped;
  }, [filteredTimeRecords]);

  // Função para renderizar informações de localização - APENAS exibe dados gravados
  const renderLocationInfo = (location: LocationDetails | null) => {
    if (!location) return 'N/A';
    
    return (
      <div className="text-xs">
        {location.locationName && (
          <div className="font-bold text-blue-600 mb-1">📍 {location.locationName}</div>
        )}
        <div className="font-medium mb-1">{location.fullAddress}</div>
        {(location.street !== 'Não informado' || location.city !== 'Não informado') && (
          <div className="text-gray-500 space-y-0.5">
            {location.street !== 'Não informado' && (
              <div>🏠 {location.street}, {location.houseNumber}</div>
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

  if (activeEmployees.length === 0) {
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
            <CardContent className="text-center py-8">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum funcionário ativo encontrado</h3>
              <p className="text-sm text-gray-500">
                Cadastre funcionários ativos (não administradores) para visualizar relatórios de localização.
              </p>
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                      {activeEmployees
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
                  <label className="text-sm font-medium">Total de Registros</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredTimeRecords.length}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Registros com Localização</label>
                  <div className="text-2xl font-bold text-green-600">
                    {filteredTimeRecords.filter(r => 
                      r.clockInLocation || r.lunchStartLocation || r.lunchEndLocation || r.clockOutLocation
                    ).length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {Object.keys(recordsByEmployee).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(recordsByEmployee).map(([userId, employeeData]) => (
                <Card key={userId}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {employeeData.employeeName}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {employeeData.records.length} registro(s) de ponto
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {employeeData.records.map((record) => (
                        <div key={record.recordId} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium">
                              {format(new Date(record.date + 'T00:00:00'), 'dd/MM/yyyy')}
                            </h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <h5 className="font-medium text-sm text-gray-700 mb-1">Entrada</h5>
                              <p className="text-sm mb-2">{record.clockInTime || '-'}</p>
                              {renderLocationInfo(record.clockInLocation)}
                            </div>
                            
                            <div>
                              <h5 className="font-medium text-sm text-gray-700 mb-1">Saída Almoço</h5>
                              <p className="text-sm mb-2">{record.lunchStartTime || '-'}</p>
                              {renderLocationInfo(record.lunchStartLocation)}
                            </div>
                            
                            <div>
                              <h5 className="font-medium text-sm text-gray-700 mb-1">Volta Almoço</h5>
                              <p className="text-sm mb-2">{record.lunchEndTime || '-'}</p>
                              {renderLocationInfo(record.lunchEndLocation)}
                            </div>
                            
                            <div>
                              <h5 className="font-medium text-sm text-gray-700 mb-1">Saída</h5>
                              <p className="text-sm mb-2">{record.clockOutTime || '-'}</p>
                              {renderLocationInfo(record.clockOutLocation)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500 py-12">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                     {activeEmployees.length === 0
                      ? 'Nenhum funcionário ativo cadastrado'
                      : 'Nenhum registro de ponto encontrado'
                    }
                  </h3>
                  <p className="text-sm">
                     {activeEmployees.length === 0
                      ? 'Cadastre funcionários ativos para ver os registros de ponto e localização'
                      : selectedEmployee === 'all'
                        ? 'Nenhum registro de ponto encontrado para todos os funcionários ativos.'
                        : `Nenhum registro de ponto encontrado para o funcionário selecionado.`
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

export default LocationReport;
