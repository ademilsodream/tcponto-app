import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, LogOut, Users, BarChart3, FileText, MapPin, Clock } from 'lucide-react';
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

  // Layout para funcionário comum - RESTAURADO AO ORIGINAL
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 w-full">
        <main className="w-full px-6 py-8">
          <TimeRegistration />
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
