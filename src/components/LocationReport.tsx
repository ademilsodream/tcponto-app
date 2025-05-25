
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, ArrowLeft, Search } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

interface LocationData {
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

const LocationReport: React.FC<LocationReportProps> = ({ employees, onBack }) => {
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [filteredData, setFilteredData] = useState<LocationData[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Endereços de exemplo para demonstração
  const sampleAddresses = [
    "Rua das Flores, 123 - Centro, São Paulo, SP",
    "Av. Paulista, 1578 - Bela Vista, São Paulo, SP", 
    "Rua Augusta, 456 - Consolação, São Paulo, SP",
    "Av. Faria Lima, 789 - Itaim Bibi, São Paulo, SP",
    "Rua Oscar Freire, 321 - Jardins, São Paulo, SP",
    "Av. Brigadeiro Faria Lima, 654 - Vila Olímpia, São Paulo, SP"
  ];

  const generateSampleLocationData = () => {
    const data: LocationData[] = [];
    const today = new Date();
    
    employees.forEach(employee => {
      // Gerar dados para os últimos 7 dias
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Gerar coordenadas aleatórias (região de São Paulo)
        const lat = -23.5505 + (Math.random() - 0.5) * 0.1;
        const lng = -46.6333 + (Math.random() - 0.5) * 0.1;
        
        // Entrada
        data.push({
          employeeName: employee.name,
          date: dateStr,
          type: 'Entrada',
          time: '08:00',
          address: sampleAddresses[Math.floor(Math.random() * sampleAddresses.length)],
          coordinates: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        });
        
        // Saída para almoço
        data.push({
          employeeName: employee.name,
          date: dateStr,
          type: 'Início Almoço',
          time: '12:00',
          address: sampleAddresses[Math.floor(Math.random() * sampleAddresses.length)],
          coordinates: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        });
        
        // Retorno do almoço
        data.push({
          employeeName: employee.name,
          date: dateStr,
          type: 'Fim Almoço', 
          time: '13:00',
          address: sampleAddresses[Math.floor(Math.random() * sampleAddresses.length)],
          coordinates: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        });
        
        // Saída
        data.push({
          employeeName: employee.name,
          date: dateStr,
          type: 'Saída',
          time: '17:00',
          address: sampleAddresses[Math.floor(Math.random() * sampleAddresses.length)],
          coordinates: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        });
      }
    });
    
    return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  useEffect(() => {
    console.log('LocationReport: Carregando dados de localização...');
    console.log('LocationReport: Funcionários recebidos:', employees);
    
    try {
      if (employees && employees.length > 0) {
        const data = generateSampleLocationData();
        console.log('LocationReport: Dados de localização gerados:', data.length, 'registros');
        setLocationData(data);
        setFilteredData(data);
      } else {
        console.log('LocationReport: Nenhum funcionário encontrado');
        setLocationData([]);
        setFilteredData([]);
      }
    } catch (error) {
      console.error('LocationReport: Erro ao gerar dados:', error);
      setLocationData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  }, [employees]);

  useEffect(() => {
    console.log('LocationReport: Aplicando filtro por funcionário:', selectedEmployee);
    
    if (selectedEmployee) {
      const filtered = locationData.filter(item => {
        const employee = employees.find(emp => emp.id === selectedEmployee);
        return employee && item.employeeName === employee.name;
      });
      console.log('LocationReport: Dados filtrados:', filtered.length, 'registros');
      setFilteredData(filtered);
    } else {
      setFilteredData(locationData);
    }
  }, [selectedEmployee, locationData, employees]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Entrada':
        return 'bg-green-100 text-green-800';
      case 'Saída':
        return 'bg-red-100 text-red-800';
      case 'Início Almoço':
        return 'bg-orange-100 text-orange-800';
      case 'Fim Almoço':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p>Carregando relatório de localizações...</p>
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
                <h1 className="text-xl font-semibold text-primary-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Relatório de Localizações
                </h1>
                <p className="text-sm text-gray-600">Visualize onde os funcionários registraram seus horários</p>
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
                  <label className="text-sm font-medium">Total de Registros</label>
                  <div className="text-2xl font-bold text-primary-900">
                    {filteredData.length}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Funcionários Ativos</label>
                  <div className="text-2xl font-bold text-primary-900">
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
                      {filteredData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(item.date).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.employeeName}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getTypeColor(item.type)}`}>
                              {item.type}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {item.time}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {item.coordinates}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <span title={item.address} className="truncate block">
                              {item.address}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum registro encontrado</h3>
                  <p className="text-sm">
                    {employees.length === 0 
                      ? 'Nenhum funcionário cadastrado no sistema'
                      : selectedEmployee 
                        ? 'Nenhum registro de localização para o funcionário selecionado'
                        : 'Nenhum registro de localização disponível'
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
