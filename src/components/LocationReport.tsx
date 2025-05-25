
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, Calendar, User, Search, Download, ArrowLeft } from 'lucide-react';
import CurrencySelector from './CurrencySelector';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

interface TimeRecord {
  id: string;
  date: string;
  clockIn?: string;
  lunchStart?: string;
  lunchEnd?: string;
  clockOut?: string;
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  normalPay: number;
  overtimePay: number;
  totalPay: number;
  locations?: {
    clockIn?: { lat: number; lng: number; address: string; timestamp: string };
    lunchStart?: { lat: number; lng: number; address: string; timestamp: string };
    lunchEnd?: { lat: number; lng: number; address: string; timestamp: string };
    clockOut?: { lat: number; lng: number; address: string; timestamp: string };
  };
  employeeId?: string;
  employeeName?: string;
}

interface LocationReportProps {
  employees: User[];
  onBack?: () => void;
}

const LocationReport: React.FC<LocationReportProps> = ({ employees, onBack }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [currency, setCurrency] = useState<'EUR' | 'BRL'>('EUR');

  const getAllRecords = (): TimeRecord[] => {
    const allRecords: TimeRecord[] = [];
    
    console.log('Carregando registros para funcionários:', employees);
    
    employees.forEach(employee => {
      const savedRecords = localStorage.getItem(`tcponto_records_${employee.id}`);
      console.log(`Registros para ${employee.name}:`, savedRecords);
      
      if (savedRecords) {
        try {
          const records = JSON.parse(savedRecords) as TimeRecord[];
          records.forEach(record => {
            allRecords.push({
              ...record,
              employeeId: employee.id,
              employeeName: employee.name
            });
          });
        } catch (error) {
          console.error(`Erro ao carregar registros do funcionário ${employee.name}:`, error);
        }
      }
    });

    console.log('Total de registros carregados:', allRecords.length);
    return allRecords;
  };

  const filteredRecords = useMemo(() => {
    let records = getAllRecords();

    console.log('Registros antes do filtro:', records.length);

    // Filtrar por funcionário
    if (selectedEmployee) {
      records = records.filter(record => record.employeeId === selectedEmployee);
      console.log('Após filtro por funcionário:', records.length);
    }

    // Filtrar por data específica
    if (selectedDate) {
      records = records.filter(record => record.date === selectedDate);
      console.log('Após filtro por data específica:', records.length);
    }

    // Filtrar por período
    if (dateRange.start && dateRange.end) {
      records = records.filter(record => {
        const recordDate = new Date(record.date);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        return recordDate >= startDate && recordDate <= endDate;
      });
      console.log('Após filtro por período:', records.length);
    }

    // Filtrar apenas registros com localização
    records = records.filter(record => {
      const hasLocations = record.locations && Object.keys(record.locations).length > 0;
      return hasLocations;
    });

    console.log('Após filtro de localização:', records.length);

    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedEmployee, selectedDate, dateRange, employees]);

  const getLocationDetails = (record: TimeRecord) => {
    const details: Array<{
      type: string;
      time: string;
      location: { lat: number; lng: number; address: string; timestamp: string };
    }> = [];

    if (record.clockIn && record.locations?.clockIn) {
      details.push({ type: 'Entrada', time: record.clockIn, location: record.locations.clockIn });
    }
    if (record.lunchStart && record.locations?.lunchStart) {
      details.push({ type: 'Início Almoço', time: record.lunchStart, location: record.locations.lunchStart });
    }
    if (record.lunchEnd && record.locations?.lunchEnd) {
      details.push({ type: 'Fim Almoço', time: record.lunchEnd, location: record.locations.lunchEnd });
    }
    if (record.clockOut && record.locations?.clockOut) {
      details.push({ type: 'Saída', time: record.clockOut, location: record.locations.clockOut });
    }

    return details;
  };

  const exportToCSV = () => {
    const csvData: string[] = ['Data,Funcionário,Tipo,Horário,Latitude,Longitude,Endereço'];
    
    filteredRecords.forEach(record => {
      const employeeName = record.employeeName || 'N/A';
      const locationDetails = getLocationDetails(record);
      
      locationDetails.forEach(detail => {
        csvData.push([
          new Date(record.date).toLocaleDateString('pt-BR'),
          employeeName,
          detail.type,
          detail.time,
          detail.location.lat.toString(),
          detail.location.lng.toString(),
          `"${detail.location.address}"`
        ].join(','));
      });
    });

    const blob = new Blob([csvData.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_localizacoes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSelectedEmployee('');
    setSelectedDate('');
    setDateRange({ start: '', end: '' });
  };

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
                <h1 className="text-xl font-semibold text-primary-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Relatório de Localizações
                </h1>
                <p className="text-sm text-gray-600">Visualize onde os funcionários registraram seus horários</p>
              </div>
            </div>
            
            <CurrencySelector currency={currency} onCurrencyChange={setCurrency} />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Filtros de Busca
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Funcionário</label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os funcionários" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg z-50">
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
                  <label className="text-sm font-medium">Data Específica</label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Início</label>
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Fim</label>
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ações</label>
                  <div className="flex gap-2">
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      size="sm"
                    >
                      <Search className="w-4 h-4 mr-1" />
                      Limpar
                    </Button>
                    <Button
                      onClick={exportToCSV}
                      variant="outline"
                      size="sm"
                      disabled={filteredRecords.length === 0}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      CSV
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                {filteredRecords.length} registro(s) encontrado(s) com localização
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registros de Localização</CardTitle>
            </CardHeader>
            <CardContent>
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
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map(record => {
                        const locationDetails = getLocationDetails(record);
                        return locationDetails.map((detail, index) => (
                          <TableRow key={`${record.id}-${index}`}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(record.date).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {record.employeeName}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                detail.type === 'Entrada' ? 'bg-green-100 text-green-800' :
                                detail.type === 'Saída' ? 'bg-red-100 text-red-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {detail.type}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {detail.time}
                            </TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {detail.location.lat.toFixed(6)}, {detail.location.lng.toFixed(6)}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <span title={detail.location.address} className="truncate block">
                                {detail.location.address}
                              </span>
                            </TableCell>
                          </TableRow>
                        ));
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          <div className="flex flex-col items-center gap-2">
                            <MapPin className="w-8 h-8 text-gray-300" />
                            <span>Nenhum registro com localização encontrado</span>
                            <span className="text-xs">
                              {employees.length === 0 
                                ? 'Nenhum funcionário cadastrado' 
                                : 'Aplique filtros ou verifique se há registros com GPS'
                              }
                            </span>
                          </div>
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
