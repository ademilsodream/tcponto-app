
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('AdminPanel: Iniciando carregamento...');
    
    try {
      // Carregar funcionários
      const savedEmployees = localStorage.getItem('tcponto_employees');
      if (savedEmployees) {
        const parsedEmployees = JSON.parse(savedEmployees);
        console.log('AdminPanel: Funcionários encontrados:', parsedEmployees.length);
        setEmployees(parsedEmployees);
      } else {
        console.log('AdminPanel: Criando funcionários de exemplo...');
        // Criar funcionários de exemplo
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
      
      setLoading(false);
    } catch (err) {
      console.error('AdminPanel: Erro ao carregar dados:', err);
      setError('Erro ao carregar dados do painel administrativo');
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p>Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Tentar novamente
          </Button>
        </Alert>
      </div>
    );
  }

  const renderContent = () => {
    console.log('AdminPanel: Renderizando aba:', activeTab);
    
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
                  <div className="text-2xl font-bold">{employees.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{employees.length}</div>
                  <Badge variant="secondary" className="mt-1">
                    Todos ativos
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Registros Mês</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {employees.reduce((total, emp) => {
                      const records = localStorage.getItem(`tcponto_records_${emp.id}`);
                      if (records) {
                        const parsedRecords = JSON.parse(records);
                        const currentMonth = new Date().getMonth();
                        const currentYear = new Date().getFullYear();
                        
                        return total + parsedRecords.filter((r: any) => {
                          const recordDate = new Date(r.date);
                          return recordDate.getMonth() === currentMonth && 
                                 recordDate.getFullYear() === currentYear;
                        }).length;
                      }
                      return total;
                    }, 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Valor Médio/Hora</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {employees.length > 0 
                      ? (employees.reduce((sum, emp) => sum + emp.hourlyRate, 0) / employees.length).toFixed(2)
                      : '0.00'
                    }
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Funcionários */}
            <Card>
              <CardHeader>
                <CardTitle>Funcionários Cadastrados</CardTitle>
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
              className="flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Aprovações
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
