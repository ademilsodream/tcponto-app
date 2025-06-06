import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { CalendarIcon, LogOut, Users, BarChart3, FileText, MapPin, Clock, Menu, Edit, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import TimeRegistration from '@/components/TimeRegistration';
import GlobalCurrencySelector from '@/components/GlobalCurrencySelector';
import AdminPanel from '@/components/AdminPanel';
import PayrollReport from '@/components/PayrollReport';
import DetailedTimeReport from '@/components/DetailedTimeReport';
import LocationReport from '@/components/LocationReport';
import AutoDeObras from '@/components/AutoDeObras';
import MonthlyControl from '@/components/MonthlyControl';
import EmployeeMonthlySummary from '@/components/EmployeeMonthlySummary';
import IncompleteRecordsProfile from '@/components/IncompleteRecordsProfile';
import EmployeeDetailedReport from '@/components/EmployeeDetailedReport';
import AdjustPreviousDays from '@/components/AdjustPreviousDays';
import EmployeeDrawer from '@/components/EmployeeDrawer';
import HourBankDetailedView from '@/components/HourBankDetailedView';
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
  const [employeeActiveScreen, setEmployeeActiveScreen] = useState('timeRegistration');
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
      case 'autoDeObras':
        return <AutoDeObras employees={employees} onBack={() => setActiveTab('adminDashboard')} />;
      case 'hourBank':
        return <HourBankDetailedView employees={employees} />;
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

  // Layout para funcionário comum - Com o drawer lateral
  if (!isAdmin) {
    return (
      <div className="relative w-full min-h-screen bg-gray-50">
        {/* Drawer/Menu lateral */}
        <EmployeeDrawer 
          activeScreen={employeeActiveScreen}
          onScreenChange={setEmployeeActiveScreen}
        />

        {/* Conteúdo principal */}
        <div className="w-full min-h-screen">
          {renderEmployeeContent()}
        </div>
      </div>
    );
  }

  // Layout para Admin - mantém os menus superiores
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 w-full">
      {/* Navigation Tabs - apenas para Admin */}
      <div className="bg-white border-b w-full">
        <div className="w-full px-4">
          <nav className="flex space-x-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab('adminDashboard')}
              className={`flex items-center px-2 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'adminDashboard'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 mr-1" />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('monthlyControl')}
              className={`flex items-center px-2 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'monthlyControl'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4 mr-1" />
              Fechamento
            </button>

            <button
              onClick={() => setActiveTab('payrollReport')}
              className={`flex items-center px-2 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'payrollReport'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4 mr-1" />
              Folha
            </button>

            <button
              onClick={() => setActiveTab('detailedReport')}
              className={`flex items-center px-2 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'detailedReport'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Detalhamento
            </button>

            <button
              onClick={() => setActiveTab('locationReport')}
              className={`flex items-center px-2 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'locationReport'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MapPin className="w-4 h-4 mr-1" />
              Localização
            </button>

            <button
              onClick={() => setActiveTab('autoDeObras')}
              className={`flex items-center px-2 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'autoDeObras'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Building2 className="w-4 h-4 mr-1" />
              Alocação
            </button>

            <button
              onClick={() => setActiveTab('hourBank')}
              className={`flex items-center px-2 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'hourBank'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Clock className="w-4 h-4 mr-1" />
              Banco de Horas
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