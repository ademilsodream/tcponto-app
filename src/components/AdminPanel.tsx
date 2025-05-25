import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Clock, FileText, MapPin, Calendar, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PayrollReport from './PayrollReport';
import DetailedTimeReport from './DetailedTimeReport';
import PendingApprovals from './PendingApprovals';
import LocationReport from './LocationReport';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

interface AdminPanelProps {
  onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [employees, setEmployees] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    // Carregar funcionários
    const savedEmployees = localStorage.getItem('tcponto_employees');
    if (savedEmployees) {
      setEmployees(JSON.parse(savedEmployees));
    } else {
      // Criar funcionários de exemplo se não existirem
      const sampleEmployees = [
        {
          id: 'emp1',
          name: 'Maria Silva',
          email: 'maria@empresa.com',
          role: 'employee' as const,
          hourlyRate: 15,
          overtimeRate: 22.5
        },
        {
          id: 'emp2',
          name: 'João Santos',
          email: 'joao@empresa.com',
          role: 'employee' as const,
          hourlyRate: 18,
          overtimeRate: 27
        },
        {
          id: 'emp3',
          name: 'Ana Costa',
          email: 'ana@empresa.com',
          role: 'employee' as const,
          hourlyRate: 20,
          overtimeRate: 30
        }
      ];
      
      setEmployees(sampleEmployees);
      localStorage.setItem('tcponto_employees', JSON.stringify(sampleEmployees));
    }

    // Carregar solicitações pendentes
    const savedRequests = localStorage.getItem('tcponto_edit_requests');
    if (savedRequests) {
      const requests = JSON.parse(savedRequests);
      setPendingRequests(requests.filter((req: any) => req.status === 'pending'));
    }
  }, []);

  useEffect(() => {
    // Adicionar dados de localização e registros de exemplo quando os funcionários forem carregados
    if (employees.length > 0) {
      addSampleLocationData();
    }
  }, [employees]);

  const addSampleLocationData = () => {
    const enderecos = [
      { lat: 38.7223, lng: -9.1393, address: "Av. da Liberdade, 1250-096 Lisboa, Portugal" },
      { lat: 41.1579, lng: -8.6291, address: "R. de Santa Catarina, 4000-447 Porto, Portugal" },
      { lat: -23.5505, lng: -46.6333, address: "Av. Paulista, 1578 - Bela Vista, São Paulo - SP, Brasil" },
      { lat: -22.9068, lng: -43.1729, address: "Av. Rio Branco, 1 - Centro, Rio de Janeiro - RJ, Brasil" },
      { lat: 38.7071, lng: -9.1359, address: "Praça do Comércio, 1100-148 Lisboa, Portugal" },
      { lat: 38.7077, lng: -9.1365, address: "Rua Augusta, 1100-053 Lisboa, Portugal" },
      { lat: -23.5475, lng: -46.6361, address: "Rua Oscar Freire, 2500 - Jardins, São Paulo - SP, Brasil" },
      { lat: 41.1496, lng: -8.6109, address: "Av. dos Aliados, 4000-064 Porto, Portugal" }
    ];

    employees.forEach(employee => {
      const recordsKey = `tcponto_records_${employee.id}`;
      let records = [];
      
      const savedRecords = localStorage.getItem(recordsKey);
      if (savedRecords) {
        records = JSON.parse(savedRecords);
      } else {
        // Criar registros para os últimos 20 dias do mês atual
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        for (let day = 1; day <= today.getDate(); day++) {
          const date = new Date(currentYear, currentMonth, day);
          
          // Pular fins de semana (sábado = 6, domingo = 0)
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          
          const dateString = date.toISOString().split('T')[0];
          const clockIn = `${8 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
          const lunchStart = `12:${Math.floor(Math.random() * 30).toString().padStart(2, '0')}`;
          const lunchEnd = `13:${Math.floor(Math.random() * 30).toString().padStart(2, '0')}`;
          const clockOut = `${17 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
          
          // Calcular horas trabalhadas
          const totalMinutes = (17 * 60) - (8 * 60) - 60; // 8h de trabalho menos 1h de almoço
          const totalHours = totalMinutes / 60;
          const normalHours = Math.min(totalHours, 8);
          const overtimeHours = Math.max(0, totalHours - 8);
          
          const normalPay = normalHours * employee.hourlyRate;
          const overtimePay = overtimeHours * employee.overtimeRate;
          const totalPay = normalPay + overtimePay;
          
          // Selecionar endereços aleatórios para cada registro
          const getRandomAddress = () => enderecos[Math.floor(Math.random() * enderecos.length)];
          
          const record = {
            id: `${employee.id}_${dateString}`,
            date: dateString,
            clockIn,
            lunchStart,
            lunchEnd,
            clockOut,
            totalHours: Math.round(totalHours * 100) / 100,
            normalHours: Math.round(normalHours * 100) / 100,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            normalPay: Math.round(normalPay * 100) / 100,
            overtimePay: Math.round(overtimePay * 100) / 100,
            totalPay: Math.round(totalPay * 100) / 100,
            locations: {
              clockIn: {
                ...getRandomAddress(),
                timestamp: new Date(`${dateString}T${clockIn}:00`).toISOString()
              },
              lunchStart: {
                ...getRandomAddress(),
                timestamp: new Date(`${dateString}T${lunchStart}:00`).toISOString()
              },
              lunchEnd: {
                ...getRandomAddress(),
                timestamp: new Date(`${dateString}T${lunchEnd}:00`).toISOString()
              },
              clockOut: {
                ...getRandomAddress(),
                timestamp: new Date(`${dateString}T${clockOut}:00`).toISOString()
              }
            }
          };
          
          records.push(record);
        }
      }
      
      // Garantir que todos os registros tenham localizações
      const updatedRecords = records.map((record: any) => {
        if (!record.locations) {
          const getRandomAddress = () => enderecos[Math.floor(Math.random() * enderecos.length)];
          
          record.locations = {};
          
          if (record.clockIn) {
            record.locations.clockIn = {
              ...getRandomAddress(),
              timestamp: new Date(`${record.date}T${record.clockIn}:00`).toISOString()
            };
          }
          
          if (record.lunchStart) {
            record.locations.lunchStart = {
              ...getRandomAddress(),
              timestamp: new Date(`${record.date}T${record.lunchStart}:00`).toISOString()
            };
          }
          
          if (record.lunchEnd) {
            record.locations.lunchEnd = {
              ...getRandomAddress(),
              timestamp: new Date(`${record.date}T${record.lunchEnd}:00`).toISOString()
            };
          }
          
          if (record.clockOut) {
            record.locations.clockOut = {
              ...getRandomAddress(),
              timestamp: new Date(`${record.date}T${record.clockOut}:00`).toISOString()
            };
          }
        }
        
        return record;
      });
      
      localStorage.setItem(recordsKey, JSON.stringify(updatedRecords));
    });
  };

  const totalEmployees = employees.length;
  const totalPendingRequests = pendingRequests.length;

  const renderContent = () => {
    switch (activeTab) {
      case 'payroll':
        return <PayrollReport employees={employees} onBack={() => setActiveTab('overview')} />;
      case 'detailed':
        return <DetailedTimeReport employees={employees} onBack={() => setActiveTab('overview')} />;
      case 'approvals':
        return <PendingApprovals employees={employees} />;
      case 'locations':
        return <LocationReport employees={employees} onBack={() => setActiveTab('overview')} />;
      default:
        // ... keep existing code (overview tab content)
        return (
          <div className="space-y-6">
            {/* Estatísticas Gerais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Funcionários</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalEmployees}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Solicitações Pendentes</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalPendingRequests}</div>
                  {totalPendingRequests > 0 && (
                    <Badge variant="destructive" className="mt-1">
                      Requer atenção
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Registros Hoje</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {employees.reduce((total, emp) => {
                      const todayRecords = localStorage.getItem(`tcponto_records_${emp.id}`);
                      if (todayRecords) {
                        const records = JSON.parse(todayRecords);
                        const today = new Date().toISOString().split('T')[0];
                        return total + (records.filter((r: any) => r.date === today).length > 0 ? 1 : 0);
                      }
                      return total;
                    }, 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Horas Mês</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {employees.reduce((total, emp) => {
                      const records = localStorage.getItem(`tcponto_records_${emp.id}`);
                      if (records) {
                        const parsedRecords = JSON.parse(records);
                        const currentMonth = new Date().getMonth();
                        const currentYear = new Date().getFullYear();
                        
                        return total + parsedRecords
                          .filter((r: any) => {
                            const recordDate = new Date(r.date);
                            return recordDate.getMonth() === currentMonth && 
                                   recordDate.getFullYear() === currentYear;
                          })
                          .reduce((sum: number, r: any) => sum + r.totalHours, 0);
                      }
                      return total;
                    }, 0).toFixed(1)}h
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Funcionários */}
            <Card>
              <CardHeader>
                <CardTitle>Funcionários Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {employees.map((employee) => (
                    <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{employee.name}</h3>
                        <p className="text-sm text-gray-500">{employee.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={employee.role === 'admin' ? 'default' : 'secondary'}>
                          {employee.role === 'admin' ? 'Administrador' : 'Funcionário'}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">
                          R$ {employee.hourlyRate.toFixed(2)}/h
                        </p>
                      </div>
                    </div>
                  ))}
                  {employees.length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      Nenhum funcionário cadastrado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                onClick={onBack}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-primary-900">Painel Administrativo</h1>
                <p className="text-sm text-gray-600">Gestão de funcionários e relatórios</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
            <Button
              onClick={() => setActiveTab('overview')}
              variant={activeTab === 'overview' ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Visão Geral
            </Button>
            <Button
              onClick={() => setActiveTab('payroll')}
              variant={activeTab === 'payroll' ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Folha de Pagamento
            </Button>
            <Button
              onClick={() => setActiveTab('detailed')}
              variant={activeTab === 'detailed' ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Relatório Detalhado
            </Button>
            <Button
              onClick={() => setActiveTab('locations')}
              variant={activeTab === 'locations' ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Localizações
            </Button>
            <Button
              onClick={() => setActiveTab('approvals')}
              variant={activeTab === 'approvals' ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center gap-2 relative"
            >
              <Clock className="w-4 h-4" />
              Aprovações
              {totalPendingRequests > 0 && (
                <Badge variant="destructive" className="ml-1 px-1 py-0 text-xs">
                  {totalPendingRequests}
                </Badge>
              )}
            </Button>
          </nav>
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminPanel;
