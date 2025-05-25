
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');

  // Gerar dados de exemplo simples
  const locationData = useMemo(() => {
    if (!employees || employees.length === 0) {
      return [];
    }

    const sampleData: LocationData[] = [];
    const addresses = [
      "Rua das Flores, 123 - Centro, São Paulo, SP",
      "Av. Paulista, 1578 - Bela Vista, São Paulo, SP", 
      "Rua Augusta, 456 - Consolação, São Paulo, SP",
      "Rua Oscar Freire, 789 - Jardins, São Paulo, SP"
    ];

    employees.forEach((employee, index) => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      // Dados para hoje
      sampleData.push({
        employeeName: employee.name,
        date: today.toISOString().split('T')[0],
        type: 'Entrada',
        time: '08:00',
        address: addresses[index % addresses.length],
        coordinates: '-23.5505, -46.6333'
      });
      
      sampleData.push({
        employeeName: employee.name,
        date: today.toISOString().split('T')[0],
        type: 'Saída',
        time: '17:00',
        address: addresses[(index + 1) % addresses.length],
        coordinates: '-23.5489, -46.6388'
      });

      // Dados para ontem
      sampleData.push({
        employeeName: employee.name,
        date: yesterday.toISOString().split('T')[0],
        type: 'Entrada',
        time: '08:15',
        address: addresses[(index + 2) % addresses.length],
        coordinates: '-23.5520, -46.6350'
      });
      
      sampleData.push({
        employeeName: employee.name,
        date: yesterday.toISOString().split('T')[0],
        type: 'Saída',
        time: '17:30',
        address: addresses[(index + 3) % addresses.length],
        coordinates: '-23.5470, -46.6400'
      });
    });

    return sampleData;
  }, [employees]);

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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  console.log('LocationReport renderizado com:', {
    employeesCount: employees.length,
    locationDataCount: locationData.length,
    filteredDataCount: filteredData.length
  });

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
                      {filteredData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {new Date(item.date).toLocaleDateString('pt-BR')}
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
                      : 'Os registros de localização aparecerão aqui'
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
