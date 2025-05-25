
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Clock, Settings, FileText, MapPin, DollarSign, UserPlus, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import AdminDashboard from './AdminDashboard';
import PendingApprovals from './PendingApprovals';
import PayrollReport from './PayrollReport';
import DetailedTimeReport from './DetailedTimeReport';
import LocationReport from './LocationReport';
import UserManagement from './UserManagement';
import MonthlyControl from './MonthlyControl';
import GlobalCurrencySelector from './GlobalCurrencySelector';

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
  const [activeTab, setActiveTab] = useState('dashboard');

  // Carregar lista de funcionários
  const getEmployees = (): User[] => {
    const savedUsers = localStorage.getItem('tcponto_users');
    if (savedUsers) {
      return JSON.parse(savedUsers);
    }
    return [];
  };

  const employees = getEmployees();

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard employees={employees} />;
      case 'users':
        return <UserManagement employees={employees} />;
      case 'approvals':
        return <PendingApprovals employees={employees} />;
      case 'payroll':
        return <PayrollReport employees={employees} onBack={() => setActiveTab('dashboard')} />;
      case 'detailed':
        return <DetailedTimeReport employees={employees} onBack={() => setActiveTab('dashboard')} />;
      case 'locations':
        return <LocationReport employees={employees} />;
      case 'monthly':
        return <MonthlyControl employees={employees} />;
      default:
        return <AdminDashboard employees={employees} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
            
            <GlobalCurrencySelector />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Usuários
            </button>
            
            <button
              onClick={() => setActiveTab('approvals')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'approvals'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="w-4 h-4 mr-2" />
              Aprovações
            </button>

            <button
              onClick={() => setActiveTab('payroll')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'payroll'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Folha de Pagamento
            </button>

            <button
              onClick={() => setActiveTab('detailed')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'detailed'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4 mr-2" />
              Relatório Detalhado
            </button>

            <button
              onClick={() => setActiveTab('locations')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'locations'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Localizações
            </button>

            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'monthly'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Controle Mensal
            </button>
          </nav>
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminPanel;
