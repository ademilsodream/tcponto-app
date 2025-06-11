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
import { CalendarIcon, LogOut, Users, BarChart3, FileText, MapPin, Clock, Menu, Edit, Building2, ChevronLeft, ChevronRight, User } from 'lucide-react';
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
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
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

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  userName: string;
  onSignOut: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isCollapsed, 
  setIsCollapsed, 
  userName, 
  onSignOut 
}) => {
  const menuItems = [
    {
      id: 'adminDashboard',
      label: 'Dashboard',
      icon: Users,
      description: 'Visão geral do sistema'
    },
    {
      id: 'monthlyControl',
      label: 'Fechamento',
      icon: CalendarIcon,
      description: 'Controle mensal'
    },
    {
      id: 'payrollReport',
      label: 'Folha de Pagamento',
      icon: FileText,
      description: 'Relatórios de folha'
    },
    {
      id: 'detailedReport',
      label: 'Detalhamento',
      icon: BarChart3,
      description: 'Relatórios detalhados'
    },
    {
      id: 'locationReport',
      label: 'Localização',
      icon: MapPin,
      description: 'Controle de localização'
    },
    {
      id: 'autoDeObras',
      label: 'Alocação',
      icon: Building2,
      description: 'Gestão de obras'
    },
    {
      id: 'hourBank',
      label: 'Banco de Horas',
      icon: Clock,
      description: 'Controle de horas'
    }
  ];

  return (
    <div className={cn(
      "fixed left-0 top-0 h-full bg-white border-r border-gray-200 shadow-lg transition-all duration-300 z-50",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header do Sidebar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">TimeClock</h2>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Profile Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary-600" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userName}
              </p>
              <p className="text-xs text-gray-500">Administrador</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center px-3 py-3 rounded-lg text-left transition-colors duration-200 group",
                isActive 
                  ? "bg-primary-100 text-primary-700 border border-primary-200" 
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={cn(
                "w-5 h-5 flex-shrink-0",
                isActive ? "text-primary-600" : "text-gray-400"
              )} />
              {!isCollapsed && (
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {item.description}
                  </p>
                </div>
              )}
              {isActive && !isCollapsed && (
                <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer - Sign Out */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onSignOut}
          className={cn(
            "w-full flex items-center px-3 py-3 rounded-lg text-left transition-colors duration-200",
            "text-red-600 hover:bg-red-50 hover:text-red-700"
          )}
          title={isCollapsed ? 'Sair' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && (
            <span className="ml-3 text-sm font-medium">
              Sair
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('adminDashboard');
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeActiveScreen, setEmployeeActiveScreen] = useState('timeRegistration');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user, profile } = useOptimizedAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadEmployees();
    } else {
      setLoading(false);
    }
  }, [profile]);

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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const userName = profile?.name || user?.email || 'Usuário';

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-gray-600">Carregando...</span>
        </div>
      );
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

  // Layout para funcionário comum - Com o drawer lateral (mantém como estava)
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

  // Layout para Admin - Novo layout com sidebar
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        userName={userName}
        onSignOut={handleSignOut}
      />

      {/* Main Content */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        isSidebarCollapsed ? "ml-16" : "ml-64"
      )}>
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {(() => {
                  switch (activeTab) {
                    case 'adminDashboard': return 'Dashboard Administrativo';
                    case 'monthlyControl': return 'Controle Mensal';
                    case 'payrollReport': return 'Folha de Pagamento';
                    case 'detailedReport': return 'Relatórios Detalhados';
                    case 'locationReport': return 'Controle de Localização';
                    case 'autoDeObras': return 'Alocação de Obras';
                    case 'hourBank': return 'Banco de Horas';
                    default: return 'Dashboard';
                  }
                })()}
              </h1>
              <p className="text-gray-600 mt-1">
                {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <GlobalCurrencySelector />
              <div className="text-sm text-gray-600">
                Olá, <span className="font-medium">{userName}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;