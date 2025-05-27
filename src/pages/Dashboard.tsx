import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, LogOut, Users, BarChart3, FileText, MapPin, Clock, AlertCircle, TrendingUp, Home } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('adminDashboard');
  const [activeEmployeeView, setActiveEmployeeView] = useState('timeRegistration');
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
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

      const formattedEmployees = data.map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as 'admin' | 'employee',
        hourlyRate: Number(profile.hourly_rate),
        overtimeRate: Number(profile.hourly_rate) * 1.5
      }));

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
    switch (activeEmployeeView) {
      case 'timeRegistration':
        return (
          <TimeRegistration 
            selectedDate={format(selectedDate, 'yyyy-MM-dd')}
          />
        );
      case 'incompleteRecords':
        return (
          <IncompleteRecordsProfile 
            onBack={() => setActiveEmployeeView('timeRegistration')}
          />
        );
      case 'monthlySummary':
        return (
          <EmployeeMonthlySummary 
            selectedMonth={selectedDate}
            onShowDetailedReport={() => setActiveEmployeeView('detailedReport')}
            onBack={() => setActiveEmployeeView('timeRegistration')}
          />
        );
      case 'detailedReport':
        return (
          <EmployeeDetailedReport 
            selectedMonth={selectedDate}
            onBack={() => setActiveEmployeeView('monthlySummary')}
          />
        );
      default:
        return (
          <TimeRegistration 
            selectedDate={format(selectedDate, 'yyyy-MM-dd')}
          />
        );
    }
  };

  // Layout para funcionário comum com sidebar
  if (!isAdmin) {
    return (
      <SidebarProvider>
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex w-full">
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Menu</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        onClick={() => setActiveEmployeeView('timeRegistration')}
                        isActive={activeEmployeeView === 'timeRegistration'}
                      >
                        <Home className="w-4 h-4" />
                        <span>Dashboard Principal</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        onClick={() => setActiveEmployeeView('incompleteRecords')}
                        isActive={activeEmployeeView === 'incompleteRecords'}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>Registros Incompletos</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        onClick={() => setActiveEmployeeView('monthlySummary')}
                        isActive={activeEmployeeView === 'monthlySummary'}
                      >
                        <TrendingUp className="w-4 h-4" />
                        <span>Resumo Mensal</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {activeEmployeeView === 'timeRegistration' && (
                <SidebarGroup>
                  <SidebarGroupLabel>Seleção de Data</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <div className="p-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal text-xs",
                              !selectedDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {selectedDate ? (
                              format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione uma data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            initialFocus
                            locale={ptBR}
                            disabled={(date) => {
                              const today = new Date();
                              const currentMonth = today.getMonth();
                              const currentYear = today.getFullYear();
                              
                              if (date >= today) return true;
                              
                              return date.getMonth() !== currentMonth || date.getFullYear() !== currentYear;
                            }}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>

                      <div className="mt-4 p-3 bg-accent-50 rounded-lg">
                        <h4 className="font-medium text-accent-900 mb-1 text-xs">Data Selecionada</h4>
                        <p className="text-accent-700 text-xs">
                          {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarContent>
          </Sidebar>

          <SidebarInset>
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center space-x-4">
                    <SidebarTrigger />
                    <img 
                      src="/lovable-uploads/e1cebe67-0124-4b20-8434-701ca5a10612.png" 
                      alt="TCPonto Logo" 
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <h1 className="text-xl font-semibold text-primary-900">TCPonto</h1>
                      <p className="text-sm text-gray-600 hidden sm:block">Sistema de Controle de Ponto</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 text-sm">
                      <span className="text-gray-600 text-xs sm:text-sm">Olá,</span>
                      <span className="text-gray-900 font-medium text-xs sm:text-sm truncate max-w-24 sm:max-w-none">{userName}</span>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleSignOut}>
                      <LogOut className="w-4 h-4" />
                      <span className="hidden sm:inline">Sair</span>
                    </Button>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content para Funcionário */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
              {renderEmployeeContent()}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img 
                src="/lovable-uploads/e1cebe67-0124-4b20-8434-701ca5a10612.png" 
                alt="TCPonto Logo" 
                className="w-10 h-10 rounded-full"
              />
              <div>
                <h1 className="text-xl font-semibold text-primary-900">TCPonto</h1>
                <p className="text-sm text-gray-600">Sistema de Controle de Ponto</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <GlobalCurrencySelector />

              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-600">Olá, {userName}</span>
                <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-xs">Admin</span>
              </div>

              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs - apenas para Admin */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default Dashboard;
