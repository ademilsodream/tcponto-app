
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import UserManagement from './UserManagement';

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
    const savedUsers = localStorage.getItem('tcponto_employees');
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
      default:
        return <AdminDashboard employees={employees} />;
    }
  };

  return (
    <div className="space-y-6">
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
            Dashboard em Tempo Real
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
            Gerenciar Usuários
          </button>
        </nav>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
};

export default AdminPanel;
