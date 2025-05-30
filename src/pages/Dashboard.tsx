
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, LogOut, Users, BarChart3, FileText, MapPin, Clock, Menu, ChevronDown, ChevronRight, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import TimeRegistration from '@/components/TimeRegistration';
import GlobalCurrencySelector from '@/components/GlobalCurrencySelector';
import AdminPanel from '@/components/AdminPanel';
import PayrollReport from '@/components/PayrollReport';
import DetailedTimeReport from '@/components/DetailedTimeReport';
import LocationReport from '@/components/LocationReport';
import MonthlyControl from '@/components/MonthlyControl';
import EmployeeMonthlySummary from '@/components/EmployeeMonthlySummary';
import IncompleteRecordsProfile from '@/components/IncompleteRecordsProfile';
import EmployeeDetailedReport from '@/components/EmployeeDetailedReport';
import AdjustPreviousDays from '@/components/AdjustPreviousDays';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
}

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('adminDashboard');
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [employeeActiveScreen, setEmployeeActiveScreen] = useState('timeRegistration');
  const [reportsSubmenuOpen, setReportsSubmenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'admin') {
      loadEmployees();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (error) throw error;

      console.log('Dados brutos dos perfis:', data);

      const formattedEmployees = data.map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as 'admin' | 'user',
        hourlyRate: Number(profile.hourly_rate),
        overtimeRate: Number(profile.hourly_rate) * 1.5
      }));

      console.log('Funcionários formatados:', formattedEmployees);
      setEmployees(formattedEmployees);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';
  const userName = user?.name || user?.email || 'Usuário';

  const renderTabContent = () => {
    if (loading) {
      return <div>Carregando...</div>;
    }

    switch (activeTab) {
      case 'adminDashboard':
        return <AdminPanel />;
      case 'monthlyControl':
        return <MonthlyControl employees={employees} />;
      case 'payrollReport':
        return <PayrollReport employees={employees} onBack={() => setActiveTab('adminDashboard')} />;
      case 'detailedReport':
        return <DetailedTimeReport employees={employees} onBack={() => setActiveTab('adminDashboard')} />;
      case 'locationReport':
        return <LocationReport employees={employees} />;
      default:
        return <AdminPanel />;
    }
  };

  const renderEmployeeContent = () => {
    switch (employeeActiveScreen) {
      case 'timeRegistration':
        return <TimeRegistration />;
      case 'monthlySummary':
        return (
          <EmployeeMonthlySummary 
            selectedMonth={selectedDate}
            onShowDetailedReport={() => setEmployeeActiveScreen('detailedReport')}
            onBack={() => setEmployeeActiveScreen('timeRegistration')} 
          />
        );
      case 'detailedReport':
        return (
          <EmployeeDetailedReport 
            selectedMonth={selectedDate}
            onBack={() => setEmployeeActiveScreen('timeRegistration')} 
          />
        );
      case 'incompleteRecords':
        return <IncompleteRecordsProfile onBack={() => setEmployeeActiveScreen('timeRegistration')} />;
      case 'adjustPreviousDays':
        return <AdjustPreviousDays onBack={() => setEmployeeActiveScreen('timeRegistration')} />;
      default:
        return <TimeRegistration />;
    }
  };

  // Layout para funcionário comum - apenas ícone do menu e conteúdo
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 w-full flex">
        {/* Sidebar para funcionário */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white shadow-lg transition-all duration-300 flex flex-col border-r`}>
          <div className="p-4 border-b">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center p-2 hover:bg-gray-100 rounded"
            >
              {sidebarOpen ? (
                <div className="flex items-center gap-2">
                  <img 
                    src="/lovable-uploads/669270b6-ec43-4161-8f51-34a39fc1b06f.png" 
                    alt="TCPonto Logo" 
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="font-semibold text-gray-800">TCPonto</span>
                </div>
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>

          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {/* Registro de Ponto - Principal/Ativo */}
              <button 
                onClick={() => setEmployeeActiveScreen('timeRegistration')}
                className={`w-full flex items-center gap-3 p-3 text-left hover:bg-blue-50 rounded-lg ${
                  employeeActiveScreen === 'timeRegistration' ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                <Clock className="w-5 h-5 text-blue-600" />
                {sidebarOpen && <span className="text-blue-700 font-medium">Registro de Ponto</span>}
              </button>
              
              {/* Relatórios com submenu */}
              <div>
                <button 
                  onClick={() => setReportsSubmenuOpen(!reportsSubmenuOpen)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-100 rounded-lg"
                >
                  <BarChart3 className="w-5 h-5 text-gray-600" />
                  {sidebarOpen && (
                    <>
                      <span className="text-gray-700 flex-1">Relatórios</span>
                      {reportsSubmenuOpen ? (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      )}
                    </>
                  )}
                </button>
                
                {reportsSubmenuOpen && sidebarOpen && (
                  <div className="ml-6 mt-1 space-y-1">
                    <button
                      onClick={() => setEmployeeActiveScreen('monthlySummary')}
                      className={`w-full flex items-center gap-2 p-2 text-left hover:bg-gray-100 rounded text-sm ${
                        employeeActiveScreen === 'monthlySummary' ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
                      }`}
                    >
                      Resumo Mensal
                    </button>
                    <button
                      onClick={() => setEmployeeActiveScreen('detailedReport')}
                      className={`w-full flex items-center gap-2 p-2 text-left hover:bg-gray-100 rounded text-sm ${
                        employeeActiveScreen === 'detailedReport' ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
                      }`}
                    >
                      Relatório Detalhado
                    </button>
                    <button
                      onClick={() => setEmployeeActiveScreen('incompleteRecords')}
                      className={`w-full flex items-center gap-2 p-2 text-left hover:bg-gray-100 rounded text-sm ${
                        employeeActiveScreen === 'incompleteRecords' ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
                      }`}
                    >
                      Registros Incompletos
                    </button>
                    <button
                      onClick={() => setEmployeeActiveScreen('adjustPreviousDays')}
                      className={`w-full flex items-center gap-2 p-2 text-left hover:bg-gray-100 rounded text-sm ${
                        employeeActiveScreen === 'adjustPreviousDays' ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
                      }`}
                    >
                      <Edit className="w-3 h-3" />
                      Ajustar dias anteriores
                    </button>
                  </div>
                )}
              </div>
            </div>
          </nav>

          {/* Menu Sair na parte inferior */}
          <div className="p-4 border-t">
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-red-50 rounded-lg text-red-600"
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span>Sair</span>}
            </button>
          </div>
        </div>

        {/* Conteúdo principal para funcionário - SEM HEADER */}
        <main className="flex-1">
          {renderEmployeeContent()}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 w-full">
      {/* Navigation Tabs - apenas para Admin */}
      <div className="bg-white border-b w-full">
        <div className="w-full px-6">
          <nav className="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('adminDashboard')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'adminDashboard'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('monthlyControl')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'monthlyControl'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Controle Mensal
            </button>

            <button
              onClick={() => setActiveTab('payrollReport')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'payrollReport'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4 mr-2" />
              Folha de Pagamento
            </button>

            <button
              onClick={() => setActiveTab('detailedReport')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'detailedReport'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Relatório Detalhado
            </button>

            <button
              onClick={() => setActiveTab('locationReport')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'locationReport'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Relatório de Localização
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content para Admin */}
      <main className="w-full px-6 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default Dashboard;
